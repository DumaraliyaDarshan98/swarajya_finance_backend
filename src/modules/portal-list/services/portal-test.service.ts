import {
  BadRequestException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Portal } from '../entities/portal.entity';
import { PortalCategory } from '../entities/portal-category.entity';
import { ScrappingService } from '../../scrapping/services/scrapping.service';
import { APIResponseInterface } from '../../../common/interfaces/response.interface';
import {
  matchExpectedFields,
  PORTAL_SCRAPE_DEFINITIONS,
  REACHABILITY_DEFINITION,
  resolvePortalScrapeDefinition,
  type PortalScrapeDefinition,
  type PortalScrapeStrategy,
} from '../config/portal-scrape-registry';
import type { PortalTestScrapeDto, PortalValidateAllDto } from '../dto/portal-test.dto';

export type PortalTestResult = {
  portalId: string;
  title: string;
  url: string;
  state: string | null;
  categoryName: string | null;
  strategy: PortalScrapeStrategy;
  strategyLabel: string;
  apiPath: string;
  supportsFieldScrape: boolean;
  accessible: boolean | null;
  httpStatus: number | null;
  pageTitle: string | null;
  durationMs: number;
  success: boolean;
  status: 'success' | 'partial' | 'failed' | 'unsupported';
  message: string;
  fields: Record<string, string>;
  expectedMatched: string[];
  expectedMissing: string[];
  error?: string | null;
  captchaImageBase64?: string | null;
  sessionId?: string | null;
  sourceUrl?: string | null;
  scrapedAt: string;
};

@Injectable()
export class PortalTestService {
  private readonly logger = new Logger(PortalTestService.name);

  constructor(
    @InjectRepository(Portal)
    private readonly portalRepo: Repository<Portal>,
    @InjectRepository(PortalCategory)
    private readonly categoryRepo: Repository<PortalCategory>,
    private readonly scrappingService: ScrappingService,
  ) {}

  /** Catalog of scrape strategies + all portals with resolved strategy (for Admin dropdown). */
  async getTestCatalog(): Promise<
    APIResponseInterface<{
      strategies: Array<{
        strategy: PortalScrapeStrategy;
        label: string;
        requiredInputs: PortalScrapeDefinition['requiredInputs'];
        expectedFields: string[];
        apiPath: string;
        supportsFieldScrape: boolean;
      }>;
      portals: Array<{
        id: string;
        title: string;
        url: string;
        state: string | null;
        categoryId: string;
        categoryName: string;
        isActive: boolean;
        usedInDigitalReport: boolean;
        strategy: PortalScrapeStrategy;
        strategyLabel: string;
        requiredInputs: PortalScrapeDefinition['requiredInputs'];
        expectedFields: string[];
        supportsFieldScrape: boolean;
        apiPath: string;
      }>;
    }>
  > {
    const categories = await this.categoryRepo.find({
      relations: ['portals'],
      order: { sortOrder: 'ASC', name: 'ASC' },
    });

    const portals = categories.flatMap((cat) =>
      (cat.portals ?? [])
        .slice()
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
        .map((p) => {
          const def = resolvePortalScrapeDefinition(p);
          return {
            id: p.id,
            title: p.title,
            url: p.url,
            state: p.state ?? null,
            categoryId: cat.id,
            categoryName: cat.name,
            isActive: !!p.isActive,
            usedInDigitalReport: !!p.usedInDigitalReport,
            strategy: def.strategy,
            strategyLabel: def.label,
            requiredInputs: def.requiredInputs,
            expectedFields: def.expectedFields,
            supportsFieldScrape: def.supportsFieldScrape,
            apiPath: def.apiPath,
          };
        }),
    );

    // Built-in OCR scrapers that may not exist as portal-list rows
    const builtInPortals = PORTAL_SCRAPE_DEFINITIONS.map((def) => {
      const syn = this.syntheticPortalForStrategy(def);
      return {
        id: syn.id,
        title: `[Built-in] ${def.label}`,
        url: syn.url,
        state: 'Pan India' as string | null,
        categoryId: 'built-in',
        categoryName: 'Built-in scrapers (OCR)',
        isActive: true,
        usedInDigitalReport: true,
        strategy: def.strategy,
        strategyLabel: def.label,
        requiredInputs: def.requiredInputs,
        expectedFields: def.expectedFields,
        supportsFieldScrape: def.supportsFieldScrape,
        apiPath: def.apiPath,
      };
    });

    return {
      code: HttpStatus.OK,
      message: 'Portal test catalog loaded',
      data: {
        strategies: [
          ...PORTAL_SCRAPE_DEFINITIONS.map((d) => ({
            strategy: d.strategy,
            label: d.label,
            requiredInputs: d.requiredInputs,
            expectedFields: d.expectedFields,
            apiPath: d.apiPath,
            supportsFieldScrape: d.supportsFieldScrape,
          })),
          {
            strategy: REACHABILITY_DEFINITION.strategy,
            label: REACHABILITY_DEFINITION.label,
            requiredInputs: [],
            expectedFields: [],
            apiPath: REACHABILITY_DEFINITION.apiPath,
            supportsFieldScrape: false,
          },
        ],
        portals: [...builtInPortals, ...portals],
      },
    };
  }

