import { lazy, Suspense } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Loading } from './components/States';

const Dashboard = lazy(() => import('./pages/Dashboard').then((module) => ({ default: module.Dashboard })));
const FiiDetail = lazy(() => import('./pages/FiiDetail').then((module) => ({ default: module.FiiDetail })));
const Portfolio = lazy(() => import('./pages/Portfolio').then((module) => ({ default: module.Portfolio })));
const Fiis = lazy(() => import('./pages/Ranking').then((module) => ({ default: module.Fiis })));
const Ranking = lazy(() => import('./pages/Ranking').then((module) => ({ default: module.Ranking })));
const Simulator = lazy(() => import('./pages/Simulator').then((module) => ({ default: module.Simulator })));

export default function App() {
  return <HashRouter><Suspense fallback={<div className="page"><Loading /></div>}><Routes><Route element={<Layout/>}><Route path="/" element={<Dashboard/>}/><Route path="/carteira" element={<Portfolio/>}/><Route path="/fiis" element={<Fiis/>}/><Route path="/ranking" element={<Ranking mode="portfolio"/>}/><Route path="/fii/:ticker" element={<FiiDetail/>}/><Route path="/simulador" element={<Simulator/>}/></Route></Routes></Suspense></HashRouter>;
}
