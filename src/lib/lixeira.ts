// Lixeira: o que foi excluído (cadastrado por engano) não some, fica aqui e pode ser restaurado.
// Funções "puras": recebem os dados e devolvem os dados alterados (fáceis de testar).
import type { Dados } from './cofre';
import { novoId } from './ids';
import type { Familia, Morador, Revisita, Visita } from './tipos';

export type TipoLixeira = 'visita' | 'familia' | 'morador';

export interface ItemLixeira {
  /** Id da entrada na lixeira. */
  id: string;
  tipo: TipoLixeira;
  /** Id da visita, família ou morador excluído. */
  itemId: string;
  /** Família a que pertence (para morador e visita; para família, ela mesma). */
  familiaId: string;
  excluidoEm: string;
  restauradoEm?: string;
  /** Texto para mostrar, ex.: "VD de 03/11/2026 – Rua das Acácias, 12". */
  descricao: string;
  visita?: Visita;
  /** Família excluída inteira, com as VDs e revisitas dela. */
  familia?: { familia: Familia; visitas: Visita[]; revisitas: Revisita[] };
  morador?: Morador;
}

export class NaoDaParaRestaurar extends Error {}

const naLixeira = (d: Dados) => d.lixeira ?? [];

export function excluirVisita(d: Dados, visitaId: string, descricao: string, quando = new Date().toISOString()): Dados {
  const v = d.visitas.find((x) => x.id === visitaId);
  if (!v) return d;
  // Revisitas resolvidas nesta VD voltam a ficar abertas.
  const revisitas = (d.revisitas ?? []).map((r) => (r.visitaId === v.id ? { ...r, feitaEm: undefined, visitaId: undefined } : r));
  const item: ItemLixeira = { id: novoId('l'), tipo: 'visita', itemId: v.id, familiaId: v.familiaId, excluidoEm: quando, descricao, visita: v };
  return { ...d, visitas: d.visitas.filter((x) => x.id !== v.id), revisitas, lixeira: [...naLixeira(d), item] };
}

export function excluirFamilia(d: Dados, familiaId: string, descricao: string, quando = new Date().toISOString()): Dados {
  const f = d.familias.find((x) => x.id === familiaId);
  if (!f) return d;
  const visitas = d.visitas.filter((v) => v.familiaId === familiaId);
  const revisitas = (d.revisitas ?? []).filter((r) => r.familiaId === familiaId);
  const item: ItemLixeira = {
    id: novoId('l'),
    tipo: 'familia',
    itemId: f.id,
    familiaId: f.id,
    excluidoEm: quando,
    descricao,
    familia: { familia: f, visitas, revisitas },
  };
  return {
    ...d,
    familias: d.familias.filter((x) => x.id !== familiaId),
    visitas: d.visitas.filter((v) => v.familiaId !== familiaId),
    revisitas: (d.revisitas ?? []).filter((r) => r.familiaId !== familiaId),
    rascunho: d.rascunho?.familiaId === familiaId ? null : d.rascunho,
    lixeira: [...naLixeira(d), item],
  };
}

export function excluirMorador(d: Dados, familiaId: string, moradorId: string, descricao: string, quando = new Date().toISOString()): Dados {
  const f = d.familias.find((x) => x.id === familiaId);
  const m = f?.moradores.find((x) => x.id === moradorId);
  if (!f || !m) return d;
  const nova: Familia = {
    ...f,
    moradores: f.moradores.filter((x) => x.id !== moradorId),
    responsavelId: f.responsavelId === moradorId ? '' : f.responsavelId,
    atualizadoEm: quando,
  };
  const item: ItemLixeira = { id: novoId('l'), tipo: 'morador', itemId: m.id, familiaId, excluidoEm: quando, descricao, morador: m };
  return { ...d, familias: d.familias.map((x) => (x.id === familiaId ? nova : x)), lixeira: [...naLixeira(d), item] };
}

