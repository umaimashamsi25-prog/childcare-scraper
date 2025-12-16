import { Base44Config, ProviderRecord } from './types';

export class Base44Client {
  private config: Base44Config;
  private dryRun: boolean;

  constructor(config: Base44Config, dryRun: boolean) {
    this.config = config;
    this.dryRun = dryRun;
  }

  async upsertProvider(provider: ProviderRecord): Promise<void> {
    if (this.dryRun) {
      console.log('[DRY RUN] Skipping Base44 upsert for', provider.name);
      return;
    }
    const url = `${this.config.apiUrl.replace(/\/$/, '')}/provider`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify(provider)
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Base44 upsert failed (${response.status}): ${body}`);
    }
  }
}

export function loadBase44Config(): Base44Config {
  const apiUrl = process.env.BASE44_API_URL;
  const apiKey = process.env.BASE44_API_KEY;
  if (!apiUrl || !apiKey) {
    throw new Error('Missing BASE44_API_URL or BASE44_API_KEY environment variables');
  }
  return { apiUrl, apiKey };
}
