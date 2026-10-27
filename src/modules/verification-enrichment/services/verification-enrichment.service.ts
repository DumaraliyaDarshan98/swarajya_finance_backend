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
import type {
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
   */
  async enrichFromDetails(input: ScrapeInput): Promise<EnrichmentResult> {
    const scrapePayload: ScrapePayload = {};
    const cascadeNotes: string[] = [];
    const softFailures: string[] = [];

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
          try {
            const res = await this.scrappingService.gstSearch(gstNumber);
            scrapePayload.gst = {
              source: 'knowyourgst',
              scrapedAt: new Date().toISOString(),
              success: true,
              data: res.data as unknown as Record<string, unknown>,
            };
            cascadeNotes.push(`GST scraped for ${gstNumber}`);
          } catch (error: any) {
            softFailures.push('gst');
            scrapePayload.gst = {
              source: 'knowyourgst',
              scrapedAt: new Date().toISOString(),
              success: false,
              error: error?.message ?? 'GST verification failed',
            };
            cascadeNotes.push(`GST scrape failed for ${gstNumber}`);
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

    // Portal catalog + one-by-one reachability check for each relevant site
    try {
      const catalog = await this.portalListService.getDigitalReportCatalog();
      const stateHint =
        input.residential?.state ||
        input.office?.state ||
        (scrapePayload.residentialAddress?.data as any)?.pincodeFields?.State ||
        (scrapePayload.gstDerivedAddress?.data as any)?.pincodeFields?.State ||
        null;

      const categories = catalog.categories.map((cat) => ({
        ...cat,
        portals: (cat.portals || []).map((p) => ({
          ...p,
          relevant: this.isPortalRelevant(p.state, stateHint),
        })),
      }));

      // Prefer state-matched + Pan India; still probe every flagged digital-report portal
      // that is relevant, one site at a time.
      const flatPortals = categories.flatMap((cat) =>
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

      this.logger.log(
        `Portal site checks starting count=${flatPortals.length} stateHint=${stateHint || '-'}`,
      );

      const siteChecks = await this.scrappingService.checkPortalSitesSequentially(
        flatPortals,
        {
          timeoutMs: 10_000,
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

      // Merge check outcome back onto catalog portals for the report UI
      const checkById = new Map(siteChecks.map((s) => [s.id || s.url, s]));
      const categoriesWithChecks = categories.map((cat) => ({
        ...cat,
        portals: (cat.portals || []).map((p) => {
          const check = checkById.get(p.id) || checkById.get(p.url);
          if (!check) {
            return {
              ...p,
              checkStatus: p.relevant ? 'skipped' : 'not_relevant',
            };
          }
          return {
            ...p,
            checkStatus: check.success ? 'ok' : 'failed',
            httpStatus: check.httpStatus,
            pageTitle: check.titleTag,
            finalUrl: check.finalUrl,
            durationMs: check.durationMs,
            checkError: check.error,
            checkedAt: check.checkedAt,
          };
        }),
      }));

      scrapePayload.portalCatalog = {
        source: 'portal-list',
        scrapedAt: new Date().toISOString(),
        success: failCount === 0 || okCount > 0,
        data: {
          portalCount: catalog.portalCount,
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
        `Portal sites checked one-by-one: ${okCount} OK / ${failCount} failed of ${siteChecks.length} relevant`,
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
        inputSummary: {
          hasResidential: !!scrapePayload.residentialAddress,
          hasOffice: !!scrapePayload.officeAddress,
          hasGst: !!scrapePayload.gst,
          hasDomain: !!scrapePayload.domain,
          hasPortalCatalog: !!scrapePayload.portalCatalog,
          hasBusinessMatch: !!scrapePayload.businessMatch,
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
