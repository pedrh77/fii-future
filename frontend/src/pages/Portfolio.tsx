import { BriefcaseBusiness, CircleDollarSign, Pencil, PieChart as PieChartIcon, Plus, Save, Trash2, TrendingUp, WalletCards, X } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { ErrorState, Loading } from '../components/States';
import { useAsync } from '../hooks/useAsync';
import { api } from '../services/api';
import { loadPortfolio, savePortfolio, type PortfolioPosition } from '../services/portfolio';
import { money, number, percent } from '../utils/format';

const COLORS = ['#34d399', '#5eead4', '#60a5fa', '#a78bfa', '#fbbf24', '#fb7185', '#22d3ee', '#c084fc'];
const emptyForm: PortfolioPosition = { ticker: '', quantity: 0, averagePrice: 0 };

export function Portfolio() {
  const [positions, setPositions] = useState<PortfolioPosition[]>(loadPortfolio);
  const [form, setForm] = useState<PortfolioPosition>(emptyForm);
  const [editing, setEditing] = useState<string>();
  const [formError, setFormError] = useState('');
  const tickers = positions.map((position) => position.ticker);
  const { data: fiis = [], loading, error, retry } = useAsync(
    () => tickers.length ? api.analyzePortfolio(tickers) : Promise.resolve([]),
    [tickers.join(',')],
  );
  const { data: catalog = [] } = useAsync(api.getFiis, []);

  const rows = useMemo(() => positions.map((position) => {
    const fii = fiis.find((item) => item.ticker === position.ticker);
    const invested = position.quantity * position.averagePrice;
    const currentValue = position.quantity * (fii?.price ?? 0);
    const result = position.quantity > 0 && position.averagePrice > 0 && fii?.price !== undefined ? currentValue - invested : undefined;
    const monthlyIncome = fii?.dividendYield12m !== undefined ? currentValue * (fii.dividendYield12m / 100) / 12 : undefined;
    return { ...position, fii, invested, currentValue, result, monthlyIncome };
  }), [positions, fiis]);

  const totalInvested = rows.reduce((sum, row) => sum + row.invested, 0);
  const totalCurrent = rows.reduce((sum, row) => sum + row.currentValue, 0);
  const incomeRows = rows.filter((row) => row.monthlyIncome !== undefined);
  const resultRows = rows.filter((row) => row.result !== undefined);
  const totalIncome = incomeRows.length ? incomeRows.reduce((sum, row) => sum + (row.monthlyIncome ?? 0), 0) : undefined;
  const totalResult = resultRows.length ? resultRows.reduce((sum, row) => sum + (row.result ?? 0), 0) : undefined;
  const resultInvested = resultRows.reduce((sum, row) => sum + row.invested, 0);
  const resultPercentage = totalResult !== undefined && resultInvested > 0 ? (totalResult / resultInvested) * 100 : undefined;
  const chartData = rows.filter((row) => row.currentValue > 0).map((row) => ({ name: row.ticker, value: row.currentValue }));

  const persist = (next: PortfolioPosition[]) => {
    savePortfolio(next);
    setPositions(next);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const ticker = form.ticker.trim().toUpperCase();
    if (!/^[A-Z]{4}[0-9]{2}$/.test(ticker)) {
      setFormError('Digite um ticker válido, como HGLG11.');
      return;
    }
    const position = { ticker, quantity: Math.max(0, form.quantity), averagePrice: Math.max(0, form.averagePrice) };
    const duplicate = positions.some((item) => item.ticker === ticker && item.ticker !== editing);
    if (duplicate) {
      setFormError('Esse FII já está na carteira. Edite a posição existente.');
      return;
    }
    const next = editing
      ? positions.map((item) => item.ticker === editing ? position : item)
      : [...positions, position];
    persist(next);
    setForm(emptyForm);
    setEditing(undefined);
    setFormError('');
  };

  const startEdit = (position: PortfolioPosition) => {
    setForm(position);
    setEditing(position.ticker);
    setFormError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setForm(emptyForm);
    setEditing(undefined);
    setFormError('');
  };

  return <div className="page portfolio-page">
    <div className="page-heading"><div><span className="eyebrow"><BriefcaseBusiness size={14}/> Gestão da carteira</span><h1>Minha carteira</h1><p>Registre suas posições para acompanhar patrimônio, resultado, peso e renda mensal estimada.</p></div><div className="result-count"><strong>{positions.length}</strong><span>ativos cadastrados</span></div></div>

    <section className="portfolio-manager-grid">
      <form className="panel position-form" onSubmit={submit}>
        <div className="panel-head"><div><span className="kicker">{editing ? 'EDITAR POSIÇÃO' : 'NOVA POSIÇÃO'}</span><h2>{editing ? editing : 'Adicionar FII'}</h2></div>{editing && <button type="button" className="icon-button" onClick={cancelEdit} title="Cancelar edição"><X size={17}/></button>}</div>
        <div className="position-form-fields">
          <label><span>Ticker</span><input list="fii-catalog" value={form.ticker} onChange={(event) => setForm({ ...form, ticker: event.target.value.toUpperCase() })} placeholder="HGLG11" maxLength={6}/><datalist id="fii-catalog">{catalog.map((fii) => <option key={fii.ticker} value={fii.ticker}>{fii.name}</option>)}</datalist></label>
          <label><span>Quantidade de cotas</span><input type="number" min="0" step="1" value={form.quantity || ''} onChange={(event) => setForm({ ...form, quantity: Number(event.target.value) })} placeholder="100"/></label>
          <label><span>Preço médio</span><div className="input-prefix"><i>R$</i><input type="number" min="0" step="0.01" value={form.averagePrice || ''} onChange={(event) => setForm({ ...form, averagePrice: Number(event.target.value) })} placeholder="98,50"/></div></label>
        </div>
        {formError && <p className="field-error">{formError}</p>}
        <button className="primary-button wide">{editing ? <><Save size={16}/> Salvar alterações</> : <><Plus size={16}/> Adicionar à carteira</>}</button>
        <p className="form-note">Você pode cadastrar apenas o ticker e completar quantidade e preço médio depois.</p>
      </form>

      <div className="portfolio-summary">
        <article className="summary-main"><WalletCards size={20}/><span>Patrimônio atual</span><strong>{money(totalCurrent)}</strong><small>{totalResult === undefined ? 'preço médio pendente' : `${totalResult >= 0 ? '+' : ''}${money(totalResult)} versus valor investido`}</small></article>
        <article><CircleDollarSign size={18}/><span>Renda mensal estimada</span><strong className="green">{money(totalIncome)}</strong><small>baseada no DY dos últimos 12 meses</small></article>
        <article><TrendingUp size={18}/><span>Resultado não realizado</span><strong className={totalResult === undefined ? '' : totalResult >= 0 ? 'green' : 'negative'}>{percent(resultPercentage)}</strong><small>{money(totalResult)}</small></article>
        <article><PieChartIcon size={18}/><span>Valor investido</span><strong>{money(totalInvested)}</strong><small>{number(positions.reduce((sum, position) => sum + position.quantity, 0))} cotas</small></article>
      </div>
    </section>

    {loading ? <Loading/> : error ? <ErrorState message={error} retry={retry}/> : positions.length === 0 ? <section className="panel empty-portfolio"><BriefcaseBusiness size={30}/><h2>Sua carteira está vazia</h2><p>Adicione o primeiro FII acima. O dashboard passa a usar automaticamente os ativos cadastrados aqui.</p></section> : <section className="portfolio-content-grid">
      <div className="panel portfolio-table-panel"><div className="panel-head"><div><span className="kicker">POSIÇÕES</span><h2>Composição da carteira</h2></div></div><div className="portfolio-table"><div className="portfolio-row table-header"><span>Ativo</span><span>Cotas</span><span>Preço médio</span><span>Preço atual</span><span>Investido</span><span>Valor atual</span><span>Resultado</span><span>Peso</span><span>Renda/mês</span><span/></div>{rows.map((row) => <div className="portfolio-row" key={row.ticker}><span className="fund-name"><b>{row.ticker}</b><small>{row.fii?.segment ?? row.fii?.name ?? 'Dados parciais'}</small></span><span>{number(row.quantity)}</span><span>{money(row.averagePrice)}</span><span>{money(row.fii?.price)}</span><span>{money(row.invested)}</span><span>{money(row.currentValue)}</span><span className={row.result === undefined ? '' : row.result >= 0 ? 'green' : 'negative'}>{money(row.result)}</span><span>{totalCurrent ? percent((row.currentValue / totalCurrent) * 100) : '—'}</span><span className="green">{money(row.monthlyIncome)}</span><span className="row-actions"><button onClick={() => startEdit(row)} title={`Editar ${row.ticker}`} aria-label={`Editar ${row.ticker}`}><Pencil size={14}/></button><button className="danger" onClick={() => persist(positions.filter((item) => item.ticker !== row.ticker))} title={`Excluir ${row.ticker}`} aria-label={`Excluir ${row.ticker}`}><Trash2 size={14}/></button></span></div>)}</div></div>

      <aside className="panel allocation-chart"><div className="panel-head"><div><span className="kicker">ALOCAÇÃO</span><h2>Peso por ativo</h2></div></div>{chartData.length ? <><ResponsiveContainer width="100%" height={245}><PieChart><Pie data={chartData} dataKey="value" nameKey="name" innerRadius={65} outerRadius={92} paddingAngle={3}>{chartData.map((item, index) => <Cell key={item.name} fill={COLORS[index % COLORS.length]}/>)}</Pie><Tooltip formatter={(value) => money(Number(value))} contentStyle={{ background: '#0d1929', border: '1px solid #253449', borderRadius: 10 }}/></PieChart></ResponsiveContainer><div className="allocation-legend">{chartData.map((item, index) => <span key={item.name}><i style={{ background: COLORS[index % COLORS.length] }}/><b>{item.name}</b><small>{percent((item.value / totalCurrent) * 100)}</small></span>)}</div></> : <div className="chart-empty"><PieChartIcon size={28}/><p>Informe quantidade e preço médio para visualizar a alocação.</p></div>}</aside>
    </section>}
  </div>;
}
