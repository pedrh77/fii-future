import express from 'express';
import cors from 'cors';
import { ZodError } from 'zod';
import dotenv from 'dotenv';
import { resolve } from 'node:path';
import { BrapiMarketProvider } from './providers/brapiMarketProvider.js';
import { CvmProvider } from './providers/cvmProvider.js';
import { createFiiRouter } from './routes/fiis.js';
import { createSimulationRouter } from './routes/simulation.js';
import { createContributionRouter } from './routes/contributions.js';
import { FiiService } from './services/fiiService.js';
import { requestFilters } from './routes/fiis.js';
import { createPortfolioRouter } from './routes/portfolio.js';

dotenv.config({ path: resolve(process.cwd(), '..', '.env') });

const app = express();
const cvm = new CvmProvider();
const market = new BrapiMarketProvider();

app.use(cors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:5173' }));
app.use(express.json());
app.get('/api/health', (_request, response) => response.json({ status: 'ok' }));
app.use('/api/fiis', createFiiRouter(cvm, market));
app.get('/api/ranking', async (request, response, next) => {
  try { response.json(await new FiiService(cvm, market).ranking(requestFilters(request.query))); } catch (error) { next(error); }
});
app.use('/api/simulation', createSimulationRouter(cvm, market));
app.use('/api/contributions', createContributionRouter(cvm, market));
app.use('/api/portfolio', createPortfolioRouter(cvm, market));

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  if (error instanceof ZodError) return response.status(400).json({ message: 'Dados inválidos.', issues: error.issues });
  console.error(error);
  const message = error instanceof Error && error.message.includes('não encontrado')
    ? error.message
    : 'Não foi possível carregar os dados no momento.';
  response.status(message.includes('não encontrado') ? 404 : 502).json({ message });
});

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => console.log(`FII Future API em http://localhost:${port}`));
