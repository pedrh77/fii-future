export interface ScoreDetails { dividends: number; valuation: number; liquidity: number; consistency: number; netWorth: number; shareholders: number; quality: number }
export interface Fii {
  ticker: string; name?: string; cnpj?: string; segment?: string; assetType?: string; price?: number; changeDay?: number; netWorth?: number; totalShares?: number;
  patrimonialValuePerShare?: number; pvp?: number; dividendYield12m?: number; lastDividend?: number;
  averageDividend6m?: number; averageDividend12m?: number; shareholders?: number; liquidity?: number;
  annualAppreciation?: number; score?: number; scoreDetails?: ScoreDetails;
}
export interface FiiDividend { ticker: string; date: string; value: number }
export interface FiiPriceHistory { date: string; price: number }
export interface FiiPerformance { ticker: string; name?: string; assetType?: string; price?: number; changePercent: number; period: 'day' | 'week' | 'month' }
export interface SimulationInput { initialAmount: number; monthlyContribution: number; years: number; annualDividendYield: number; annualAppreciation: number; reinvestDividends: boolean }
export interface SimulationPeriod { year: number; invested: number; portfolioValue: number; accumulatedDividends: number; estimatedMonthlyIncome: number }
export interface SimulationResult { finalPortfolioValue: number; totalInvested: number; totalDividends: number; estimatedMonthlyIncome: number; periods: SimulationPeriod[]; assumptions?: { annualDividendYield: number; annualAppreciation: number } }
export interface Allocation {
  ticker: string; score: number; price: number; quantity: number; currentValue: number; amount: number; percentage: number;
  currentPercentage: number; targetPercentage: number; afterPercentage: number;
}
