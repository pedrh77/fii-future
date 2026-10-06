export const money = (value?: number) => value === undefined || !Number.isFinite(value) ? '—' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
export const percent = (value?: number) => value === undefined || !Number.isFinite(value) ? '—' : `${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
export const number = (value?: number) => value === undefined || !Number.isFinite(value) ? '—' : value.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
export const compact = (value?: number) => value === undefined || !Number.isFinite(value) ? '—' : new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
