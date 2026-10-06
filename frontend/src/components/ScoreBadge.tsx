export function ScoreBadge({ score }: { score?: number }) {
  if (score === undefined) return <span className="score-badge"><strong>—</strong><small>Sem dados</small></span>;
  const label = score >= 90 ? 'Excelente' : score >= 80 ? 'Muito bom' : score >= 70 ? 'Bom' : score >= 60 ? 'Neutro' : 'Atenção';
  const tone = score >= 80 ? 'emerald' : score >= 60 ? 'amber' : 'rose';
  return <span className={`score-badge ${tone}`}><strong>{Math.round(score)}</strong><small>{label}</small></span>;
}
