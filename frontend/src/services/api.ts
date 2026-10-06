import type { Allocation, Fii, FiiDividend, FiiPerformance, FiiPriceHistory, SimulationInput, SimulationResult } from '../types';
import type { PortfolioPosition } from './portfolio';

const apiOrigin = String(import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  if (!apiOrigin) throw new Error('Modo estático ativo.');
  const response = await fetch(`${apiOrigin}/api${path}`, { headers: { 'Content-Type': 'application/json' }, ...options });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message ?? 'Não foi possível carregar os dados no momento.');
  }
  return response.json() as Promise<T>;
}

type PublicFund = { stock: string; name?: string; close?: number; change?: number; volume?: number; subsector?: string; subType?: string };
type StaticFund = {
  history: FiiPriceHistory[]; dividends: FiiDividend[]; annualDividendYield?: number; annualAppreciation?: number;
  cnpj?: string; referenceDate?: string; name?: string; segment?: string; netWorth?: number; totalShares?: number;
  patrimonialValuePerShare?: number; shareholders?: number;
};
type StaticSnapshot = { generatedAt: string; coverage: { catalog: number; historical: number; fundamentals?: number }; funds: Record<string, StaticFund>; performance: { week: FiiPerformance[]; month: FiiPerformance[] } };
const supportedFundTypes = new Set(['fii', 'fi-agro', 'fi-infra', 'fip', 'fidc']);
let publicCatalogRequest: Promise<Fii[]> | undefined;
let staticSnapshotRequest: Promise<StaticSnapshot> | undefined;

function publicCatalog() {
  publicCatalogRequest ??= fetch('https://brapi.dev/api/quote/list?type=fund&limit=5000')
    .then((response) => {
      if (!response.ok) throw new Error('Catálogo público indisponível.');
      return response.json() as Promise<{ stocks: PublicFund[] }>;
    })
    .then((data) => data.stocks.filter((item) => supportedFundTypes.has(item.subType ?? '')).map((item) => ({
      ticker: item.stock,
      name: item.name,
      segment: item.subsector,
      assetType: item.subType,
      price: item.close,
      changeDay: item.change,
      liquidity: item.close && item.volume ? item.close * item.volume : undefined,
    })))
    .catch((error) => {
      publicCatalogRequest = undefined;
      throw error;
    });
  return publicCatalogRequest;
}

function staticSnapshot() {
  const revision = Math.floor(Date.now() / 300_000);
  staticSnapshotRequest ??= fetch(`${import.meta.env.BASE_URL}market-snapshot.json?v=${revision}`, { cache: 'no-store' })
    .then((response) => {
      if (!response.ok) throw new Error('Snapshot estático indisponível.');
      return response.json() as Promise<StaticSnapshot>;
    })
    .catch((error) => {
      staticSnapshotRequest = undefined;
      throw error;
    });
  return staticSnapshotRequest;
}

async function staticFii(ticker: string) {
  const normalized = ticker.toUpperCase();
  const [catalog, snapshot] = await Promise.all([publicCatalog(), staticSnapshot()]);
  const base = catalog.find((item) => item.ticker === normalized);
  const stored = snapshot.funds[normalized];
  if (!/^[A-Z]{4}[0-9]{2}$/.test(normalized)) throw new Error('Ticker inválido.');
  return enrichStatic(base ?? { ticker: normalized, name: 'Ticker cadastrado manualmente' }, stored);
}

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

