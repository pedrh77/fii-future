# FII Future

Dashboard educacional para consultar fundos imobiliários brasileiros, comparar indicadores, calcular classificação interna e simular patrimônio e renda futura.

## Arquitetura

```text
React + TypeScript + Vite
          ↓ /api
Node.js + Express + TypeScript
          ↓
Providers CVM + mercado
```

Projeto sem banco de dados e sem autenticação. Servidor protege token, normaliza respostas, mantém cache em memória e executa cálculos. Frontend nunca acessa API externa diretamente.

## Stack

- React, TypeScript, Vite e Tailwind CSS
- Recharts e Lucide React
- Node.js, Express, Zod e TypeScript
- Vitest para testes dos cálculos
- Axios para acesso às fontes externas
- Portal de Dados Abertos CVM para fundamentos
- BRAPI como provider desacoplado de preço, histórico e eventos de rendimento

## Instalação

Requer Node.js 20 ou superior.

```bash
cd fii-future
npm install
```

Copie `.env.example` para `.env` e configure:

```env
BRAPI_TOKEN=seu_token
PORT=3001
FRONTEND_URL=http://localhost:5173
```

O token fica somente no servidor. Sem token, provider de mercado permite ambiente sandbox com `HGLG11` e `MXRF11`. Listagem completa exige token BRAPI compatível. `CVM_DATA_YEAR` é opcional e força ano-base dos informes.

## Executar

```bash
npm run dev
```

- Frontend: http://localhost:5173
- API Node: http://localhost:3001

Build e testes:

```bash
npm run build
npm test
```

## Endpoints

- `GET /api/health`
- `GET /api/fiis`
- `GET /api/fiis/ranking`
- `GET /api/fiis/:ticker`
- `GET /api/fiis/:ticker/dividends`
- `GET /api/fiis/:ticker/history`
- `GET /api/ranking?minDy=&maxPvp=&minScore=&segment=&search=`
- `POST /api/simulation`
- `POST /api/simulation/fii/:ticker`
- `POST /api/simulation/portfolio`
- `POST /api/contributions`

## Fontes e cache

Fundamentos vêm dos Informes Mensais Estruturados da CVM:

- `https://dados.cvm.gov.br/dados/FII/DOC/INF_MENSAL/DADOS/inf_mensal_fii_{ano}.zip`
- arquivos `geral` e `complemento` dentro de cada ZIP

Campos usados: CNPJ, nome, segmento, patrimônio líquido, cotas emitidas, valor patrimonial, cotistas e DY mensal. Servidor baixa ano atual e anterior, seleciona versão mais recente e cruza fundos por CNPJ.

Provider de mercado usa endpoints BRAPI v2 documentados:

- `/api/v2/fii/list`
- `/api/v2/fii/dividends`
- `/api/v2/fii/historical`

Sem token Pro, catálogo público BRAPI carrega universo de FIIs e Yahoo Finance fornece preço, histórico, nome e dividendos dos tickers escolhidos. Servidor cruza nome do fundo com informe CVM. Com token Pro, vínculo usa CNPJ direto.

Dados CVM ficam em cache por 6 horas. Preços e lista ficam por 10 minutos. Histórico fica por 1 hora. Dividendos ficam por 6 horas. Cache usa `Map` em memória e reinicia junto com servidor.

## Cálculos fundamentais

- VP por cota = patrimônio líquido / cotas emitidas. Quando CVM já informa o campo, sistema usa valor oficial mais recente.
- P/VP = preço atual / VP por cota, arredondado para duas casas.
- DY 12 meses = soma dos 12 rendimentos / preço atual × 100.
- Médias de dividendos usam últimos 6 e 12 eventos disponíveis.
- Ranking usa série mensal oficial CVM para evitar uma chamada externa por fundo. Tela detalhada usa eventos de rendimento do provider de mercado.

## Score

Nota de 0 a 100:

- dividend yield: 30%
- valuation por P/VP: 25%
- consistência de dividendos: 20%
- patrimônio líquido: 10%
- número de cotistas: 5%
- liquidez: 10%

Indicadores ausentes recebem nota neutra/conservadora. Consistência considera até 12 pagamentos, média, desvio e regularidade. Score serve somente como classificação interna.

## Simulação

Simulação ocorre mês a mês. Cada período aplica aporte, valorização e dividendos. Dividendos entram novamente no patrimônio somente quando reinvestimento está ativo. Resultado mostra patrimônio, total aportado, dividendos, renda mensal estimada e pontos anuais.

Simulação por FII usa DY calculado pelo total dos últimos 12 rendimentos dividido pelo preço atual. Valorização usa retorno anualizado do histórico disponível, limitado entre -20% e 20%. Carteira usa média simples dos FIIs, com divisão igual no MVP.

## Limitações

- CVM publica informes em lote e pode ter atraso, reapresentações ou campos vazios.
- CNPJ do provider de mercado faz vínculo entre ticker e informe CVM.
- Liquidez pode ficar ausente quando fonte gratuita não fornece volume normalizado.
- Sem token BRAPI Pro, universo público mostra preços de todos os FIIs, mas cálculo completo ocorre sob demanda para carteira escolhida.
- Correspondência sem token usa nome do fundo. Renomes recentes podem deixar algum FII com dados parciais.
- Score e projeções não são recomendação e não garantem resultado.

## Fluxo inicial

Dashboard começa pedindo até 10 tickers. Carteira fica salva localmente no navegador. Backend busca cada fundo, cruza dados CVM, calcula indicadores e monta ranking somente da seleção. Tela `FIIs` mantém catálogo completo do mercado para pesquisa.

## Aporte inteligente

Distribuição usa proporção dos scores e limita cada ativo a 40% do valor. Opções: 3, 5 ou 10 fundos mais bem classificados.

## Disclaimer

Este sistema possui finalidade exclusivamente educacional e informativa. Os dados e cálculos apresentados não constituem recomendação de compra ou venda de ativos. Resultados históricos não garantem resultados futuros.
