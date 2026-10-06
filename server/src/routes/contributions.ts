import { Router } from 'express';
import { z } from 'zod';
import { allocateContribution } from '../calculations/contributionAllocator.js';
import type { CvmProvider } from '../providers/cvmProvider.js';
import type { MarketProvider } from '../providers/marketProvider.js';
import { FiiService } from '../services/fiiService.js';

export function createContributionRouter(cvm: CvmProvider, market: MarketProvider) {
  const router = Router();
  router.post('/', async (request, response, next) => {
    try {
      const { amount, count, tickers, positions } = z.object({
        amount: z.number().positive(),
        count: z.union([z.literal(3), z.literal(5), z.literal(10)]),
        tickers: z.array(z.string()).max(30).optional(),
        positions: z.array(z.object({ ticker: z.string(), quantity: z.number().nonnegative() })).max(30).optional(),
      }).parse(request.body);
      const service = new FiiService(cvm, market);
      const ranking = tickers?.length
        ? (await Promise.all(tickers.map((ticker) => service.detail(ticker)))).filter((item) => item !== null).sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        : await service.ranking();
      response.json(allocateContribution(amount, ranking.slice(0, count), positions));
    } catch (error) { next(error); }
  });
  return router;
}