function enrichStatic(base: Fii, stored?: StaticFund): Fii {
  if (!stored) return base;
  const patrimonialValuePerShare = stored.patrimonialValuePerShare ?? (stored.netWorth && stored.totalShares ? stored.netWorth / stored.totalShares : undefined);
  const pvp = base.price && patrimonialValuePerShare ? Math.round(base.price / patrimonialValuePerShare * 100) / 100 : undefined;
  const values = stored.dividends.map((item) => item.value);
  const returns = stored.history.slice(-91).flatMap((item, index, history) => index && history[index - 1].price > 0
    ? [(item.price / history[index - 1].price - 1) * 100]
    : []);
  const meanReturn = returns.length ? returns.reduce((sum, value) => sum + value, 0) / returns.length : 0;
  const volatility = returns.length ? Math.sqrt(returns.reduce((sum, value) => sum + (value - meanReturn) ** 2, 0) / returns.length) : 4;
  const dividends = clamp(((stored.annualDividendYield ?? 0) - 4) / 12 * 100);
  const valuation = pvp === undefined
    ? clamp(((stored.annualAppreciation ?? -15) + 15) / 30 * 100)
    : clamp(100 - Math.abs(pvp - .9) * 100);
  const liquidity = clamp(((Math.log10(Math.max(base.liquidity ?? 1, 1)) - 4) / 3) * 100);
  const consistency = clamp(100 - volatility * 25);
  const netWorth = stored.netWorth === undefined ? 45 : clamp((Math.log10(Math.max(stored.netWorth, 1)) - 6) * 30);
  const shareholders = stored.shareholders === undefined ? 45 : clamp(Math.log10(Math.max(stored.shareholders, 1)) / 6 * 100);
  const quality = netWorth * (2 / 3) + shareholders * (1 / 3);
  const score = dividends * .3 + valuation * .25 + consistency * .2 + netWorth * .1 + shareholders * .05 + liquidity * .1;
  return {
    ...base,
    cnpj: stored.cnpj,
    name: stored.name ?? base.name,
    segment: stored.segment ?? base.segment,
    netWorth: stored.netWorth,
    totalShares: stored.totalShares,
    patrimonialValuePerShare,
    pvp,
    shareholders: stored.shareholders,
    dividendYield12m: stored.annualDividendYield,
    annualAppreciation: stored.annualAppreciation,
    lastDividend: values[0],
    averageDividend6m: values.length ? values.slice(0, 6).reduce((sum, value) => sum + value, 0) / Math.min(values.length, 6) : undefined,
    averageDividend12m: values.length ? values.slice(0, 12).reduce((sum, value) => sum + value, 0) / Math.min(values.length, 12) : undefined,
    score: Math.round(score * 10) / 10,
    scoreDetails: { dividends, valuation, liquidity, consistency, quality, netWorth, shareholders },
  };
}

async function analyzeStatically(tickers: string[]) {
  const [catalog, snapshot] = await Promise.all([publicCatalog(), staticSnapshot()]);
  const byTicker = new Map(catalog.map((item) => [item.ticker, item]));
  return [...new Set(tickers.map((ticker) => ticker.toUpperCase()))]
    .filter((ticker) => /^[A-Z]{4}[0-9]{2}$/.test(ticker))
    .map((ticker) => enrichStatic(byTicker.get(ticker) ?? { ticker, name: 'Ticker cadastrado manualmente' }, snapshot.funds[ticker]));
}

const roundMoney = (value: number) => Math.round(value * 100) / 100;

function simulateLocally(input: SimulationInput): SimulationResult {
  const months = input.years * 12;
  const monthlyYield = input.annualDividendYield / 100 / 12;
  const monthlyAppreciation = (1 + input.annualAppreciation / 100) ** (1 / 12) - 1;
  let portfolio = input.initialAmount;
  let invested = input.initialAmount;
  let accumulatedDividends = 0;
  const periods = [];
  for (let month = 1; month <= months; month += 1) {
    portfolio += input.monthlyContribution;
    invested += input.monthlyContribution;
    portfolio *= 1 + monthlyAppreciation;
    const dividend = portfolio * monthlyYield;
    accumulatedDividends += dividend;
    if (input.reinvestDividends) portfolio += dividend;
    if (month % 12 === 0) periods.push({ year: month / 12, invested: roundMoney(invested), portfolioValue: roundMoney(portfolio), accumulatedDividends: roundMoney(accumulatedDividends), estimatedMonthlyIncome: roundMoney(portfolio * monthlyYield) });
  }
  return { finalPortfolioValue: roundMoney(portfolio), totalInvested: roundMoney(invested), totalDividends: roundMoney(accumulatedDividends), estimatedMonthlyIncome: roundMoney(portfolio * monthlyYield), periods };
}

