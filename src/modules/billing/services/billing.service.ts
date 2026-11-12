import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { BillingRateConfig } from '../entities/billing-rate-config.entity';
import { UpdateBillingRatesDto } from '../dto/billing.dto';
import { Client } from '../../client/entities/client.entity';
import { OcrVerification } from '../../ocr-verification/entities/ocr-verification.entity';
import { DigitalVerification } from '../../digital-verification/entities/digital-verification.entity';
import { PhysicalVerification } from '../../physical-verification/entities/physical-verification.entity';
import type { OcrDocumentsPayload } from '../../ocr-verification/interfaces/ocr-documents-payload.interface';
import type { ScrapePayload } from '../../digital-verification/interfaces/scrape-payload.interface';
import type { APIResponseInterface } from '../../../common/interfaces/response.interface';
import { HttpStatus } from '@nestjs/common';
import type {
  BillingLineItem,
  BillingRatesView,
  BillingUsageCounts,
  ClientBillDetail,
  ClientBillHistoryMonth,
  ClientBillSummary,
} from '../interfaces/billing.interface';

function money(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

function parseDateBound(raw: string | undefined, fallback: Date): Date {
  if (!raw?.trim()) return fallback;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthsBetween(from: Date, to: Date): Array<{ year: number; month: number; start: Date; end: Date }> {
  const out: Array<{ year: number; month: number; start: Date; end: Date }> = [];
  let cursor = startOfMonth(from);
  const last = startOfMonth(to);
  while (cursor <= last) {
    out.push({
      year: cursor.getFullYear(),
      month: cursor.getMonth() + 1,
      start: startOfMonth(cursor),
      end: endOfMonth(cursor),
    });
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }
  return out;
}

function countSuccessfulScrapes(payload: ScrapePayload | null | undefined): Array<{
  key: string;
  scrapedAt: string;
}> {
  if (!payload || typeof payload !== 'object') return [];
  const rows: Array<{ key: string; scrapedAt: string }> = [];
  for (const [key, entry] of Object.entries(payload)) {
    if (key === 'pipeline') continue;
    if (!entry || typeof entry !== 'object') continue;
    if ((entry as { success?: boolean }).success !== true) continue;
    rows.push({
      key,
      scrapedAt: String((entry as { scrapedAt?: string }).scrapedAt || ''),
    });
  }
  return rows;
}

function countSuccessfulOcrDocs(payload: OcrDocumentsPayload | null | undefined): Array<{
  key: string;
  label: string;
  fileName: string | null;
}> {
  if (!payload) return [];
  const docs = [...(payload.documents ?? []), ...(payload.extraDocuments ?? [])];
  return docs
    .filter((d) => d?.ocrSuccess === true)
    .map((d) => ({
      key: d.key,
      label: d.label || d.documentType || 'Document',
      fileName: d.fileName ?? null,
    }));
}

@Injectable()
export class BillingService {
  constructor(
    @InjectRepository(BillingRateConfig)
    private readonly ratesRepo: Repository<BillingRateConfig>,
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
    @InjectRepository(OcrVerification)
    private readonly ocrRepo: Repository<OcrVerification>,
    @InjectRepository(DigitalVerification)
    private readonly digitalRepo: Repository<DigitalVerification>,
    @InjectRepository(PhysicalVerification)
    private readonly physicalRepo: Repository<PhysicalVerification>,
  ) {}

  private emptyRates(): BillingRatesView {
    return {
      id: null,
      ocrDocumentCharge: 0,
      scrapeSiteCharge: 0,
      serverCostPerDocument: 0,
      serverCostPerScrape: 0,
      triangulationCost: 0,
      physicalVerificationCost: 0,
      monthlySmsCost: 0,
      monthlyEmailCost: 0,
      monthlyOtherCost: 0,
      currency: 'INR',
      updatedAt: null,
    };
  }

  private toRatesView(row: BillingRateConfig | null): BillingRatesView {
    if (!row) return this.emptyRates();
    return {
      id: row.id,
      ocrDocumentCharge: num(row.ocrDocumentCharge),
      scrapeSiteCharge: num(row.scrapeSiteCharge),
      serverCostPerDocument: num(row.serverCostPerDocument),
      serverCostPerScrape: num(row.serverCostPerScrape),
      triangulationCost: num(row.triangulationCost),
      physicalVerificationCost: num(row.physicalVerificationCost),
      monthlySmsCost: num(row.monthlySmsCost),
      monthlyEmailCost: num(row.monthlyEmailCost),
      monthlyOtherCost: num(row.monthlyOtherCost),
      currency: row.currency || 'INR',
      updatedAt: row.updatedAt?.toISOString?.() ?? null,
    };
  }

  async getRates(): Promise<APIResponseInterface<BillingRatesView>> {
    const row = await this.ratesRepo.find({
      order: { updatedAt: 'DESC' },
      take: 1,
    });
    return {
      code: HttpStatus.OK,
      message: 'Billing rates fetched',
      data: this.toRatesView(row[0] ?? null),
    };
  }

  async saveRates(
    dto: UpdateBillingRatesDto,
    userId?: string,
  ): Promise<APIResponseInterface<BillingRatesView>> {
    let row =
      (
        await this.ratesRepo.find({
          order: { updatedAt: 'DESC' },
          take: 1,
        })
      )[0] ?? null;

    if (!row) {
      row = this.ratesRepo.create();
    }

    row.ocrDocumentCharge = dto.ocrDocumentCharge;
    row.scrapeSiteCharge = dto.scrapeSiteCharge;
    row.serverCostPerDocument = dto.serverCostPerDocument;
    row.serverCostPerScrape = dto.serverCostPerScrape;
    row.triangulationCost = dto.triangulationCost;
    row.physicalVerificationCost = dto.physicalVerificationCost;
    row.monthlySmsCost = dto.monthlySmsCost;
    row.monthlyEmailCost = dto.monthlyEmailCost;
    row.monthlyOtherCost = dto.monthlyOtherCost;
    row.currency = (dto.currency || 'INR').trim().toUpperCase() || 'INR';
    row.updatedBy = userId ?? null;

    const saved = await this.ratesRepo.save(row);
    return {
      code: HttpStatus.OK,
      message: 'Billing rates saved',
      data: this.toRatesView(saved),
    };
  }

  private async requireClient(clientId: string): Promise<Client> {
    const client = await this.clientRepo.findOne({ where: { id: clientId } });
    if (!client) throw new NotFoundException('Client not found');
    return client;
  }

  private async buildBillForClient(
    client: Client,
    from: Date,
    to: Date,
    rates: BillingRatesView,
  ): Promise<ClientBillDetail> {
    const lineItems: BillingLineItem[] = [];
    let lineSeq = 0;
    const pushLine = (item: Omit<BillingLineItem, 'id'>) => {
      lineSeq += 1;
      lineItems.push({ ...item, id: `line_${lineSeq}` });
    };

    const usage: BillingUsageCounts = {
      successfulOcrDocuments: 0,
      successfulScrapes: 0,
      triangulationCases: 0,
      physicalVerifications: 0,
      monthsCovered: 0,
    };

    // --- OCR cases in period (charge only successful OCR docs + successful scrapes) ---
    const ocrRows = await this.ocrRepo.find({
      where: {
        clientId: client.id,
        createdAt: Between(from, to),
      },
      order: { createdAt: 'ASC' },
    });

    for (const ocr of ocrRows) {
      const when = (ocr.reportGeneratedAt ?? ocr.updatedAt ?? ocr.createdAt).toISOString();
      const docs = countSuccessfulOcrDocs(ocr.documentsPayload);
      for (const doc of docs) {
        usage.successfulOcrDocuments += 1;
        const ocrAmt = money(rates.ocrDocumentCharge);
        const srvAmt = money(rates.serverCostPerDocument);
        pushLine({
          category: 'OCR_DOCUMENT',
          categoryLabel: 'OCR document',
          occurredAt: when,
          quantity: 1,
          unitRate: ocrAmt,
          amount: ocrAmt,
          description: `Successful OCR — ${doc.label}${doc.fileName ? ` (${doc.fileName})` : ''}`,
          referenceType: 'ocr',
          referenceId: ocr.id,
          meta: { documentKey: doc.key },
        });
        if (srvAmt > 0) {
          pushLine({
            category: 'OCR_SERVER',
            categoryLabel: 'Server cost (document)',
            occurredAt: when,
            quantity: 1,
            unitRate: srvAmt,
            amount: srvAmt,
            description: `Server cost for OCR document — ${doc.label}`,
            referenceType: 'ocr',
            referenceId: ocr.id,
            meta: { documentKey: doc.key },
          });
        }
      }

      const scrapes = countSuccessfulScrapes(ocr.scrapePayload);
      for (const scrape of scrapes) {
        usage.successfulScrapes += 1;
        const scrapeAmt = money(rates.scrapeSiteCharge);
        const scrapeSrv = money(rates.serverCostPerScrape);
        const at = scrape.scrapedAt || when;
        pushLine({
          category: 'SCRAPE_SITE',
          categoryLabel: 'Scrape site',
          occurredAt: at,
          quantity: 1,
          unitRate: scrapeAmt,
          amount: scrapeAmt,
          description: `Successful site scrape — ${scrape.key} (from OCR case)`,
          referenceType: 'ocr',
          referenceId: ocr.id,
          meta: { scrapeKey: scrape.key, source: 'ocr' },
        });
        if (scrapeSrv > 0) {
          pushLine({
            category: 'SCRAPE_SERVER',
            categoryLabel: 'Server cost (scrape)',
            occurredAt: at,
            quantity: 1,
            unitRate: scrapeSrv,
            amount: scrapeSrv,
            description: `Server cost for scrape — ${scrape.key}`,
            referenceType: 'ocr',
            referenceId: ocr.id,
            meta: { scrapeKey: scrape.key, source: 'ocr' },
          });
        }
      }
    }

    // --- Digital verification scrapes + triangulation ---
    const digitalRows = await this.digitalRepo.find({
      where: {
        clientId: client.id,
        createdAt: Between(from, to),
      },
      order: { createdAt: 'ASC' },
    });

    const triangulationEnabled = !!client.setting?.triangulation;

    for (const dig of digitalRows) {
      const when = (dig.reportGeneratedAt ?? dig.updatedAt ?? dig.createdAt).toISOString();
      const scrapes = countSuccessfulScrapes(dig.scrapePayload);
      for (const scrape of scrapes) {
        usage.successfulScrapes += 1;
        const scrapeAmt = money(rates.scrapeSiteCharge);
        const scrapeSrv = money(rates.serverCostPerScrape);
        const at = scrape.scrapedAt || when;
        pushLine({
          category: 'SCRAPE_SITE',
          categoryLabel: 'Scrape site',
          occurredAt: at,
          quantity: 1,
          unitRate: scrapeAmt,
          amount: scrapeAmt,
          description: `Successful site scrape — ${scrape.key} (from digital verification)`,
          referenceType: 'digital',
          referenceId: dig.id,
          meta: { scrapeKey: scrape.key, source: 'digital' },
        });
        if (scrapeSrv > 0) {
          pushLine({
            category: 'SCRAPE_SERVER',
            categoryLabel: 'Server cost (scrape)',
            occurredAt: at,
            quantity: 1,
            unitRate: scrapeSrv,
            amount: scrapeSrv,
            description: `Server cost for scrape — ${scrape.key}`,
            referenceType: 'digital',
            referenceId: dig.id,
            meta: { scrapeKey: scrape.key, source: 'digital' },
          });
        }
      }

      if (
        triangulationEnabled &&
        dig.status === 'REPORT_GENERATED' &&
        money(rates.triangulationCost) > 0
      ) {
        usage.triangulationCases += 1;
        const amt = money(rates.triangulationCost);
        pushLine({
          category: 'TRIANGULATION',
          categoryLabel: 'Triangulation',
          occurredAt: when,
          quantity: 1,
          unitRate: amt,
          amount: amt,
          description: `Triangulation case completed — digital verification ${dig.id.slice(0, 8)}…`,
          referenceType: 'digital',
          referenceId: dig.id,
        });
      }
    }

    // --- Physical verification (only completed reports) ---
    const physicalRows = await this.physicalRepo.find({
      where: {
        clientId: client.id,
        status: 'REPORT_GENERATED',
        updatedAt: Between(from, to),
      },
      order: { updatedAt: 'ASC' },
    });

    for (const phys of physicalRows) {
      usage.physicalVerifications += 1;
      const when = (phys.reportGeneratedAt ?? phys.updatedAt ?? phys.createdAt).toISOString();
      const amt = money(rates.physicalVerificationCost);
      pushLine({
        category: 'PHYSICAL_VERIFICATION',
        categoryLabel: 'Physical verification',
        occurredAt: when,
        quantity: 1,
        unitRate: amt,
        amount: amt,
        description: `Physical verification report generated${
          phys.customerName ? ` — ${phys.customerName}` : ''
        }`,
        referenceType: 'physical',
        referenceId: phys.id,
      });
    }

    // --- Monthly fixed costs (SMS / Email / Other) for each overlapping month ---
    const months = monthsBetween(from, to);
    usage.monthsCovered = months.length;
    for (const m of months) {
      const label = m.start.toLocaleString('en-IN', {
        month: 'long',
        year: 'numeric',
      });
      const stamp = m.end.toISOString();
      if (money(rates.monthlySmsCost) > 0) {
        pushLine({
          category: 'MONTHLY_SMS',
          categoryLabel: 'SMS (monthly)',
          occurredAt: stamp,
          quantity: 1,
          unitRate: money(rates.monthlySmsCost),
          amount: money(rates.monthlySmsCost),
          description: `Monthly SMS cost — ${label}`,
          referenceType: 'monthly',
          referenceId: monthKey(m.start),
        });
      }
      if (money(rates.monthlyEmailCost) > 0) {
        pushLine({
          category: 'MONTHLY_EMAIL',
          categoryLabel: 'Email (monthly)',
          occurredAt: stamp,
          quantity: 1,
          unitRate: money(rates.monthlyEmailCost),
          amount: money(rates.monthlyEmailCost),
          description: `Monthly email cost — ${label}`,
          referenceType: 'monthly',
          referenceId: monthKey(m.start),
        });
      }
      if (money(rates.monthlyOtherCost) > 0) {
        pushLine({
          category: 'MONTHLY_OTHER',
          categoryLabel: 'Other (monthly)',
          occurredAt: stamp,
          quantity: 1,
          unitRate: money(rates.monthlyOtherCost),
          amount: money(rates.monthlyOtherCost),
          description: `Other monthly cost — ${label}`,
          referenceType: 'monthly',
          referenceId: monthKey(m.start),
        });
      }
    }

    lineItems.sort(
      (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
    );

    const totalsByCategory: Record<string, number> = {};
    let totalAmount = 0;
    for (const line of lineItems) {
      totalsByCategory[line.category] = money(
        (totalsByCategory[line.category] || 0) + line.amount,
      );
      totalAmount = money(totalAmount + line.amount);
    }

    return {
      clientId: client.id,
      companyName: client.companyName || client.email || client.id,
      email: client.email ?? null,
      currency: rates.currency,
      periodFrom: from.toISOString(),
      periodTo: to.toISOString(),
      rates,
      usage,
      totalsByCategory,
      totalAmount,
      lineItems,
    };
  }

  async getClientBill(
    clientId: string,
    fromRaw?: string,
    toRaw?: string,
  ): Promise<APIResponseInterface<ClientBillDetail>> {
    const client = await this.requireClient(clientId);
    const now = new Date();
    const from = parseDateBound(fromRaw, startOfMonth(now));
    const to = parseDateBound(toRaw, endOfMonth(now));
    const ratesRes = await this.getRates();
    const bill = await this.buildBillForClient(client, from, to, ratesRes.data!);
    return {
      code: HttpStatus.OK,
      message: 'Client bill calculated',
      data: bill,
    };
  }

  async getClientBillHistory(
    clientId: string,
  ): Promise<APIResponseInterface<ClientBillHistoryMonth[]>> {
    const client = await this.requireClient(clientId);
    const ratesRes = await this.getRates();
    const rates = ratesRes.data!;

    // Earliest activity across OCR / digital / physical
    const [ocrMin, digMin, physMin] = await Promise.all([
      this.ocrRepo
        .createQueryBuilder('o')
        .select('MIN(o.created_at)', 'min')
        .where('o.client_id = :id', { id: clientId })
        .getRawOne<{ min: Date | string | null }>(),
      this.digitalRepo
        .createQueryBuilder('d')
        .select('MIN(d.created_at)', 'min')
        .where('d.client_id = :id', { id: clientId })
        .getRawOne<{ min: Date | string | null }>(),
      this.physicalRepo
        .createQueryBuilder('p')
        .select('MIN(p.created_at)', 'min')
        .where('p.client_id = :id', { id: clientId })
        .getRawOne<{ min: Date | string | null }>(),
    ]);

    const dates = [ocrMin?.min, digMin?.min, physMin?.min]
      .filter(Boolean)
      .map((d) => new Date(d as string | Date))
      .filter((d) => !Number.isNaN(d.getTime()));

    if (!dates.length) {
      return {
        code: HttpStatus.OK,
        message: 'No billing history',
        data: [],
      };
    }

    const earliest = startOfMonth(
      dates.reduce((a, b) => (a < b ? a : b)),
    );
    const latest = startOfMonth(new Date());
    const months = monthsBetween(earliest, latest);
    const history: ClientBillHistoryMonth[] = [];

    for (const m of months) {
      const bill = await this.buildBillForClient(client, m.start, m.end, rates);
      // Skip empty months with zero activity and zero monthly fees configured
      if (
        bill.totalAmount <= 0 &&
        bill.usage.successfulOcrDocuments === 0 &&
        bill.usage.successfulScrapes === 0 &&
        bill.usage.physicalVerifications === 0 &&
        bill.usage.triangulationCases === 0
      ) {
        continue;
      }
      history.push({
        year: m.year,
        month: m.month,
        label: m.start.toLocaleString('en-IN', { month: 'long', year: 'numeric' }),
        periodFrom: m.start.toISOString(),
        periodTo: m.end.toISOString(),
        totalAmount: bill.totalAmount,
        usage: bill.usage,
      });
    }

    history.reverse();
    return {
      code: HttpStatus.OK,
      message: 'Billing history fetched',
      data: history,
    };
  }

  async listClientSummaries(opts: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<APIResponseInterface<ClientBillSummary[]>> {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(100, Math.max(1, opts.limit ?? 20));
    const qb = this.clientRepo.createQueryBuilder('c').orderBy('c.createdAt', 'DESC');

    if (opts.search?.trim()) {
      const s = `%${opts.search.trim()}%`;
      qb.andWhere(
        '(c.companyName LIKE :s OR c.email LIKE :s OR c.phone LIKE :s OR c.bankVendorName LIKE :s)',
        { s },
      );
    }

    const [clients, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const ratesRes = await this.getRates();
    const rates = ratesRes.data!;
    const now = new Date();
    const monthFrom = startOfMonth(now);
    const monthTo = endOfMonth(now);
    const lifeFrom = new Date(2000, 0, 1);

    const data: ClientBillSummary[] = [];
    for (const client of clients) {
      const current = await this.buildBillForClient(client, monthFrom, monthTo, rates);
      const lifetime = await this.buildBillForClient(client, lifeFrom, monthTo, rates);
      data.push({
        clientId: client.id,
        companyName: client.companyName || client.email || client.id,
        email: client.email ?? null,
        currency: rates.currency,
        currentMonthTotal: current.totalAmount,
        lifetimeTotal: lifetime.totalAmount,
        usage: current.usage,
      });
    }

    return {
      code: HttpStatus.OK,
      message: 'Client billing summaries fetched',
      data,
      pagination: { total, page, pagePerRecord: limit },
    };
  }

  /** Lightweight map of clientId → current month bill total (for client listing). */
  async getCurrentMonthTotalsMap(
    clientIds: string[],
  ): Promise<APIResponseInterface<Record<string, number>>> {
    const ratesRes = await this.getRates();
    const rates = ratesRes.data!;
    const now = new Date();
    const from = startOfMonth(now);
    const to = endOfMonth(now);
    const map: Record<string, number> = {};

    for (const id of clientIds) {
      if (!id) continue;
      try {
        const client = await this.requireClient(id);
        const bill = await this.buildBillForClient(client, from, to, rates);
        map[id] = bill.totalAmount;
      } catch {
        map[id] = 0;
      }
    }

    return {
      code: HttpStatus.OK,
      message: 'Current month totals',
      data: map,
    };
  }
}
