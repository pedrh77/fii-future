import { BarChart3, BriefcaseBusiness, Calculator, LayoutDashboard, TrendingUp } from 'lucide-react';
import { useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';

const links = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/carteira', label: 'Carteira', icon: BriefcaseBusiness },
  { to: '/fiis', label: 'FIIs', icon: BarChart3 },
  { to: '/simulador', label: 'Simulador', icon: Calculator },
  { to: '/ranking', label: 'Ranking', icon: TrendingUp },
];

export function Layout() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return <div className="app-shell">
    <header className="topbar">
      <NavLink to="/" className="brand"><span className="brand-mark"><TrendingUp size={20} /></span><span>FII <b>Future</b></span></NavLink>
      <nav id="main-navigation" className="nav" aria-label="Navegação principal">{links.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === '/'}><Icon size={17} /><span>{label}</span></NavLink>)}</nav>
      <div className="market-status"><i /> mercado + histórico</div>
    </header>
    <main><Outlet /></main>
    <footer><b>FII Future</b><p>Este sistema possui finalidade exclusivamente educacional e informativa. Os dados e cálculos apresentados não constituem recomendação de compra ou venda de ativos. Resultados históricos não garantem resultados futuros.</p></footer>
  </div>;
}
