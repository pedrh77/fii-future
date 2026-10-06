import { ArrowRight, CircleDollarSign, Info, Landmark, PieChart, Plus, Sparkles, Target, TrendingUp, WalletCards } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { useAsync } from '../hooks/useAsync';
import { money, number, percent } from '../utils/format';
import { ErrorState, Loading } from '../components/States';
import { ScoreBadge } from '../components/ScoreBadge';
import { loadPortfolio, savePortfolio, type PortfolioPosition } from '../services/portfolio';
import type { Fii, FiiPerformance } from '../types';

export function Dashboard() {
  const [positions, setPositions] = useState<PortfolioPosition[]>(loadPortfolio);
  const save = (tickers: string[]) => {
    const next = tickers.map((ticker) => ({ ticker, quantity: 0, averagePrice: 0 }));
    savePortfolio(next);
    setPositions(next);
  };
  return positions.length ? <PortfolioDashboard tickers={positions.map((position) => position.ticker)} /> : <PortfolioSetup save={save} />;
}

function PortfolioSetup({ save }: { save: (tickers: string[]) => void }) {
  const [value, setValue] = useState('HGLG11, MXRF11, XPML11');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const tickers = [...new Set(value.toUpperCase().split(/[\s,;]+/).filter((item) => /^[A-Z]{4}[0-9]{2}$/.test(item)))].slice(0, 10);
    if (tickers.length) save(tickers);
  };
  return <div className="page portfolio-onboarding"><section className="portfolio-intro"><span className="eyebrow"><WalletCards size={14}/> Primeiro passo</span><h1>Monte sua carteira.<br/><em>Depois, veja o futuro.</em></h1><p>Escolha seus FIIs. Sistema cruza cotações, rendimentos e histórico público para calcular indicadores da sua carteira.</p></section>
    <form className="panel portfolio-builder" onSubmit={submit}><div className="builder-count">01</div><div><span className="kicker">SUA CARTEIRA</span><h2>Quais FIIs você quer acompanhar?</h2><p>Digite até 10 tickers, separados por vírgula.</p><label><span>Tickers</span><input value={value} onChange={(event) => setValue(event.target.value)} placeholder="HGLG11, MXRF11, XPML11"/></label><div className="suggestions"><span>Exemplos:</span>{['HGLG11','MXRF11','XPML11','KNCR11','BTLG11'].map((ticker) => <button type="button" key={ticker} onClick={() => setValue((current) => current.includes(ticker) ? current : `${current}, ${ticker}`)}><Plus size={12}/>{ticker}</button>)}</div><button className="primary-button wide">Analisar minha carteira <ArrowRight size={17}/></button></div></form>
    <div className="source-note"><i/><span><b>Dados reais e públicos</b>Catálogo BRAPI e histórico de mercado atualizado pelo GitHub Actions. Sem servidor próprio.</span></div>
  </div>;
}

