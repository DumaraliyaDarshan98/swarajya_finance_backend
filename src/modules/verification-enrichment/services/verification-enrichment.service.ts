import { Injectable, Logger } from '@nestjs/common';
import { ScrappingService } from '../../scrapping/services/scrapping.service';
import { PortalListService } from '../../portal-list/services/portal-list.service';
import type {
  ScrapePayload,
  ScrapeResultEntry,
} from '../../digital-verification/interfaces/scrape-payload.interface';
import { businessNamesMatch, normalizeDomain } from '../../digital-verification/helpers/business-verification.helper';
import {
  buildMapEmbedFromQuery,
  buildMapEmbedUrl,
  buildStreetViewEmbedUrl,
  buildStreetViewLink,
  geocodeAddress,
  joinAddressParts,
} from '../../digital-verification/helpers/address-enrichment.helper';
import {
  cascadeHintsFromGstFields,
} from '../helpers/extract-scrape-input.helper';
import {
  categoriesFromScrapeFields,
  isCategoryAllowedForOcr,
  portalCategoriesForDocumentTypes,
  type ExecutedScrapeApi,
} from '../helpers/portal-document-type.helper';
import {
  resolvePortalScrapeDefinition,
  type PortalScrapeStrategy,
} from '../../portal-list/config/portal-scrape-registry';
import type {
  EnrichmentOptions,
  EnrichmentResult,
  ScrapeInput,
} from '../interfaces/scrape-input.interface';

const FREE_EMAIL_HOSTS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.co.in',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'msn.com',
  'rediffmail.com',
  'icloud.com',
  'me.com',
  'aol.com',
  'protonmail.com',
  'proton.me',
  'mail.com',
  'ymail.com',
]);

@Injectable()
export class VerificationEnrichmentService {
  private readonly logger = new Logger(VerificationEnrichmentService.name);

  constructor(
    private readonly scrappingService: ScrappingService,
    private readonly portalListService: PortalListService,
  ) {}