  async testPortal(
    dto: PortalTestScrapeDto,
  ): Promise<APIResponseInterface<PortalTestResult>> {
    const inputs = dto.inputs ?? {};

    if (dto.portalId) {
      const portal = await this.portalRepo.findOne({
        where: { id: dto.portalId },
        relations: ['category'],
      });
      if (!portal) throw new NotFoundException('Portal not found');
      const result = await this.runPortalTest(portal, inputs);
      return {
        code: HttpStatus.OK,
        message: result.success
          ? 'Portal scrape validated successfully'
          : result.message,
        data: result,
      };
    }

    const strategy = String(dto.strategy || '').trim();
    const def =
      PORTAL_SCRAPE_DEFINITIONS.find((d) => d.strategy === strategy) ?? null;
    if (!def) {
      throw new BadRequestException(
        'Provide portalId or a valid built-in strategy (gst-knowyourgst, gst-portal, whois, pincode)',
      );
    }

    const synthetic = this.syntheticPortalForStrategy(def);
    const result = await this.runPortalTest(synthetic, inputs);
    return {
      code: HttpStatus.OK,
      message: result.success
        ? 'Portal scrape validated successfully'
        : result.message,
      data: result,
    };
  }

  private syntheticPortalForStrategy(def: PortalScrapeDefinition): Portal {
    const urls: Record<string, string> = {
      'gst-knowyourgst': 'https://www.knowyourgst.com/gst-number-search/',
      'gst-portal': 'https://services.gst.gov.in/services/searchtp',
      whois: 'https://who.is/',
      pincode: 'https://api.postalpincode.in/',
    };
    const portal = new Portal();
    portal.id = `synthetic-${def.strategy}`;
    portal.title = def.label;
    portal.url = urls[def.strategy] || 'https://example.com';
    portal.state = 'Pan India';
    portal.isActive = true;
    portal.usedInDigitalReport = true;
    portal.sortOrder = 0;
    return portal;
  }

  /**
   * Validate every configured portal one-by-one.
   * Always runs accessibility. Field scrapes run only when runFieldScrapes=true
   * and sample inputs cover the strategy.
   */
  async validateAll(
    dto: PortalValidateAllDto = {},
  ): Promise<
    APIResponseInterface<{
      summary: {
        total: number;
        success: number;
        partial: number;
        failed: number;
        unsupported: number;
        fieldScrapeCapable: number;
      };
      results: PortalTestResult[];
    }>
  > {
    const portals = await this.portalRepo.find({
      relations: ['category'],
      order: { sortOrder: 'ASC', title: 'ASC' },
    });

    const stateFilter = String(dto.stateFilter || '')
      .trim()
      .toLowerCase();
    const list = stateFilter
      ? portals.filter((p) => {
          const s = String(p.state || '').toLowerCase();
          return (
            !s ||
            s === 'pan india' ||
            s === 'all' ||
            s.includes(stateFilter) ||
            stateFilter.includes(s)
          );
        })
      : portals;

    const sample = dto.sampleInputs ?? {};
    const results: PortalTestResult[] = [];

    for (const portal of list) {
      const def = resolvePortalScrapeDefinition(portal);
      const inputs: Record<string, string> = {};
      if (dto.runFieldScrapes && def.supportsFieldScrape) {
        if (def.strategy === 'gst-knowyourgst' || def.strategy === 'gst-portal') {
          if (sample.gstNumber) inputs.gstNumber = sample.gstNumber;
        }
        if (def.strategy === 'whois' && sample.domain) {
          inputs.domain = sample.domain;
        }
        if (def.strategy === 'pincode' && sample.pincode) {
          inputs.pincode = sample.pincode;
        }
      }

      // Field scrape only when inputs present; otherwise reachability-only pass for batch.
      const forceReachabilityOnly =
        def.supportsFieldScrape &&
        (!dto.runFieldScrapes || Object.keys(inputs).length === 0);

      try {
        const result = await this.runPortalTest(
          portal,
          inputs,
          forceReachabilityOnly,
        );
        results.push(result);
      } catch (err: any) {
        results.push(
          this.failedResult(portal, def, err?.message ?? 'Validation failed'),
        );
      }
    }

    const summary = {
      total: results.length,
      success: results.filter((r) => r.status === 'success').length,
      partial: results.filter((r) => r.status === 'partial').length,
      failed: results.filter((r) => r.status === 'failed').length,
      unsupported: results.filter((r) => r.status === 'unsupported').length,
      fieldScrapeCapable: results.filter((r) => r.supportsFieldScrape).length,
    };

    return {
      code: HttpStatus.OK,
      message: `Validated ${summary.total} portal(s)`,
      data: { summary, results },
    };
  }

