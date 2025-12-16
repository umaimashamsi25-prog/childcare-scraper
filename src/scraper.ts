import fs from 'fs';
import path from 'path';
import { chromium, Browser, Page } from 'playwright';
import { Base44Client, loadBase44Config } from './base44Client';
import { ProviderRecord, ScraperOptions } from './types';
import {
  delay,
  normalizeWhitespace,
  normalizePhone,
  extractPostalCode,
  normalizeList,
  uniqueKey,
  saveJson,
  saveCsv,
  ensureDir
} from './utils';

const BASE_URL = 'https://www.earlyyears.edu.gov.on.ca/LCCWWeb/childcare/searchResults.xhtml';

export class ChildcareScraper {
  private browser?: Browser;
  private page?: Page;
  private options: ScraperOptions;
  private base44?: Base44Client;
  private records: ProviderRecord[] = [];
  private recordKeys = new Set<string>();
  private errorDir = path.join('artifacts', 'errors');

  constructor(options: ScraperOptions) {
    this.options = options;
    ensureDir(this.errorDir);
    if (process.env.BASE44_API_URL && process.env.BASE44_API_KEY) {
      this.base44 = new Base44Client(loadBase44Config(), options.dryRun);
    }
  }

  async run() {
    this.browser = await chromium.launch({ headless: this.options.headless });
    this.page = await this.browser.newPage({ viewport: { width: 1280, height: 720 } });
    try {
      await this.page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
      await this.page.waitForSelector('table');
      if (this.options.startPage > 1) {
        await this.gotoPage(this.options.startPage);
      }

      let currentPage = this.options.startPage;
      let hasMore = true;
      let pagesScraped = 0;
      while (hasMore && (!this.options.maxPages || pagesScraped < this.options.maxPages)) {
        console.log(`Scraping page ${currentPage}`);
        const newRecords = await this.scrapeCurrentPage(currentPage);
        pagesScraped += 1;
        console.log(`Page ${currentPage} collected ${newRecords.length} providers (total ${this.records.length})`);
        hasMore = await this.goToNextPage();
        currentPage += 1;
      }

      saveJson(path.join('data', 'providers.json'), this.records);
      saveCsv(path.join('data', 'providers.csv'), this.records);
    } catch (error) {
      await this.captureError(error);
      throw error;
    } finally {
      await this.browser?.close();
    }
  }

  private async scrapeCurrentPage(pageNumber: number): Promise<ProviderRecord[]> {
    if (!this.page) throw new Error('Page not initialized');

    const rows = this.page.locator('table tbody tr');
    const count = await rows.count();
    const pageRecords: ProviderRecord[] = [];
    for (let i = 0; i < count; i++) {
      try {
        const row = rows.nth(i);
        const nameLink = row.locator('a');
        const name = normalizeWhitespace(await nameLink.textContent()) || 'Unknown Provider';
        const ageGroups = normalizeList(await row.locator('td:nth-child(2)').textContent());
        const address = normalizeWhitespace(await row.locator('td:nth-child(3)').textContent()) || 'Unknown Address';
        const phone = normalizePhone(await row.locator('td:nth-child(4)').textContent());

        await nameLink.click();
        await this.page.waitForSelector('h1, h2, h3, text=Child Care');
        await delay(this.options.delayMs);

        const record = await this.extractDetail({
          name,
          address,
          age_groups: ageGroups,
          phone,
          postal_code: extractPostalCode(address),
          source_url: this.page.url()
        });

        const key = uniqueKey(record);
        if (!this.recordKeys.has(key)) {
          this.recordKeys.add(key);
          this.records.push(record);
          pageRecords.push(record);
          if (this.base44) {
            await this.base44.upsertProvider(record);
          }
        } else {
          console.log('Duplicate detected, skipping', record.name);
        }
      } catch (error) {
        console.error(`Failed to process row ${i + 1} on page ${pageNumber}`, error);
        await this.captureError(error);
      } finally {
        await this.page.goBack({ waitUntil: 'domcontentloaded' });
        await this.page.waitForSelector('table');
        await delay(this.options.delayMs);
      }
    }
    return pageRecords;
  }

