import type { FiiDividend } from '../types/fii.js';

const clamp = (value: number) => Math.max(0, Math.min(100, value));

export function calculateDividendConsistency(dividends: FiiDividend[]) {
  const values = dividends.slice(0, 12).map((item) => item.value).filter((value) => value > 0);
  if (!values.length) return 35;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  const variation = mean ? Math.sqrt(variance) / mean : 1;
  const regularity = Math.min(values.length / 12, 1);
  return Math.round(clamp(regularity * 55 + (1 - Math.min(variation, 1)) * 45));
}
