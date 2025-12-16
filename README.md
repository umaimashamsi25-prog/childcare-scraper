# Ontario Childcare Scraper

Production-ready Playwright scraper for the Ontario early years childcare directory. The tool collects provider details from every search results page, writes them locally to JSON/CSV, and optionally upserts records into Base44.

## Prerequisites

- Node.js 18+
- npm
- Playwright browsers (install with `npx playwright install chromium` after dependencies)

## Setup

```bash
npm install
```

Configure Base44 (optional) with environment variables:

- `BASE44_API_URL` – Base44 API base URL (e.g., `https://api.base44.com/v1`)
- `BASE44_API_KEY` – API key with permission to upsert providers

Create a `.env` file or export variables in your shell.

## Usage

Run the scraper:

```bash
npm run scrape -- --headless --start-page 1 --dry-run
```

### Options

- `--headless` (boolean, default: `true`) – run browser in headless mode
- `--start-page` (number, default: `1`) – starting search results page
- `--max-pages` (number) – limit how many pages to process
- `--dry-run` (boolean, default: `false`) – collect data but do not write to Base44
- `--delay` (number, default: `500`) – delay between navigation steps in milliseconds

Outputs are saved to `data/providers.json` and `data/providers.csv`. Error screenshots and HTML snapshots are written to `artifacts/errors/`.

## Implementation Notes

- Uses Playwright to maintain session state with the JSF application.
- Clicks each provider row, scrapes detail fields, then navigates back to results.
- Normalizes whitespace, phone numbers, languages, and postal codes; deduplicates by provider name + address.
- Retries and waits are implemented via small delays to respect the site.
- Base44 upserts are skipped automatically when credentials are absent or `--dry-run` is set.
