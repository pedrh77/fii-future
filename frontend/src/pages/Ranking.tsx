import { Check, ChevronLeft, ChevronRight, Filter, Info, Plus, Search, SlidersHorizontal } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ScoreBadge } from '../components/ScoreBadge';
import { ErrorState, Loading } from '../components/States';
import { useAsync } from '../hooks/useAsync';
import { api } from '../services/api';
import { addTicker, portfolioTickers } from '../services/portfolio';
import type { Fii } from '../types';
import { compact, money, number, percent } from '../utils/format';

export function Ranking({ mode = 'portfolio' }: { mode?: 'portfolio' | 'universe' }) {
  const [portfolioVersion, setPortfolioVersion] = useState(0);
  const saved = portfolioTickers();
  const portfolioSet = new Set(saved);
  const load = () => mode === 'universe' ? api.getFiis() : saved.length ? api.analyzePortfolio(saved) : Promise.resolve([]);
  const { data = [], loading, error, retry } = useAsync(load, [mode, saved.join(','), portfolioVersion]);
  const [search, setSearch] = useState('');
  const [segment, setSegment] = useState('');
  const [assetType, setAssetType] = useState('');
  const [minDy, setMinDy] = useState('');
  const [maxPvp, setMaxPvp] = useState('');
  const [minScore, setMinScore] = useState('');
  const [page, setPage] = useState(1);
  const segments = [...new Set(data.map((item) => item.segment).filter(Boolean))] as string[];
  const assetTypes = [...new Set(data.map((item) => item.assetType).filter(Boolean))] as string[];
  const filtered = useMemo(() => data.filter((fii) =>
    (!search || `${fii.ticker} ${fii.name}`.toLowerCase().includes(search.toLowerCase())) &&
    (!segment || fii.segment === segment) && (!assetType || fii.assetType === assetType) && (!minDy || (fii.dividendYield12m ?? 0) >= Number(minDy)) &&
    (!maxPvp || (fii.pvp ?? Infinity) <= Number(maxPvp)) && (!minScore || (fii.score ?? 0) >= Number(minScore))), [data, search, segment, assetType, minDy, maxPvp, minScore]);
  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = mode === 'universe' ? filtered.slice((page - 1) * pageSize, page * pageSize) : filtered;
  useEffect(() => setPage(1), [search, segment, assetType, mode]);

  const includeInPortfolio = (ticker: string) => {
    addTicker(ticker);
    setPortfolioVersion((current) => current + 1);
  };

  if (mode === 'portfolio' && !saved.length) return <div className="page"><section className="panel empty-ranking"><h1>Ranking começa pela sua carteira</h1><p>Adicione seus FIIs e depois calculamos e comparamos cada fundo.</p><Link className="primary-button" to="/carteira">Montar carteira</Link></section></div>;
  return <div className="page"><div className="page-heading"><div><span className="eyebrow"><Filter size={14} /> Visão comparativa</span><h1>{mode === 'universe' ? 'Universo de FIIs' : 'Ranking da carteira'}</h1><p>{mode === 'universe' ? 'Explore os fundos disponíveis, pesquise por nome ou segmento e adicione ativos direto à sua carteira.' : 'Classificação dos seus FIIs baseada em indicadores públicos. Não representa recomendação.'}</p></div><div className="result-count"><strong>{filtered.length}</strong><span>{mode === 'universe' ? 'fundos encontrados' : 'fundos na carteira'}</span></div></div>
    {mode === 'universe' && <section className="info-panel compact-info"><Info size={17}/><div><b>Catálogo ampliado</b><p>Além de FIIs, lista inclui FIAGRO, FI-Infra, FIP e FIDC negociados em bolsa. Use “Tipo” para separar cada classe.</p></div></section>}
    <section className={`filter-bar ${mode === 'universe' ? 'catalog-filter-bar' : ''}`}><label className="search-field"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar ticker ou nome" /></label><label><span>Segmento</span><select value={segment} onChange={(event) => setSegment(event.target.value)}><option value="">Todos</option>{segments.map((item) => <option key={item}>{item}</option>)}</select></label>{mode === 'universe' && <label><span>Tipo</span><select value={assetType} onChange={(event) => setAssetType(event.target.value)}><option value="">Todos os fundos</option>{assetTypes.map((item) => <option key={item} value={item}>{fundType(item)}</option>)}</select></label>}{mode === 'portfolio' && <><label><span>DY mínimo (%)</span><input type="number" value={minDy} onChange={(event) => setMinDy(event.target.value)} placeholder="0" /></label><label><span>P/VP máximo</span><input type="number" value={maxPvp} onChange={(event) => setMaxPvp(event.target.value)} placeholder="2" /></label><label><span>Score mínimo</span><input type="number" value={minScore} onChange={(event) => setMinScore(event.target.value)} placeholder="0" /></label><button className="filter-icon" title="Filtros"><SlidersHorizontal size={19} /></button></>}</section>
    {loading
      ? <Loading />
      : error
        ? <ErrorState message={error} retry={retry} />
        : mode === 'universe'
          ? <><CatalogTable fiis={paged} portfolioSet={portfolioSet} add={includeInPortfolio} start={(page - 1) * pageSize}/><Pagination page={page} total={totalPages} setPage={setPage}/></>
          : <RankingTable fiis={filtered}/>}
  </div>;
}

