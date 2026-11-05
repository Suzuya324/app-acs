// Mapa da área: cada casa com uma cor conforme a situação no período da meta.
// E a ordem dos prontuários (numérica) para a lista impressa.
import { dentroDoPeriodo, type Periodo } from './calendario';
import { contaParaMeta } from './desfecho';
import { prontuarioIncompleto } from './pendencias';
import type { Familia, Revisita, Visita } from './tipos';

export type CorCasa = 'conta' | 'marcada' | 'revisitar' | 'falta' | 'fora';

export const NOMES_COR: Record<CorCasa, string> = {
  conta: 'Visitada (conta)',
  marcada: 'Revisita marcada',
  revisitar: 'Ninguém em casa',
  falta: 'Falta visitar',
  fora: 'Não conta (fechada, vazia…)',
};

export const ORDEM_COR: CorCasa[] = ['falta', 'revisitar', 'marcada', 'conta', 'fora'];

/** Cor de cada família: fora > revisita marcada > visitada que conta > ninguém em casa > falta. */
export function coresDoMapa(familias: Familia[], visitas: Visita[], revisitas: Revisita[], periodo: Periodo): Map<string, CorCasa> {
  const contou = new Set<string>();
  const ausente = new Set<string>();
  for (const v of visitas) {
    if (!dentroDoPeriodo(v.data, periodo)) continue;
    if (contaParaMeta(v.desfecho)) contou.add(v.familiaId);
    else if (v.desfecho === 'ausencia_completa') ausente.add(v.familiaId);
  }
  const marcadas = new Set(revisitas.filter((r) => !r.feitaEm && !r.canceladaEm).map((r) => r.familiaId));
  const cores = new Map<string, CorCasa>();
  for (const f of familias) {
    const ativa = f.situacaoCasa === 'habitada' && f.moradores.some((m) => m.situacao === 'mora');
    cores.set(
      f.id,
      !ativa ? 'fora' : marcadas.has(f.id) ? 'marcada' : contou.has(f.id) ? 'conta' : ausente.has(f.id) ? 'revisitar' : 'falta',
    );
  }
  return cores;
}

/** Partes numéricas de um texto: "04.0123" → [4, 123]. */
function numeros(texto: string): number[] {
  return (texto.match(/\d+/g) ?? []).map(Number);
}

function compararNumeros(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] === undefined) return -1;
    if (b[i] === undefined) return 1;
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

/** Ordem numérica do prontuário (04.0099 antes de 04.0100); incompletos ("04.") e depois vazios vão para o fim. */
export function ordenarPorProntuario(familias: Familia[]): Familia[] {
  const faixa = (f: Familia) => (!f.prontuario.trim() ? 2 : prontuarioIncompleto(f.prontuario) ? 1 : 0);
  return [...familias].sort(
    (a, b) =>
      faixa(a) - faixa(b) ||
      compararNumeros(numeros(a.prontuario), numeros(b.prontuario)) ||
      a.prontuario.localeCompare(b.prontuario) ||
      a.rua.localeCompare(b.rua, 'pt-BR'),
  );
}

/** Ordem da colmeia (número), casas sem colmeia no fim. */
export function ordenarPorColmeia(familias: Familia[]): Familia[] {
  return [...familias].sort((a, b) => {
    const na = numeros(a.colmeia);
    const nb = numeros(b.colmeia);
    if (!na.length || !nb.length) return (na.length ? 0 : 1) - (nb.length ? 0 : 1);
    return compararNumeros(na, nb);
  });
}