  private async runPortalTest(
    portal: Portal,
    inputs: Record<string, string>,
    forceReachabilityOnly = false,
  ): Promise<PortalTestResult> {
    const def = resolvePortalScrapeDefinition(portal);
    const started = Date.now();
    const scrapedAt = new Date().toISOString();

    // Always probe accessibility first
    const access = await this.scrappingService.checkPortalSite(portal.url, {
      timeoutMs: 10_000,
    });

    if (forceReachabilityOnly || def.strategy === 'reachability') {
      const accessible = access.success;
      return {
        portalId: portal.id,
        title: portal.title,
        url: portal.url,
        state: portal.state ?? null,
        categoryName: portal.category?.name ?? null,
        strategy: def.strategy,
        strategyLabel: def.label,
        apiPath: def.apiPath,
        supportsFieldScrape: def.supportsFieldScrape,
        accessible,
        httpStatus: access.httpStatus,
        pageTitle: access.title,
        durationMs: Date.now() - started,
        success: accessible,
        status: accessible
          ? def.supportsFieldScrape
            ? 'partial'
            : 'success'
          : 'failed',
        message: accessible
          ? def.supportsFieldScrape
            ? 'Site reachable — provide required inputs and run Test Scrape to validate field data'
            : 'Site reachable (HTTP check only — no field scraper configured for this portal)'
          : access.error || 'Site not reachable',
        fields:
          accessible && Object.keys(access.responseFields || {}).length
            ? { ...access.responseFields }
            : accessible && access.title
              ? { 'Page Title': access.title }
              : {},
        expectedMatched: [],
        expectedMissing: def.expectedFields,
        error: accessible ? null : access.error ?? 'Unreachable',
        sourceUrl: portal.url,
        scrapedAt,
      };
    }

    try {
      if (def.strategy === 'gst-knowyourgst') {
        const gstNumber = String(inputs.gstNumber || '')
          .trim()
          .toUpperCase();
        if (!gstNumber) {
          throw new BadRequestException('gstNumber is required');
        }
        const res = await this.scrappingService.gstSearch(gstNumber);
        return this.buildFieldResult({
          portal,
          def,
          access,
          started,
          scrapedAt,
          fields: (res.data?.fields ?? {}) as Record<string, string>,
          sourceUrl: res.data?.sourceUrl ?? portal.url,
        });
      }

      if (def.strategy === 'whois') {
        const domain = String(inputs.domain || '').trim();
        if (!domain) throw new BadRequestException('domain is required');
        const res = await this.scrappingService.whoisSearch(domain);
        return this.buildFieldResult({
          portal,
          def,
          access,
          started,
          scrapedAt,
          fields: (res.data?.fields ?? {}) as Record<string, string>,
          sourceUrl: res.data?.sourceUrl ?? portal.url,
        });
      }

      if (def.strategy === 'pincode') {
        const pincode = String(inputs.pincode || '').trim();
        if (!pincode) throw new BadRequestException('pincode is required');
        const res = await this.scrappingService.pincodeLookup(pincode);
        return this.buildFieldResult({
          portal,
          def,
          access,
          started,
          scrapedAt,
          fields: (res.data?.fields ?? {}) as Record<string, string>,
          sourceUrl: res.data?.sourceUrl ?? portal.url,
        });
      }

      if (def.strategy === 'gst-portal') {
        const gstNumber = String(inputs.gstNumber || '')
          .trim()
          .toUpperCase();
        if (!gstNumber) {
          throw new BadRequestException('gstNumber is required');
        }
        const sessionId = String(inputs.sessionId || '').trim();
        const captchaCode = String(inputs.captchaCode || '').trim();

        if (!sessionId || !captchaCode) {
          const init = await this.scrappingService.gstPortalInit(gstNumber);
          return {
            portalId: portal.id,
            title: portal.title,
            url: portal.url,
            state: portal.state ?? null,
            categoryName: portal.category?.name ?? null,
            strategy: def.strategy,
            strategyLabel: def.label,
            apiPath: def.apiPath,
            supportsFieldScrape: true,
            accessible: access.success,
            httpStatus: access.httpStatus,
            pageTitle: access.title,
            durationMs: Date.now() - started,
            success: false,
            status: 'partial',
            message:
              'Captcha required — enter captcha code and sessionId, then Test Scrape again',
            fields: {},
            expectedMatched: [],
            expectedMissing: def.expectedFields,
            captchaImageBase64: init.data?.captchaImageBase64 ?? null,
            sessionId: init.data?.sessionId ?? null,
            sourceUrl: init.data?.sourceUrl ?? portal.url,
            scrapedAt,
          };
        }

        const search = await this.scrappingService.gstPortalSearch(
          sessionId,
          captchaCode,
        );
        const details = (search.data?.details ?? {}) as Record<string, unknown>;
        const fields: Record<string, string> = {};
        for (const [k, v] of Object.entries(details)) {
          if (v == null) continue;
          if (typeof v === 'object') {
            fields[k] = JSON.stringify(v);
          } else {
            fields[k] = String(v);
          }
        }
        return this.buildFieldResult({
          portal,
          def,
          access,
          started,
          scrapedAt,
          fields,
          sourceUrl: search.data?.sourceUrl ?? portal.url,
        });
      }

      return this.failedResult(portal, def, 'Unknown scrape strategy');
    } catch (err: any) {
      this.logger.warn(
        `Portal test failed id=${portal.id} title="${portal.title}": ${err?.message ?? err}`,
      );
      return {
        ...this.failedResult(portal, def, err?.message ?? 'Scrape failed'),
        accessible: access.success,
        httpStatus: access.httpStatus,
        pageTitle: access.title,
        durationMs: Date.now() - started,
        scrapedAt,
      };
    }
  }