  /**
   * Shared pipeline for Digital + OCR:
   * 1) Primary scrapes from entered/extracted details (all sites possible for the data)
   * 2) Cascade scrapes from primary results
   * 3) Portal catalog of related government / public sites
   *
   * Individual scrape failures are recorded on the payload; they do not abort the pipeline.
   * Pass `options.mode = 'ocr'` + `documentTypes` to filter portals and speed up OCR cases.
   */
  async enrichFromDetails(
    input: ScrapeInput,
    options?: EnrichmentOptions,
  ): Promise<EnrichmentResult> {
    const scrapePayload: ScrapePayload = {};
    const cascadeNotes: string[] = [];
    const softFailures: string[] = [];
    const executedScrapes: ExecutedScrapeApi[] = [];
    const isOcrMode = options?.mode === 'ocr';
    const documentTypes = (options?.documentTypes ?? [])
      .map((t) => String(t || '').trim())
      .filter(Boolean);

    const residential = input.residential;
    const office = input.office;
    const gstNumber = input.gstNumber?.trim().toUpperCase() || null;
    const companyName = input.companyName?.trim() || null;

    let companyDomain =
      normalizeDomain(input.companyDomain?.trim() || '') || null;
    if (!companyDomain) {
      const fromEmail = this.domainFromEmail(input.emailId);
      if (fromEmail) {
        companyDomain = fromEmail;
        cascadeNotes.push(`Domain derived from email (${fromEmail})`);
      }
    }

    // Run independent primary checks in parallel so one slow/failing site
    // does not block the others.
    const primaryTasks: Array<Promise<void>> = [];

    if (
      residential &&
      (residential.address ||
        residential.pincode ||
        residential.city ||
        residential.state)
    ) {
      primaryTasks.push(
        (async () => {
          scrapePayload.residentialAddress = await this.enrichAddressSection({
            address: residential.address,
            landmark: residential.landmark,
            city: residential.city,
            state: residential.state,
            pincode: residential.pincode,
          });
          if (!scrapePayload.residentialAddress.success) {
            softFailures.push('residential-address');
          } else {
            cascadeNotes.push('Residential address enrichment done');
          }
        })(),
      );
    }

    if (
      office &&
      (office.address || office.pincode || office.city || office.state)
    ) {
      primaryTasks.push(
        (async () => {
          scrapePayload.officeAddress = await this.enrichAddressSection({
            address: office.address,
            landmark: office.landmark,
            city: office.city,
            state: office.state,
            pincode: office.pincode,
          });
          if (!scrapePayload.officeAddress.success) {
            softFailures.push('office-address');
          } else {
            cascadeNotes.push('Office address enrichment done');
          }
        })(),
      );
    }

    if (gstNumber) {
      primaryTasks.push(
        (async () => {
          const started = Date.now();
          try {
            const res = await this.scrappingService.gstSearch(gstNumber);
            scrapePayload.gst = {
              source: 'knowyourgst',
              scrapedAt: new Date().toISOString(),
              success: true,
              data: res.data as unknown as Record<string, unknown>,
            };
            cascadeNotes.push(`GST scraped for ${gstNumber}`);
            executedScrapes.push({
              api: 'POST /scrapping/gst-search',
              name: 'GST Search',
              source: 'knowyourgst',
              success: true,
              scrapedAt: scrapePayload.gst.scrapedAt,
              durationMs: Date.now() - started,
              documentTypes,
            });
          } catch (error: any) {
            softFailures.push('gst');
            scrapePayload.gst = {
              source: 'knowyourgst',
              scrapedAt: new Date().toISOString(),
              success: false,
              error: error?.message ?? 'GST verification failed',
            };
            cascadeNotes.push(`GST scrape failed for ${gstNumber}`);
            executedScrapes.push({
              api: 'POST /scrapping/gst-search',
              name: 'GST Search',
              source: 'knowyourgst',
              success: false,
              scrapedAt: scrapePayload.gst.scrapedAt,
              error: scrapePayload.gst.error,
              durationMs: Date.now() - started,
              documentTypes,
            });
          }
        })(),
      );
    }

    if (companyDomain) {
      primaryTasks.push(
        (async () => {
          await this.scrapeWhoisIntoPayload(
            scrapePayload,
            companyDomain!,
            cascadeNotes,
            softFailures,
          );
        })(),
      );
    }

    await Promise.all(primaryTasks);

    // --- Cascade: use GST public data to hit other available scrapes ---
    if (scrapePayload.gst?.success) {
      const gstFields =
        (scrapePayload.gst.data as { fields?: Record<string, string> } | undefined)
          ?.fields ?? {};
      const hints = cascadeHintsFromGstFields(gstFields);

      if (companyName) {
        const gstLegalName =
          gstFields['Legal Name of Business'] ||
          gstFields['Legal Name'] ||
          gstFields['Trade Name'] ||
          hints.tradeName ||
          '';
        const nameMatched = businessNamesMatch(companyName, gstLegalName);
        scrapePayload.businessMatch = {
          source: 'gst-name-compare',
          scrapedAt: new Date().toISOString(),
          success: nameMatched,
          data: {
            submittedBusinessName: companyName,
            gstLegalName,
            matched: nameMatched,
          },
          error: nameMatched
            ? undefined
            : 'Submitted business name does not match GST public records',
        };
        cascadeNotes.push(
          nameMatched
            ? 'Business name matched GST legal name'
            : 'Business name mismatch vs GST (recorded as finding, report still generated)',
        );
      }

      if (
        !scrapePayload.gstDerivedAddress &&
        (hints.address || hints.pincode || hints.city || hints.state)
      ) {
        scrapePayload.gstDerivedAddress = await this.enrichAddressSection({
          address: hints.address,
          city: hints.city,
          state: hints.state,
          pincode: hints.pincode,
        });
        cascadeNotes.push(
          'Cascaded address enrichment from GST principal place of business',
        );
      }

      if (!scrapePayload.domain?.success && hints.website) {
        const derivedDomain = normalizeDomain(hints.website);
        if (derivedDomain) {
          await this.scrapeWhoisIntoPayload(
            scrapePayload,
            derivedDomain,
            cascadeNotes,
            softFailures,
            { cascadedFrom: 'gst' },
          );
        }
      }
    }

    // Portal catalog + reachability checks (OCR: type-filtered + concurrent)
    try {
      const catalog = await this.portalListService.getDigitalReportCatalog();
      const stateHint =
        input.residential?.state ||
        input.office?.state ||
        (scrapePayload.residentialAddress?.data as any)?.pincodeFields?.State ||
        (scrapePayload.gstDerivedAddress?.data as any)?.pincodeFields?.State ||
        null;

      let allowedCategories = portalCategoriesForDocumentTypes(documentTypes);
      if (isOcrMode) {
        const fromFields = categoriesFromScrapeFields({
          panNumber: input.panNumber,
          aadhaarNumber: input.aadhaarNumber,
          gstNumber: input.gstNumber,
          companyDomain,
        }).map((c) => c.toLowerCase());
        if (fromFields.length) {
          allowedCategories = [
            ...new Set([...(allowedCategories ?? []), ...fromFields]),
          ];
        }
      }

      const categories = catalog.categories
        .filter((cat) =>
          isCategoryAllowedForOcr(cat.name, cat.key, allowedCategories),
        )
        .map((cat) => ({
          ...cat,
          portals: (cat.portals || []).map((p) => ({
            ...p,
            relevant: this.isPortalRelevant(p.state, stateHint),
          })),
        }));

      let flatPortals = categories.flatMap((cat) =>
        (cat.portals || [])
          .filter((p) => p.relevant && !!String(p.url || '').trim())
          .map((p) => ({
            id: p.id,
            title: p.title,
            state: p.state,
            url: p.url,
            categoryName: cat.name,
            categoryKey: cat.key,
            relevant: true as const,
          })),
      );

      const maxChecks = isOcrMode
        ? Math.max(1, options?.maxPortalChecks ?? 12)
        : flatPortals.length;
      if (flatPortals.length > maxChecks) {
        cascadeNotes.push(
          `Portal list capped ${flatPortals.length} → ${maxChecks} for OCR speed`,
        );
        flatPortals = flatPortals.slice(0, maxChecks);
      }

      const concurrency = isOcrMode
        ? Math.max(1, options?.portalConcurrency ?? 5)
        : 1;
      const timeoutMs = isOcrMode
        ? Math.max(2000, options?.portalTimeoutMs ?? 6000)
        : 10_000;

      this.logger.log(
        `Portal site checks starting count=${flatPortals.length} concurrency=${concurrency} mode=${isOcrMode ? 'ocr' : 'digital'} stateHint=${stateHint || '-'} types=${documentTypes.join(',') || '-'}`,
      );

      const siteChecks = await this.scrappingService.checkPortalSitesSequentially(
        flatPortals,
        {
          timeoutMs,
          concurrency,
          onProgress: (done, total, title) => {
            if (done === 1 || done === total || done % 5 === 0) {
              this.logger.log(
                `Portal site check ${done}/${total}: ${title}`,
              );
            }
          },
        },
      );

      const okCount = siteChecks.filter((s) => s.success).length;
      const failCount = siteChecks.length - okCount;

      for (const s of siteChecks) {
        executedScrapes.push({
          api: 'GET portal-check',
          name: s.title,
          source: s.categoryName || 'portal-list',
          success: s.success,
          scrapedAt: s.checkedAt,
          url: s.url,
          error: s.error ?? null,
          durationMs: s.durationMs,
          documentTypes,
        });
      }

      // Merge probe outcome; attach scraped fields ONLY to the portal that owns that scraper.
      const checkById = new Map(siteChecks.map((s) => [s.id || s.url, s]));
      const claimedStrategies = new Set<PortalScrapeStrategy>();

      let categoriesWithChecks = categories.map((cat) => ({
        ...cat,
        portals: (cat.portals || []).map((p) => {
          const def = resolvePortalScrapeDefinition(p);
          const check = checkById.get(p.id) || checkById.get(p.url);
          const scrapeAttach = this.scrapedFieldsForStrategy(
            def.strategy,
            scrapePayload,
          );
          const scrapeInputs = this.scrapeInputsForStrategy(
            def.strategy,
            input,
            scrapePayload,
          );
          if (scrapeAttach.fields) {
            claimedStrategies.add(def.strategy);
          }
          const description = this.portalDescription({
            state: p.state,
            strategyLabel: def.label,
            supportsFieldScrape: def.supportsFieldScrape,
            fieldScrapeDone: !!scrapeAttach.fields,
          });

          if (!check) {
            return {
              ...p,
              description,
              scrapeStrategy: def.strategy,
              scrapeStrategyLabel: def.label,
              supportsFieldScrape: def.supportsFieldScrape,
              checkStatus: p.relevant ? 'skipped' : 'not_relevant',
              fieldScrapeDone: !!scrapeAttach.fields,
              scrapeInputs: scrapeInputs || undefined,
              scrapedFields: scrapeAttach.fields || undefined,
              scrapedSource: scrapeAttach.source || undefined,
            };
          }
          return {
            ...p,
            description,
            scrapeStrategy: def.strategy,
            scrapeStrategyLabel: def.label,
            supportsFieldScrape: def.supportsFieldScrape,
            checkStatus: check.success ? 'ok' : 'failed',
            httpStatus: check.httpStatus,
            pageTitle: check.titleTag,
            finalUrl: check.finalUrl,
            durationMs: check.durationMs,
            checkError: check.error,
            checkedAt: check.checkedAt,
            fieldScrapeDone: !!scrapeAttach.fields,
            scrapeInputs: scrapeInputs || undefined,
            scrapedFields: scrapeAttach.fields || undefined,
            scrapedSource: scrapeAttach.source || undefined,
          };
        }),
      }));

      // Ensure scrapes that ran still appear under their own site card even if
      // that portal was capped out of the OCR probe list.
      categoriesWithChecks = this.ensureScrapedSitesVisible(
        categoriesWithChecks,
        scrapePayload,
        claimedStrategies,
        input,
      );

      scrapePayload.portalCatalog = {
        source: 'portal-list',
        scrapedAt: new Date().toISOString(),
        success: failCount === 0 || okCount > 0,
        data: {
          portalCount: catalog.portalCount,
          filteredByDocumentTypes: documentTypes,
          checkedCount: siteChecks.length,
          okCount,
          failCount,
          stateHint,
          categories: categoriesWithChecks,
          siteChecks,
          cascadeNotes,
        },
      };

      if (failCount > 0) softFailures.push('portal-site-checks');
      cascadeNotes.push(
        `Portal sites checked (concurrency=${concurrency}): ${okCount} OK / ${failCount} failed of ${siteChecks.length}`,
      );
    } catch (error: any) {
      softFailures.push('portal-catalog');
      scrapePayload.portalCatalog = {
        source: 'portal-list',
        scrapedAt: new Date().toISOString(),
        success: false,
        error: error?.message ?? 'Failed to load / check portal catalog',
      };
    }

    // Record address / WHOIS scrapes that already ran
    if (scrapePayload.residentialAddress) {
      executedScrapes.push({
        api: 'POST /scrapping/pincode-search',
        name: 'Residential address / pincode',
        source: scrapePayload.residentialAddress.source || 'postalpincode.in',
        success: !!scrapePayload.residentialAddress.success,
        scrapedAt: scrapePayload.residentialAddress.scrapedAt,
        error: scrapePayload.residentialAddress.error ?? null,
        documentTypes,
      });
    }
    if (scrapePayload.officeAddress) {
      executedScrapes.push({
        api: 'POST /scrapping/pincode-search',
        name: 'Office address / pincode',
        source: scrapePayload.officeAddress.source || 'postalpincode.in',
        success: !!scrapePayload.officeAddress.success,
        scrapedAt: scrapePayload.officeAddress.scrapedAt,
        error: scrapePayload.officeAddress.error ?? null,
        documentTypes,
      });
    }
    if (scrapePayload.domain) {
      executedScrapes.push({
        api: 'POST /scrapping/whois-search',
        name: 'Domain / WHOIS',
        source: scrapePayload.domain.source || 'who.is',
        success: !!scrapePayload.domain.success,
        scrapedAt: scrapePayload.domain.scrapedAt,
        error: scrapePayload.domain.error ?? null,
        documentTypes,
      });
    }
    if (scrapePayload.gstDerivedAddress) {
      executedScrapes.push({
        api: 'POST /scrapping/pincode-search',
        name: 'GST-derived address / pincode',
        source: scrapePayload.gstDerivedAddress.source || 'postalpincode.in',
        success: !!scrapePayload.gstDerivedAddress.success,
        scrapedAt: scrapePayload.gstDerivedAddress.scrapedAt,
        error: scrapePayload.gstDerivedAddress.error ?? null,
        documentTypes,
      });
    }

    scrapePayload.executedScrapes = {
      source: 'verification-enrichment',
      scrapedAt: new Date().toISOString(),
      success: executedScrapes.some((s) => s.success) || executedScrapes.length === 0,
      data: {
        count: executedScrapes.length,
        documentTypes,
        apis: executedScrapes,
      },
    };

    const hasSoftFailure = softFailures.length > 0;
    scrapePayload.pipeline = {
      source: 'verification-enrichment',
      scrapedAt: new Date().toISOString(),
      success: !hasSoftFailure,
      data: {
        steps: [
          'primary-details',
          'address-scrape',
          'gst-whois',
          'cascade-from-scrape',
          'portal-catalog',
        ],
        cascadeNotes,
        softFailures,
        documentTypes,
        executedScrapeCount: executedScrapes.length,
        inputSummary: {
          hasResidential: !!scrapePayload.residentialAddress,
          hasOffice: !!scrapePayload.officeAddress,
          hasGst: !!scrapePayload.gst,
          hasDomain: !!scrapePayload.domain,
          hasPortalCatalog: !!scrapePayload.portalCatalog,
          hasBusinessMatch: !!scrapePayload.businessMatch,
          hasExecutedScrapes: executedScrapes.length > 0,
        },
      },
    };

    this.logger.log(
      `Enrichment done softFailures=${softFailures.join(',') || 'none'} notes=${cascadeNotes.join(' | ') || 'none'}`,
    );

    return {
      scrapePayload,
      // Informational only — callers should still generate the report.
      hasFailure: hasSoftFailure,
      derivedFrom: input,
      cascadeNotes,
    };
  }

