import type { FiiDividend } from '../types/fii.js';

export function calculateDividendYield(dividends: FiiDividend[], price?: number) {
  if (!price || price <= 0) return undefined;
  const total = dividends.slice(0, 12).reduce((sum, dividend) => sum + dividend.value, 0);
  return Math.round((total / price) * 10_000) / 100;
}

export function calculateDividendAverage(dividends: FiiDividend[], months: number) {
  const values = dividends.slice(0, months);
  if (!values.length) return undefined;
  return Math.round(values.reduce((sum, dividend) => sum + dividend.value, 0) / values.length * 10_000) / 10_000;
}
