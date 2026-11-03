import type { Desfecho } from './tipos';

export interface EntradaDesfecho {
  /** Quantos moradores (que moram na casa) existem na família. */
  totalMoradores: number;
  /** Quantos foram marcados como presentes. */
  presentes: number;
  /** O ACS conversou com a família (alguém respondeu por todos). */
  conversouComFamilia: boolean;
  /** A família não quis receber a visita. */
  recusou: boolean;
}

/**
 * Define o desfecho da VD sozinho, seguindo as regras do Fast:
 * - família não quis receber → Recusa
 * - todos presentes ou conversou com a família → Visita realizada
 * - alguém atendeu, mas o restante não estava → Ausente realizada
 * - ninguém em casa → Ausência da família completa
 */
export function sugerirDesfecho(e: EntradaDesfecho): Desfecho {
  if (e.recusou) return 'recusa';
  if (e.conversouComFamilia) return 'realizada';
  if (e.presentes <= 0) return 'ausencia_completa';
  if (e.presentes >= e.totalMoradores) return 'realizada';
  return 'ausente_realizada';
}

/** Desfechos que contam para a meta do mês. */
export function contaParaMeta(d: Desfecho): boolean {
  return d === 'realizada' || d === 'ausente_realizada';
}
