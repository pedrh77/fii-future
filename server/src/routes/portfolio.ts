import { Router } from 'express';
import { z } from 'zod';
import type { CvmProvider } from '../providers/cvmProvider.js';
import type { MarketProvider } from '../providers/marketProvider.js';
import { FiiService } from '../services/fiiService.js';

export function createPortfolioRouter(cvm: CvmProvider, market: MarketProvider) {
  const router = Router();
  const service = new FiiService(cvm, market);
  router.post('/analyze', async (request, response, next) => {
    try {
      const { tickers } = z.object({ tickers: z.array(z.string().regex(/^[A-Z]{4}[0-9]{2}$/)).min(1).max(30) }).parse(request.body);
      const results = await Promise.all(tickers.map((ticker) => service.detail(ticker)));
      response.json(results.filter(Boolean));
    } catch (error) { next(error); }
  });
  return router;
}
