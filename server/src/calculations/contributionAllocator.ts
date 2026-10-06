import type { Fii } from '../types/fii.js';

export interface CurrentPosition { ticker: string; quantity: number }

export function allocateContribution(amount: number, fiis: Fii[], positions: CurrentPosition[] = [], count = fiis.length) {
  if (amount <= 0 || !fiis.length || count <= 0) return [];
  const quantityByTicker = new Map(positions.map((position) => [position.ticker.toUpperCase(), Math.max(0, position.quantity)]));
  const analyzed = fiis
    .filter((fii) => (fii.score ?? 0) > 0 && (fii.price ?? 0) > 0)
    .map((fii) => ({ fii, currentValue: (quantityByTicker.get(fii.ticker.toUpperCase()) ?? 0) * fii.price! }));
  if (!analyzed.length) return [];

  const portfolioValue = analyzed.reduce((sum, item) => sum + item.currentValue, 0);
  const fullTargets = cappedPercentages(analyzed.map((item) => item.fii.score ?? 0));
  const portfolioAfterContribution = portfolioValue + amount;
  const ranked = analyzed.map((item, index) => ({
    ...item,
    targetPercentage: fullTargets[index]!,
    gap: Math.max(0, portfolioAfterContribution * fullTargets[index]! / 100 - item.currentValue),
  })).filter((item) => item.fii.price! <= amount)
    .sort((a, b) => b.gap - a.gap || (b.fii.score ?? 0) - (a.fii.score ?? 0) || a.fii.ticker.localeCompare(b.fii.ticker));
  if (!ranked.length) return [];
  const selected = ranked.slice(0, Math.min(count, ranked.length));

  if (portfolioValue === 0) {
    const initialTargets = cappedPercentages(selected.map((item) => item.fii.score ?? 0));
    selected.forEach((item, index) => {
      item.targetPercentage = initialTargets[index]!;
      item.gap = amount * initialTargets[index]! / 100;
    });
  }

  const gapTotal = selected.reduce((sum, item) => sum + item.gap, 0);
  const targetTotal = selected.reduce((sum, item) => sum + item.targetPercentage, 0);
  const desired = selected.map((item) => {
    const gapShare = gapTotal > 0 ? item.gap / gapTotal : 0;
    const targetShare = targetTotal > 0 ? item.targetPercentage / targetTotal : 1 / selected.length;
    return gapTotal >= amount ? amount * gapShare : item.gap + (amount - gapTotal) * targetShare;
  });
  const allocationCap = selected.length >= 3 ? amount * 0.4 : amount;
  const quantities = selected.map((item, index) => Math.floor(Math.min(desired[index]!, allocationCap) / item.fii.price!));
  let spent = quantities.reduce((sum, quantity, index) => sum + quantity * selected[index]!.fii.price!, 0);

  while (true) {
    const affordable = selected.map((item, index) => {
      const allocated = quantities[index]! * item.fii.price!;
      return { item, index, penalty: Math.abs(allocated + item.fii.price! - desired[index]!) - Math.abs(allocated - desired[index]!) };
    }).filter(({ item, index, penalty }) => {
      const nextAmount = (quantities[index]! + 1) * item.fii.price!;
      return penalty <= 0 && item.fii.price! <= amount - spent + 0.001 && nextAmount <= allocationCap + 0.001;
    }).sort((a, b) => a.penalty - b.penalty || (b.item.fii.score ?? 0) - (a.item.fii.score ?? 0));
    if (!affordable.length) break;
    const choice = affordable[0]!;
    quantities[choice.index] = quantities[choice.index]! + 1;
    spent += choice.item.fii.price!;
  }

  const finalPortfolioValue = portfolioValue + spent;
  return selected.map((item, index) => {
    const allocated = quantities[index]! * item.fii.price!;
    return {
      ticker: item.fii.ticker,
      score: item.fii.score ?? 0,
      price: item.fii.price!,
      quantity: quantities[index]!,
      currentValue: money(item.currentValue),
      amount: money(allocated),
      percentage: percentage(allocated, amount),
      currentPercentage: percentage(item.currentValue, portfolioValue),
      targetPercentage: money(item.targetPercentage),
      afterPercentage: percentage(item.currentValue + allocated, finalPortfolioValue),
    };
  }).filter((item) => item.quantity > 0);
}

function cappedPercentages(weights: number[]) {
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

const money = (value: number) => Math.round(value * 100) / 100;
const percentage = (value: number, total: number) => total > 0 ? Math.round(value / total * 1000) / 10 : 0;
