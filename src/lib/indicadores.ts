// Números do mês: previsão da meta pelo ritmo atual e indicadores por grupo (quem foi visitado, quem teve
// P.A. ou glicemia medida). Só contagens: nada de nomes. Funções "puras".
import { contarDiasDeCampo } from './calendario';
import { contaParaMeta } from './desfecho';
import type { Painel } from './meta';
import type { Familia, Grupo, Visita } from './tipos';

export interface Previsao {
  /** Famílias por dia de campo até agora. */
  ritmo: number;
  /** Quantas famílias no fim do período, se continuar assim. */
  previsto: number;
  /** Dias de campo que já passaram (com hoje, se for dia de campo). */
  diasPassados: number;
  vaiBater: boolean;
}

/** Previsão do fim do período pelo ritmo até hoje (null no período que já terminou ou sem dia de campo passado). */
export function previsaoDaMeta(p: Painel, hoje: string, ehDiaDeCampo: (iso: string) => boolean): Previsao | null {
  if (p.passado || !p.atual) return null;
  const diasPassados = contarDiasDeCampo(p.periodo.inicio, hoje, ehDiaDeCampo);
  if (diasPassados <= 0) return null;
  // Hoje conta como passado só se já teve VD hoje; senão os dias que faltam incluem hoje.
  const restantes = p.diasUteisRestantes - (p.visitasHoje > 0 && ehDiaDeCampo(hoje) ? 1 : 0);
  const ritmo = p.familiasVisitadas / diasPassados;
  const previsto = Math.round(p.familiasVisitadas + ritmo * Math.max(0, restantes));
  return { ritmo, previsto, diasPassados, vaiBater: previsto >= p.meta };
}

export interface Indicador {
  grupo: Grupo;
  nome: string;
  /** Pessoas no grupo (moram na área). */
  total: number;
  /** Delas, quantas tiveram a família visitada (VD que conta) no período. */
  visitadas: number;
  /** Medida do grupo no período (P.A. para hipertenso, glicemia para diabético), se houver. */
  medida?: { nome: string; feitas: number };
}

const GRUPOS: { grupo: Grupo; nome: string; medida?: 'pa' | 'glicemia' }[] = [
  { grupo: 'hipertenso', nome: 'Hipertensos', medida: 'pa' },
  { grupo: 'diabetico', nome: 'Diabéticos', medida: 'glicemia' },
  { grupo: 'gestante', nome: 'Gestantes' },
  { grupo: 'puerpera', nome: 'Puérperas' },
  { grupo: 'crianca', nome: 'Crianças pequenas' },
  { grupo: 'acamado', nome: 'Acamados' },
  { grupo: 'idoso', nome: 'Idosos' },
  { grupo: 'saude_mental', nome: 'Saúde mental' },
];

/** Indicadores do período por grupo (só números). */
export function indicadores(familias: Familia[], visitas: Visita[], inicio: string, fim: string): Indicador[] {
  const noPeriodo = visitas.filter((v) => v.data >= inicio && v.data <= fim);
  const visitadas = new Set(noPeriodo.filter((v) => contaParaMeta(v.desfecho)).map((v) => v.familiaId));
  const comMedida = { pa: new Set<string>(), glicemia: new Set<string>() };
  for (const v of noPeriodo) {
    for (const [mid, s] of Object.entries(v.sinais ?? {})) {
      if (s.pa?.trim()) comMedida.pa.add(mid);
      if (s.glicemia?.trim()) comMedida.glicemia.add(mid);
    }
  }
  return GRUPOS.map(({ grupo, nome, medida }) => {
    let total = 0;
    let vis = 0;
    let med = 0;
    for (const f of familias) {
      if (f.situacaoCasa !== 'habitada') continue;
      for (const m of f.moradores) {
        if (m.situacao !== 'mora' || !m.grupos.includes(grupo)) continue;
        total++;
        if (visitadas.has(f.id)) vis++;
        if (medida && comMedida[medida].has(m.id)) med++;
      }
    }
    return { grupo, nome, total, visitadas: vis, ...(medida ? { medida: { nome: medida === 'pa' ? 'P.A. medida' : 'glicemia medida', feitas: med } } : {}) };
  }).filter((i) => i.total > 0);
}

export const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
