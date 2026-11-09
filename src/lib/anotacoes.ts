// Anotações por pessoa: o que o ACS escreve sobre cada morador na VD vai para a ficha dele
// (linha do tempo) e gera SUGESTÕES de atualização (condições, situação) — o ACS confirma antes.
import { normalizar } from './busca';
import { NOMES_GRUPO } from './rotulos';
import type { Prioritario } from './prioritarios';
import type { Desfecho, Familia, Grupo, Morador, SinaisVitais, Visita } from './tipos';

export type Sugestao =
  | { id: string; tipo: 'grupo'; grupo: Grupo; texto: string }
  | { id: string; tipo: 'situacao'; situacao: 'faleceu' | 'mudou'; texto: string };

/** Palavras que indicam uma condição (texto já sem acento e em minúsculas). */
const REGRAS: [RegExp, Grupo][] = [
  [/\b(hipertens\w*|pressao alta|has)\b/, 'hipertenso'],
  [/\b(diabet\w*|dm2?|insulina|metformina|glifage)\b/, 'diabetico'],
  [/\b(acamad\w*|domiciliad\w*|nao (anda|levanta) mais)\b/, 'acamado'],
  [/\b(oxigenio|o2)\b/, 'oxigenio'],
  [/\b(avc|derrame|infarto|infartou)\b/, 'avc'],
  [/\b(cancer|tumor|quimioterapia|quimio|radioterapia|oncologia)\b/, 'cancer'],
  [/\b(cirurgia|operou|operad[oa]|pos operatorio)\b/, 'cirurgia'],
  [/\b(depress\w*|ansiedade|psiquiatr\w*|caps|saude mental|bipolar\w*|esquizofren\w*)\b/, 'saude_mental'],
  [/\b(alzheimer|demencia|paliativ\w*)\b/, 'alzheimer'],
  [/\b(gravida|gestante|gestacao|gravidez|pre natal)\b/, 'gestante'],
  [/\b(puerpera|pariu|teve (o|a) (bebe|nenem|crianca)|ganhou (o|a) (bebe|nenem))\b/, 'puerpera'],
  [/\b(deficiencia|cadeirante|autis\w*|sindrome de down)\b/, 'deficiencia'],
];
const FALECEU = /\b(faleceu|falecid[oa]|obito|morreu)\b/;
const MUDOU = /\b(mudou[- ]se|se mudou|mudou de (casa|endereco)|nao mora mais)\b/;
/** Antes da palavra, na mesma frase: negação ou outra pessoa ("nega", "sem", "a mãe é…"). */
const NEGACAO = /\b(nega\w*|sem|nao tem|nao e|nunca teve|descartad\w*|nao esta)\b/;
const OUTRA_PESSOA = /\b(mae|pai|esposa|esposo|marido|filh[oa]s?|irma[o]?s?|avo|avos|net[oa]s?|vizinh[oa]|sogr[oa]|tia|tio|prim[oa])\b/;

/** Pedaços da anotação em que a palavra vale para a própria pessoa. */
function valePara(texto: string, re: RegExp): boolean {
  for (const frase of normalizar(texto.replace(/[.;,!?\n]+/g, '|')).split('|')) {
    const m = frase.match(re);
    if (!m || m.index === undefined) continue;
    // Depois de "contou que", "disse que"… o assunto volta a ser a própria pessoa.
    const antes = frase.slice(0, m.index).split(/\b(?:contou|disse|relatou|informou|falou|avisou|referiu)\b/).pop() ?? '';
    if (NEGACAO.test(antes) || OUTRA_PESSOA.test(antes)) continue;
    return true;
  }
  return false;
}