  private async extractDetail(base: ProviderRecord): Promise<ProviderRecord> {
    if (!this.page) throw new Error('Page not initialized');

    const getValue = async (label: string): Promise<string | undefined> => {
      const locator = this.page!.locator(`xpath=//label[contains(normalize-space(.), "${label}")]/following::*[1]`);
      if (await locator.count()) {
        return normalizeWhitespace(await locator.first().textContent());
      }
      return undefined;
    };

    const programType = await getValue('Type of program');
    const hours = await getValue('Days and hours of operation');
    const website = await this.extractWebsite();
    const languages = normalizeList(await getValue('Language of Service'));
    const cwelcc = await this.extractCwelcc();

    return {
      ...base,
      program_type: programType,
      hours_operation: hours,
      website,
      languages,
      cwelcc_participant: cwelcc
    };
  }

  private async extractWebsite(): Promise<string | undefined> {
    if (!this.page) return undefined;
    const link = this.page.locator('a[href^="http"], a[href^="www"]');
    for (let i = 0; i < (await link.count()); i++) {
      const href = await link.nth(i).getAttribute('href');
      if (href && href.startsWith('http')) {
        return normalizeWhitespace(href);
      }
    }
    return undefined;
  }

  private async extractCwelcc(): Promise<boolean | undefined> {
    if (!this.page) return undefined;
    const locator = this.page.locator('text=Canada-wide Early Learning and Child Care System');
    if ((await locator.count()) === 0) return undefined;
    const row = locator.first().locator('xpath=..');
    const text = normalizeWhitespace(await row.textContent());
    if (!text) return undefined;
    if (/\bYes\b/i.test(text)) return true;
    if (/\bNo\b/i.test(text)) return false;
    return undefined;
  }

  private async goToNextPage(): Promise<boolean> {
    if (!this.page) return false;
    const nextButton = this.page.locator('a[aria-label="Next"], a:has-text("Next")');
    if ((await nextButton.count()) === 0) return false;
    const isDisabled = (await nextButton.first().getAttribute('aria-disabled')) === 'true';
    if (isDisabled || (await nextButton.first().isDisabled())) return false;
    const previousUrl = this.page.url();
    const rows = this.page.locator('table tbody tr');
    const previousFirstRow = (await rows.count()) > 0 ? await rows.first().textContent() : undefined;

    await Promise.all([
      this.page.waitForLoadState('domcontentloaded'),
      nextButton.first().click()
    ]);

    await this.page.waitForSelector('table tbody tr');

    try {
      await this.page.waitForFunction(
        ([selector, previous]) => {
          const firstRow = document.querySelector(`${selector} tbody tr`);
          const text = firstRow?.textContent?.trim();
          return previous ? text && text !== previous.trim() : Boolean(text);
        },
        ['table', previousFirstRow],
        { timeout: 5000 }
      );
    } catch (err) {
      // If content did not change, assume we are at the last page.
      return false;
    }

    await delay(this.options.delayMs);
    const newUrl = this.page.url();
    return newUrl !== previousUrl || (await rows.first().textContent()) !== previousFirstRow;
  }

  private async gotoPage(target: number) {
    for (let i = 1; i < target; i++) {
      const hasMore = await this.goToNextPage();
      if (!hasMore) break;
    }
  }

  private async captureError(error: unknown) {
    if (!this.page) return;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const screenshotPath = path.join(this.errorDir, `error-${timestamp}.png`);
    const htmlPath = path.join(this.errorDir, `error-${timestamp}.html`);
    await this.page.screenshot({ path: screenshotPath, fullPage: true });
    fs.writeFileSync(htmlPath, await this.page.content(), 'utf-8');
    console.error('Error captured:', error);
  }
}