  private buildFieldResult(args: {
    portal: Portal;
    def: PortalScrapeDefinition;
    access: {
      success: boolean;
      httpStatus: number | null;
      title: string | null;
    };
    started: number;
    scrapedAt: string;
    fields: Record<string, string>;
    sourceUrl: string;
  }): PortalTestResult {
    const { portal, def, access, started, scrapedAt, fields, sourceUrl } = args;
    const validation = matchExpectedFields(
      fields,
      def.expectedFields,
      def.minExpectedMatches,
    );
    const fieldCount = Object.keys(fields).length;
    const success = validation.ok && fieldCount > 0;

    return {
      portalId: portal.id,
      title: portal.title,
      url: portal.url,
      state: portal.state ?? null,
      categoryName: portal.category?.name ?? null,
      strategy: def.strategy,
      strategyLabel: def.label,
      apiPath: def.apiPath,
      supportsFieldScrape: true,
      accessible: access.success,
      httpStatus: access.httpStatus,
      pageTitle: access.title,
      durationMs: Date.now() - started,
      success,
      status: success ? 'success' : fieldCount > 0 ? 'partial' : 'failed',
      message: success
        ? `Scraped ${fieldCount} field(s); expected fields validated`
        : fieldCount > 0
          ? `Scraped ${fieldCount} field(s) but expected fields incomplete (matched ${validation.matched.length})`
          : 'No field data scraped — selectors may have changed or site blocked the request',
      fields,
      expectedMatched: validation.matched,
      expectedMissing: validation.missing,
      error: success
        ? null
        : validation.missing.length
          ? `Missing expected fields: ${validation.missing.slice(0, 6).join(', ')}`
          : 'Empty scrape result',
      sourceUrl,
      scrapedAt,
    };
  }

  private failedResult(
    portal: Portal,
    def: PortalScrapeDefinition,
    error: string,
  ): PortalTestResult {
    return {
      portalId: portal.id,
      title: portal.title,
      url: portal.url,
      state: portal.state ?? null,
      categoryName: portal.category?.name ?? null,
      strategy: def.strategy,
      strategyLabel: def.label,
      apiPath: def.apiPath,
      supportsFieldScrape: def.supportsFieldScrape,
      accessible: null,
      httpStatus: null,
      pageTitle: null,
      durationMs: 0,
      success: false,
      status: def.supportsFieldScrape ? 'failed' : 'unsupported',
      message: error,
      fields: {},
      expectedMatched: [],
      expectedMissing: def.expectedFields,
      error,
      scrapedAt: new Date().toISOString(),
    };
  }
}