/** Sugestões para a ficha a partir do que foi escrito sobre a pessoa (só o que ainda não está lá). */
export function sugestoesDaAnotacao(texto: string, m: Morador): Sugestao[] {
  if (!texto.trim()) return [];
  const nome = m.nome.split(' ')[0];
  const lista: Sugestao[] = [];
  if (m.situacao === 'mora' && valePara(texto, FALECEU)) lista.push({ id: 'faleceu', tipo: 'situacao', situacao: 'faleceu', texto: `Mudar ${nome} para “faleceu”` });
  else if (m.situacao === 'mora' && valePara(texto, MUDOU)) lista.push({ id: 'mudou', tipo: 'situacao', situacao: 'mudou', texto: `Mudar ${nome} para “mudou-se”` });
  for (const [re, g] of REGRAS) {
    if (m.grupos.includes(g) || lista.some((s) => s.tipo === 'grupo' && s.grupo === g)) continue;
    if ((g === 'gestante' || g === 'puerpera') && m.sexo === 'M') continue;
    if (valePara(texto, re)) lista.push({ id: `g-${g}`, tipo: 'grupo', grupo: g, texto: `Marcar ${nome}: ${NOMES_GRUPO[g]}` });
  }
  return lista;
}

// ---------------------------------------------------------------- linha do tempo

export interface ItemLinha {
  data: string;
  titulo: string;
  texto: string;
  /** P.A., glicemia… daquela VD. */
  sinais?: string;
  origem: 'vd' | 'lista' | 'relato';
}

export function textoSinais(s?: SinaisVitais): string {
  if (!s) return '';
  return [
    s.pa?.trim() && `P.A. ${s.pa.trim()}`,
    s.glicemia?.trim() && `glicemia ${s.glicemia.trim()}`,
    s.temperatura?.trim() && `temp. ${s.temperatura.trim()}`,
    s.peso?.trim() && `peso ${s.peso.trim()}`,
    s.altura?.trim() && `altura ${s.altura.trim()}`,
  ]
    .filter(Boolean)
    .join(' · ');
}

const dataDeTexto = (t: string) => {
  const m = t.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
};

/**
 * Tudo sobre a pessoa, do mais novo ao mais antigo: o que foi anotado nas VDs, os sinais vitais,
 * a presença, o resumo da lista de prioritários e os relatos antigos que citam o nome.
 */
export function linhaDoTempo(
  m: Morador,
  f: Familia,
  visitas: Visita[],
  nomeDesfecho: (d: Desfecho) => string,
  prio?: Prioritario,
): ItemLinha[] {
  const itens: ItemLinha[] = [];
  for (const v of visitas) {
    if (v.familiaId !== f.id) continue;
    const anot = v.anotacoes?.[m.id]?.trim() ?? '';
    const sinais = textoSinais(v.sinais?.[m.id]);
    const presente = v.presentes.includes(m.id);
    if (!anot && !sinais && !presente) continue;
    itens.push({ data: v.data, titulo: `VD · ${nomeDesfecho(v.desfecho)}${presente ? ' · presente' : ''}`, texto: anot, sinais: sinais || undefined, origem: 'vd' });
  }
  if (prio?.resumo) itens.push({ data: dataDeTexto(prio.ultimaInfo), titulo: `Lista de prioritários${prio.ultimaInfo ? ` · ${prio.ultimaInfo}` : ''}`, texto: prio.resumo, origem: 'lista' });
  const primeiro = normalizar(m.nome.split(' ')[0]);
  for (const r of f.relatosAnteriores ?? []) {
    if (primeiro.length >= 3 && new RegExp(`\\b${primeiro}\\b`).test(normalizar(`${r.titulo} ${r.texto}`))) {
      itens.push({ data: r.data ?? '', titulo: r.titulo, texto: r.texto, origem: 'relato' });
    }
  }
  return itens.sort((a, b) => b.data.localeCompare(a.data));
}

/** A anotação mais recente sobre a pessoa (para mostrar na lista). */
export function ultimaAnotacao(moradorId: string, familiaId: string, visitas: Visita[]): { data: string; texto: string } | null {
  let melhor: { data: string; texto: string } | null = null;
  for (const v of visitas) {
    const t = v.familiaId === familiaId ? v.anotacoes?.[moradorId]?.trim() : '';
    if (t && (!melhor || v.data > melhor.data)) melhor = { data: v.data, texto: t };
  }
  return melhor;
}