function CatalogTable({ fiis, portfolioSet, add, start }: { fiis: Fii[]; portfolioSet: Set<string>; add: (ticker: string) => void; start: number }) {
  return <section className="panel table-panel"><div className="catalog-table"><div className="universe-row table-header"><span>#</span><span>Fundo</span><span>Segmento</span><span>Preço</span><span>Liquidez</span><span>Análise</span><span>Carteira</span></div>{fiis.map((fii, index) => {
    const included = portfolioSet.has(fii.ticker);
    return <div className="universe-row" key={fii.ticker}><span className="rank-number">{String(start + index + 1).padStart(2, '0')}</span><Link to={`/fii/${fii.ticker}`} className="fund-name"><b>{fii.ticker}</b><small>{fundType(fii.assetType)} · {fii.name ?? '—'}</small></Link><span className="segment-pill">{fii.segment ?? 'Não informado'}</span><span>{money(fii.price)}</span><span>{compact(fii.liquidity)}</span><Link className="table-link" to={`/fii/${fii.ticker}`}>Ver fundo</Link><button className={`portfolio-add ${included ? 'added' : ''}`} disabled={included} onClick={() => add(fii.ticker)}>{included ? <><Check size={13}/> Na carteira</> : <><Plus size={13}/> Adicionar</>}</button></div>;
  })}</div></section>;
}

function RankingTable({ fiis }: { fiis: Fii[] }) {
  return <section className="panel table-panel"><div className="data-table"><div className="data-row table-header"><span>#</span><span>Fundo</span><span>Preço</span><span>DY</span><span>P/VP</span><span>Último</span><span>Patrimônio</span><span>Cotistas</span><span>Score</span></div>{fiis.map((fii, index) => <Link to={`/fii/${fii.ticker}`} className="data-row" key={fii.ticker}><span className="rank-number">{String(index + 1).padStart(2, '0')}</span><span className="fund-name"><b>{fii.ticker}</b><small>{fii.name ?? '—'}</small></span><span>{money(fii.price)}</span><span className="green">{percent(fii.dividendYield12m)}</span><span>{number(fii.pvp)}</span><span>{money(fii.lastDividend)}</span><span>{compact(fii.netWorth)}</span><span>{compact(fii.shareholders)}</span><ScoreBadge score={fii.score} /></Link>)}</div></section>;
}

export const Fiis = () => <Ranking mode="universe" />;

function Pagination({ page, total, setPage }: { page: number; total: number; setPage: (page: number) => void }) {
  return <nav className="pagination" aria-label="Paginação"><button disabled={page === 1} onClick={() => setPage(page - 1)}><ChevronLeft size={15}/> Anterior</button><span>Página <b>{page}</b> de {total}</span><button disabled={page === total} onClick={() => setPage(page + 1)}>Próxima <ChevronRight size={15}/></button></nav>;
}

const fundType = (type?: string) => ({ fii: 'FII', 'fi-agro': 'FIAGRO', 'fi-infra': 'FI-Infra', fip: 'FIP', fidc: 'FIDC' }[type ?? ''] ?? 'Fundo');
