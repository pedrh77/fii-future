export function calculatePatrimonialValue(netWorth?: number, totalShares?: number) {
  if (!netWorth || !totalShares || netWorth <= 0 || totalShares <= 0) return undefined;
  return Math.round((netWorth / totalShares) * 100) / 100;
}
