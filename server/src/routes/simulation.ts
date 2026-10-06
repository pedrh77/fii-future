import { Router } from 'express';
import { z } from 'zod';
import type { CvmProvider } from '../providers/cvmProvider.js';
import type { MarketProvider } from '../providers/marketProvider.js';
import { FiiService } from '../services/fiiService.js';
import { simulateInvestment } from '../calculations/investmentSimulation.js';

const inputSchema = z.object({
  initialAmount: z.number().min(0),
  monthlyContribution: z.number().min(0),
  years: z.number().int().min(1).max(60),
  annualDividendYield: z.number().min(0).max(100),
  annualAppreciation: z.number().min(-100).max(100),
  reinvestDividends: z.boolean(),
});

const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

function historicalAppreciation(history: Array<{ date: string; price: number }>) {
  if (history.length < 2) return 0;
  const first = history[0]!;
  const last = history.at(-1)!;
  const years = Math.max((new Date(last.date).getTime() - new Date(first.date).getTime()) / 31_557_600_000, 1);
  return Math.max(-20, Math.min(20, ((last.price / first.price) ** (1 / years) - 1) * 100));
}

async function assumptions(cvm: CvmProvider, market: MarketProvider, ticker: string) {
  const service = new FiiService(cvm, market);
  const [fii, history] = await Promise.all([
    service.detail(ticker), market.getHistory(ticker),
  ]);
  if (!fii) throw new Error(`FII ${ticker} não encontrado.`);
  const annualDividendYield = fii.dividendYield12m ?? 0;
  return { annualDividendYield, annualAppreciation: historicalAppreciation(history) };
}

export function createSimulationRouter(cvm: CvmProvider, market: MarketProvider) {
  const router = Router();

  router.post('/', (request, response, next) => {
    try { response.json(simulateInvestment(inputSchema.parse(request.body))); } catch (error) { next(error); }
  });

  router.post('/fii/:ticker', async (request, response, next) => {
    try {
      const base = z.object({ initialAmount: z.number().min(0), monthlyContribution: z.number().min(0), years: z.number().int().min(1).max(60), reinvestDividends: z.boolean().default(true) }).parse(request.body);
      const calculated = await assumptions(cvm, market, request.params.ticker.toUpperCase());
      response.json({ ...simulateInvestment({ ...base, ...calculated }), assumptions: calculated });
    } catch (error) { next(error); }
  });

  router.post('/portfolio', async (request, response, next) => {
    try {
      const body = z.object({ initialAmount: z.number().min(0), monthlyContribution: z.number().min(0), years: z.number().int().min(1).max(60), tickers: z.array(z.string()).min(1).max(30), weights: z.array(z.number().min(0)).optional(), annualDividendYield: z.number().min(0).max(100).optional(), annualAppreciation: z.number().min(-100).max(100).optional(), reinvestDividends: z.boolean().default(true) }).parse(request.body);
      const values = await Promise.all(body.tickers.map((ticker) => assumptions(cvm, market, ticker.toUpperCase())));
      const suppliedWeights = body.weights?.length === values.length ? body.weights : undefined;
      const weightTotal = suppliedWeights?.reduce((sum, value) => sum + value, 0) ?? 0;
      const weightedAverage = (select: (value: typeof values[number]) => number) => weightTotal > 0
        ? values.reduce((sum, value, index) => sum + select(value) * (suppliedWeights![index] ?? 0), 0) / weightTotal
        : average(values.map(select));
      const calculated = {
        annualDividendYield: weightedAverage((item) => item.annualDividendYield > 0 ? item.annualDividendYield : (body.annualDividendYield ?? 0)),
        annualAppreciation: weightedAverage((item) => item.annualAppreciation || (body.annualAppreciation ?? 0)),
      };
      response.json({ ...simulateInvestment({ ...body, ...calculated }), assumptions: calculated });
    } catch (error) { next(error); }
  });

  return router;
}
