import {
  Injectable,
  HttpStatus,
  ServiceUnavailableException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import type { Browser } from 'puppeteer';
import { APIResponseInterface } from '../../interface/response.interface';
import { randomUUID } from 'crypto';

type GstScrapeResult = {
  gstNumber: string;
  sourceUrl: string;
  extractedAt: string;
  fields: Record<string, string>;
};

type GstPortalSession = {
  gstNumber: string;
  cookies: any[];
  createdAtMs: number;
};

type GstPortalInitResult = {
  sessionId: string;
  gstNumber: string;
  sourceUrl: string;
  captchaImageBase64: string;
};

type GstPortalSearchResult = {
  gstNumber: string;
  sourceUrl: string;
  extractedAt: string;
  details: Record<string, any>;
  html: string;
};

@Injectable()
export class ScrappingService {
  private gstPortalSessions = new Map<string, GstPortalSession>();
  private gstPortalSessionTtlMs = 5 * 60 * 1000;

  private async launchBrowser(): Promise<Browser> {
    try {
      const puppeteer = await import('puppeteer');
      return await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    } catch (e: any) {
      throw new ServiceUnavailableException(
        `Puppeteer launch failed: ${e?.message ?? 'unknown error'}`,
      );
    }
  }

  private normalizeText(value: unknown): string {
    return String(value ?? '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private cleanupExpiredGstPortalSessions() {
    const now = Date.now();
    for (const [id, session] of this.gstPortalSessions.entries()) {
      if (now - session.createdAtMs > this.gstPortalSessionTtlMs) {
        this.gstPortalSessions.delete(id);
      }
    }
  }

  private async extractCaptchaBase64(page: any): Promise<string> {
    // Prefer element screenshot; works for <img>, <canvas>, background images, etc.
    const selectors = [
      'img[src*="captcha" i]',
      'img[id*="captcha" i]',
      'img[class*="captcha" i]',
      'canvas[id*="captcha" i]',
      'canvas[class*="captcha" i]',
      'canvas',
    ];

    for (const selector of selectors) {
      const el = await page.$(selector);
      if (!el) continue;
      try {
        const b64 = await el.screenshot({ encoding: 'base64' });
        if (typeof b64 === 'string' && b64.length > 100) return b64;
      } catch {
        // continue
      }
    }

    // Fallback: try to locate an <img> and if it's already a data URL, return it.
    const dataUrl = await page.evaluate(() => {
      const images = Array.from(document.querySelectorAll('img')) as HTMLImageElement[];
      const candidate =
        images.find((i) => /captcha/i.test(i.id || '')) ||
        images.find((i) => /captcha/i.test(i.className || '')) ||
        images.find((i) => /captcha/i.test(i.getAttribute('alt') || '')) ||
        images.find((i) => /captcha/i.test(i.getAttribute('src') || '')) ||
        images.find((i) => (i.getAttribute('src') || '').startsWith('data:image/'));
      return candidate?.getAttribute('src') || '';
    });

    if (dataUrl?.startsWith('data:image/') && dataUrl.includes('base64,')) {
      return dataUrl.split('base64,')[1] || '';
    }

    throw new ServiceUnavailableException('Captcha image not found on GST portal page');
  }

  async gstPortalInit(
    gstNumber: string,
  ): Promise<APIResponseInterface<GstPortalInitResult>> {
    this.cleanupExpiredGstPortalSessions();

    const gst = gstNumber.trim().toUpperCase();
    const url = 'https://services.gst.gov.in/services/searchtp';

    const browser = await this.launchBrowser();
    try {
      const page = await browser.newPage();
      page.setDefaultNavigationTimeout(60_000);
      page.setDefaultTimeout(30_000);

      await page.goto(url, { waitUntil: 'domcontentloaded' });

      // Fill GSTIN/UIN input (type to trigger keyup handler that shows captcha).
      await page.waitForSelector('input#for_gstin', { timeout: 30_000 });
      await page.focus('input#for_gstin');
      await page.keyboard.down('Control');
      await page.keyboard.press('A');
      await page.keyboard.up('Control');
      await page.keyboard.press('Backspace');
      await page.type('input#for_gstin', gst, { delay: 50 });

      // Click Search to trigger captcha (portal shows captcha flow after this).
      await page.click('button#lotsearch').catch(() => undefined);

      // Wait for captcha input to appear (best signal that captcha is rendered).
      await page
        .waitForSelector('input[name="cap"], input#cap, input[ng-model*="cap"]', {
          timeout: 30_000,
        })
        .catch(() => undefined);

      // Give UI a moment to paint captcha element after the input shows up.
      await new Promise((r) => setTimeout(r, 750));

      const captchaImageBase64 = await this.extractCaptchaBase64(page);
      const cookies = await page.cookies();

      const sessionId = randomUUID();
      this.gstPortalSessions.set(sessionId, {
        gstNumber: gst,
        cookies,
        createdAtMs: Date.now(),
      });

      return {
        code: HttpStatus.OK,
        message: 'Captcha generated successfully',
        data: {
          sessionId,
          gstNumber: gst,
          sourceUrl: url,
          captchaImageBase64,
        },
      };
    } finally {
      await browser.close().catch(() => undefined);
    }
  }

  // async gstPortalSearch(
  //   sessionId: string,
  //   captchaCode: string,
  // ): Promise<APIResponseInterface<GstPortalSearchResult>> {
  
  //   this.cleanupExpiredGstPortalSessions();
  
  //   const session = this.gstPortalSessions.get(sessionId);
  
  //   if (!session) {
  //     throw new NotFoundException(
  //       'Session expired or invalid',
  //     );
  //   }
  
  //   const url =
  //     'https://services.gst.gov.in/services/searchtp';
  
  //   const browser = await this.launchBrowser();
  
  //   try {
  
  //     const page : any = await browser.newPage();
  
  //     page.setDefaultNavigationTimeout(
  //       60000,
  //     );
  
  //     page.setDefaultTimeout(
  //       30000,
  //     );
  
  //     if (session.cookies?.length) {
  //       await page.setCookie(
  //         ...(session.cookies as any),
  //       );
  //     }
  
  //     await page.goto(
  //       url,
  //       {
  //         waitUntil: 'networkidle2'
  //       }
  //     );
  
  //     await page.waitForSelector(
  //       '#for_gstin',
  //       {
  //         visible: true
  //       }
  //     );
  
  //     //
  //     // ENTER GST NUMBER
  //     //
  
  //     await page.click(
  //       '#for_gstin',
  //       {
  //         clickCount: 3
  //       }
  //     );
  
  //     await page.keyboard.press(
  //       'Backspace'
  //     );
  
  //     await page.type(
  //       '#for_gstin',
  //       session.gstNumber,
  //       {
  //         delay: 50
  //       }
  //     );
  
  //     //
  //     // CAPTCHA
  //     //
  
  //     const captchaSelector =
  //       'input#fo-captcha,' +
  //       'input#captcha,' +
  //       'input[name="cap"]';
  
  //     const captchaExists =
  //       await page.$(
  //         captchaSelector
  //       );
  
  //     if (captchaExists) {
  
  //       if (!captchaCode?.trim()) {
  //         throw new BadRequestException(
  //           'captchaCode required'
  //         );
  //       }
  
  //       await page.click(
  //         captchaSelector,
  //         {
  //           clickCount: 3
  //         }
  //       );
  
  //       await page.keyboard.press(
  //         'Backspace'
  //       );
  
  //       await page.type(
  //         captchaSelector,
  //         captchaCode.trim(),
  //         {
  //           delay: 100
  //         }
  //       );
  //     }
  
  //     //
  //     // CLICK SEARCH
  //     //
  
  //     await Promise.all([
  
  //       page.click(
  //         '#lotsearch'
  //       ),
  
  //       page.waitForFunction(
  //         () => {
  
  //           const el =
  //             document.querySelector(
  //               '#lottable'
  //             );
  
  //           if (!el) {
  //             return false;
  //           }
  
  //           const txt =
  //             el.textContent || '';
  
  //           return (
  //             txt.length > 100 &&
  //             txt.includes(
  //               'Legal Name'
  //             )
  //           );
  
  //         },
  //         {
  //           timeout: 45000
  //         }
  //       )
  
  //     ]);
  
  //     //
  //     // EXTRA WAIT FOR ANGULAR
  //     //
  
  //     await page.waitForTimeout(
  //       2000
  //     );
  
  //     const result : any =
  //       await page.evaluate(() => {
  
  //       const clean = (
  //         value: string
  //       ) =>
  //         value
  //         ?.replace(
  //           /\s+/g,
  //           ' '
  //         )
  //         .trim();
  
  //       const out: any = {};
  
  //       const root =
  //         document.querySelector(
  //           '#lottable'
  //         );
  
  //       if (!root) {
  //         return null;
  //       }
  
  //       //
  //       // BASIC DETAILS
  //       //
  
  //       root
  //       .querySelectorAll(
  //         '.tbl-format .col-sm-4'
  //       )
  //       .forEach(
  //         (col) => {
  
  //         const strong =
  //           col.querySelector(
  //             'strong'
  //           );
  
  //         const p =
  //           col.querySelectorAll(
  //             'p'
  //           );
  
  //         const label =
  //           clean(
  //             strong?.textContent || ''
  //           );
  
  //         if (
  //           label &&
  //           p.length >= 2
  //         ) {
  
  //           out[label] =
  //             clean(
  //               p[
  //                 p.length - 1
  //               ].textContent || ''
  //             );
  
  //         }
  
  //       });
  
  //       //
  //       // ADMIN OFFICE
  //       //
  
  //       const office =
  //         Array.from(
  //           root.querySelectorAll(
  //             '.jurisdictList li'
  //           )
  //         )
  //         .map(
  //           x =>
  //             clean(
  //               x.textContent || ''
  //             )
  //         );
  
  //       out.adminOffice =
  //         office;
  
  //       //
  //       // BUSINESS ACTIVITY
  //       //
  
  //       out.businessActivities =
  //         Array.from(
  //           root.querySelectorAll(
  //             '.list-child-inline li'
  //           )
  //         )
  //         .map(
  //           x =>
  //             clean(
  //               x.textContent || ''
  //             )
  //         );
  
  //       //
  //       // GOODS
  //       //
  
  //       out.goods =
  //         [];
  
  //       root
  //       .querySelectorAll(
  //         'table tbody tr'
  //       )
  //       .forEach(
  //         row => {
  
  //         const td =
  //           row.querySelectorAll(
  //             'td'
  //           );
  
  //         if (
  //           td.length >= 2 &&
  //           td[0]
  //           .innerText !==
  //           'HSN'
  //         ) {
  
  //           out.goods.push({
  
  //             hsn:
  //             clean(
  //               td[0]
  //               .innerText
  //             ),
  
  //             description:
  //             clean(
  //               td[1]
  //               .innerText
  //             )
  
  //           });
  
  //         }
  
  //       });
  
  //       return {
  
  //         details: out,
  
  //         html:
  //           root.outerHTML
  
  //       };
  
  //     });
  
  //     this
  //     .gstPortalSessions
  //     .delete(
  //       sessionId
  //     );
  
  //     return {
  
  //       code:
  //         HttpStatus.OK,
  
  //       message:
  //         'GST fetched successfully',
  
  //       data: {
  
  //         gstNumber:
  //           session.gstNumber,
  
  //         sourceUrl:
  //           url,
  
  //         extractedAt:
  //           new Date()
  //           .toISOString(),
  
  //         details:
  //           result.details,
  
  //         html:
  //           result.html
  
  //       }
  
  //     };
  
  //   }
  //   finally {
  
  //     await browser
  //     .close()
  //     .catch(
  //       () => {}
  //     );
  
  //   }
  
  // }

  async gstPortalSearch(
    sessionId: string,
    captchaCode: string,
  ): Promise<APIResponseInterface<GstPortalSearchResult>> {
    this.cleanupExpiredGstPortalSessions();

    const session = this.gstPortalSessions.get(sessionId);
    if (!session) {
      throw new NotFoundException('Session expired or invalid. Please regenerate captcha.');
    }

    const url = 'https://services.gst.gov.in/services/searchtp';

    const browser = await this.launchBrowser();
    try {
      const page = await browser.newPage();
      page.setDefaultNavigationTimeout(60_000);
      page.setDefaultTimeout(30_000);

      if (session.cookies?.length) {
        await page.setCookie(...(session.cookies as any));
      }

      // await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.goto(url, { waitUntil: 'networkidle2' });
      await page.waitForSelector('input#for_gstin', { timeout: 30_000 });

      // Fill GSTIN/UIN input.
      await page.evaluate(
        (gstinValue) => {
          const gstin = document.querySelector('input#for_gstin') as HTMLInputElement | null;
          if (gstin) {
            gstin.value = gstinValue;
            gstin.dispatchEvent(new Event('input', { bubbles: true }));
            gstin.dispatchEvent(new Event('change', { bubbles: true }));
          }
        },
        session.gstNumber,
      );

      // If captcha input exists on the page, require captchaCode and fill it.
      const capSelector = 'input[name="cap"], input#cap, input[ng-model*="cap"]';
      const capInput = await page.$(capSelector);
      if (capInput) {
        const code = (captchaCode ?? '').trim();
        if (!code) {
          throw new BadRequestException('captchaCode is required');
        }
        await page.focus(capSelector).catch(() => undefined);
        await page.keyboard.down('Control');
        await page.keyboard.press('A');
        await page.keyboard.up('Control');
        await page.keyboard.press('Backspace');
        await page.type(capSelector, code, { delay: 50 }).catch(() => undefined);
      }

      await page.click('button#lotsearch').catch(() => undefined);

      // Wait for results block to appear.
      await page.waitForSelector('#lottable', { timeout: 45_000 });

      const { details, html } = await page.evaluate(() => {
        const out: Record<string, any> = {};
        const lottable = document.querySelector('#lottable') as HTMLElement | null;
        if (!lottable) return { details: out, html: '' };

        // Extract simple labeled fields: <p><strong>Label</strong></p> followed by a <p>Value</p>
        const inners = Array.from(lottable.querySelectorAll('.tbl-format .inner'));
        for (const inner of inners) {
          const cols = Array.from(inner.querySelectorAll('[class*="col-"]'));
          for (const col of cols) {
            const strong = col.querySelector('p strong');
            const ps = Array.from(col.querySelectorAll('p'));
            const label = (strong?.textContent || '').replace(/\s+/g, ' ').trim();
            const valueCandidate = ps
              .map((p) => (p.textContent || '').replace(/\s+/g, ' ').trim())
              .filter(Boolean)
              .filter((t) => t !== label);
            const value = valueCandidate[0] || '';
            if (label) out[label] = value;

            // Administrative/Other office lists
            const ul = col.querySelector('ul');
            if (label && ul) {
              const items = Array.from(ul.querySelectorAll('li'))
                .map((li) => (li.textContent || '').replace(/\s+/g, ' ').trim())
                .filter(Boolean);
              if (items.length) out[label] = items;
            }
          }
        }

        // Principal Place of Business (has ng-bind in sample; UI renders as text)
        const principal =
          lottable.querySelector('.taxpayer-info')?.parentElement?.querySelector(
            'p.wordCls',
          ) || lottable.querySelector('p.wordCls');
        if (principal?.textContent?.trim()) {
          out['Principal Place of Business'] = principal.textContent
            .replace(/\s+/g, ' ')
            .trim();
        }

        return { details: out, html: lottable.outerHTML };
      });

      // One-time session use (avoid stale captcha/cookies)
      this.gstPortalSessions.delete(sessionId);

      return {
        code: HttpStatus.OK,
        message: 'GST portal details fetched successfully',
        data: {
          gstNumber: session.gstNumber,
          sourceUrl: url,
          extractedAt: new Date().toISOString(),
          details,
          html,
        },
      };
    } finally {
      await browser.close().catch(() => undefined);
    }
  }

  async gstSearch(gstNumber: string): Promise<APIResponseInterface<GstScrapeResult>> {
    const gst = gstNumber.trim().toUpperCase();
    const baseUrl = 'https://www.knowyourgst.com/gst-number-search/';
    const url = `${baseUrl}?gstnum=${encodeURIComponent(gst)}`;

    const browser = await this.launchBrowser();
    try {
      const page = await browser.newPage();
      page.setDefaultNavigationTimeout(45_000);
      page.setDefaultTimeout(20_000);

      // Load page (query param may or may not populate results). If results table not present,
      // fill the form and submit to get the table.
      await page.goto(url, { waitUntil: 'domcontentloaded' });

      const resultsSelector = 'table.questionlist tbody tr';
      const hasResults = await page.$(resultsSelector);
      if (!hasResults) {
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('input#gstnumber', { timeout: 20_000 });
        await page.evaluate((value) => {
          const input = document.querySelector('input#gstnumber') as HTMLInputElement | null;
          if (!input) return;
          input.value = value;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }, gst);

        const navigationPromise = page
          .waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20_000 })
          .catch(() => undefined);
        const clickPromise = page
          .click('form[action="/gst-number-search/"] input[type="submit"]')
          .catch(() => undefined);
        await Promise.all([navigationPromise, clickPromise]);
      }

      await page.waitForSelector(resultsSelector, { timeout: 20_000 });

      // Extract only the GST details table shown in UI (avoid login modal tables).
      const fields = await page.evaluate(() => {
        const result: Record<string, string> = {};
        const rows = Array.from(
          document.querySelectorAll('table.questionlist tbody tr'),
        ) as HTMLTableRowElement[];

        for (const tr of rows) {
          const tds = Array.from(tr.querySelectorAll('td')).map((td) =>
            (td.textContent ?? '').replace(/\s+/g, ' ').trim(),
          );
          if (tds.length >= 2 && tds[0] && tds[1]) {
            result[tds[0]] = tds[1];
          }
        }
        return result;
      });

      // If site blocked or structure changed, fields may be empty; still return with sourceUrl.
      const normalizedFields: Record<string, string> = {};
      for (const [k, v] of Object.entries(fields ?? {})) {
        const nk = this.normalizeText(k);
        const nv = this.normalizeText(v);
        if (nk && nv) normalizedFields[nk] = nv;
      }

      return {
        code: HttpStatus.OK,
        message: 'GST details fetched successfully',
        data: {
          gstNumber: gst,
          sourceUrl: url,
          extractedAt: new Date().toISOString(),
          fields: normalizedFields,
        },
      };
    } finally {
      await browser.close().catch(() => undefined);
    }
  }
}

