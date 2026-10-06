export interface PortfolioPosition {
  ticker: string;
  quantity: number;
  averagePrice: number;
}

const STORAGE_KEY = 'fii-future-portfolio';

const normalizeTicker = (ticker: string) => ticker.trim().toUpperCase();

export function loadPortfolio(): PortfolioPosition[] {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as unknown;
    if (!Array.isArray(stored)) return [];

    const positions = stored.flatMap((item): PortfolioPosition[] => {
      if (typeof item === 'string') {
        const ticker = normalizeTicker(item);
        return ticker ? [{ ticker, quantity: 0, averagePrice: 0 }] : [];
      }
      if (!item || typeof item !== 'object') return [];
      const candidate = item as Partial<PortfolioPosition>;
      const ticker = normalizeTicker(String(candidate.ticker ?? ''));
      if (!ticker) return [];
      return [{
        ticker,
        quantity: Math.max(0, Number(candidate.quantity) || 0),
        averagePrice: Math.max(0, Number(candidate.averagePrice) || 0),
      }];
    });

    const unique = [...new Map(positions.map((position) => [position.ticker, position])).values()];
    if (stored.some((item) => typeof item === 'string')) savePortfolio(unique);
    return unique;
  } catch {
    return [];
  }
}

export function savePortfolio(positions: PortfolioPosition[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
}

export function addTicker(ticker: string) {
  const normalized = normalizeTicker(ticker);
  const positions = loadPortfolio();
  if (!normalized || positions.some((position) => position.ticker === normalized)) return positions;
  const next = [...positions, { ticker: normalized, quantity: 0, averagePrice: 0 }];
  savePortfolio(next);
  return next;
}

export function portfolioTickers() {
  return loadPortfolio().map((position) => position.ticker);
}
