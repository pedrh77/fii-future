import type { Fii, FiiDividend, FiiScoreDetails } from '../types/fii.js';
import { calculateDividendConsistency } from './dividendConsistency.js';

const clamp = (value: number) => Math.max(0, Math.min(100, value));

export const calculateDividendScore = (dy = 0) => clamp((dy / 12) * 100);

export const calculateValuationScore = (pvp?: number) => {
  if (!pvp || pvp <= 0) return 45;
  if (pvp <= 0.8) return 100;
  if (pvp <= 1) return 100 - (pvp - 0.8) * 100;
  return clamp(80 - (pvp - 1) * 100);
};

export const calculateLiquidityScore = (liquidity?: number) => liquidity === undefined
  ? 45
  : clamp((Math.log10(Math.max(liquidity, 1)) / 7) * 100);

export const calculateConsistencyScore = calculateDividendConsistency;

export const calculateNetWorthScore = (netWorth?: number) => netWorth === undefined
  ? 45 : clamp((Math.log10(Math.max(netWorth, 1)) - 6) * 30);
export const calculateShareholderScore = (shareholders?: number) => shareholders === undefined
  ? 45 : clamp((Math.log10(Math.max(shareholders, 1)) / 6) * 100);

export function calculateFiiScore(fii: Fii, dividends: FiiDividend[] = []) {
  const details: FiiScoreDetails = {
    dividends: calculateDividendScore(fii.dividendYield12m),
    valuation: calculateValuationScore(fii.pvp),
    liquidity: calculateLiquidityScore(fii.liquidity),
    consistency: calculateConsistencyScore(dividends),
    netWorth: calculateNetWorthScore(fii.netWorth),
    shareholders: calculateShareholderScore(fii.shareholders),
    quality: 0,
  };
  details.quality = details.netWorth * (2 / 3) + details.shareholders * (1 / 3);
  const score = details.dividends * 0.3 + details.valuation * 0.25 + details.consistency * 0.2
    + details.netWorth * 0.1 + details.shareholders * 0.05 + details.liquidity * 0.1;
  return { score: Math.round(clamp(score)), details };
}
