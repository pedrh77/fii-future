import type { FiiDividend, FiiPriceHistory } from '../types/fii.js';

export interface MarketAsset {
  ticker: string;
  name?: string;
  cnpj?: string;
  segment?: string;
  price?: number;
  liquidity?: number;
}

export interface MarketProvider {
  getAssets(): Promise<MarketAsset[]>;
  getAsset(ticker: string): Promise<MarketAsset | null>;
  getPrice(ticker: string): Promise<number | null>;
  getHistory(ticker: string, period?: string): Promise<FiiPriceHistory[]>;
  getDividends(ticker: string): Promise<FiiDividend[]>;
}
