import { BarChart3, Calculator, LayoutDashboard, Menu, TrendingUp, X } from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';

const links = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/fiis', label: 'FIIs', icon: BarChart3 },
  { to: '/simulador', label: 'Simulador', icon: Calculator },
  { to: '/ranking', label: 'Ranking', icon: TrendingUp },
];

export function Layout() {
  const [open, setOpen] = useState(false);
  return <div className="app-shell">
    <header className="topbar">
      <NavLink to="/" className="brand"><span className="brand-mark"><TrendingUp size={20} /></span><span>FII <b>Future</b></span></NavLink>
      <nav className={open ? 'nav open' : 'nav'}>{links.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === '/'} onClick={() => setOpen(false)}><Icon size={17} />{label}</NavLink>)}</nav>
      <div className="market-status"><i /> CVM + mercado</div>
      <button className="menu-button" onClick={() => setOpen(!open)} aria-label="Abrir menu">{open ? <X /> : <Menu />}</button>
    </header>
    <main><Outlet /></main>
    <footer><b>FII Future</b><p>Este sistema possui finalidade exclusivamente educacional e informativa. Os dados e cálculos apresentados não constituem recomendação de compra ou venda de ativos. Resultados históricos não garantem resultados futuros.</p></footer>
  </div>;
}
