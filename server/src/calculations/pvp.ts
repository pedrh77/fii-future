export function calculatePvp(price?: number, patrimonialValuePerShare?: number) {
  if (!price || !patrimonialValuePerShare || price <= 0 || patrimonialValuePerShare <= 0) return undefined;
  return Math.round((price / patrimonialValuePerShare) * 100) / 100;
}