  /** Request inputs sent (or available) for this portal’s scraper. */
  private scrapeInputsForStrategy(
    strategy: PortalScrapeStrategy,
    input: ScrapeInput,
    scrapePayload: ScrapePayload,
  ): Record<string, string> | null {
    const put = (rows: Array<[string, string | null | undefined]>) => {
      const out: Record<string, string> = {};
      for (const [label, value] of rows) {
        const v = String(value ?? '').trim();
        if (v) out[label] = v;
      }
      return Object.keys(out).length ? out : null;
    };

    if (strategy === 'gst-knowyourgst' || strategy === 'gst-portal') {
      const gstFromPayload = String(
        (scrapePayload.gst?.data as { gstNumber?: string } | undefined)?.gstNumber ||
          '',
      ).trim();
      return put([
        ['GSTIN', input.gstNumber || gstFromPayload || null],
        ['Company name', input.companyName],
        ['Business PAN', input.businessPan || input.panNumber],
      ]);
    }

    if (strategy === 'whois') {
      const domainFromPayload = String(
        (scrapePayload.domain?.data as { domain?: string } | undefined)?.domain || '',
      ).trim();
      return put([
        ['Domain', input.companyDomain || domainFromPayload || null],
        ['Email (domain hint)', input.emailId],
      ]);
    }

    if (strategy === 'pincode') {
      const res = input.residential;
      const off = input.office;
      const fromPayload = scrapePayload.residentialAddress?.data as
        | { pincode?: string | null; submittedAddress?: string | null }
        | undefined;
      return put([
        [
          'Pincode',
          res?.pincode || off?.pincode || fromPayload?.pincode || null,
        ],
        [
          'Address',
          res?.address || off?.address || fromPayload?.submittedAddress || null,
        ],
        ['City', res?.city || off?.city],
        ['State', res?.state || off?.state],
      ]);
    }

    return null;
  }

