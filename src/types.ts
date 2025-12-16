export interface ProviderRecord {
  name: string;
  address: string;
  postal_code?: string;
  phone?: string;
  age_groups?: string;
  program_type?: string;
  hours_operation?: string;
  website?: string;
  languages?: string;
  cwelcc_participant?: boolean;
  source_url?: string;
}

export interface ScraperOptions {
  headless: boolean;
  startPage: number;
  maxPages?: number;
  dryRun: boolean;
  delayMs: number;
}

export interface Base44Config {
  apiUrl: string;
  apiKey: string;
}
