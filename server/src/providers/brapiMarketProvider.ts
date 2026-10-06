import axios, { type AxiosInstance } from 'axios';
import { cache } from '../services/cache.js';
import type { FiiDividend, FiiPriceHistory } from '../types/fii.js';
import type { MarketAsset, MarketProvider } from './marketProvider.js';

const TEN_MINUTES = 10 * 60_000;
const ONE_HOUR = 60 * 60_000;
const SIX_HOURS = 6 * 60 * 60_000;
type BrapiFii = { symbol: string; name?: string; cnpj?: string; segmentoAtuacao?: string; price?: number };
type PublicFund = { stock: string; name?: string; close?: number; change?: number; volume?: number; subsector?: string; subType?: string };
type YahooChart = { chart: { result?: Array<{ meta: { longName?: string; regularMarketPrice?: number; regularMarketVolume?: number }; timestamp?: number[]; indicators?: { quote?: Array<{ close?: Array<number | null> }> }; events?: { dividends?: Record<string, { amount: number; date: number }> } }> } };

export class BrapiMarketProvider implements MarketProvider {
  private readonly client: AxiosInstance;
  private readonly hasToken: boolean;
  private queue: Promise<void> = Promise.resolve();

  constructor(token = process.env.BRAPI_TOKEN) {
    this.hasToken = Boolean(token);
    this.client = axios.create({
      baseURL: 'https://brapi.dev/api/v2/fii', timeout: 15_000,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  }

  private request<T>(path: string): Promise<T> {
    const task = this.queue.then(async () => (await this.client.get<T>(path)).data);
    this.queue = task.then(() => undefined, () => undefined);
    return task;
  }

  private normalize(item: BrapiFii): MarketAsset {
    return { ticker: item.symbol, name: item.name, cnpj: item.cnpj?.replace(/\D/g, ''), segment: item.segmentoAtuacao, price: item.price };
  }

  async getAssets() {
    return cache.remember('market:assets', TEN_MINUTES, async () => {
      if (this.hasToken) {
        const data = await this.request<{ fiis: BrapiFii[] }>('/list?limit=2000&sortBy=totalInvestors&sortOrder=desc');
        return data.fiis.map((item) => this.normalize(item));
      }
      const { data } = await axios.get<{ stocks: PublicFund[] }>('https://brapi.dev/api/quote/list?type=fund&limit=2000', { timeout: 20_000 });
      const supportedFundTypes = new Set(['fii', 'fi-agro', 'fi-infra', 'fip', 'fidc']);
      return data.stocks.filter((item) => supportedFundTypes.has(item.subType ?? '')).map((item) => ({
        ticker: item.stock,
        name: item.name,
        segment: item.subsector,
        assetType: item.subType,
        price: item.close,
        changeDay: item.change,
        liquidity: item.close && item.volume ? item.close * item.volume : undefined,
      }));
    });
  }

  async getAsset(ticker: string) {
    const symbol = ticker.toUpperCase();
    return cache.remember(`market:asset:${symbol}`, TEN_MINUTES, async () => {
      if (this.hasToken) {
        const data = await this.request<{ fiis: BrapiFii[] }>(`/list?symbols=${encodeURIComponent(symbol)}`);
        return data.fiis[0] ? this.normalize(data.fiis[0]) : null;
      }
      if (symbol === 'HGLG11' || symbol === 'MXRF11') {
        const data = await this.request<{ fiis: BrapiFii[] }>(`/list?symbols=${encodeURIComponent(symbol)}`);
        return data.fiis[0] ? this.normalize(data.fiis[0]) : null;
      }
      const base = (await this.getAssets()).find((item) => item.ticker === symbol);
      if (!base) return null;
      const chart = await this.yahoo(symbol, '1mo');
      const meta = chart.chart.result?.[0]?.meta;
      return {
        ...base,
        name: meta?.longName ?? base.name,
        price: meta?.regularMarketPrice ?? base.price,
        liquidity: meta?.regularMarketPrice && meta.regularMarketVolume
          ? meta.regularMarketPrice * meta.regularMarketVolume : base.liquidity,
      };
    });
  }

  async getPrice(ticker: string) { return (await this.getAsset(ticker))?.price ?? null; }

  async getHistory(ticker: string, period = '1y'): Promise<FiiPriceHistory[]> {
    const symbol = ticker.toUpperCase();
    return cache.remember(`market:history:${symbol}:${period}`, ONE_HOUR, async () => {
      if (!this.hasToken) {
        const chart = await this.yahoo(symbol, period);
        const result = chart.chart.result?.[0];
        const closes = result?.indicators?.quote?.[0]?.close ?? [];
        return (result?.timestamp ?? []).flatMap((timestamp, index) => {
          const price = closes[index];
          return price == null ? [] : [{ date: new Date(timestamp * 1000).toISOString().slice(0, 10), price }];
        });
      }
      const months: Record<string, number> = { '1m': 1, '6m': 6, '1y': 12, '5y': 60 };
      const start = new Date();
      start.setMonth(start.getMonth() - (months[period] ?? 12));
      const startDate = start.toISOString().slice(0, 10);
      const data = await this.request<{ fiis: Array<{ historicalDataPrice: Array<{ date: number; close: number }> }> }>(`/historical?symbols=${encodeURIComponent(symbol)}&startDate=${startDate}&sortOrder=asc`);
      return (data.fiis[0]?.historicalDataPrice ?? []).map((item) => ({ date: new Date(item.date * 1000).toISOString().slice(0, 10), price: item.close }));
    });
  }

  async getDividends(ticker: string): Promise<FiiDividend[]> {
    const symbol = ticker.toUpperCase();
    return cache.remember(`market:dividends:${symbol}`, SIX_HOURS, async () => {
      if (!this.hasToken) {
        const chart = await this.yahoo(symbol, '2y');
        const events = chart.chart.result?.[0]?.events?.dividends ?? {};
        return Object.values(events)
          .map((item) => ({ ticker: symbol, date: new Date(item.date * 1000).toISOString().slice(0, 10), value: item.amount }))
          .sort((a, b) => b.date.localeCompare(a.date));
      }
      const data = await this.request<{ dividends: Array<{ symbol: string; paymentDate?: string | null; exDate?: string | null; rate: number; label?: string }> }>(`/dividends?symbols=${encodeURIComponent(symbol)}&sortOrder=desc`);
      return data.dividends
        .filter((item) => item.symbol === symbol && item.rate > 0 && item.label !== 'AMORTIZACAO')
        .map((item) => ({ ticker: symbol, date: (item.paymentDate ?? item.exDate ?? '').slice(0, 10), value: item.rate }));
    });
  }

  private async yahoo(ticker: string, range: string): Promise<YahooChart> {
    const ranges: Record<string, string> = { '1m': '1mo', '6m': '6mo', '1y': '1y', '2y': '2y', '5y': '5y' };
    const { data } = await axios.get<YahooChart>(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}.SA`, {
      timeout: 20_000,
      params: { range: ranges[range] ?? range, interval: '1d', events: 'div' },
      headers: { 'User-Agent': 'Mozilla/5.0 FII-Future/1.0' },
    });
    return data;
  }
}
