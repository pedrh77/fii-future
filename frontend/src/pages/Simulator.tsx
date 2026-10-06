import { Calculator, Check, CircleDollarSign, Info, PiggyBank, RefreshCcw, Target, TrendingUp, WalletCards } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ErrorState } from '../components/States';
import { useAsync } from '../hooks/useAsync';
import { api } from '../services/api';
import type { Allocation, SimulationInput, SimulationResult } from '../types';
import { money, percent } from '../utils/format';

const initialInput: SimulationInput = { initialAmount: 10000, monthlyContribution: 500, years: 5, annualDividendYield: 10, annualAppreciation: 4, reinvestDividends: true };

export function Simulator() {
  const { data: fiis = [] } = useAsync(api.getFiis, []);
  const [input, setInput] = useState(initialInput);
  const [result, setResult] = useState<SimulationResult>();
  const [selectedTicker, setSelectedTicker] = useState('');
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);
  const [incomeGoal, setIncomeGoal] = useState(2000);
  const [allocationAmount, setAllocationAmount] = useState(500);
  const [allocationCount, setAllocationCount] = useState<3 | 5 | 10>(3);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const requiredPortfolio = input.annualDividendYield > 0 ? incomeGoal * 12 / (input.annualDividendYield / 100) : 0;

  const run = async (event?: FormEvent) => {
    event?.preventDefault(); setRunning(true); setError('');
    try { setResult(await api.simulate(input)); } catch (reason) { setError((reason as Error).message); } finally { setRunning(false); }
  };
  useEffect(() => { void run(); }, []);

  const useFiiData = async (ticker: string) => {
    setSelectedTicker(ticker);
    if (!ticker) return;
    setRunning(true); setError('');
    try {
      const historical = await api.simulateFii(ticker, input);
      if (historical.assumptions) setInput((current) => ({ ...current, ...historical.assumptions }));
      setResult(historical);
    } catch (reason) { setError((reason as Error).message); } finally { setRunning(false); }
  };

  const allocate = async () => {
    setError('');
    try {
      const saved = JSON.parse(localStorage.getItem('fii-future-portfolio') ?? '[]') as string[];
      setAllocations(await api.allocate(allocationAmount, allocationCount, saved));
    } catch (reason) { setError((reason as Error).message); }
  };

  return <div className="page"><div className="page-heading"><div><span className="eyebrow"><Calculator size={14}/> Planejamento patrimonial</span><h1>Simulador de futuro</h1><p>Transforme premissas em uma visão clara da evolução do seu patrimônio.</p></div></div>
    {error && <ErrorState message={error} />}
    <section className="simulator-grid"><form className="panel simulator-form" onSubmit={run}><div className="panel-head"><div><span className="kicker">PREMISSAS</span><h2>Seu plano</h2></div><RefreshCcw size={18}/></div>
      <label className="full"><span>Usar histórico de um FII</span><select value={selectedTicker} onChange={(event) => void useFiiData(event.target.value)}><option value="">Premissas manuais</option>{fiis.map((fii) => <option key={fii.ticker} value={fii.ticker}>{fii.ticker} · {fii.name}</option>)}</select></label>
      <div className="form-grid"><NumberField label="Patrimônio inicial" prefix="R$" value={input.initialAmount} onChange={(value) => setInput({ ...input, initialAmount: value })}/><NumberField label="Aporte mensal" prefix="R$" value={input.monthlyContribution} onChange={(value) => setInput({ ...input, monthlyContribution: value })}/><NumberField label="Prazo" suffix="anos" value={input.years} onChange={(value) => setInput({ ...input, years: value })}/><NumberField label="Dividend Yield anual" suffix="%" value={input.annualDividendYield} step={0.1} onChange={(value) => setInput({ ...input, annualDividendYield: value })}/><NumberField label="Valorização anual" suffix="%" value={input.annualAppreciation} step={0.1} onChange={(value) => setInput({ ...input, annualAppreciation: value })}/></div>
      <label className="toggle-row"><button type="button" className={input.reinvestDividends ? 'toggle active' : 'toggle'} onClick={() => setInput({ ...input, reinvestDividends: !input.reinvestDividends })}><i/></button><span><b>Reinvestir dividendos</b><small>Potencializa o efeito dos juros compostos</small></span></label>
      <button className="primary-button wide" disabled={running}>{running ? 'Calculando...' : 'Atualizar projeção'} <TrendingUp size={17}/></button>
      <p className="form-note"><Info size={14}/> Projeção baseada em dados históricos. Não representa garantia de resultado futuro.</p>
    </form>

    <div className="results-column"><div className="result-grid"><ResultCard icon={PiggyBank} label="Patrimônio final" value={money(result?.finalPortfolioValue)} primary/><ResultCard icon={WalletCards} label="Total investido" value={money(result?.totalInvested)}/><ResultCard icon={CircleDollarSign} label="Dividendos acumulados" value={money(result?.totalDividends)} positive/><ResultCard icon={TrendingUp} label="Renda mensal estimada" value={money(result?.estimatedMonthlyIncome)} positive/></div>
      <section className="panel projection-chart"><div className="panel-head"><div><h2>Evolução do patrimônio</h2><p>Comparativo entre aportes e valor projetado</p></div><div className="legend"><span><i className="invested"/>Aportado</span><span><i className="projected"/>Projetado</span></div></div><ResponsiveContainer width="100%" height={290}><AreaChart data={result?.periods ?? []}><defs><linearGradient id="portfolioFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#34d399" stopOpacity={0.25}/><stop offset="100%" stopColor="#34d399" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="#ffffff0a" vertical={false}/><XAxis dataKey="year" stroke="#64748b" fontSize={11} tickFormatter={(value) => `${value}a`}/><YAxis stroke="#64748b" fontSize={11} tickFormatter={(value) => `R$${Math.round(value/1000)}k`}/><Tooltip contentStyle={{ background:'#0d1929',border:'1px solid #253449',borderRadius:10 }} formatter={(value) => money(Number(value))}/><Area type="monotone" dataKey="portfolioValue" name="Patrimônio" stroke="#34d399" strokeWidth={2.5} fill="url(#portfolioFill)"/><Line type="monotone" dataKey="invested" name="Aportado" stroke="#64748b" strokeDasharray="5 5" dot={false}/></AreaChart></ResponsiveContainer></section>
      <section className="panel projection-chart"><div className="panel-head"><div><h2>Renda mensal projetada</h2><p>Estimativa ao fim de cada ano</p></div></div><ResponsiveContainer width="100%" height={220}><LineChart data={result?.periods ?? []}><CartesianGrid stroke="#ffffff0a" vertical={false}/><XAxis dataKey="year" stroke="#64748b" fontSize={11}/><YAxis stroke="#64748b" fontSize={11} tickFormatter={(value) => `R$${value}`}/><Tooltip contentStyle={{ background:'#0d1929',border:'1px solid #253449',borderRadius:10 }} formatter={(value) => money(Number(value))}/><Line type="monotone" dataKey="estimatedMonthlyIncome" name="Renda mensal" stroke="#5eead4" strokeWidth={2.5} dot={{ fill:'#5eead4' }}/></LineChart></ResponsiveContainer></section>
    </div></section>

    <section className="planning-grid"><div className="panel goal-card"><div className="icon-disc"><Target/></div><span className="kicker">META DE RENDA</span><h2>Quanto preciso acumular?</h2><p>Com DY estimado de <b>{percent(input.annualDividendYield)}</b> ao ano.</p><NumberField label="Meta mensal desejada" prefix="R$" value={incomeGoal} onChange={setIncomeGoal}/><div className="goal-result"><span>Patrimônio necessário</span><strong>{money(requiredPortfolio)}</strong></div></div>
      <div className="panel allocation-card"><div className="panel-head"><div><span className="kicker">APORTE INTELIGENTE</span><h2>Como distribuir meu próximo aporte?</h2></div></div><div className="allocation-controls"><NumberField label="Valor disponível" prefix="R$" value={allocationAmount} onChange={setAllocationAmount}/><label><span>Quantidade de FIIs</span><select value={allocationCount} onChange={(event) => setAllocationCount(Number(event.target.value) as 3|5|10)}><option value={3}>3 fundos</option><option value={5}>5 fundos</option><option value={10}>10 fundos</option></select></label><button className="primary-button" onClick={allocate}>Distribuir</button></div><div className="allocations">{allocations.map((item) => <div key={item.ticker}><span className="allocation-check"><Check size={14}/></span><b>{item.ticker}</b><small>Score {item.score}</small><strong>{money(item.amount)}</strong><em>{item.percentage}%</em></div>)}</div><p className="form-note"><Info size={14}/> Critérios matemáticos internos, com limite de 40% por ativo. Não representa recomendação.</p></div></section>
  </div>;
}

function NumberField({ label, value, onChange, prefix, suffix, step = 1 }: { label: string; value: number; onChange: (value: number) => void; prefix?: string; suffix?: string; step?: number }) { return <label className="number-field"><span>{label}</span><div>{prefix && <i>{prefix}</i>}<input type="number" min="0" step={step} value={value} onChange={(event) => onChange(Number(event.target.value))}/>{suffix && <i>{suffix}</i>}</div></label>; }
function ResultCard({ icon: Icon, label, value, primary, positive }: { icon: typeof PiggyBank; label: string; value: string; primary?: boolean; positive?: boolean }) { return <article className={`result-card ${primary ? 'primary' : ''}`}><Icon size={19}/><span>{label}</span><strong className={positive ? 'green' : ''}>{value}</strong></article>; }
