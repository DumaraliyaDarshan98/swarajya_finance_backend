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

@Injectable()
export class VerificationEnrichmentService {
  private readonly logger = new Logger(VerificationEnrichmentService.name);

  constructor(
    private readonly scrappingService: ScrappingService,
    private readonly portalListService: PortalListService,
  ) {}

  /**
   * Shared pipeline for Digital + OCR:
   * 1) Primary scrapes from entered/extracted details
   * 2) Cascade scrapes from primary results (other sites / derived addresses)
   * 3) Portal catalog of related government / public sites for the report
   */
  async enrichFromDetails(input: ScrapeInput): Promise<EnrichmentResult> {
    const scrapePayload: ScrapePayload = {};
    const cascadeNotes: string[] = [];
    let hasFailure = false;

    const residential = input.residential;
    if (
      residential &&
      (residential.address ||
        residential.pincode ||
        residential.city ||
        residential.state)
    ) {
      scrapePayload.residentialAddress = await this.enrichAddressSection({
        address: residential.address,
        landmark: residential.landmark,
        city: residential.city,
        state: residential.state,
        pincode: residential.pincode,
      });
    }

    const office = input.office;
    if (
      office &&
      (office.address || office.pincode || office.city || office.state)
    ) {
      scrapePayload.officeAddress = await this.enrichAddressSection({
        address: office.address,
        landmark: office.landmark,
        city: office.city,
        state: office.state,
        pincode: office.pincode,
      });
    }

    const gstNumber = input.gstNumber?.trim().toUpperCase() || null;
    const companyDomain =
      normalizeDomain(input.companyDomain?.trim() || '') || null;
    const companyName = input.companyName?.trim() || null;

    if (gstNumber) {
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
        hasFailure = true;
        scrapePayload.gst = {
          source: 'knowyourgst',
          scrapedAt: new Date().toISOString(),
          success: false,
          error: error?.message ?? 'GST verification failed',
        };
      }
    }

    if (companyDomain) {
      try {
        const res = await this.scrappingService.whoisSearch(companyDomain);
        scrapePayload.domain = {
          source: 'whois.com',
          scrapedAt: new Date().toISOString(),
          success: true,
          data: res.data as unknown as Record<string, unknown>,
        };
        cascadeNotes.push(`WHOIS scraped for ${companyDomain}`);
      } catch (error: any) {
        hasFailure = true;
        scrapePayload.domain = {
          source: 'whois.com',
          scrapedAt: new Date().toISOString(),
          success: false,
          error: error?.message ?? 'WHOIS domain verification failed',
        };
      }
    }

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
        if (!nameMatched) hasFailure = true;
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

      if (!scrapePayload.domain && hints.website) {
        const derivedDomain = normalizeDomain(hints.website);
        if (derivedDomain) {
          try {
            const res = await this.scrappingService.whoisSearch(derivedDomain);
            scrapePayload.domain = {
              source: 'whois.com',
              scrapedAt: new Date().toISOString(),
              success: true,
              data: {
                ...(res.data as unknown as Record<string, unknown>),
                cascadedFrom: 'gst',
              },
            };
            cascadeNotes.push(
              `Cascaded WHOIS from GST website field (${derivedDomain})`,
            );
          } catch (error: any) {
            scrapePayload.domain = {
              source: 'whois.com',
              scrapedAt: new Date().toISOString(),
              success: false,
              error: error?.message ?? 'Cascaded WHOIS from GST failed',
              data: { cascadedFrom: 'gst', domain: derivedDomain },
            };
          }
        }
      }
    }

    // Portal catalog = other public / gov sites available for this report
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
          relevant:
            !stateHint ||
            !p.state ||
            String(p.state).toLowerCase() === 'all' ||
            String(p.state).toLowerCase() === String(stateHint).toLowerCase(),
        })),
      }));

      scrapePayload.portalCatalog = {
        source: 'portal-list',
        scrapedAt: new Date().toISOString(),
        success: true,
        data: {
          portalCount: catalog.portalCount,
          stateHint,
          categories,
          cascadeNotes,
        },
      };
      cascadeNotes.push(
        `Portal catalog loaded (${catalog.portalCount} sites)`,
      );
    } catch (error: any) {
      scrapePayload.portalCatalog = {
        source: 'portal-list',
        scrapedAt: new Date().toISOString(),
        success: false,
        error: error?.message ?? 'Failed to load portal catalog',
      };
    }

    scrapePayload.pipeline = {
      source: 'verification-enrichment',
      scrapedAt: new Date().toISOString(),
      success: !hasFailure,
      data: {
        steps: [
          'primary-details',
          'address-scrape',
          'gst-whois',
          'cascade-from-scrape',
          'portal-catalog',
        ],
        cascadeNotes,
        inputSummary: {
          hasResidential: !!scrapePayload.residentialAddress,
          hasOffice: !!scrapePayload.officeAddress,
          hasGst: !!scrapePayload.gst,
          hasDomain: !!scrapePayload.domain,
          hasPortalCatalog: !!scrapePayload.portalCatalog,
        },
      },
    };

    this.logger.log(
      `Enrichment done failure=${hasFailure} notes=${cascadeNotes.join(' | ') || 'none'}`,
    );

    return {
      scrapePayload,
      hasFailure,
      derivedFrom: input,
      cascadeNotes,
    };
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
