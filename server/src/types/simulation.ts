export interface SimulationInput {
  initialAmount: number;
  monthlyContribution: number;
  years: number;
  annualDividendYield: number;
  annualAppreciation: number;
  reinvestDividends: boolean;
}

export interface SimulationPeriod {
  year: number;
  invested: number;
  portfolioValue: number;
  accumulatedDividends: number;
  estimatedMonthlyIncome: number;
}

export interface SimulationResult {
  finalPortfolioValue: number;
  totalInvested: number;
  totalDividends: number;
  estimatedMonthlyIncome: number;
  periods: SimulationPeriod[];
  assumptions?: { annualDividendYield: number; annualAppreciation: number };
}