/** Itens na lixeira que ainda não foram restaurados, do mais recente para o mais antigo. */
export function itensNaLixeira(d: Pick<Dados, 'lixeira'>): ItemLixeira[] {
  return naLixeira(d as Dados)
    .filter((i) => !i.restauradoEm)
    .sort((a, b) => b.excluidoEm.localeCompare(a.excluidoEm));
}

export function restaurar(d: Dados, entradaId: string, quando = new Date().toISOString()): Dados {
  const item = naLixeira(d).find((i) => i.id === entradaId);
  if (!item || item.restauradoEm) return d;
  const marcar = (lx: ItemLixeira[]) => lx.map((i) => (i.id === entradaId ? { ...i, restauradoEm: quando } : i));
  let r: Dados = { ...d, lixeira: marcar(naLixeira(d)) };

  if (item.tipo === 'visita' && item.visita) {
    if (!r.familias.some((f) => f.id === item.familiaId)) {
      throw new NaoDaParaRestaurar('A família desta VD também está na lixeira. Restaure a família primeiro.');
    }
    const v = item.visita;
    const revisitas = (r.revisitas ?? []).map((rv) =>
      (v.revisitasFeitas ?? []).includes(rv.id) && !rv.feitaEm && !rv.canceladaEm ? { ...rv, feitaEm: v.data, visitaId: v.id } : rv,
    );
    r = { ...r, visitas: [...r.visitas.filter((x) => x.id !== v.id), v], revisitas };
  } else if (item.tipo === 'familia' && item.familia) {
    const { familia, visitas, revisitas } = item.familia;
    r = {
      ...r,
      familias: [...r.familias.filter((x) => x.id !== familia.id), { ...familia, atualizadoEm: quando }],
      visitas: [...r.visitas.filter((x) => !visitas.some((v) => v.id === x.id)), ...visitas],
      revisitas: [...(r.revisitas ?? []).filter((x) => !revisitas.some((rv) => rv.id === x.id)), ...revisitas],
    };
  } else if (item.tipo === 'morador' && item.morador) {
    const f = r.familias.find((x) => x.id === item.familiaId);
    if (!f) throw new NaoDaParaRestaurar('A família deste morador também está na lixeira. Restaure a família primeiro.');
    const m = item.morador;
    const nova: Familia = {
      ...f,
      moradores: [...f.moradores.filter((x) => x.id !== m.id), m],
      responsavelId: f.responsavelId || (m.situacao === 'mora' ? m.id : ''),
      atualizadoEm: quando,
    };
    r = { ...r, familias: r.familias.map((x) => (x.id === f.id ? nova : x)) };
  }
  return r;
}

/** Junta duas lixeiras (por id da entrada); restaurada num lado vale para os dois. */
export function juntarLixeiras(a: ItemLixeira[], b: ItemLixeira[]): ItemLixeira[] {
  const porId = new Map(a.map((i) => [i.id, i]));
  for (const i of b) {
    const aqui = porId.get(i.id);
    if (!aqui || (i.restauradoEm && !aqui.restauradoEm)) porId.set(i.id, i);
  }
  return [...porId.values()];
}

/** Depois de juntar com outro aparelho: o que está na lixeira (e não foi restaurado) sai das listas ativas. */
export function aplicarLixeira(d: Dados): Dados {
  const ativos = itensNaLixeira(d);
  if (!ativos.length) return d;
  const visitasFora = new Set(ativos.filter((i) => i.tipo === 'visita').map((i) => i.itemId));
  const familiasFora = new Set(ativos.filter((i) => i.tipo === 'familia').map((i) => i.itemId));
  const moradoresFora = new Set(ativos.filter((i) => i.tipo === 'morador').map((i) => i.itemId));
  return {
    ...d,
    familias: d.familias
      .filter((f) => !familiasFora.has(f.id))
      .map((f) => (f.moradores.some((m) => moradoresFora.has(m.id)) ? { ...f, moradores: f.moradores.filter((m) => !moradoresFora.has(m.id)) } : f)),
    visitas: d.visitas.filter((v) => !visitasFora.has(v.id) && !familiasFora.has(v.familiaId)),
    revisitas: (d.revisitas ?? []).filter((r) => !familiasFora.has(r.familiaId)),
  };
}
