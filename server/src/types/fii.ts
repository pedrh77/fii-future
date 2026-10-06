export interface Fii {
  ticker: string;
  name?: string;
  cnpj?: string;
  segment?: string;
  price?: number;
  netWorth?: number;
  totalShares?: number;
  patrimonialValuePerShare?: number;
  pvp?: number;
  dividendYield12m?: number;
  lastDividend?: number;
  averageDividend6m?: number;
  averageDividend12m?: number;
  shareholders?: number;
  liquidity?: number;
  score?: number;
  scoreDetails?: FiiScoreDetails;
}

export interface FiiScoreDetails {
  dividends: number;
  valuation: number;
  liquidity: number;
  consistency: number;
  netWorth: number;
  shareholders: number;
  quality: number;
}

export interface FiiDividend { ticker: string; date: string; value: number }
export interface FiiPriceHistory { date: string; price: number }
