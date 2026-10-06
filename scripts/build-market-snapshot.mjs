import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const fundTypes = new Set(['fii', 'fi-agro', 'fi-infra', 'fip', 'fidc']);
const historyLimit = Number(process.env.SNAPSHOT_LIMIT ?? 120);
const catalogUrl = 'https://brapi.dev/api/quote/list?type=fund&limit=5000';
const headers = { 'User-Agent': 'FII-Future/1.0' };

const response = await fetch(catalogUrl, { headers });
if (!response.ok) throw new Error(`Catálogo BRAPI falhou: HTTP ${response.status}`);
const catalogPayload = await response.json();
const catalog = catalogPayload.stocks
  .filter((item) => fundTypes.has(item.subType))
  .map((item) => ({
    ticker: item.stock,
    name: item.name,
    assetType: item.subType,
    price: item.close,
    liquidity: item.close && item.volume ? item.close * item.volume : 0,
  }))
  .sort((a, b) => b.liquidity - a.liquidity);

const selected = catalog.slice(0, historyLimit);
const entries = await mapWithConcurrency(selected, 8, async (fund) => {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(fund.ticker)}.SA?range=1y&interval=1d&events=div`;
    const chartResponse = await fetch(url, { headers });
    if (!chartResponse.ok) return null;
    const payload = await chartResponse.json();
    const result = payload.chart?.result?.[0];
    const timestamps = result?.timestamp ?? [];
    const closes = result?.indicators?.quote?.[0]?.close ?? [];
    const history = timestamps.flatMap((timestamp, index) => closes[index] == null ? [] : [{
      date: new Date(timestamp * 1000).toISOString().slice(0, 10),
      price: closes[index],
    }]);
    if (history.length < 2) return null;
    const dividends = Object.values(result?.events?.dividends ?? {}).map((item) => ({
      ticker: fund.ticker,
      date: new Date(item.date * 1000).toISOString().slice(0, 10),
      value: item.amount,
    })).sort((a, b) => b.date.localeCompare(a.date));
    const price = history.at(-1).price;
    const annualDividendYield = price > 0 ? dividends.reduce((sum, item) => sum + item.value, 0) / price * 100 : undefined;
    const annualAppreciation = Math.max(-30, Math.min(30, (price / history[0].price - 1) * 100));
    return [fund.ticker, { history, dividends, annualDividendYield, annualAppreciation }];
  } catch {
    return null;
  }
});

const funds = Object.fromEntries(entries.filter(Boolean));
const performance = {
  week: performanceFor('week', selected, funds),
  month: performanceFor('month', selected, funds),
};
const snapshot = {
  generatedAt: new Date().toISOString(),
  coverage: { catalog: catalog.length, historical: Object.keys(funds).length },
  funds,
  performance,
};

const outputDirectory = resolve('frontend', 'public');
await mkdir(outputDirectory, { recursive: true });
await writeFile(resolve(outputDirectory, 'market-snapshot.json'), JSON.stringify(snapshot));
console.log(`Snapshot: ${catalog.length} fundos, ${Object.keys(funds).length} históricos.`);

function performanceFor(period, assets, staticFunds) {
  return assets.flatMap((asset) => {
    const history = staticFunds[asset.ticker]?.history ?? [];
    const latest = history.at(-1);
    const previous = period === 'week' ? history.at(-6) : history.find((item) => new Date(item.date).getTime() >= Date.now() - 31 * 86_400_000) ?? history[0];
    if (!latest || !previous || previous.price <= 0) return [];
    return [{ ticker: asset.ticker, name: asset.name, assetType: asset.assetType, price: latest.price, changePercent: (latest.price / previous.price - 1) * 100, period }];
  }).sort((a, b) => b.changePercent - a.changePercent).slice(0, 5);
}

async function mapWithConcurrency(items, concurrency, load) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await load(items[index]);
    }
  }));
  return results;
}
