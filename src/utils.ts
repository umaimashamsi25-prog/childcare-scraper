import fs from 'fs';
import path from 'path';
import { ProviderRecord } from './types';

export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function normalizeWhitespace(value?: string | null): string | undefined {
  if (!value) return undefined;
  return value.replace(/\s+/g, ' ').trim();
}

export function normalizePhone(value?: string | null): string | undefined {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return undefined;
  const digits = normalized.replace(/\D+/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return normalized;
}

export function extractPostalCode(address?: string | null): string | undefined {
  if (!address) return undefined;
  const match = address.toUpperCase().match(/[A-Z]\d[A-Z]\s?\d[A-Z]\d/);
  return match ? match[0].replace(' ', '') : undefined;
}

export function normalizeList(value?: string | null): string | undefined {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return undefined;
  return normalized
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .join(', ');
}

export function uniqueKey(provider: ProviderRecord): string {
  const name = normalizeWhitespace(provider.name)?.toLowerCase() ?? '';
  const address = normalizeWhitespace(provider.address)?.toLowerCase() ?? '';
  return `${name}|${address}`;
}

export function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function saveJson(filePath: string, data: unknown) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export function saveCsv(filePath: string, records: ProviderRecord[]) {
  ensureDir(path.dirname(filePath));
  const headers = [
    'name',
    'address',
    'postal_code',
    'phone',
    'age_groups',
    'program_type',
    'hours_operation',
    'website',
    'languages',
    'cwelcc_participant',
    'source_url'
  ];

  const lines = [headers.join(',')];
  for (const record of records) {
    const row = headers
      .map((key) => formatCsvValue((record as any)[key]))
      .join(',');
    lines.push(row);
  }
  fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
}

function formatCsvValue(value: unknown): string {
  if (value === undefined || value === null) return '';
  const stringValue = String(value);
  if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
    return '"' + stringValue.replace(/"/g, '""') + '"';
  }
  return stringValue;
}