  /** Fields for one portal strategy only — never share across unrelated sites. */
  private scrapedFieldsForStrategy(
    strategy: PortalScrapeStrategy,
    scrapePayload: ScrapePayload,
  ): { fields: Record<string, string> | null; source: string | null } {
    const empty = { fields: null as Record<string, string> | null, source: null as string | null };

    if (strategy === 'gst-knowyourgst') {
      const fields =
        (scrapePayload.gst?.data as { fields?: Record<string, string> } | undefined)?.fields ??
        null;
      if (!scrapePayload.gst?.success || !fields || !Object.keys(fields).length) return empty;
      return { fields, source: scrapePayload.gst.source || 'knowyourgst' };
    }

    if (strategy === 'whois') {
      const fields =
        (scrapePayload.domain?.data as { fields?: Record<string, string> } | undefined)?.fields ??
        null;
      if (!scrapePayload.domain?.success || !fields || !Object.keys(fields).length) return empty;
      return { fields, source: scrapePayload.domain.source || 'whois' };
    }

    if (strategy === 'pincode') {
      const entry =
        scrapePayload.residentialAddress?.success
          ? scrapePayload.residentialAddress
          : scrapePayload.officeAddress?.success
            ? scrapePayload.officeAddress
            : scrapePayload.gstDerivedAddress?.success
              ? scrapePayload.gstDerivedAddress
              : null;
      if (!entry) return empty;
      const data = entry.data as
        | {
            pincodeFields?: Record<string, string>;
            submittedAddress?: string | null;
            pincode?: string | null;
            latitude?: string | null;
            longitude?: string | null;
          }
        | undefined;
      const fields: Record<string, string> = { ...(data?.pincodeFields ?? {}) };
      if (data?.submittedAddress) fields['Submitted address'] = data.submittedAddress;
      if (data?.pincode) fields['Pincode'] = data.pincode;
      if (data?.latitude && data?.longitude) {
        fields['Coordinates'] = `${data.latitude}, ${data.longitude}`;
      }
      if (!Object.keys(fields).length) return empty;
      return { fields, source: entry.source || 'postalpincode.in' };
    }

    // gst-portal / reachability: OCR enrichment does not auto-complete captcha forms
    return empty;
  }

