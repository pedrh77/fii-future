import type { CvmFundSnapshot, CvmProvider } from '../providers/cvmProvider.js';
import type { MarketAsset, MarketProvider } from '../providers/marketProvider.js';
import type { Fii, FiiPerformance } from '../types/fii.js';
import { cache } from './cache.js';
import { calculateFiiScore } from '../calculations/fiiScore.js';
import { calculatePatrimonialValue } from '../calculations/patrimonialValue.js';
import { calculatePvp } from '../calculations/pvp.js';
import { calculateDividendAverage, calculateDividendYield } from '../calculations/dividendYield.js';

export class FiiService {
  constructor(private readonly cvm: CvmProvider, private readonly market: MarketProvider) {}

  private async normalize(asset: MarketAsset, cvm?: CvmFundSnapshot, useDividendEvents = false): Promise<Fii> {
    if (!cvm) return {
      ticker: asset.ticker, name: asset.name, cnpj: asset.cnpj, segment: asset.segment,
      assetType: asset.assetType, price: asset.price, liquidity: asset.liquidity, changeDay: asset.changeDay,
    };
    const dividends = useDividendEvents
      ? await this.market.getDividends(asset.ticker)
      : asset.cnpj ? await this.cvm.getDividendEstimates(asset.cnpj, asset.ticker) : [];
    const patrimonialValuePerShare = cvm?.patrimonialValuePerShare
      ?? calculatePatrimonialValue(cvm?.netWorth, cvm?.totalShares);
    const fii: Fii = {
      ticker: asset.ticker,
      name: cvm?.name ?? asset.name,
      cnpj: asset.cnpj,
      segment: cvm?.segment ?? asset.segment,
      assetType: asset.assetType,
      price: asset.price,
      changeDay: asset.changeDay,
      netWorth: cvm?.netWorth,
      totalShares: cvm?.totalShares,
      patrimonialValuePerShare,
      pvp: calculatePvp(asset.price, patrimonialValuePerShare),
      dividendYield12m: calculateDividendYield(dividends, asset.price),
      lastDividend: dividends[0]?.value,
      averageDividend6m: calculateDividendAverage(dividends, 6),
      averageDividend12m: calculateDividendAverage(dividends, 12),
      shareholders: cvm?.shareholders,
      liquidity: asset.liquidity,
    };
    const { score, details } = calculateFiiScore(fii, dividends);
    return { ...fii, score, scoreDetails: details };
  }

  async list() {
    const [assets, funds] = await Promise.all([this.market.getAssets(), this.cvm.getFunds()]);
    return Promise.all(assets.map((asset) => this.normalize(asset, asset.cnpj ? funds.get(asset.cnpj) : undefined)));
  }

  async ranking(filters: { minDy?: number; maxPvp?: number; minScore?: number; segment?: string; search?: string } = {}) {
    return (await this.list())
      .filter((fii) => filters.minDy === undefined || (fii.dividendYield12m ?? 0) >= filters.minDy)
      .filter((fii) => filters.maxPvp === undefined || (fii.pvp ?? Infinity) <= filters.maxPvp)
      .filter((fii) => filters.minScore === undefined || (fii.score ?? 0) >= filters.minScore)
      .filter((fii) => !filters.segment || fii.segment?.toLowerCase() === filters.segment.toLowerCase())
      .filter((fii) => !filters.search || `${fii.ticker} ${fii.name ?? ''}`.toLowerCase().includes(filters.search.toLowerCase()))
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  }

  async detail(ticker: string) {
    const asset = await this.market.getAsset(ticker);
    if (!asset) return null;
    const cvm = asset.cnpj ? await this.cvm.getFund(asset.cnpj) : await this.cvm.findByName(asset.name);
    return this.normalize(asset, cvm ?? undefined, true);
  }

  async dividends(ticker: string) {
    return this.market.getDividends(ticker);
  }

  async performance(period: 'day' | 'week' | 'month'): Promise<FiiPerformance[]> {
    return cache.remember(`performance:${period}`, 10 * 60_000, async () => {
      const assets = await this.market.getAssets();
      if (period === 'day') {
        return assets
          .filter((asset) => asset.changeDay !== undefined && (asset.liquidity ?? 0) >= 100_000)
          .sort((a, b) => (b.changeDay ?? 0) - (a.changeDay ?? 0))
          .slice(0, 5)
          .map((asset) => ({ ticker: asset.ticker, name: asset.name, assetType: asset.assetType, price: asset.price, changePercent: asset.changeDay!, period }));
      }

      const candidates = [...assets].sort((a, b) => (b.liquidity ?? 0) - (a.liquidity ?? 0)).slice(0, 36);
      const results = await mapWithConcurrency<MarketAsset, FiiPerformance | null>(candidates, 6, async (asset) => {
        try {
          const history = await this.market.getHistory(asset.ticker, '1m');
          const previous = period === 'week' ? history.at(-6) : history[0];
          const latest = history.at(-1);
          if (!previous || !latest || previous.price <= 0) return null;
          return { ticker: asset.ticker, name: asset.name, assetType: asset.assetType, price: latest.price, changePercent: ((latest.price / previous.price) - 1) * 100, period };
        } catch { return null; }
      });
      return results.filter((item): item is FiiPerformance => item !== null).sort((a, b) => b.changePercent - a.changePercent).slice(0, 5);
    });
  }
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, load: (item: T) => Promise<R>) {
  const results = new Array<R>(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await load(items[index]!);
    }
  }));
  return results;
}