function PortfolioDashboard({ tickers }: { tickers: string[] }) {
  const { data: fiis, loading, error, retry } = useAsync(() => api.analyzePortfolio(tickers), [tickers.join(',')]);
  if (loading) return <div className="page"><Loading /></div>;
  if (error || !fiis) return <div className="page"><ErrorState message={error} retry={retry} /><Link className="secondary-button center-button" to="/carteira">Editar carteira</Link></div>;
  const complete = fiis.filter((fii) => fii.score !== undefined);
  const avgDy = average(complete, (item) => item.dividendYield12m);
  const avgPvp = average(complete, (item) => item.pvp);
  const avgAppreciation = average(complete, (item) => item.annualAppreciation);
  const best = [...complete].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];

  return <div className="page dashboard">
    <section className="hero portfolio-hero"><div><span className="eyebrow"><Sparkles size={14}/> Sua carteira em perspectiva</span><h1>Seus fundos.<br/><em>Uma visão clara.</em></h1><p>Indicadores calculados sobre FIIs escolhidos por você, usando dados públicos e históricos.</p><div className="hero-actions"><Link className="primary-button" to="/simulador">Simular carteira <ArrowRight size={17}/></Link><Link className="secondary-button" to="/carteira">Gerenciar carteira</Link></div></div><div className="portfolio-symbols">{fiis.slice(0, 6).map((fii, index) => <div key={fii.ticker} style={{ transform: `translate(${index % 2 ? 24 : -8}px, ${index * -5}px)` }}><b>{fii.ticker}</b><span>{money(fii.price)}</span></div>)}</div></section>
    <section className="metric-grid"><Metric icon={Landmark} label="FIIs na carteira" value={number(fiis.length)} detail={`${complete.length} com análise histórica`}/><Metric icon={CircleDollarSign} label="Dividend Yield médio" value={percent(avgDy)} detail="últimos 12 meses" positive/><Metric icon={PieChart} label={avgPvp === undefined ? 'Valorização anual média' : 'P/VP médio'} value={avgPvp === undefined ? percent(avgAppreciation) : number(avgPvp)} detail="fundos selecionados"/><Metric icon={Target} label="Maior score" value={best ? `${best.score}/100` : '—'} detail={best?.ticker ?? 'dados insuficientes'} positive/></section>
    <section className="info-panel"><Info size={18}/><div><b>Como ler este painel</b><p>Score compara qualidade, preço, renda e liquidez. DY mostra renda passada. P/VP compara cotação com patrimônio. Nenhum indicador isolado representa recomendação.</p></div></section>
    <MarketLeaders/>
    <section className="dashboard-grid"><div className="panel ranking-preview"><div className="panel-head"><div><span className="kicker">SUA SELEÇÃO</span><h2>Análise da carteira</h2></div><Link to="/fiis">Explorar FIIs <ArrowRight size={15}/></Link></div><div className="mini-table"><div className="mini-row header"><span>Ativo</span><span>Preço</span><span>DY</span><span>Score</span></div>{fiis.map((fii) => <Link to={`/fii/${fii.ticker}`} className="mini-row" key={fii.ticker}><span><b>{fii.ticker}</b><small>{fii.segment ?? fii.name ?? 'Dados parciais'}</small></span><span>{money(fii.price)}</span><span className="green">{percent(fii.dividendYield12m)}</span><ScoreBadge score={fii.score}/></Link>)}</div></div><div className="panel next-step"><span className="kicker">PRÓXIMO PASSO</span><div className="icon-disc"><WalletCards/></div><h2>Projete aportes e renda</h2><p>Use premissas históricas dos seus FIIs para visualizar patrimônio e renda mensal.</p><Link className="primary-button" to="/simulador">Começar simulação <ArrowRight size={17}/></Link><small>Projeção educacional</small></div></section>
  </div>;
}

const average = (fiis: Fii[], get: (fii: Fii) => number | undefined) => {
  const values = fiis.map(get).filter((value): value is number => value !== undefined);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined;
};

function Metric({ icon: Icon, label, value, detail, positive = false }: { icon: typeof Landmark; label: string; value: string; detail: string; positive?: boolean }) { return <article className="metric-card"><div className="metric-icon"><Icon size={20}/></div><div><span>{label}</span><strong className={positive ? 'green' : ''}>{value}</strong><small>{detail}</small></div></article>; }

function MarketLeaders() {
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('day');
  const { data = [], loading, error, retry } = useAsync(() => api.getPerformance(period), [period]);
  const labels = { day: 'Dia', week: 'Semana', month: 'Mês' };
  return <section className="panel market-leaders"><div className="panel-head"><div><span className="kicker">DESTAQUES DO MERCADO</span><h2>Melhores fundos do período</h2><p>Variação de preço, sem dividendos. Dia exige liquidez acima de R$ 100 mil; semana e mês usam amostra dos 120 fundos mais líquidos, atualizada diariamente.</p></div><div className="period-tabs">{(Object.keys(labels) as Array<keyof typeof labels>).map((key) => <button key={key} className={period === key ? 'active' : ''} onClick={() => setPeriod(key)}>{labels[key]}</button>)}</div></div>{loading ? <Loading/> : error ? <ErrorState message={error} retry={retry}/> : data.length ? <div className="leader-grid">{data.map((item, index) => <LeaderCard key={item.ticker} item={item} rank={index + 1}/>)}</div> : <div className="leader-empty">Sem dados suficientes no retrato diário deste período.</div>}</section>;
}

function LeaderCard({ item, rank }: { item: FiiPerformance; rank: number }) {
  return <Link to={`/fii/${item.ticker}`} className="leader-card"><span className="leader-rank">{String(rank).padStart(2, '0')}</span><div><b>{item.ticker}</b><small>{fundType(item.assetType)}</small></div><strong>{item.changePercent >= 0 ? '+' : ''}{percent(item.changePercent)}</strong><small>{money(item.price)}</small><TrendingUp size={16}/></Link>;
}

const fundType = (type?: string) => ({ fii: 'FII', 'fi-agro': 'FIAGRO', 'fi-infra': 'FI-Infra', fip: 'FIP', fidc: 'FIDC' }[type ?? ''] ?? 'Fundo listado');