  private portalDescription(opts: {
    state?: string | null;
    strategyLabel: string;
    supportsFieldScrape: boolean;
    fieldScrapeDone: boolean;
  }): string {
    const parts: string[] = [];
    if (opts.state) parts.push(String(opts.state));
    if (opts.fieldScrapeDone) {
      parts.push(`Scraped via ${opts.strategyLabel}`);
    } else if (opts.supportsFieldScrape) {
      parts.push(`${opts.strategyLabel} (no field scrape this run)`);
    } else {
      parts.push('Availability check only — no field scraper for this site');
    }
    return parts.join(' · ');
  }

  /**
   * If a dedicated scrape ran but its portal was not in the checked list,
   * add a synthetic site card so data appears under that site only.
   */
  private ensureScrapedSitesVisible(
    categories: Array<{
      name: string;
      key?: string;
      portals?: any[];
      [k: string]: unknown;
    }>,
    scrapePayload: ScrapePayload,
    claimed: Set<PortalScrapeStrategy>,
    input: ScrapeInput,
  ): typeof categories {
    const inject: Array<{
      strategy: PortalScrapeStrategy;
      categoryName: string;
      title: string;
      url: string;
      state: string;
    }> = [
      {
        strategy: 'gst-knowyourgst',
        categoryName: 'GST',
        title: 'KnowYourGST — GST Number Search',
        url: 'https://www.knowyourgst.com/gst-number-search/',
        state: 'Pan India',
      },
      {
        strategy: 'whois',
        categoryName: 'Website',
        title: 'WHOIS Domain Lookup',
        url: 'https://who.is/',
        state: 'Pan India',
      },
      {
        strategy: 'pincode',
        categoryName: 'Address',
        title: 'India Post Pincode Lookup',
        url: 'https://www.postalpincode.in/',
        state: 'Pan India',
      },
    ];

    const next = categories.map((c) => ({
      ...c,
      portals: [...(c.portals || [])],
    }));

    for (const item of inject) {
      if (claimed.has(item.strategy)) continue;
      const attach = this.scrapedFieldsForStrategy(item.strategy, scrapePayload);
      if (!attach.fields) continue;

      const def = resolvePortalScrapeDefinition({ title: item.title, url: item.url });
      const scrapeInputs = this.scrapeInputsForStrategy(
        item.strategy,
        input,
        scrapePayload,
      );
      const portal = {
        id: `scraped-${item.strategy}`,
        title: item.title,
        url: item.url,
        state: item.state,
        relevant: true,
        description: this.portalDescription({
          state: item.state,
          strategyLabel: def.label,
          supportsFieldScrape: true,
          fieldScrapeDone: true,
        }),
        scrapeStrategy: item.strategy,
        scrapeStrategyLabel: def.label,
        supportsFieldScrape: true,
        checkStatus: 'ok',
        fieldScrapeDone: true,
        scrapeInputs: scrapeInputs || undefined,
        scrapedFields: attach.fields,
        scrapedSource: attach.source,
      };

      let cat = next.find(
        (c) =>
          String(c.name || '').toLowerCase() === item.categoryName.toLowerCase() ||
          String(c.key || '').toLowerCase() === item.categoryName.toLowerCase(),
      );
      if (!cat) {
        cat = { name: item.categoryName, key: item.categoryName.toLowerCase(), portals: [] };
        next.push(cat);
      }
      cat.portals = [portal, ...(cat.portals || [])];
      claimed.add(item.strategy);
    }

    return next;
  }

