import { contaParaMeta } from './desfecho';
import { diasUteisAteFimDoMes, inicioDaSemana, mesDe } from './datas';
import type { Desfecho, Familia, Visita } from './tipos';

export interface Painel {
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
): Painel {
  const mes = mesDe(hoje);
  const doMes = visitas.filter((v) => mesDe(v.data) === mes);
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
  const diasUteisRestantes = diasUteisAteFimDoMes(hoje);
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

  return {
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
