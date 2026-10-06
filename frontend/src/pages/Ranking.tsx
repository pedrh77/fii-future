import { Filter, Search, SlidersHorizontal } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ScoreBadge } from '../components/ScoreBadge';
import { ErrorState, Loading } from '../components/States';
import { useAsync } from '../hooks/useAsync';
import { api } from '../services/api';
import { compact, money, number, percent } from '../utils/format';

export function Ranking({ mode = 'portfolio' }: { mode?: 'portfolio' | 'universe' }) {
  const saved = (() => { try { return JSON.parse(localStorage.getItem('fii-future-portfolio') ?? '[]') as string[]; } catch { return []; } })();
  const load = () => mode === 'universe' ? api.getFiis() : saved.length ? api.analyzePortfolio(saved) : Promise.resolve([]);
  const { data = [], loading, error, retry } = useAsync(load, [mode, saved.join(',')]);
  const [search, setSearch] = useState('');
  const [segment, setSegment] = useState('');
  const [minDy, setMinDy] = useState('');
  const [maxPvp, setMaxPvp] = useState('');
  const [minScore, setMinScore] = useState('');
  const segments = [...new Set(data.map((item) => item.segment).filter(Boolean))] as string[];
  const filtered = useMemo(() => data.filter((fii) =>
    (!search || `${fii.ticker} ${fii.name}`.toLowerCase().includes(search.toLowerCase())) &&
    (!segment || fii.segment === segment) && (!minDy || (fii.dividendYield12m ?? 0) >= Number(minDy)) &&
    (!maxPvp || (fii.pvp ?? Infinity) <= Number(maxPvp)) && (!minScore || (fii.score ?? 0) >= Number(minScore))), [data, search, segment, minDy, maxPvp, minScore]);

  if (mode === 'portfolio' && !saved.length) return <div className="page"><section className="panel empty-ranking"><h1>Ranking começa pela sua carteira</h1><p>Escolha FIIs no dashboard. Depois calculamos e comparamos cada fundo.</p><Link className="primary-button" to="/">Montar carteira</Link></section></div>;
  return <div className="page"><div className="page-heading"><div><span className="eyebrow"><Filter size={14} /> Visão comparativa</span><h1>{mode === 'universe' ? 'Universo de FIIs' : 'Ranking da carteira'}</h1><p>{mode === 'universe' ? 'Fundos imobiliários encontrados no mercado. Abra um fundo para calcular indicadores completos.' : 'Classificação dos seus FIIs baseada em indicadores públicos. Não representa recomendação.'}</p></div><div className="result-count"><strong>{filtered.length}</strong><span>{mode === 'universe' ? 'fundos encontrados' : 'fundos na carteira'}</span></div></div>
    <section className="filter-bar"><label className="search-field"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar ticker ou nome" /></label><label><span>Segmento</span><select value={segment} onChange={(event) => setSegment(event.target.value)}><option value="">Todos</option>{segments.map((item) => <option key={item}>{item}</option>)}</select></label><label><span>DY mínimo (%)</span><input type="number" value={minDy} onChange={(event) => setMinDy(event.target.value)} placeholder="0" /></label><label><span>P/VP máximo</span><input type="number" value={maxPvp} onChange={(event) => setMaxPvp(event.target.value)} placeholder="2" /></label><label><span>Score mínimo</span><input type="number" value={minScore} onChange={(event) => setMinScore(event.target.value)} placeholder="0" /></label><button className="filter-icon" title="Filtros"><SlidersHorizontal size={19} /></button></section>
    {loading ? <Loading /> : error ? <ErrorState message={error} retry={retry} /> : <section className="panel table-panel"><div className="data-table"><div className="data-row table-header"><span>#</span><span>Fundo</span><span>Preço</span><span>DY</span><span>P/VP</span><span>Último</span><span>Patrimônio</span><span>Cotistas</span><span>Score</span></div>{filtered.map((fii, index) => <Link to={`/fii/${fii.ticker}`} className="data-row" key={fii.ticker}><span className="rank-number">{String(index + 1).padStart(2, '0')}</span><span className="fund-name"><b>{fii.ticker}</b><small>{fii.name ?? '—'}</small></span><span>{money(fii.price)}</span><span className="green">{percent(fii.dividendYield12m)}</span><span>{number(fii.pvp)}</span><span>{money(fii.lastDividend)}</span><span>{compact(fii.netWorth)}</span><span>{compact(fii.shareholders)}</span><ScoreBadge score={fii.score} /></Link>)}</div></section>}
  </div>;
}

export const Fiis = () => <Ranking mode="universe" />;