  private isPortalRelevant(
    portalState?: string | null,
    stateHint?: string | null,
  ): boolean {
    const state = String(portalState || '').trim().toLowerCase();
    if (!state || state === 'all' || state === 'pan india' || state === 'pan-india') {
      return true;
    }
    const hint = String(stateHint || '').trim().toLowerCase();
    if (!hint) return true; // no state known → check all digital-report portals
    if (state === hint) return true;
    // Soft match: "Gujarat" vs "GJ", or "Delhi NCR" containing delhi
    if (hint.includes(state) || state.includes(hint)) return true;
    const aliases: Record<string, string[]> = {
      gujarat: ['gj', 'guj'],
      maharashtra: ['mh', 'maha'],
      'uttar pradesh': ['up', 'u.p.'],
      'madhya pradesh': ['mp', 'm.p.'],
      'delhi ncr': ['delhi', 'ncr', 'noida', 'gurgaon', 'gurugram'],
      karnataka: ['ka', 'blr', 'bengaluru'],
      rajasthan: ['rj'],
      haryana: ['hr'],
      punjab: ['pb'],
      bihar: ['br'],
      odisha: ['orissa', 'od'],
      'west bengal': ['wb', 'bengal'],
      'andhra pradesh': ['ap'],
      telangana: ['ts', 'tg'],
      tamilnadu: ['tamil nadu', 'tn'],
      kerala: ['kl'],
    };
    for (const [canonical, alts] of Object.entries(aliases)) {
      const group = [canonical, ...alts];
      if (group.includes(state) && group.includes(hint)) return true;
    }
    return false;
  }

