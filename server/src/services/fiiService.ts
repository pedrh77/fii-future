import type { CvmFundSnapshot, CvmProvider } from '../providers/cvmProvider.js';
import type { MarketAsset, MarketProvider } from '../providers/marketProvider.js';
import type { Fii } from '../types/fii.js';
import { calculateFiiScore } from '../calculations/fiiScore.js';
import { calculatePatrimonialValue } from '../calculations/patrimonialValue.js';
import { calculatePvp } from '../calculations/pvp.js';
import { calculateDividendAverage, calculateDividendYield } from '../calculations/dividendYield.js';

export class FiiService {
  constructor(private readonly cvm: CvmProvider, private readonly market: MarketProvider) {}

  private async normalize(asset: MarketAsset, cvm?: CvmFundSnapshot, useDividendEvents = false): Promise<Fii> {
    if (!cvm) return {
      ticker: asset.ticker, name: asset.name, cnpj: asset.cnpj, segment: asset.segment,
      price: asset.price, liquidity: asset.liquidity,
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
      price: asset.price,
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
}
