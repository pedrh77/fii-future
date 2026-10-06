import { describe, expect, it } from 'vitest';
import { allocateContribution } from './contributionAllocator.js';
import { calculateFiiScore } from './fiiScore.js';
import { simulateInvestment } from './investmentSimulation.js';
import { calculatePatrimonialValue } from './patrimonialValue.js';
import { calculatePvp } from './pvp.js';
import { calculateDividendYield } from './dividendYield.js';

describe('investment simulation', () => {
  it('simulates every month and reports each year', () => {
    const result = simulateInvestment({ initialAmount: 10_000, monthlyContribution: 500, years: 5, annualDividendYield: 10, annualAppreciation: 4, reinvestDividends: true });
    expect(result.periods).toHaveLength(5);
    expect(result.totalInvested).toBe(40_000);
    expect(result.finalPortfolioValue).toBeGreaterThan(result.totalInvested);
    expect(result.estimatedMonthlyIncome).toBeGreaterThan(0);
  });

  it('does not add dividends to portfolio when reinvestment is disabled', () => {
    const base = { initialAmount: 10_000, monthlyContribution: 0, years: 1, annualDividendYield: 12, annualAppreciation: 0 };
    const reinvested = simulateInvestment({ ...base, reinvestDividends: true });
    const paidOut = simulateInvestment({ ...base, reinvestDividends: false });
    expect(paidOut.finalPortfolioValue).toBe(10_000);
    expect(reinvested.finalPortfolioValue).toBeGreaterThan(paidOut.finalPortfolioValue);
  });
});

describe('score and contribution allocation', () => {
  it('keeps score inside 0-100', () => {
    const result = calculateFiiScore({ ticker: 'TEST11', price: 100, dividendYield12m: 12, pvp: 0.9, liquidity: 1_000_000, netWorth: 2_000_000_000 });
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('caps each allocation at 40%', () => {
    const result = allocateContribution(500, [
      { ticker: 'AAA11', price: 10, score: 100 }, { ticker: 'BBB11', price: 10, score: 70 }, { ticker: 'CCC11', price: 10, score: 60 },
    ]);
    expect(Math.max(...result.map((item) => item.percentage))).toBeLessThanOrEqual(40);
    expect(result.reduce((sum, item) => sum + item.amount, 0)).toBeCloseTo(500, 1);
  });
});

describe('fundamental calculations', () => {
  it('calculates patrimonial value and P/VP', () => {
    const vp = calculatePatrimonialValue(1_600_000_000, 10_000_000);
    expect(vp).toBe(160);
    expect(calculatePvp(150, vp)).toBe(0.94);
  });

  it('calculates 12-month dividend yield from events', () => {
    const dividends = Array.from({ length: 12 }, (_, index) => ({ ticker: 'TEST11', date: `2026-${String(index + 1).padStart(2, '0')}-01`, value: 1.125 }));
    expect(calculateDividendYield(dividends, 150)).toBe(9);
  });
});
