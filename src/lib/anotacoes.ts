// Anotações por pessoa: o que o ACS escreve sobre cada morador na VD vai para a ficha dele
// (linha do tempo) e gera SUGESTÕES de atualização (condições, situação) — o ACS confirma antes.
import { normalizar } from './busca';
import { NOMES_GRUPO } from './rotulos';
import type { Prioritario } from './prioritarios';
import type { Caso, Desfecho, Familia, Grupo, Morador, SinaisVitais, Visita } from './tipos';

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
  [/\b(cardiopat\w*|arritmia|marca[- ]?passo|sopro no coracao|cirurgia cardiaca|insuficiencia cardiaca)\b/, 'coracao'],
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
/** Antes da palavra, no mesmo pedaço da frase (entre vírgulas): negação ou só orientação ("nega", "sem", "orientada sobre…"). */
export const NEGACAO = /\b(nega\w*|sem|nao tem|nao e|nunca teve|descartad\w*|nao esta|orient\w*)\b/;
/** Antes da palavra, na mesma frase: outra pessoa ("a mãe é…", "o marido…"). */
export const OUTRA_PESSOA = /\b(mae|pai|esposa|esposo|marido|filh[oa]s?|irma[o]?s?|avo|avos|net[oa]s?|vizinh[oa]|sogr[oa]|tia|tio|prim[oa])\b/;
/** Depois de "contou que", "disse que"… o assunto volta a ser a própria pessoa. */
export const RELATOU = /\b(?:contou|disse|relatou|informou|falou|avisou|referiu)\b/;

/** Logo depois da palavra: "…da mãe", "…do marido" (a condição é de outra pessoa). */
const DE_OUTRA_PESSOA = new RegExp(`^\\s*d[aeo]s?\\s+(?:su[ao]s?\\s+|seus?\\s+)?${OUTRA_PESSOA.source}`);