export const api = {
  getFiis: async () => request<Fii[]>('/fiis').catch(publicCatalog),
  getRanking: () => request<Fii[]>('/ranking').catch(publicCatalog),
  getFii: async (ticker: string) => request<Fii>(`/fiis/${ticker}`).catch(() => staticFii(ticker)),
  getDividends: (ticker: string) => request<FiiDividend[]>(`/fiis/${ticker}/dividends`).catch(async () => (await staticSnapshot()).funds[ticker.toUpperCase()]?.dividends ?? []),
  getHistory: (ticker: string, period = '1y') => request<FiiPriceHistory[]>(`/fiis/${ticker}/history?period=${period}`).catch(async () => {
    const history = (await staticSnapshot()).funds[ticker.toUpperCase()]?.history ?? [];
    const days: Record<string, number> = { '1m': 31, '6m': 183, '1y': 366, '5y': 1827 };
    const cutoff = Date.now() - (days[period] ?? 366) * 86_400_000;
    return history.filter((item) => new Date(item.date).getTime() >= cutoff);
  }),
  getPerformance: async (period: 'day' | 'week' | 'month') => request<FiiPerformance[]>(`/fiis/performance?period=${period}`).catch(async () => period === 'day'
    ? (await publicCatalog()).filter((item) => item.changeDay !== undefined && (item.liquidity ?? 0) >= 100_000).sort((a, b) => (b.changeDay ?? 0) - (a.changeDay ?? 0)).slice(0, 5).map((item) => ({ ticker: item.ticker, name: item.name, assetType: item.assetType, price: item.price, changePercent: item.changeDay!, period }))
    : (await staticSnapshot()).performance[period]),
  simulate: async (input: SimulationInput) => request<SimulationResult>('/simulation', { method: 'POST', body: JSON.stringify(input) }).catch(() => simulateLocally(input)),
  simulateFii: async (ticker: string, input: Pick<SimulationInput, 'initialAmount' | 'monthlyContribution' | 'years' | 'reinvestDividends'>) => request<SimulationResult>(`/simulation/fii/${ticker}`, { method: 'POST', body: JSON.stringify(input) }).catch(async () => {
    const fii = await staticFii(ticker);
    const assumptions = { annualDividendYield: roundMoney(fii.dividendYield12m ?? 8), annualAppreciation: roundMoney(fii.annualAppreciation ?? 2) };
    return { ...simulateLocally({ ...input, ...assumptions }), assumptions };
  }),
  simulatePortfolio: async (input: { initialAmount: number; monthlyContribution: number; years: number; tickers: string[]; weights?: number[]; annualDividendYield: number; annualAppreciation: number; reinvestDividends?: boolean }) => request<SimulationResult>('/simulation/portfolio', { method: 'POST', body: JSON.stringify(input) }).catch(() => {
    const result = simulateLocally({ initialAmount: input.initialAmount, monthlyContribution: input.monthlyContribution, years: input.years, annualDividendYield: input.annualDividendYield, annualAppreciation: input.annualAppreciation, reinvestDividends: input.reinvestDividends ?? true });
    return { ...result, assumptions: { annualDividendYield: input.annualDividendYield, annualAppreciation: input.annualAppreciation } };
  }),
  allocate: async (amount: number, count: 1 | 3 | 5 | 10, positions: PortfolioPosition[]) => {
    const tickers = positions.map((position) => position.ticker);
    return request<Allocation[]>('/contributions', { method: 'POST', body: JSON.stringify({ amount, count, tickers, positions }) }).catch(async () => {
      const candidates = (await analyzeStatically(tickers)).filter((item) => (item.price ?? 0) > 0 && (item.score ?? 0) > 0);
      return allocateWholeShares(amount, candidates, positions, count);
    });
  },
  analyzePortfolio: async (tickers: string[]) => request<Fii[]>('/portfolio/analyze', { method: 'POST', body: JSON.stringify({ tickers }) }).catch(() => analyzeStatically(tickers)),
};

