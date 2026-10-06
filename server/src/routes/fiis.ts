import { Router } from 'express';
import type { CvmProvider } from '../providers/cvmProvider.js';
import type { MarketProvider } from '../providers/marketProvider.js';
import { FiiService } from '../services/fiiService.js';

export function createFiiRouter(cvm: CvmProvider, market: MarketProvider) {
  const router = Router();
  const service = new FiiService(cvm, market);

  router.get('/ranking', async (request, response, next) => {
    try { response.json(await service.ranking(requestFilters(request.query))); } catch (error) { next(error); }
  });

  router.get('/', async (_request, response, next) => {
    try { response.json(await service.list()); } catch (error) { next(error); }
  });

  router.get('/performance', async (request, response, next) => {
    try {
      const period = String(request.query.period ?? 'day');
      if (!['day', 'week', 'month'].includes(period)) return response.status(400).json({ message: 'Período inválido.' });
      response.json(await service.performance(period as 'day' | 'week' | 'month'));
    } catch (error) { next(error); }
  });

  router.get('/:ticker/dividends', async (request, response, next) => {
    try { response.json(await service.dividends(request.params.ticker)); } catch (error) { next(error); }
  });

  router.get('/:ticker/history', async (request, response, next) => {
    try { response.json(await market.getHistory(request.params.ticker, String(request.query.period ?? '1y'))); } catch (error) { next(error); }
  });

  router.get('/:ticker', async (request, response, next) => {
    try {
      const fii = await service.detail(request.params.ticker);
      if (!fii) return response.status(404).json({ message: 'FII não encontrado.' });
      response.json(fii);
    } catch (error) { next(error); }
  });

  return router;
}

export const requestFilters = (query: Record<string, unknown>) => ({
  minDy: query.minDy === undefined ? undefined : Number(query.minDy),
  maxPvp: query.maxPvp === undefined ? undefined : Number(query.maxPvp),
  minScore: query.minScore === undefined ? undefined : Number(query.minScore),
  segment: query.segment ? String(query.segment) : undefined,
  search: query.search ? String(query.search) : undefined,
});