  private domainFromEmail(email?: string | null): string | null {
    const m = String(email || '')
      .trim()
      .toLowerCase()
      .match(/@([a-z0-9.-]+\.[a-z]{2,})$/i);
    if (!m?.[1]) return null;
    const host = m[1].toLowerCase();
    if (FREE_EMAIL_HOSTS.has(host)) return null;
    return normalizeDomain(host) || null;
  }

  private async scrapeWhoisIntoPayload(
    scrapePayload: ScrapePayload,
    domain: string,
    cascadeNotes: string[],
    softFailures: string[],
    extraData?: Record<string, unknown>,
  ): Promise<void> {
    try {
      const res = await this.scrappingService.whoisSearch(domain);
      const sourceHost = String(res.data?.sourceUrl || '').includes('who.is')
        ? 'who.is'
        : 'whois.com';
      scrapePayload.domain = {
        source: sourceHost,
        scrapedAt: new Date().toISOString(),
        success: true,
        data: {
          ...(res.data as unknown as Record<string, unknown>),
          ...(extraData ?? {}),
        },
      };
      cascadeNotes.push(
        extraData?.cascadedFrom
          ? `Cascaded WHOIS (${sourceHost}) for ${domain}`
          : `WHOIS (${sourceHost}) scraped for ${domain}`,
      );
    } catch (error: any) {
      softFailures.push('domain-whois');
      scrapePayload.domain = {
        source: 'who.is',
        scrapedAt: new Date().toISOString(),
        success: false,
        error: error?.message ?? 'WHOIS domain verification failed',
        data: { domain, ...(extraData ?? {}) },
      };
      cascadeNotes.push(`WHOIS scrape failed for ${domain}`);
    }
  }

