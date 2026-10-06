import { ArrowLeft, Building2, CalendarDays, CircleDollarSign, Droplets, Landmark, Scale, Wallet } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ErrorState, Loading } from '../components/States';
import { ScoreBadge } from '../components/ScoreBadge';
import { useAsync } from '../hooks/useAsync';
import { api } from '../services/api';
import { compact, money, number, percent } from '../utils/format';

export function FiiDetail() {
  const { ticker = '' } = useParams();
  const [period, setPeriod] = useState('1y');
  const { data, loading, error, retry } = useAsync(() => Promise.all([api.getFii(ticker), api.getHistory(ticker, period), api.getDividends(ticker)]), [ticker, period]);
  if (loading) return <div className="page"><Loading /></div>;
  if (error || !data) return <div className="page"><ErrorState message={error} retry={retry} /></div>;
  const [fii, history, dividends] = data;
  const historySample = history.filter((_, index) => index % Math.max(Math.floor(history.length / 80), 1) === 0);
  const scoreItems = fii.scoreDetails ? Object.entries(fii.scoreDetails).filter(([key]) => ['dividends', 'valuation', 'consistency', 'liquidity', 'quality'].includes(key)) : [];
  const labels: Record<string, string> = { dividends: 'Dividendos', valuation: 'Valuation', liquidity: 'Liquidez', consistency: 'Consistência', quality: 'Qualidade' };

  return <div className="page"><Link to="/ranking" className="back-link"><ArrowLeft size={16} /> Voltar ao ranking</Link><section className="detail-hero"><div><div className="ticker-line"><h1>{fii.ticker}</h1><span>{fii.segment ?? 'Segmento não informado'}</span></div><p>{fii.name}</p></div><div className="detail-price"><small>COTAÇÃO ATUAL</small><strong>{money(fii.price)}</strong></div><ScoreBadge score={fii.score} /></section>
    <section className="metric-grid detail-metrics"><DetailMetric icon={CircleDollarSign} label="Dividend Yield 12m" value={percent(fii.dividendYield12m)} /><DetailMetric icon={Scale} label="P/VP calculado" value={number(fii.pvp)} /><DetailMetric icon={Building2} label="VP por cota" value={money(fii.patrimonialValuePerShare)} /><DetailMetric icon={Wallet} label="Último rendimento" value={money(fii.lastDividend)} /><DetailMetric icon={CalendarDays} label="Média 12 meses" value={money(fii.averageDividend12m)} /><DetailMetric icon={Landmark} label="Patrimônio" value={compact(fii.netWorth)} /><DetailMetric icon={Droplets} label="Cotistas" value={compact(fii.shareholders)} /></section>
    <section className="charts-grid"><ChartPanel title="Histórico da cotação" subtitle="Preço de fechamento" action={<div className="period-tabs">{[['1m','1M'],['6m','6M'],['1y','1A'],['5y','5A']].map(([value,label]) => <button className={period === value ? 'active' : ''} onClick={() => setPeriod(value)} key={value}>{label}</button>)}</div>}><ResponsiveContainer width="100%" height={280}><AreaChart data={historySample}><defs><linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#34d399" stopOpacity={0.3}/><stop offset="100%" stopColor="#34d399" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="#ffffff0a" vertical={false}/><XAxis dataKey="date" hide/><YAxis stroke="#64748b" fontSize={11} domain={['auto','auto']} tickFormatter={(value) => `R$${value}`}/><Tooltip contentStyle={{ background: '#0d1929', border: '1px solid #253449', borderRadius: 10 }} formatter={(value) => money(Number(value))}/><Area type="monotone" dataKey="price" stroke="#34d399" strokeWidth={2} fill="url(#priceFill)"/></AreaChart></ResponsiveContainer></ChartPanel>
      <ChartPanel title="Histórico de dividendos" subtitle="Valor por cota"><ResponsiveContainer width="100%" height={280}><BarChart data={[...dividends].reverse().slice(-24)}><CartesianGrid stroke="#ffffff0a" vertical={false}/><XAxis dataKey="date" hide/><YAxis stroke="#64748b" fontSize={11} tickFormatter={(value) => `R$${value}`}/><Tooltip contentStyle={{ background: '#0d1929', border: '1px solid #253449', borderRadius: 10 }} formatter={(value) => money(Number(value))}/><Bar dataKey="value" fill="#5eead4" radius={[3,3,0,0]}/></BarChart></ResponsiveContainer></ChartPanel></section>
    <section className="panel score-detail"><div><span className="kicker">METODOLOGIA</span><h2>Score detalhado</h2><p>Composição da nota interna, ponderada entre cinco dimensões.</p></div><div className="score-bars">{scoreItems.map(([key, value]) => <div className="score-line" key={key}><span>{labels[key]}</span><div><i style={{ width: `${value}%` }} /></div><b>{Math.round(value)}/100</b></div>)}</div></section>
    <div className="disclaimer-box">Projeção e classificação baseadas em dados históricos. Não representam garantia de resultado futuro nem recomendação de investimento.</div>
  </div>;
}

function DetailMetric({ icon: Icon, label, value }: { icon: typeof Wallet; label: string; value: string }) { return <article className="metric-card compact-card"><Icon size={18}/><span>{label}</span><strong>{value}</strong></article>; }
function ChartPanel({ title, subtitle, children, action }: { title: string; subtitle: string; children: React.ReactNode; action?: React.ReactNode }) { return <section className="panel chart-panel"><div className="panel-head"><div><h2>{title}</h2><p>{subtitle}</p></div>{action}</div>{children}</section>; }