function allocateWholeShares(amount: number, candidates: Fii[], positions: PortfolioPosition[], count: number): Allocation[] {
  if (amount <= 0 || !candidates.length || count <= 0) return [];
  const quantityByTicker = new Map(positions.map((position) => [position.ticker, position.quantity]));
  const analyzed = candidates
    .map((item) => ({ item, currentValue: (quantityByTicker.get(item.ticker) ?? 0) * item.price! }));
  if (!analyzed.length) return [];
  const portfolioValue = analyzed.reduce((sum, item) => sum + item.currentValue, 0);
  const fullTargets = capWeights(analyzed.map((item) => item.item.score ?? 0));
  const portfolioAfterContribution = portfolioValue + amount;
  const ranked = analyzed.map((entry, index) => ({
    ...entry,
    targetPercentage: fullTargets[index]!,
    gap: Math.max(0, portfolioAfterContribution * fullTargets[index]! / 100 - entry.currentValue),
  })).filter((entry) => entry.item.price! <= amount)
    .sort((a, b) => b.gap - a.gap || (b.item.score ?? 0) - (a.item.score ?? 0) || a.item.ticker.localeCompare(b.item.ticker));
  if (!ranked.length) return [];
  const selected = ranked.slice(0, Math.min(count, ranked.length));
  if (portfolioValue === 0) {
    const initialTargets = capWeights(selected.map((entry) => entry.item.score ?? 0));
    selected.forEach((entry, index) => {
      entry.targetPercentage = initialTargets[index]!;
      entry.gap = amount * initialTargets[index]! / 100;
    });
  }
  const gapTotal = selected.reduce((sum, entry) => sum + entry.gap, 0);
  const targetTotal = selected.reduce((sum, entry) => sum + entry.targetPercentage, 0);
  const desired = selected.map((entry) => {
    const gapShare = gapTotal > 0 ? entry.gap / gapTotal : 0;
    const targetShare = targetTotal > 0 ? entry.targetPercentage / targetTotal : 1 / selected.length;
    return gapTotal >= amount ? amount * gapShare : entry.gap + (amount - gapTotal) * targetShare;
  });
  const allocationCap = selected.length >= 3 ? amount * 0.4 : amount;
  const quantities = selected.map((entry, index) => Math.floor(Math.min(desired[index]!, allocationCap) / entry.item.price!));
  let spent = quantities.reduce((sum, quantity, index) => sum + quantity * selected[index]!.item.price!, 0);
  while (true) {
    const affordable = selected.map((entry, index) => {
      const allocated = quantities[index]! * entry.item.price!;
      return { entry, index, penalty: Math.abs(allocated + entry.item.price! - desired[index]!) - Math.abs(allocated - desired[index]!) };
    }).filter(({ entry, index, penalty }) => penalty <= 0 && entry.item.price! <= amount - spent + .001 && (quantities[index]! + 1) * entry.item.price! <= allocationCap + .001)
      .sort((a, b) => a.penalty - b.penalty || (b.entry.item.score ?? 0) - (a.entry.item.score ?? 0));
    if (!affordable.length) break;
    const choice = affordable[0]!;
    quantities[choice.index] = quantities[choice.index]! + 1;
    spent += choice.entry.item.price!;
  }
  const finalPortfolioValue = portfolioValue + spent;
  return selected.map((entry, index) => {
    const allocated = quantities[index]! * entry.item.price!;
    return {
      ticker: entry.item.ticker,
      score: entry.item.score ?? 0,
      price: entry.item.price!,
      quantity: quantities[index]!,
      currentValue: roundMoney(entry.currentValue),
      amount: roundMoney(allocated),
      percentage: roundMoney(allocated / amount * 100),
      currentPercentage: portfolioValue > 0 ? roundMoney(entry.currentValue / portfolioValue * 100) : 0,
      targetPercentage: roundMoney(entry.targetPercentage),
      afterPercentage: finalPortfolioValue > 0 ? roundMoney((entry.currentValue + allocated) / finalPortfolioValue * 100) : 0,
    };
  }).filter((item) => item.quantity > 0);
}

function capWeights(weights: number[]) {
  if (!weights.length) return [];
  const safeWeights = weights.map((weight) => Math.max(0, weight));
  if (!safeWeights.some(Boolean)) return safeWeights.map(() => 100 / safeWeights.length);
  if (safeWeights.length < 3) {
    const total = safeWeights.reduce((sum, weight) => sum + weight, 0);
    return safeWeights.map((weight) => weight / total * 100);
  }
  const result = Array(safeWeights.length).fill(0) as number[];
  let active = safeWeights.map((_, index) => index);
  let remaining = 100;
  while (active.length) {
    const total = active.reduce((sum, index) => sum + safeWeights[index]!, 0);
    const over = active.filter((index) => remaining * safeWeights[index]! / Math.max(total, 1) > 40);
    if (!over.length) {
      for (const index of active) result[index] = remaining * safeWeights[index]! / Math.max(total, 1);
      break;
    }
    for (const index of over) { result[index] = 40; remaining -= 40; }
    active = active.filter((index) => !over.includes(index));
  }
  return result;
}
