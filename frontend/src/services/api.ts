import type { Allocation, Fii, FiiDividend, FiiPriceHistory, SimulationInput, SimulationResult } from '../types';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, { headers: { 'Content-Type': 'application/json' }, ...options });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message ?? 'Não foi possível carregar os dados no momento.');
  }
  return response.json() as Promise<T>;
}

export const api = {
  getFiis: () => request<Fii[]>('/fiis'),
  getRanking: () => request<Fii[]>('/ranking'),
  getFii: (ticker: string) => request<Fii>(`/fiis/${ticker}`),
  getDividends: (ticker: string) => request<FiiDividend[]>(`/fiis/${ticker}/dividends`),
  getHistory: (ticker: string, period = '1y') => request<FiiPriceHistory[]>(`/fiis/${ticker}/history?period=${period}`),
  simulate: (input: SimulationInput) => request<SimulationResult>('/simulation', { method: 'POST', body: JSON.stringify(input) }),
  simulateFii: (ticker: string, input: Pick<SimulationInput, 'initialAmount' | 'monthlyContribution' | 'years' | 'reinvestDividends'>) => request<SimulationResult>(`/simulation/fii/${ticker}`, { method: 'POST', body: JSON.stringify(input) }),
  simulatePortfolio: (input: { initialAmount: number; monthlyContribution: number; years: number; tickers: string[]; reinvestDividends?: boolean }) => request<SimulationResult>('/simulation/portfolio', { method: 'POST', body: JSON.stringify(input) }),
  allocate: (amount: number, count: 3 | 5 | 10, tickers?: string[]) => request<Allocation[]>('/contributions', { method: 'POST', body: JSON.stringify({ amount, count, tickers }) }),
  analyzePortfolio: (tickers: string[]) => request<Fii[]>('/portfolio/analyze', { method: 'POST', body: JSON.stringify({ tickers }) }),
};
