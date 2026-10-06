import { Award, BarChart3, Check, ChevronLeft, ChevronRight, Filter, Info, Plus, Search, ShieldCheck, SlidersHorizontal, Sparkles, TrendingUp } from 'lucide-react';
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
    (!maxPvp || (fii.pvp ?? Infinity) <= Number(maxPvp)) && (!minScore || (fii.score ?? 0) >= Number(minScore)))
    .sort((a, b) => mode === 'portfolio' ? (b.score ?? -1) - (a.score ?? -1) : 0), [data, search, segment, assetType, minDy, maxPvp, minScore, mode]);
  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = mode === 'universe' ? filtered.slice((page - 1) * pageSize, page * pageSize) : filtered;
  useEffect(() => setPage(1), [search, segment, assetType, minDy, maxPvp, minScore, mode]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  const includeInPortfolio = (ticker: string) => {
    addTicker(ticker);
    setPortfolioVersion((current) => current + 1);
  };

  if (mode === 'portfolio' && !saved.length) return <div className="page"><section className="panel empty-ranking"><h1>Ranking começa pela sua carteira</h1><p>Adicione seus FIIs e depois calculamos e comparamos cada fundo.</p><Link className="primary-button" to="/carteira">Montar carteira</Link></section></div>;
  return <div className="page"><div className="page-heading"><div><span className="eyebrow"><Filter size={14} /> Visão comparativa</span><h1>{mode === 'universe' ? 'Universo de FIIs' : 'Ranking da carteira'}</h1><p>{mode === 'universe' ? 'Explore os fundos disponíveis, pesquise por nome ou segmento e adicione ativos direto à sua carteira.' : 'Classificação dos seus FIIs baseada em indicadores públicos. Não representa recomendação.'}</p></div><div className="result-count"><strong>{filtered.length}</strong><span>{mode === 'universe' ? 'fundos encontrados' : 'fundos na carteira'}</span></div></div>
    {mode === 'universe' && <section className="info-panel compact-info"><Info size={17}/><div><b>Fundos com negociação e cotação disponíveis</b><p>Catálogo público reúne FIIs, FIAGRO, FI-Infra, FIP e FIDC com cotação. Fundo sem cotação pública pode ser digitado diretamente em “Carteira” e fica marcado como dado parcial.</p><Link to="/carteira">Cadastrar ticker ausente</Link></div></section>}
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
  const top = fiis.slice(0, 3);
  const analyzed = fiis.filter((fii) => fii.score !== undefined).length;
  return <div className="ranking-experience">
    <section className="ranking-intro"><div><span><BarChart3 size={17}/></span><div><b>Leitura comparativa</b><p>{analyzed ? `${analyzed} de ${fiis.length} fundos possuem histórico suficiente para score.` : 'Os fundos estão salvos, mas ainda não possuem histórico suficiente no retrato diário.'}</p></div></div><small>Modo estático combina renda, valorização, consistência e liquidez. Não é indicação de compra.</small></section>
    {top.length > 0 && <section className="ranking-podium">{top.map((fii, index) => <Link to={`/fii/${fii.ticker}`} className={`podium-card podium-${index + 1}`} key={fii.ticker}><span className="podium-place">{index === 0 ? <Award size={18}/> : index === 1 ? <Sparkles size={17}/> : <ShieldCheck size={17}/>} {index + 1}º</span><div><h2>{fii.ticker}</h2><p>{fii.segment ?? fii.name ?? 'Dados parciais'}</p></div><strong>{fii.score === undefined ? '—' : fii.score.toFixed(1)}</strong><small>score</small><div className="podium-metrics"><span>DY <b>{percent(fii.dividendYield12m)}</b></span><span>{fii.pvp === undefined ? 'Val.' : 'P/VP'} <b>{fii.pvp === undefined ? percent(fii.annualAppreciation) : number(fii.pvp)}</b></span></div></Link>)}</section>}
    <section className="panel ranking-board"><div className="ranking-board-head"><div><span className="kicker">CLASSIFICAÇÃO COMPLETA</span><h2>Compare sua carteira</h2></div><span>{fiis.length} ativos</span></div><div className="ranking-list">{fiis.map((fii, index) => <Link to={`/fii/${fii.ticker}`} className="ranking-row" key={fii.ticker}><span className={`ranking-position ${index < 3 ? 'top' : ''}`}>{String(index + 1).padStart(2, '0')}</span><span className="fund-name"><b>{fii.ticker}</b><small>{fii.name ?? fii.segment ?? 'Dados parciais'}</small></span><span className="ranking-metric"><small>Preço</small><b>{money(fii.price)}</b></span><span className="ranking-metric positive"><small>DY 12m</small><b>{percent(fii.dividendYield12m)}</b></span><span className="ranking-metric"><small>{fii.pvp === undefined ? 'Val. anual' : 'P/VP'}</small><b>{fii.pvp === undefined ? percent(fii.annualAppreciation) : number(fii.pvp)}</b></span><span className="ranking-metric"><small>Liquidez</small><b>{compact(fii.liquidity)}</b></span><span className="ranking-score"><ScoreBadge score={fii.score}/><TrendingUp size={15}/></span></Link>)}</div></section>
  </div>;
}

export const Fiis = () => <Ranking mode="universe" />;

function Pagination({ page, total, setPage }: { page: number; total: number; setPage: (page: number) => void }) {
  return <nav className="pagination" aria-label="Paginação"><button disabled={page === 1} onClick={() => setPage(page - 1)}><ChevronLeft size={15}/> Anterior</button><span>Página <b>{page}</b> de {total}</span><button disabled={page === total} onClick={() => setPage(page + 1)}>Próxima <ChevronRight size={15}/></button></nav>;
}

const fundType = (type?: string) => ({ fii: 'FII', 'fi-agro': 'FIAGRO', 'fi-infra': 'FI-Infra', fip: 'FIP', fidc: 'FIDC' }[type ?? ''] ?? 'Fundo');
