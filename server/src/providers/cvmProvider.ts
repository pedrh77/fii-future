import axios from 'axios';
import AdmZip from 'adm-zip';
import { parse } from 'csv-parse/sync';
import { cache } from '../services/cache.js';
import type { FiiDividend } from '../types/fii.js';

const SIX_HOURS = 6 * 60 * 60_000;
const CVM_BASE = 'https://dados.cvm.gov.br/dados/FII/DOC/INF_MENSAL/DADOS';

type CsvRow = Record<string, string>;
export interface CvmFundSnapshot {
  cnpj: string;
  referenceDate: string;
  name?: string;
  segment?: string;
  netWorth?: number;
  totalShares?: number;
  patrimonialValuePerShare?: number;
  shareholders?: number;
  monthlyDividendYield?: number;
}

const numberValue = (value?: string) => {
  if (!value) return undefined;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : undefined;
};
const cleanCnpj = (value = '') => value.replace(/\D/g, '');
const normalizeName = (value = '') => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
  .replace(/BTG\s+PACTUAL/g, 'BTGP')
  .replace(/\b(FUNDO|FUNDOS|INVESTIMENTO|INVESTIMENTOS|IMOBILIARIO|IMOBILIARIOS|FII|RESPONSABILIDADE|LIMITADA|LTDA|DE|DA|DO|DAS|DOS|EM)\b/g, ' ')
  .replace(/[^A-Z0-9]+/g, ' ').trim();

export class CvmProvider {
  private async loadYear(year: number): Promise<CvmFundSnapshot[]> {
    return cache.remember(`cvm:${year}`, SIX_HOURS, async () => {
      const response = await axios.get<ArrayBuffer>(`${CVM_BASE}/inf_mensal_fii_${year}.zip`, {
        responseType: 'arraybuffer', timeout: 30_000,
      });
      const zip = new AdmZip(Buffer.from(response.data));
      const read = (part: string) => {
        const entry = zip.getEntries().find((item) => item.entryName.includes(part));
        if (!entry) throw new Error(`Arquivo CVM ${part} não encontrado.`);
        return parse(entry.getData().toString('latin1'), {
          columns: true, delimiter: ';', skip_empty_lines: true, relax_column_count: true,
        }) as CsvRow[];
      };
      const general = read('_geral_');
      const complement = read('_complemento_');
      const generalByKey = new Map<string, CsvRow>();
      for (const row of general) {
        const key = `${cleanCnpj(row.CNPJ_Fundo_Classe)}:${row.Data_Referencia}`;
        const current = generalByKey.get(key);
        if (!current || Number(row.Versao) >= Number(current.Versao)) generalByKey.set(key, row);
      }
      const snapshots = new Map<string, CvmFundSnapshot>();
      const snapshotVersions = new Map<string, number>();
      for (const row of complement) {
        const cnpj = cleanCnpj(row.CNPJ_Fundo_Classe);
        const key = `${cnpj}:${row.Data_Referencia}`;
        const version = Number(row.Versao) || 0;
        if ((snapshotVersions.get(key) ?? -1) > version) continue;
        const info = generalByKey.get(key);
        snapshots.set(key, {
          cnpj,
          referenceDate: row.Data_Referencia ?? '',
          name: info?.Nome_Fundo_Classe,
          segment: info?.Segmento_Atuacao,
          netWorth: numberValue(row.Patrimonio_Liquido),
          totalShares: numberValue(row.Cotas_Emitidas) ?? numberValue(info?.Quantidade_Cotas_Emitidas),
          patrimonialValuePerShare: numberValue(row.Valor_Patrimonial_Cotas),
          shareholders: numberValue(row.Total_Numero_Cotistas),
          monthlyDividendYield: numberValue(row.Percentual_Dividend_Yield_Mes),
        });
        snapshotVersions.set(key, version);
      }
      return [...snapshots.values()];
    });
  }

  private async history() {
    const selected = Number(process.env.CVM_DATA_YEAR) || new Date().getFullYear();
    const years = [selected - 1, selected];
    const results = await Promise.all(years.map((year) => this.loadYear(year).catch(() => [])));
    const all = results.flat();
    if (!all.length) throw new Error('Dados CVM temporariamente indisponíveis.');
    return all;
  }

  async getFunds() {
    const all = await this.history();
    const latest = new Map<string, CvmFundSnapshot>();
    for (const item of all) {
      const current = latest.get(item.cnpj);
      if (!current || item.referenceDate > current.referenceDate) latest.set(item.cnpj, item);
    }
    return latest;
  }

  async getFund(cnpj: string) {
    return (await this.getFunds()).get(cleanCnpj(cnpj)) ?? null;
  }

  async findByName(name?: string) {
    const target = normalizeName(name);
    if (!target) return null;
    const targetTokens = new Set(target.split(' '));
    let best: CvmFundSnapshot | null = null;
    let bestScore = 0;
    for (const fund of (await this.getFunds()).values()) {
      const candidate = normalizeName(fund.name);
      const tokens = new Set(candidate.split(' '));
      const overlap = [...targetTokens].filter((token) => tokens.has(token)).length;
      const score = overlap / Math.max(Math.min(targetTokens.size, tokens.size), 1);
      if (score > bestScore) { best = fund; bestScore = score; }
    }
    return bestScore >= 0.65 ? best : null;
  }

  async getDividendEstimates(cnpj: string, ticker: string): Promise<FiiDividend[]> {
    const clean = cleanCnpj(cnpj);
    return (await this.history())
      .filter((item) => item.cnpj === clean && item.monthlyDividendYield && item.patrimonialValuePerShare)
      .sort((a, b) => b.referenceDate.localeCompare(a.referenceDate))
      .slice(0, 12)
      .map((item) => ({ ticker, date: item.referenceDate, value: item.monthlyDividendYield! * item.patrimonialValuePerShare! }));
  }

}
