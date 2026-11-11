// Conferir o lançado no Fast: o ACS cola a lista de VDs que aparece no Fast (copiando da tela) e o app compara
// com as VDs dele: o que falta lançar, o que está lá e não no app, e o que foi lançado duas vezes.
// O app NÃO entra no Fast: só lê o texto colado. Funções "puras".
import { chaveNome } from './importar-sv';
import { partesProntuario } from './numeros';
import type { Familia, Visita } from './tipos';

export interface LinhaFast {
  texto: string;
  data?: string;
  pront?: string;
}

const DATA = /\b(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})\b/;
const PRONT = /\b\d{1,5}[.-]\d{1,3}[.-]\d{1,5}\b|\b\d{2}\.\d{1,5}\b/g;

/** Lê a lista colada: uma VD por linha (ou por bloco de linhas, se o Fast quebrar). */
export function lerListaFast(texto: string): LinhaFast[] {
  const linhas: LinhaFast[] = [];
  for (const bruta of texto.split(/\r?\n/)) {
    const t = bruta.replace(/\s+/g, ' ').trim();
    if (t.length < 4) continue;
    const d = t.match(DATA);
    const data = d ? `${d[3].length === 2 ? `20${d[3]}` : d[3]}-${d[2].padStart(2, '0')}-${d[1].padStart(2, '0')}` : undefined;
    const pront = [...t.replace(DATA, ' ').matchAll(PRONT)].map((x) => x[0]).find((p) => partesProntuario(p));
    linhas.push({ texto: t, data, pront });
  }
  // Cabeçalhos e linhas sem nada que identifique ficam de fora.
  return linhas.filter((l) => l.data || l.pront || /[a-z]{3,}\s+[a-z]{3,}/i.test(l.texto));
}

/** A família da linha: pelo prontuário; senão pelo nome de alguém da casa escrito na linha. */
export function familiaDaLinha(l: LinhaFast, familias: Familia[]): Familia | null {
  if (l.pront) {
    const p = partesProntuario(l.pront)!;
    const achadas = familias.filter((f) => {
      const q = partesProntuario(f.prontuario);
      return q && q.micro === p.micro && q.numero === p.numero;
    });
    if (achadas.length === 1) return achadas[0];
  }
  const palavras = new Set(chaveNome(l.texto).split(' '));
  const comNome = familias.filter((f) =>
    f.moradores.some((m) => {
      const partes = chaveNome(m.nome).split(' ');
      return partes.length >= 2 && partes.every((x) => palavras.has(x));
    }),
  );
  return comNome.length === 1 ? comNome[0] : null;
}

export interface Conferencia {
  /** VD do app achada na lista do Fast. */
  achadas: { visita: Visita; linha: LinhaFast }[];
  /** VDs do app no período que não estão na lista (faltou lançar?). */
  faltando: Visita[];
  /** Linhas da lista sem VD no app no período (lançada só no Fast, ou o app não reconheceu). */
  soNoFast: LinhaFast[];
  /** A mesma VD lançada mais de uma vez no Fast. */
  repetidas: { visita: Visita; linhas: LinhaFast[] }[];
}

export function conferirComFast(linhas: LinhaFast[], familias: Familia[], visitas: Visita[], inicio: string, fim: string): Conferencia {
  const doPeriodo = visitas.filter((v) => v.data >= inicio && v.data <= fim);
  const usadas = new Map<string, LinhaFast[]>();
  const r: Conferencia = { achadas: [], faltando: [], soNoFast: [], repetidas: [] };
  for (const l of linhas) {
    if (l.data && (l.data < inicio || l.data > fim)) continue;
    const f = familiaDaLinha(l, familias);
    if (!f && !l.data && !l.pront) continue; // sem data, sem prontuário e sem nome conhecido: cabeçalho ou lixo
    const daCasa = f ? doPeriodo.filter((v) => v.familiaId === f.id) : [];
    // Com data: a VD daquele dia. Sem data: a primeira VD da casa ainda não achada (ou a já achada, se só tem ela).
    const v = l.data ? daCasa.find((x) => x.data === l.data) : (daCasa.find((x) => !usadas.has(x.id)) ?? daCasa[0]);
    if (!v) {
      r.soNoFast.push(l);
      continue;
    }
    const ja = usadas.get(v.id);
    if (ja) ja.push(l);
    else {
      usadas.set(v.id, [l]);
      r.achadas.push({ visita: v, linha: l });
    }
  }
  for (const [id, ls] of usadas) if (ls.length > 1) r.repetidas.push({ visita: doPeriodo.find((v) => v.id === id)!, linhas: ls });
  r.faltando = doPeriodo.filter((v) => !usadas.has(v.id)).sort((a, b) => a.data.localeCompare(b.data));
  return r;
}

