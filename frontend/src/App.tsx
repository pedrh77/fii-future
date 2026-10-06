import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { FiiDetail } from './pages/FiiDetail';
import { Fiis, Ranking } from './pages/Ranking';
import { Simulator } from './pages/Simulator';

export default function App() {
  return <BrowserRouter><Routes><Route element={<Layout/>}><Route path="/" element={<Dashboard/>}/><Route path="/fiis" element={<Fiis/>}/><Route path="/ranking" element={<Ranking mode="portfolio"/>}/><Route path="/fii/:ticker" element={<FiiDetail/>}/><Route path="/simulador" element={<Simulator/>}/></Route></Routes></BrowserRouter>;
}