/** A palavra aparece valendo para a própria pessoa? (frase por frase, olhando o que vem antes e logo depois dela) */
function valePara(texto: string, re: RegExp): boolean {
  const todas = new RegExp(re.source, 'g');
  // "cirurgiã(o)" é a médica, não uma cirurgia (sem acento as duas palavras ficariam iguais).
  const limpo = texto.replace(/cirurgi(?:ões|ãs|ão|ã)/gi, 'médico');
  for (const sentenca of limpo.split(/[.;!?\n]+/)) {
    let anteriores = '';
    for (const pedaco of sentenca.split(',').map(normalizar)) {
      for (const m of pedaco.matchAll(todas)) {
        const antes = pedaco.slice(0, m.index);
        const assunto = `${anteriores} ${antes}`.split(RELATOU).pop() ?? '';
        const perto = antes.split(RELATOU).pop() ?? '';
        if (NEGACAO.test(perto) || /\bpre\s*$/.test(perto) || OUTRA_PESSOA.test(assunto)) continue;
        if (DE_OUTRA_PESSOA.test(pedaco.slice((m.index ?? 0) + m[0].length))) continue;
        return true;
      }
      anteriores += ` ${pedaco}`;
    }
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

// ---------------------------------------------------------------- VDs já feitas

/** Observação que o importador põe nas VDs trazidas do Sistema de Visitas (o relato delas foi escrito pelo ACS). */
export const OBS_SISTEMA_DE_VISITAS = 'Trazida do Sistema de Visitas.';

/**
 * O que o próprio ACS escreveu na VD: o relato das VDs trazidas do Sistema de Visitas ou a observação
 * das VDs feitas no app. O relato montado pelo app fica de fora (os temas de orientação dariam falso alarme).
 */
export function textoEscritoDaVD(v: Visita): string {
  if (v.observacao?.includes('Sistema de Visitas')) return v.relato?.trim() ?? '';
  return v.observacao?.trim() ?? '';
}

/** Minúsculas e sem acento, letra por letra (mantém as posições do texto original). */
export const semAcento = (t: string) => t.split('').map((c) => (c.normalize('NFD')[0] ?? c).toLowerCase()[0] ?? c).join('');
export const escapar = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const LIGACOES = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);
/** Depois do nome: "…disse que ele/ela…" (a pessoa só está contando de outra). */
const FALA_DE_OUTRO = /^[^.;!?\n]{0,40}?\b(?:disse|contou|relatou|informou|falou|avisou|referiu)\s+que\s+(?:ele|ela)\b/;

/** Como achar cada morador no texto: o primeiro nome (ou os dois primeiros, se dois têm o mesmo primeiro nome). */
function nomesDaCasa(f: Familia): { id: string; fonte: string }[] {
  const partes = f.moradores.map((m) => ({ id: m.id, p: semAcento(m.nome).split(/[^a-z0-9']+/).filter((x) => x && !LIGACOES.has(x)) }));
  const vezes = new Map<string, number>();
  for (const x of partes) if (x.p[0]) vezes.set(x.p[0], (vezes.get(x.p[0]) ?? 0) + 1);
  const lista: { id: string; fonte: string }[] = [];
  for (const { id, p } of partes) {
    if (!p[0] || p[0].length < 3) continue;
    const repetido = (vezes.get(p[0]) ?? 0) > 1;
    if (repetido && !p[1]) continue;
    const nome = repetido ? `${escapar(p[0])}\\s+(?:d[aeo]s?\\s+)?${escapar(p[1])}` : escapar(p[0]);
    lista.push({ id, fonte: `(^|[^a-z0-9])(${nome})(?![a-z0-9])` });
  }
  return lista;
}

/**
 * Os pedaços de um texto da família que falam da pessoa: de onde o nome dela aparece até o nome de
 * outra pessoa da casa. Se ela mora sozinha, o texto todo é dela.
 */
export function trechosDaPessoa(texto: string, m: Morador, f: Familia): string[] {
  const baixo = semAcento(texto);
  const mencoes: { i: number; id: string }[] = [];
  for (const n of nomesDaCasa(f)) {
    for (const x of baixo.matchAll(new RegExp(n.fonte, 'g'))) {
      // "Fabiana disse que ele…": quem fala não é o assunto; o trecho continua sendo de quem vinha antes.
      if (FALA_DE_OUTRO.test(baixo.slice((x.index ?? 0) + x[0].length))) continue;
      mencoes.push({ i: (x.index ?? 0) + x[1].length, id: n.id });
    }
  }
  mencoes.sort((a, b) => a.i - b.i);
  const moram = f.moradores.filter((x) => x.situacao === 'mora');
  const sozinha = moram.length === 1 && moram[0].id === m.id;
  const trechos: string[] = [];
  const inicio = mencoes[0]?.i ?? texto.length;
  if (sozinha && inicio > 0) trechos.push(texto.slice(0, inicio));
  mencoes.forEach((x, k) => {
    if (x.id === m.id) trechos.push(texto.slice(x.i, mencoes[k + 1]?.i ?? texto.length));
  });
  return trechos.map((t) => t.trim()).filter(Boolean);
}

/** "12/08/2026 Agente" → "2026-08-12". */
export const dataDeTexto = (t: string) => {
  const m = (t ?? '').match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
};

/** Um texto já escrito sobre a família, com a data e de onde veio. */
export interface TextoDaFamilia {
  data: string;
  origem: string;
  texto: string;
  /** Veio de um caso já resolvido (não gera pendência). */
  encerrado?: boolean;
  /** Veio do resumo da lista de prioritários. */
  lista?: boolean;
}

export const dataCurta = (iso: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '');

/** Tudo o que já foi escrito sobre a família: VDs (relatos trazidos e observações), relatos antigos e casos. */
export function textosDaFamilia(f: Familia, visitas: Visita[], casos: Caso[] = []): TextoDaFamilia[] {
  const lista: TextoDaFamilia[] = [];
  for (const v of visitas) {
    const t = v.familiaId === f.id ? textoEscritoDaVD(v) : '';
    if (t) lista.push({ data: v.data, origem: `VD de ${dataCurta(v.data)}`, texto: t });
  }
  for (const r of f.relatosAnteriores ?? []) lista.push({ data: r.data ?? '', origem: r.titulo, texto: r.texto });
  for (const c of casos) {
    if (c.familiaId === f.id) lista.push({ data: c.criadoEm.slice(0, 10), origem: `Caso: ${c.titulo}`, texto: `${c.titulo}. ${c.texto}`, encerrado: !!c.resolvidoEm || undefined });
  }
  return lista;
}

/**
 * Tudo o que já foi escrito sobre a pessoa: as anotações dela nas VDs, os pedaços dos textos da casa
 * que falam dela (VDs, relatos antigos, casos) e, se pedir, o resumo da lista de prioritários.
 */
export function textosDaPessoa(m: Morador, f: Familia, visitas: Visita[], casos: Caso[] = [], prio?: Prioritario): TextoDaFamilia[] {
  const lista: TextoDaFamilia[] = [];
  const vistos = new Set<string>();
  const por = (t: TextoDaFamilia) => {
    const chave = `${t.data}|${t.texto}`;
    if (!t.texto || vistos.has(chave)) return;
    vistos.add(chave);
    lista.push(t);
  };
  for (const v of visitas) {
    const anot = v.familiaId === f.id ? (v.anotacoes?.[m.id]?.trim() ?? '') : '';
    if (anot) por({ data: v.data, origem: `VD de ${dataCurta(v.data)}`, texto: anot });
  }
  for (const t of textosDaFamilia(f, visitas, casos)) {
    for (const trecho of trechosDaPessoa(t.texto, m, f)) por({ ...t, texto: trecho });
  }
  if (prio?.resumo?.trim()) por({ data: dataDeTexto(prio.ultimaInfo), origem: 'Lista de prioritários', texto: prio.resumo.trim(), lista: true });
  return lista;
}

/** Uma atualização da ficha encontrada no que já foi escrito, com os trechos que a justificam. */
export interface SugestaoDasVDs {
  /** moradorId|id da sugestão (para esconder as que o ACS disse que não). */
  chave: string;
  familia: Familia;
  morador: Morador;
  sugestao: Sugestao;
  /** Onde foi lido: a frase que fez a sugestão e o pedaço inteiro sobre a pessoa. */
  provas: { data: string; origem: string; frase: string; trecho: string }[];
}

/** As frases de um texto, com a pontuação final. */
export const frases = (t: string) =>
  // "Dra.", "Sr.", "P.A." e "1.5" não terminam a frase: o ponto é trocado por um parecido só para separar.
  (t.replace(/\b(dra?|sra?|srta|p\.a|obs|tel)\./gi, '$1\u2024').replace(/(\d)\.(?=\d)/g, '$1\u2024').match(/[^.;!?\n|]+[.;!?\n|]*/g) ?? [])
    .map((x) => x.replace(/\u2024/g, '.').replace(/[|\s]+$/, '').trim())
    .filter(Boolean);

/** As atualizações de ficha achadas no que já foi escrito sobre uma pessoa. */
export function sugestoesDaPessoa(m: Morador, f: Familia, textos: TextoDaFamilia[], escondidas: ReadonlySet<string> = new Set()): SugestaoDasVDs[] {
  const porChave = new Map<string, SugestaoDasVDs>();
  for (const t of textos) {
    if (t.lista) continue; // a lista de prioritários já traz as próprias etiquetas
    for (const frase of frases(t.texto)) {
      for (const s of sugestoesDaAnotacao(frase, m)) {
        const chave = `${m.id}|${s.id}`;
        if (escondidas.has(chave)) continue;
        let item = porChave.get(chave);
        if (!item) porChave.set(chave, (item = { chave, familia: f, morador: m, sugestao: s, provas: [] }));
        if (!item.provas.some((p) => p.frase === frase)) item.provas.push({ data: t.data, origem: t.origem, frase, trecho: t.texto });
      }
    }
  }
  const lista = [...porChave.values()];
  for (const it of lista) it.provas.sort((a, b) => b.data.localeCompare(a.data));
  return lista;
}

/** Lê as VDs já feitas, as anotações, os relatos antigos e os casos e junta o que daria para atualizar nas fichas. */
export function sugestoesDasVDs(familias: Familia[], visitas: Visita[], casos: Caso[], escondidas: Iterable<string> = []): SugestaoDasVDs[] {
  const fora = new Set(escondidas);
  const comTexto = new Set<string>([...visitas.map((v) => v.familiaId), ...casos.map((c) => c.familiaId)]);
  const lista: SugestaoDasVDs[] = [];
  for (const f of familias) {
    if (!comTexto.has(f.id) && !f.relatosAnteriores?.length) continue;
    for (const m of f.moradores) {
      if (m.situacao === 'mora') lista.push(...sugestoesDaPessoa(m, f, textosDaPessoa(m, f, visitas, casos), fora));
    }
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
    // Sem anotação: o que foi escrito na VD sobre a pessoa (relato trazido ou observação).
    const escrito = anot ? '' : trechosDaPessoa(textoEscritoDaVD(v), m, f).join(' … ');
    if (!anot && !sinais && !presente && !escrito) continue;
    itens.push({ data: v.data, titulo: `VD · ${nomeDesfecho(v.desfecho)}${presente ? ' · presente' : ''}`, texto: anot || escrito, sinais: sinais || undefined, origem: 'vd' });
  }
  if (prio?.resumo) itens.push({ data: dataDeTexto(prio.ultimaInfo), titulo: `Lista de prioritários${prio.ultimaInfo ? ` · ${prio.ultimaInfo}` : ''}`, texto: prio.resumo, origem: 'lista' });
  for (const r of f.relatosAnteriores ?? []) {
    if (trechosDaPessoa(`${r.titulo}. ${r.texto}`, m, f).length) itens.push({ data: r.data ?? '', titulo: r.titulo, texto: r.texto, origem: 'relato' });
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
