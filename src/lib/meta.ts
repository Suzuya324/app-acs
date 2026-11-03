import { contarDiasDeCampo, dentroDoPeriodo, periodoDe, type Periodo } from './calendario';
import { contaParaMeta } from './desfecho';
import { ehDiaUtil, inicioDaSemana, somarDias } from './datas';
import type { Desfecho, Familia, Visita } from './tipos';

export interface OpcoesPainel {
  /** Uma data dentro do período que se quer ver (padrão: hoje). */
  referencia?: string;
  /** Dia em que o período da meta começa (1 = mês do calendário). */
  diaInicioPeriodo?: number;
  /** Diz se a data é dia de campo (padrão: segunda a sexta). */
  ehDiaDeCampo?: (iso: string) => boolean;
}

export interface Painel {
  periodo: Periodo;
  /** O período mostrado é o atual (contém hoje)? */
  atual: boolean;
  /** O período já terminou? */
  passado: boolean;
  meta: number;
  /** Famílias diferentes com VD que conta (realizada ou ausente realizada) no mês. */
  familiasVisitadas: number;
  faltam: number;
  /** Total de VDs do mês (todas, inclusive as que não contam). */
  totalVisitasMes: number;
  porDesfecho: Record<Desfecho, number>;
  visitasHoje: number;
  visitasSemana: number;
  diasUteisRestantes: number;
  /** Famílias por dia útil que faltam até o fim do mês. */
  porDiaUtil: number;
  /** Famílias ainda sem VD que conta no mês. */
  naoVisitadas: Familia[];
  /** Ausência completa no mês, sem visita que conte depois. */
  revisitar: { familia: Familia; data: string }[];
  /** Sugestão do dia: há mais tempo sem visita primeiro. */
  sugestoes: { familia: Familia; ultimaVisita: string | null }[];
  /** Para o gráfico: famílias que contam e visitas que não contam, dia a dia do período (até hoje). */
  porDia: { data: string; contam: number; naoContam: number; diaDeCampo: boolean }[];
}

/** Famílias que entram na conta (casas habitadas). */
export function familiasAtivas(familias: Familia[]): Familia[] {
  return familias.filter((f) => f.situacaoCasa === 'habitada' && f.moradores.some((m) => m.situacao === 'mora'));
}

export function calcularPainel(
  familias: Familia[],
  visitas: Visita[],
  hoje: string,
  meta: number,
  opcoes: OpcoesPainel = {},
): Painel {
  const ehDiaDeCampo = opcoes.ehDiaDeCampo ?? ehDiaUtil;
  const periodo = periodoDe(opcoes.referencia ?? hoje, opcoes.diaInicioPeriodo ?? 1);
  const atual = dentroDoPeriodo(hoje, periodo);
  const passado = hoje > periodo.fim;
  const doMes = visitas.filter((v) => dentroDoPeriodo(v.data, periodo));
  const semana = inicioDaSemana(hoje);

  const porDesfecho: Record<Desfecho, number> = {
    realizada: 0,
    ausente_realizada: 0,
    ausencia_completa: 0,
    recusa: 0,
  };
  const contadas = new Set<string>();
  for (const v of doMes) {
    porDesfecho[v.desfecho]++;
    if (contaParaMeta(v.desfecho)) contadas.add(v.familiaId);
  }

  const ativas = familiasAtivas(familias);
  const faltam = Math.max(0, meta - contadas.size);
  const desde = hoje > periodo.inicio ? hoje : periodo.inicio;
  const diasUteisRestantes = passado ? 0 : contarDiasDeCampo(desde, periodo.fim, ehDiaDeCampo);
  const porDiaUtil = diasUteisRestantes > 0 ? Math.ceil(faltam / diasUteisRestantes) : faltam;

  const naoVisitadas = ativas.filter((f) => !contadas.has(f.id));

  // Revisitar: ausência completa no mês e ainda sem VD que conte.
  const revisitarMap = new Map<string, string>();
  for (const v of doMes) {
    if (v.desfecho === 'ausencia_completa' && !contadas.has(v.familiaId)) {
      const atual = revisitarMap.get(v.familiaId);
      if (!atual || v.data > atual) revisitarMap.set(v.familiaId, v.data);
    }
  }
  const porId = new Map(familias.map((f) => [f.id, f]));
  const revisitar = [...revisitarMap.entries()]
    .map(([id, data]) => ({ familia: porId.get(id)!, data }))
    .filter((r) => r.familia)
    .sort((a, b) => a.data.localeCompare(b.data));

  // Última visita que conta, de cada família (em qualquer mês).
  const ultima = new Map<string, string>();
  for (const v of visitas) {
    if (!contaParaMeta(v.desfecho)) continue;
    const atual = ultima.get(v.familiaId);
    if (!atual || v.data > atual) ultima.set(v.familiaId, v.data);
  }
  const sugestoes = naoVisitadas
    .map((f) => ({ familia: f, ultimaVisita: ultima.get(f.id) ?? null }))
    .sort((a, b) => {
      if (a.ultimaVisita === b.ultimaVisita) return 0;
      if (a.ultimaVisita === null) return -1;
      if (b.ultimaVisita === null) return 1;
      return a.ultimaVisita.localeCompare(b.ultimaVisita);
    });

  // Gráfico: cada família conta uma vez, no primeiro dia em que contou no período.
  const porDia: Painel['porDia'] = [];
  const jaContou = new Set<string>();
  const ordenadas = [...doMes].sort((a, b) => a.data.localeCompare(b.data));
  const ultimoDia = periodo.fim < hoje ? periodo.fim : hoje;
  for (let d = periodo.inicio; d <= ultimoDia; d = somarDias(d, 1)) {
    let contam = 0;
    let naoContam = 0;
    for (const v of ordenadas) {
      if (v.data !== d) continue;
      if (contaParaMeta(v.desfecho) && !jaContou.has(v.familiaId)) {
        jaContou.add(v.familiaId);
        contam++;
      } else naoContam++;
    }
    porDia.push({ data: d, contam, naoContam, diaDeCampo: ehDiaDeCampo(d) });
  }

  return {
    periodo,
    atual,
    passado,
    porDia,
    meta,
    familiasVisitadas: contadas.size,
    faltam,
    totalVisitasMes: doMes.length,
    porDesfecho,
    visitasHoje: doMes.filter((v) => v.data === hoje).length,
    visitasSemana: visitas.filter((v) => v.data >= semana && v.data <= hoje).length,
    diasUteisRestantes,
    porDiaUtil,
    naoVisitadas,
    revisitar,
    sugestoes,
  };
}
