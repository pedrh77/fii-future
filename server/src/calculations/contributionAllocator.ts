import type { Fii } from '../types/fii.js';

export function allocateContribution(amount: number, fiis: Fii[]) {
  if (amount <= 0 || !fiis.length) return [];
  const selected = fiis.filter((fii) => (fii.score ?? 0) > 0);
  let remaining = amount;
  let active = [...selected];
  const allocations = new Map<string, number>();
  const cap = amount * 0.4;

  while (remaining > 0.009 && active.length) {
    const totalScore = active.reduce((sum, fii) => sum + (fii.score ?? 0), 0);
    let distributed = 0;
    const next: Fii[] = [];
    for (const fii of active) {
      const current = allocations.get(fii.ticker) ?? 0;
      const share = totalScore ? remaining * (fii.score ?? 0) / totalScore : remaining / active.length;
      const room = cap - current;
      const value = Math.min(share, room);
      allocations.set(fii.ticker, current + value);
      distributed += value;
      if (room - value > 0.009) next.push(fii);
    }
    if (distributed < 0.009) break;
    remaining -= distributed;
    active = next;
  }

  return selected.map((fii) => ({
    ticker: fii.ticker,
    score: fii.score ?? 0,
    amount: Math.round((allocations.get(fii.ticker) ?? 0) * 100) / 100,
    percentage: Math.round(((allocations.get(fii.ticker) ?? 0) / amount) * 1000) / 10,
  }));
}
