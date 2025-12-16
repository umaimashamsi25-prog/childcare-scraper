import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { ChildcareScraper } from './scraper';
import { ScraperOptions } from './types';

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .option('headless', {
      type: 'boolean',
      default: true,
      describe: 'Run browser in headless mode'
    })
    .option('start-page', {
      type: 'number',
      default: 1,
      describe: 'Page number to start scraping from'
    })
    .option('max-pages', {
      type: 'number',
      describe: 'Maximum number of pages to scrape'
    })
    .option('dry-run', {
      type: 'boolean',
      default: false,
      describe: 'Skip Base44 writes'
    })
    .option('delay', {
      type: 'number',
      default: 500,
      describe: 'Delay between actions in milliseconds'
    })
    .help()
    .parse();

  const options: ScraperOptions = {
    headless: argv.headless as boolean,
    startPage: argv['start-page'] as number,
    maxPages: argv['max-pages'] as number | undefined,
    dryRun: argv['dry-run'] as boolean,
    delayMs: argv.delay as number
  };

  const scraper = new ChildcareScraper(options);
  await scraper.run();
}

main().catch((error) => {
  console.error('Scraper failed:', error);
  process.exit(1);
});
