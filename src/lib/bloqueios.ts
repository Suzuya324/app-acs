// Por que o app trancou: guarda os últimos bloqueios (só o motivo e a hora, nada de dados de pacientes) para a
// tela do PIN explicar e para o ACS saber se foi o tempo parado, a saída do app ou o celular fechando o app.
// Fica no armazenamento simples do navegador; se não der para gravar, o app funciona igual.

export type MotivoBloqueio = 'parado' | 'fora' | 'cadeado' | 'atualizacao' | 'fechado';

export interface Bloqueio {
  /** Quando (ISO). */
  em: string;
  motivo: MotivoBloqueio;
  /** Quantos minutos (parado ou fora do app). */
  minutos?: number;
}

const CHAVE_LOG = 'facilitador.bloqueios';
const CHAVE_SESSAO = 'facilitador.sessao';
const MAXIMO = 15;

function ler<T>(chave: string, padrao: T): T {
  try {
    const t = localStorage.getItem(chave);
    return t ? (JSON.parse(t) as T) : padrao;
  } catch {
    return padrao;
  }
}
function gravar(chave: string, valor: unknown) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    // sem armazenamento (aba anônima, etc.): segue sem o histórico
  }
}

/** Os últimos bloqueios, o mais novo primeiro. */
export function lerBloqueios(): Bloqueio[] {
  const l = ler<Bloqueio[]>(CHAVE_LOG, []);
  return Array.isArray(l) ? l : [];
}

export function registrarBloqueio(b: Bloqueio): void {
  gravar(CHAVE_LOG, [b, ...lerBloqueios()].slice(0, MAXIMO));
}

/** Marca se o app está destrancado agora (para saber, ao abrir de novo, se ele foi fechado enquanto aberto). */
export function marcarSessao(aberto: boolean): void {
  gravar(CHAVE_SESSAO, { aberto, em: new Date().toISOString() });
}

/** O app estava destrancado quando foi fechado (pelo celular, para economizar bateria, ou pela pessoa)? */
export function sessaoEstavaAberta(): boolean {
  return ler<{ aberto?: boolean }>(CHAVE_SESSAO, {}).aberto === true;
}

/** Explicação para a tela do PIN e para a lista em Ajustes. */
export function textoDoBloqueio(b: Bloqueio, limites: { minutosParado: number; minutosFora: number }): string {
  switch (b.motivo) {
    case 'parado':
      return `Trancou depois de ${b.minutos ?? limites.minutosParado} min sem tocar na tela.`;
    case 'fora':
      return `Trancou porque você ficou ${b.minutos ? `${b.minutos} min` : 'um tempo'} fora do app ou com a tela apagada (limite: ${limites.minutosFora === 0 ? 'na hora' : `${limites.minutosFora} min`}).`;
    case 'cadeado':
      return 'Trancado pelo cadeado.';
    case 'atualizacao':
      return 'O app foi atualizado para a versão nova.';
    case 'fechado':
      return 'O app foi fechado (pelo celular, para economizar bateria, ou por você) e abriu de novo.';
  }
}

/** Hora curta: "14:05" (hoje) ou "22/11 14:05". */
export function quandoFoi(iso: string, agora = new Date()): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  const hora = `${p(d.getHours())}:${p(d.getMinutes())}`;
  return d.toDateString() === agora.toDateString() ? hora : `${p(d.getDate())}/${p(d.getMonth() + 1)} ${hora}`;
}