  private async enrichAddressSection(input: {
    address?: string | null;
    landmark?: string | null;
    city?: string | null;
    state?: string | null;
    pincode?: string | null;
  }): Promise<ScrapeResultEntry> {
    const submittedAddress = joinAddressParts([
      input.address,
      input.landmark,
      input.city,
      input.state,
      input.pincode,
    ]);
    const pincode = input.pincode?.trim() || null;

    let pincodeFields: Record<string, string> = {};
    let pincodeMessage = '';
    let pincodeError: string | undefined;

    if (pincode) {
      try {
        const res = await this.scrappingService.pincodeLookup(pincode);
        const data = res.data as {
          fields?: Record<string, string>;
          message?: string;
        };
        pincodeFields = data?.fields ?? {};
        pincodeMessage = data?.message ?? '';
      } catch (error: any) {
        pincodeError = error?.message ?? 'Pincode lookup failed';
      }
    }

    const geocodeQuery =
      submittedAddress ||
      joinAddressParts([
        pincodeFields['Post Office'],
        pincodeFields['District'],
        pincodeFields['State'],
        pincode,
      ]);

    let latitude: string | null = null;
    let longitude: string | null = null;
    if (geocodeQuery) {
      const geo = await geocodeAddress(geocodeQuery);
      if (geo) {
        latitude = geo.latitude;
        longitude = geo.longitude;
      }
    }

    let mapEmbedUrl: string | null = null;
    let streetViewLink: string | null = null;
    let streetViewEmbedUrl: string | null = null;
    if (latitude && longitude) {
      mapEmbedUrl = buildMapEmbedUrl(latitude, longitude);
      streetViewLink = buildStreetViewLink(latitude, longitude);
      streetViewEmbedUrl = buildStreetViewEmbedUrl(latitude, longitude);
    } else if (geocodeQuery) {
      mapEmbedUrl = buildMapEmbedFromQuery(geocodeQuery);
    }

    const pincodeOk = !!pincode && Object.keys(pincodeFields).length > 0;
    const geoOk = !!(latitude && longitude && mapEmbedUrl);
    const success = pincodeOk || geoOk;

    return {
      source: 'postalpincode.in',
      scrapedAt: new Date().toISOString(),
      success,
      data: {
        submittedAddress: submittedAddress || null,
        pincode,
        pincodeFields,
        pincodeMessage,
        latitude,
        longitude,
        mapEmbedUrl,
        streetViewLink,
        streetViewEmbedUrl,
        geocodeQuery: geocodeQuery || null,
      },
      error:
        pincodeError ??
        (success ? undefined : 'Could not fetch pincode details or geocode this address'),
    };
  }
}
