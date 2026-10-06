import type { SimulationInput, SimulationResult } from '../types/simulation.js';

const money = (value: number) => Math.round(value * 100) / 100;

export function simulateInvestment(input: SimulationInput): SimulationResult {
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
    if (month % 12 === 0) periods.push({
      year: month / 12,
      invested: money(invested),
      portfolioValue: money(portfolio),
      accumulatedDividends: money(accumulatedDividends),
      estimatedMonthlyIncome: money(portfolio * monthlyYield),
    });
  }

  return {
    finalPortfolioValue: money(portfolio),
    totalInvested: money(invested),
    totalDividends: money(accumulatedDividends),
    estimatedMonthlyIncome: money(portfolio * monthlyYield),
    periods,
  };
}
