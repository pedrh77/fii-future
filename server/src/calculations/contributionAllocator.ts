import type { Fii } from '../types/fii.js';

export interface CurrentPosition { ticker: string; quantity: number }

export function allocateContribution(amount: number, fiis: Fii[], positions: CurrentPosition[] = []) {
  if (amount <= 0 || !fiis.length) return [];
  const selected = fiis.filter((fii) => (fii.score ?? 0) > 0 && (fii.price ?? 0) > 0);
  if (!selected.length) return [];
  const quantityByTicker = new Map(positions.map((position) => [position.ticker.toUpperCase(), Math.max(0, position.quantity)]));
  const scoreTotal = selected.reduce((sum, fii) => sum + (fii.score ?? 0), 0);
  const targetPercentages = cappedPercentages(selected.map((fii) => (fii.score ?? 0) / Math.max(scoreTotal, 1) * 100));
  const currentValues = selected.map((fii) => (quantityByTicker.get(fii.ticker) ?? 0) * fii.price!);
  const portfolioAfterContribution = currentValues.reduce((sum, value) => sum + value, 0) + amount;
  let gaps = selected.map((_, index) => Math.max(0, portfolioAfterContribution * targetPercentages[index]! / 100 - currentValues[index]!));
  if (!gaps.some((gap) => gap > 0)) gaps = targetPercentages.map((percentage) => amount * percentage / 100);
  const gapTotal = gaps.reduce((sum, gap) => sum + gap, 0);
  const quantities = selected.map((fii, index) => Math.floor(amount * gaps[index]! / Math.max(gapTotal, 1) / fii.price!));
  let spent = quantities.reduce((sum, quantity, index) => sum + quantity * selected[index]!.price!, 0);
  while (true) {
    const affordable = selected.map((fii, index) => ({ fii, index, room: gaps[index]! - quantities[index]! * fii.price! }))
      .filter(({ fii, room }) => room > 0 && fii.price! <= amount - spent + 0.001)
      .sort((a, b) => b.room - a.room || (b.fii.score ?? 0) - (a.fii.score ?? 0));
    if (!affordable.length) break;
    const choice = affordable[0]!;
    quantities[choice.index] = quantities[choice.index]! + 1;
    spent += choice.fii.price!;
  }

  return selected.map((fii, index) => {
    const allocated = quantities[index]! * fii.price!;
    return {
    ticker: fii.ticker,
    score: fii.score ?? 0,
    price: fii.price!,
    quantity: quantities[index]!,
    currentValue: Math.round(currentValues[index]! * 100) / 100,
    amount: Math.round(allocated * 100) / 100,
    percentage: Math.round((allocated / amount) * 1000) / 10,
    targetPercentage: Math.round(targetPercentages[index]! * 10) / 10,
  }; });
}

function cappedPercentages(raw: number[]) {
  if (raw.length < 3) return raw;
  const result = Array(raw.length).fill(0) as number[];
  let active = raw.map((_, index) => index);
  let remaining = 100;
  while (active.length) {
    const total = active.reduce((sum, index) => sum + raw[index]!, 0);
    const over = active.filter((index) => remaining * raw[index]! / Math.max(total, 1) > 40);
    if (!over.length) {
      for (const index of active) result[index] = remaining * raw[index]! / Math.max(total, 1);
      break;
    }
    for (const index of over) { result[index] = 40; remaining -= 40; }
    active = active.filter((index) => !over.includes(index));
  }
  return result;
}
