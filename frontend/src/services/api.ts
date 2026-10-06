import type { Allocation, Fii, FiiDividend, FiiPerformance, FiiPriceHistory, SimulationInput, SimulationResult } from '../types';

const apiOrigin = String(import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${apiOrigin}/api${path}`, { headers: { 'Content-Type': 'application/json' }, ...options });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message ?? 'Não foi possível carregar os dados no momento.');
  }
  return response.json() as Promise<T>;
}

type PublicFund = { stock: string; name?: string; close?: number; change?: number; volume?: number; subsector?: string; subType?: string };
const supportedFundTypes = new Set(['fii', 'fi-agro', 'fi-infra', 'fip', 'fidc']);
let publicCatalogRequest: Promise<Fii[]> | undefined;

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
    })));
  return publicCatalogRequest;
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
  getRanking: () => request<Fii[]>('/ranking'),
  getFii: async (ticker: string) => request<Fii>(`/fiis/${ticker}`).catch(async () => {
    const fii = (await publicCatalog()).find((item) => item.ticker === ticker.toUpperCase());
    if (!fii) throw new Error('FII não encontrado.');
    return fii;
  }),
  getDividends: (ticker: string) => request<FiiDividend[]>(`/fiis/${ticker}/dividends`),
  getHistory: (ticker: string, period = '1y') => request<FiiPriceHistory[]>(`/fiis/${ticker}/history?period=${period}`),
  getPerformance: async (period: 'day' | 'week' | 'month') => request<FiiPerformance[]>(`/fiis/performance?period=${period}`).catch(async () => period === 'day'
    ? (await publicCatalog()).filter((item) => item.changeDay !== undefined && (item.liquidity ?? 0) >= 100_000).sort((a, b) => (b.changeDay ?? 0) - (a.changeDay ?? 0)).slice(0, 5).map((item) => ({ ticker: item.ticker, name: item.name, assetType: item.assetType, price: item.price, changePercent: item.changeDay!, period }))
    : []),
  simulate: async (input: SimulationInput) => request<SimulationResult>('/simulation', { method: 'POST', body: JSON.stringify(input) }).catch(() => simulateLocally(input)),
  simulateFii: (ticker: string, input: Pick<SimulationInput, 'initialAmount' | 'monthlyContribution' | 'years' | 'reinvestDividends'>) => request<SimulationResult>(`/simulation/fii/${ticker}`, { method: 'POST', body: JSON.stringify(input) }),
  simulatePortfolio: async (input: { initialAmount: number; monthlyContribution: number; years: number; tickers: string[]; weights?: number[]; annualDividendYield: number; annualAppreciation: number; reinvestDividends?: boolean }) => request<SimulationResult>('/simulation/portfolio', { method: 'POST', body: JSON.stringify(input) }).catch(() => {
    const result = simulateLocally({ initialAmount: input.initialAmount, monthlyContribution: input.monthlyContribution, years: input.years, annualDividendYield: input.annualDividendYield, annualAppreciation: input.annualAppreciation, reinvestDividends: input.reinvestDividends ?? true });
    return { ...result, assumptions: { annualDividendYield: input.annualDividendYield, annualAppreciation: input.annualAppreciation } };
  }),
  allocate: async (amount: number, count: 3 | 5 | 10, tickers?: string[]) => request<Allocation[]>('/contributions', { method: 'POST', body: JSON.stringify({ amount, count, tickers }) }).catch(() => (tickers ?? []).slice(0, count).map((ticker) => ({ ticker, score: 0, amount: roundMoney(amount / Math.min(count, tickers?.length || 1)), percentage: roundMoney(100 / Math.min(count, tickers?.length || 1)) }))),
  analyzePortfolio: async (tickers: string[]) => request<Fii[]>('/portfolio/analyze', { method: 'POST', body: JSON.stringify({ tickers }) }).catch(async () => {
    const selected = new Set(tickers);
    return (await publicCatalog()).filter((item) => selected.has(item.ticker));
  }),
};
