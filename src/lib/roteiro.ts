// Ordem das casas na rua, para planejar o dia a pé.
import type { Familia } from './tipos';

/**
 * Ordem de caminhada: as casas que o ACS já posicionou na rua (`ordemNaRua`) vêm primeiro, na ordem dele;
 * as outras ficam depois, pelo número da casa.
 */
export function ordenarParaAndar(familias: Familia[]): Familia[] {
  const com = familias.filter((f) => f.ordemNaRua !== undefined).sort((a, b) => (a.ordemNaRua as number) - (b.ordemNaRua as number));
  const sem = ordenarPorNumero(familias.filter((f) => f.ordemNaRua === undefined));
  return [...com, ...sem];
}

/** Ordena pelo número da casa (2 antes de 10), depois letra e complemento; S/N no fim. */
export function ordenarPorNumero(familias: Familia[]): Familia[] {
  const chave = (f: Familia) => {
    const m = f.numero.match(/^(\d+)\s*(.*)$/);
    return { n: m ? Number(m[1]) : Number.POSITIVE_INFINITY, resto: `${m ? m[2] : f.numero} ${f.complemento}`.trim() };
  };
  return [...familias].sort((a, b) => {
    const ka = chave(a);
    const kb = chave(b);
    if (ka.n !== kb.n) return ka.n - kb.n;
    return ka.resto.localeCompare(kb.resto, 'pt-BR', { numeric: true });
  });
}

/** Separa por rua (na ordem das ruas informada, depois as outras em ordem alfabética). */
export function agruparPorRua(familias: Familia[], ordemRuas: string[] = []): { rua: string; familias: Familia[] }[] {
  const ruas = [...new Set(familias.map((f) => f.rua))].sort((a, b) => {
    const ia = ordemRuas.indexOf(a);
    const ib = ordemRuas.indexOf(b);
    if (ia >= 0 && ib >= 0) return ia - ib;
    if (ia >= 0) return -1;
    if (ib >= 0) return 1;
    return a.localeCompare(b, 'pt-BR');
  });
  return ruas.map((rua) => ({ rua, familias: ordenarParaAndar(familias.filter((f) => f.rua === rua)) }));
}
