// Acompanhamento de cada paciente: lê o que o ACS já escreveu (anotações das VDs, relatos, casos, resumo da
// lista de prioritários) e monta, sem internet e sem sair do aparelho: remédios, medidas (P.A. e glicemia),
// pendências, últimas notícias e o que perguntar na próxima VD. Só procura palavras: não muda a ficha.
import {
  escapar, frases, NEGACAO, OUTRA_PESSOA, RELATOU, semAcento, sugestoesDaPessoa, textosDaPessoa,
  type SugestaoDasVDs, type TextoDaFamilia,
} from './anotacoes';
import { diferencaDias, idade } from './datas';
import type { Prioritario } from './prioritarios';
import { etiquetaDoGrupo } from './prioritarios';
import { NOMES_GRUPO } from './rotulos';
import type { Caso, Familia, Grupo, Morador, Visita } from './tipos';

// ---------------------------------------------------------------- remédios

/** Remédios comuns: "Nome para mostrar|outras formas de escrever". */
const REMEDIOS: string[] = [
  // pressão e coração
  'Losartana|losartan', 'Enalapril', 'Captopril', 'Anlodipino|anlodipina|amlodipina', 'Hidroclorotiazida|hctz', 'Furosemida|lasix',
  'Espironolactona|aldactone', 'Atenolol', 'Propranolol', 'Metoprolol|selozok', 'Carvedilol', 'Nifedipino|nifedipina', 'Metildopa',
  'Hidralazina', 'Clonidina', 'Valsartana', 'Indapamida', 'Clortalidona', 'Sinvastatina', 'Atorvastatina', 'Rosuvastatina',
  'AAS|acido acetilsalicilico|aspirina', 'Clopidogrel', 'Varfarina|marevan', 'Rivaroxabana|xarelto', 'Digoxina', 'Amiodarona',
  'Isossorbida|monocordil|isordil', 'Ciprofibrato',
  // diabetes
  'Metformina', 'Glifage', 'Glibenclamida', 'Gliclazida|diamicron', 'Glimepirida', 'Insulina', 'Forxiga', 'Dapagliflozina', 'Jardiance',
  'Empagliflozina', 'Ozempic',
  // estômago e tireoide
  'Omeprazol', 'Pantoprazol', 'Ranitidina', 'Domperidona', 'Bromoprida', 'Simeticona', 'Levotiroxina|puran|euthyrox',
  // saúde mental e neurologia
  'Fluoxetina', 'Sertralina', 'Escitalopram', 'Paroxetina', 'Citalopram', 'Venlafaxina', 'Duloxetina', 'Amitriptilina', 'Nortriptilina',
  'Clomipramina', 'Imipramina', 'Trazodona', 'Mirtazapina', 'Bupropiona', 'Clonazepam|rivotril', 'Diazepam', 'Alprazolam', 'Lorazepam',
  'Bromazepam', 'Zolpidem', 'Olanzapina', 'Risperidona', 'Haloperidol|haldol', 'Quetiapina', 'Clorpromazina', 'Levomepromazina',
  'Lítio|litio|carbolitium', 'Carbamazepina', 'Fenitoína|fenitoina', 'Fenobarbital|gardenal', 'Valproato|acido valproico|depakene|depakote',
  'Lamotrigina', 'Topiramato', 'Biperideno', 'Donepezila', 'Memantina', 'Rivastigmina', 'Levodopa|prolopa', 'Pramipexol', 'Gabapentina',
  'Pregabalina', 'Metilfenidato|ritalina',
  // dor, inflamação, alergia
  'Dipirona', 'Paracetamol', 'Ibuprofeno', 'Diclofenaco', 'Nimesulida', 'Tramadol', 'Codeína|codeina', 'Morfina', 'Prednisona',
  'Prednisolona', 'Dexametasona', 'Alopurinol', 'Colchicina', 'Ciclobenzaprina', 'Loratadina',
  // respiração
  'Salbutamol|aerolin', 'Budesonida', 'Formoterol', 'Beclometasona|clenil', 'Ipratrópio|ipratropio|atrovent', 'Montelucaste',
  // antibióticos e outros
  'Amoxicilina', 'Azitromicina', 'Cefalexina', 'Ciprofloxacino', 'Sulfametoxazol|bactrim', 'Nitrofurantoína|nitrofurantoina',
  'Metronidazol', 'Fluconazol', 'Alendronato', 'Vitamina D', 'Sulfato ferroso', 'Ácido fólico|acido folico', 'Complexo B',
  'Vitamina B12', 'Tansulosina', 'Finasterida', 'Doxazosina', 'Enoxaparina|clexane', 'Oxibutinina', 'Anticoncepcional',
];
/** Nomes que não estão na lista, pelo final da palavra (ex.: "candesartana", "nebivolol"). */
const FINAIS = '[a-z]{3,}(?:pril|sartana|sartan|olol|statina|prazol|dipino|formina|zepam|oxetina|tralina|floxacino|cilina|micina|gliptina|gliflozina|tiazida|xabana|triptilina)';

interface Dicionario {
  nomes: Map<string, string>;
  re: RegExp;
}
const dicionarios = new Map<string, Dicionario>();

/** Monta (uma vez) a busca de remédios: a lista do app mais os nomes que o ACS ensinou. */
function dicionario(extras: string): Dicionario {
  let d = dicionarios.get(extras);
  if (d) return d;
  const nomes = new Map<string, string>();
  for (const linha of [...REMEDIOS, ...extras.split(/[,;\n]+/)]) {
    const [mostrar, ...outras] = linha.split('|').map((x) => x.trim()).filter(Boolean);
    if (!mostrar || mostrar.length < 3) continue;
    for (const v of [mostrar, ...outras]) nomes.set(semAcento(v).replace(/\s+/g, ' '), mostrar);
  }
  const lista = [...nomes.keys()].sort((a, b) => b.length - a.length).map((k) => escapar(k).replace(/ /g, '\\s+'));
  d = { nomes, re: new RegExp(`(^|[^a-z0-9])(${lista.join('|')}|${FINAIS})(?![a-z0-9])`, 'g') };
  dicionarios.set(extras, d);
  return d;
}

export type SituacaoRemedio = 'usa' | 'parou' | 'alergia';

export interface Remedio {
  /** moradorId|r-nome (para esconder o que estiver errado). */
  chave: string;
  nome: string;
  /** Dose como foi escrita, ex.: "XR 500 mg". */
  dose: string;
  situacao: SituacaoRemedio;
  data: string;
  origem: string;
  frase: string;
}

const PAROU = /\b(parou|parar|parando|suspend\w*|suspens[oa]|interromp\w*|abandon\w*|deixou de (tomar|usar)|nao (toma|usa|tomou|quer tomar|quis tomar|faz uso|esta tomando|esta usando)|sem (tomar|usar|uso)|retir\w+|acabou|esta sem|ficou sem|em falta)\b/;
const ALERGIA = /\b(alergi\w*|reacao (a|ao)|passou mal com)\b/;
const TROCA = /\b(troc\w+|substitui\w+|mudou de)\b(.*)$/;
const DOSE = /^(\s+(?:xr|xl|retard|nph|regular))?(\s+(?:de\s+)?\d+(?:[.,]\d+)?\s*(?:mg|mcg|ml|ui|g)(?![a-z]))?/;
const SO_LIGACAO = /^[\s,]*(?:e|ou|mais|\+|com|junto com)?\s*(?:o|a|os|as)?\s*$/;

/**
 * O que foi dito do remédio naquela frase. `antes` é a frase até o nome; `desde` é onde acabou o remédio
 * anterior da mesma frase (0 se é o primeiro) e `anterior` o que valeu para ele.
 */
function situacaoNaFrase(antes: string, desde: number, anterior: SituacaoRemedio | null): SituacaoRemedio | null {
  const assunto = antes.split(RELATOU).pop() ?? '';
  if (OUTRA_PESSOA.test(assunto)) return null; // "o marido toma…": o remédio é de outra pessoa
  const entre = antes.slice(desde);
  if (anterior && SO_LIGACAO.test(entre)) return anterior; // "parou X, Y e Z": vale o mesmo para todos
  // Perto do nome: depois da última vírgula, do último parêntese ou do remédio anterior.
  const perto = (entre.slice(entre.lastIndexOf(',') + 1).split(RELATOU).pop() ?? '').split('(').pop() ?? '';
  if (ALERGIA.test(perto)) return 'alergia';
  const troca = perto.match(TROCA) ?? (desde ? null : assunto.match(TROCA));
  if (troca) {
    if (/\b(dose|horario)\b/.test(troca[2])) return 'usa';
    return /\b(por|pel[oa]s?|para)\b/.test(troca[2]) ? 'usa' : 'parou';
  }
  // "trocou X por Y": o Y vem depois de "por".
  if (anterior === 'parou' && /^\s*(por|pel[oa]s?|para)\s+(o |a )?$/.test(entre) && TROCA.test(antes)) return 'usa';
  return PAROU.test(perto) ? 'parou' : 'usa';
}

/** Os remédios citados sobre a pessoa; para cada um vale a citação mais recente. */
export function remediosDaPessoa(moradorId: string, textos: TextoDaFamilia[], extras = ''): Remedio[] {
  const { nomes, re } = dicionario(extras);
  const porNome = new Map<string, Remedio>();
  // Do mais antigo ao mais novo: o mais novo fica por último e vence.
  for (const t of [...textos].sort((a, b) => a.data.localeCompare(b.data))) {
    for (const frase of frases(t.texto)) {
      const baixo = semAcento(frase);
      let anterior: SituacaoRemedio | null = null;
      let desde = 0;
      for (const x of baixo.matchAll(re)) {
        const ini = (x.index ?? 0) + x[1].length;
        const fim = ini + x[2].length;
        const situacao = situacaoNaFrase(baixo.slice(0, ini), desde, anterior);
        desde = fim;
        if (!situacao) continue;
        anterior = situacao;
        const escrito = frase.slice(ini, fim);
        const nome = nomes.get(x[2].replace(/\s+/g, ' ')) ?? escrito.charAt(0).toUpperCase() + escrito.slice(1).toLowerCase();
        const dose = frase.slice(fim, fim + (baixo.slice(fim).match(DOSE)?.[0].length ?? 0)).trim();
        const chave = `${moradorId}|r-${semAcento(nome)}`;
        const ja = porNome.get(chave);
        const doseAntiga = ja && situacao === 'usa' && ja.dose.toLowerCase().startsWith(dose.toLowerCase()) ? ja.dose : '';
        porNome.set(chave, { chave, nome, dose: doseAntiga || dose, situacao, data: t.data, origem: t.origem, frase });
      }
    }
  }
  const ordem: Record<SituacaoRemedio, number> = { alergia: 0, usa: 1, parou: 2 };
  return [...porNome.values()].sort((a, b) => ordem[a.situacao] - ordem[b.situacao] || b.data.localeCompare(a.data) || a.nome.localeCompare(b.nome));
}

// ---------------------------------------------------------------- medidas

export interface Medida {
  valor: string;
  data: string;
}

const RE_PA = /\b(?:p\.?\s?a\.?|pressao(?: arterial)?)(?![a-z])[^0-9.;]{0,25}?(\d{2,3})\s*[x/]\s*(\d{2,3})(?!\d)/g;
const RE_GLIC = /\b(?:dextro|destro|glicemia(?: capilar)?|hgt)\b[^0-9.;]{0,20}?(\d{2,3})(?![\dx/])/g;

/** Últimas P.A. e glicemias da pessoa (dos sinais vitais das VDs e do que foi escrito), a mais nova primeiro. */
export function medidasDaPessoa(m: Morador, f: Familia, visitas: Visita[], textos: TextoDaFamilia[]): { pa: Medida[]; glicemia: Medida[] } {
  const pa: Medida[] = [];
  const glicemia: Medida[] = [];
  for (const v of visitas) {
    if (v.familiaId !== f.id) continue;
    const s = v.sinais?.[m.id];
    if (s?.pa?.trim()) pa.push({ valor: s.pa.trim(), data: v.data });
    if (s?.glicemia?.trim()) glicemia.push({ valor: s.glicemia.trim(), data: v.data });
  }
  // Do texto: do mais antigo ao mais novo. O mesmo valor repetido num texto mais novo é o histórico sendo
  // contado de novo, então fica só na primeira data; "PA 230x80 em 03/2026" é de outro dia e fica de fora.
  const doTexto = (lista: Medida[], valor: string, data: string, baixo: string, x: RegExpMatchArray) => {
    const i = x.index ?? 0;
    if (/^\s*(em|no dia|dia|de)\s+\d/.test(baixo.slice(i + x[0].length)) || /\b(historico|antes|anterior\w*)\b[^.;|]*$/.test(baixo.slice(0, i))) return;
    if (!lista.some((m0) => m0.valor === valor)) lista.push({ valor, data });
  };
  for (const t of [...textos].sort((a, b) => a.data.localeCompare(b.data))) {
    if (!t.data) continue;
    const baixo = semAcento(t.texto);
    for (const x of baixo.matchAll(RE_PA)) doTexto(pa, `${x[1]}x${x[2]}`, t.data, baixo, x);
    for (const x of baixo.matchAll(RE_GLIC)) doTexto(glicemia, x[1], t.data, baixo, x);
  }
  const maisNovaAntes = (l: Medida[]) => l.sort((a, b) => b.data.localeCompare(a.data));
  return { pa: maisNovaAntes(pa), glicemia: maisNovaAntes(glicemia) };
}

// ---------------------------------------------------------------- pendências

export type TipoPendencia = 'receita' | 'cirurgia' | 'resultado' | 'exame' | 'consulta' | 'encaminhamento' | 'fazer' | 'confirmar';

export const NOMES_PENDENCIA: Record<TipoPendencia, string> = {
  receita: 'Receita', cirurgia: 'Cirurgia', resultado: 'Resultado', exame: 'Exame', consulta: 'Consulta',
  encaminhamento: 'Encaminhamento', fazer: 'Pendente', confirmar: 'Confirmar',
};

export interface Pendencia {
  /** moradorId|p-código da frase. */
  chave: string;
  /** A chave desta e das repetidas (o mesmo assunto contado em outro texto do mesmo dia): resolver esconde todas. */
  chaves: string[];
  tipo: TipoPendencia;
  frase: string;
  data: string;
  origem: string;
  /** Dia marcado, se a frase diz (aaaa-mm-dd). */
  quando?: string;
}

const EXAME = 'exames?|ultrassom|usg|endoscopia|colonoscopia|mamografia|papanicolau|preventivo|raio[ -]?x|tomografia|ressonancia|eletrocardiograma|eletro|ecocardiograma|coleta|hemograma|biopsia|densitometria|holter|ivcf\\S*';
const CONSULTA = 'consulta|retorno|reavaliacao|pericia|puericultura|pre[- ]natal|agendamento|atendimento';
const FALTA = 'aguard\\w+|esperando|precisa\\w*|necessita\\w*|tem que|falta\\w*|ficou de|ira|vai|vao|marcara|pretende|pedir|pediu|solicit\\w+|agendar|marcar|marcando|pendente';
const MARCADO = 'a realizar|a fazer|a marcar|a agendar|pendente|previst[ao]|marcad[ao]|agendad[ao]|aguard\\w+|dia \\d{1,2}';
const re = (fonte: string) => new RegExp(fonte);

/** Assuntos: vale o que estiver mais perto do verbo ("marcando consulta para ver o exame" é consulta). */
const REGRAS_PENDENCIA: [TipoPendencia, RegExp][] = [
  ['receita', /\b(renovar|renovacao d[ae]|sem) (a |o )?(receita|laudo)\b|\b(receita|laudo) (vencid\w*|venceu|vai vencer|acabando)\b/],
  ['cirurgia', re(`\\b(${FALTA}|previst[ao]|marcad[ao]|agendad[ao]|fila d[aeo])\\b[^.;]*?\\b(cirurgia|operar|operacao|procedimento)\\b|\\b(cirurgia|operacao|procedimento)\\b[^.;]*?\\b(${MARCADO}|fila)\\b`)],
  ['resultado', re(`\\b(${FALTA}|buscar|pegar|retirar)\\b[^.;]*?\\bresultados?\\b|\\bresultados?\\b[^.;]*?\\b(pendente|nao saiu|ainda nao|aguard\\w+)\\b`)],
  ['exame', re(`\\b(${FALTA})\\b[^.;]*?\\b(${EXAME})(?![a-z])|\\b(${EXAME})(?![a-z])[^.;]*?\\b(${MARCADO})\\b`)],
  ['consulta', re(`\\b(${FALTA}|tem|tera)\\b[^.;]*?\\b(${CONSULTA})\\b|\\b(${CONSULTA})\\b[^.;]*?\\b(${MARCADO})\\b`)],
  ['encaminhamento', /\bencaminhad[oa]s?\b|\bencaminhamento\b|\baguard\w+ (vaga|chamad[ao]|ser chamad[ao]|regulacao)\b|\bfila d[aeo]\b/],
];
/** Se nenhum assunto serviu. */
const REGRAS_GERAIS: [TipoPendencia, RegExp][] = [
  ['fazer', /\b(precisa\w*|necessita\w*|tem que|ficou de|pedir|pede\w*|solicitar|cobrar|avisar|lembrar|aguard\w+|esperando)\b/],
  ['confirmar', /\b(a confirmar|confirmar|verificar|conferir|a identificar)\b/],
];

/** O tipo da pendência que a frase (já sem acento) traz, ou null. */
function tipoDaPendencia(baixo: string): TipoPendencia | null {
  let melhor: { tipo: TipoPendencia; i: number; n: number } | null = null;
  for (const [tipo, r] of REGRAS_PENDENCIA) {
    const x = baixo.match(r);
    if (!x) continue;
    const c = { tipo, i: x.index ?? 0, n: x[0].length };
    if (!melhor || c.i < melhor.i || (c.i === melhor.i && c.n < melhor.n)) melhor = c;
  }
  return melhor?.tipo ?? REGRAS_GERAIS.find(([, r]) => r.test(baixo))?.[0] ?? null;
}

/** Num texto MAIS NOVO, o que mostra que a pendência foi resolvida. */
const RESOLVE: Partial<Record<TipoPendencia, RegExp>> = {
  receita: /\b(renovou|renovad[ao]|pegou a receita|receita nova)\b/,
  cirurgia: /\b(operou|operad[oa]|fez a cirurgia|realizou a cirurgia|cirurgia (foi )?(realizada|feita)|pos[- ]operatorio)\b/,
  resultado: re(`\\b(pegou|buscou|retirou|recebeu|saiu|chegou|levou|mostrou|trouxe)\\b[^.;]*\\b(resultados?|${EXAME})(?![a-z])|\\b(resultados?|${EXAME})(?![a-z])[^.;]*\\b(normal|normais|sem alterac\\w+|deu)\\b`),
  exame: re(`\\b(fez|fizeram|realizou|pegou|buscou|recebeu|levou|mostrou|trouxe)\\b[^.;]*\\b(${EXAME}|resultados?)(?![a-z])|\\b(${EXAME}|resultados?)(?![a-z])[^.;]*\\b(normal|normais|sem alterac\\w+|deu|feit[oa]s?|realizad[oa]s?)\\b`),
  consulta: /\b(foi|passou|compareceu|consultou|teve)\b[^.;]*\b(consulta|medic[oa]|dra?|doutor\w*|especialista|retorno|pericia)\b|\bconsulta\b[^.;]*\b(realizada|feita)\b/,
  encaminhamento: /\b(foi chamad[oa]|passou (com|no|na|pel[oa])|consultou com)\b/,
};

const MESES = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const dois = (n: number) => String(n).padStart(2, '0');

/**
 * O dia marcado que a frase cita ("dia 23/11/2026", "17 de dezembro"): o primeiro que cai no dia em que foi
 * escrita ou depois. Datas do passado ("guia 22/10") e datas de anotação ("28/10: …") não contam.
 */
export function diaMarcado(baixo: string, escritoEm: string): string | undefined {
  if (!escritoEm) return undefined;
  const achadas: { i: number; dia: number; mes: number; ano: number }[] = [];
  for (const a of baixo.matchAll(/(?<![\d/])(\d{1,2})\/(\d{1,2})(?:\/(\d{4}|\d{2}))?(?![\d/])(\s*:)?/g)) {
    if (!a[4]) achadas.push({ i: a.index ?? 0, dia: Number(a[1]), mes: Number(a[2]), ano: a[3] ? Number(a[3].length === 2 ? `20${a[3]}` : a[3]) : 0 });
  }
  for (const b of baixo.matchAll(new RegExp(`\\b(\\d{1,2})\\s+de\\s+(${MESES.join('|')})(?:\\s+de\\s+(\\d{4}))?`, 'g'))) {
    achadas.push({ i: b.index ?? 0, dia: Number(b[1]), mes: MESES.indexOf(b[2]) + 1, ano: b[3] ? Number(b[3]) : 0 });
  }
  const escrito = Number(escritoEm.slice(0, 4));
  for (const { dia, mes, ano } of achadas.sort((x, y) => x.i - y.i)) {
    if (!dia || dia > 31 || !mes || mes > 12) continue;
    let iso = `${ano || escrito}-${dois(mes)}-${dois(dia)}`;
    // "dia 10/01" escrito em dezembro é do ano seguinte; "guia 22/10" escrito em 27/10 é passado.
    if (!ano && iso < escritoEm && diferencaDias(iso, escritoEm) > 180) iso = `${escrito + 1}-${dois(mes)}-${dois(dia)}`;
    if (iso > escritoEm && diferencaDias(escritoEm, iso) <= 366) return iso;
  }
  return undefined;
}

/** Código curto de uma frase (para lembrar o que o ACS marcou como resolvido). */
export function codigo(t: string): string {
  let h = 5381;
  for (const c of semAcento(t).replace(/[^a-z0-9]/g, '')) h = ((h << 5) + h + c.charCodeAt(0)) >>> 0;
  return h.toString(36);
}

/** Depois de quantos dias uma pendência antiga deixa de aparecer. */
export const DIAS_PENDENCIA = 180;

/** O que ficou para fazer ou esperar, ainda sem sinal de resolvido num texto mais novo. */
export function pendenciasDaPessoa(moradorId: string, textos: TextoDaFamilia[], hoje: string, escondidas: ReadonlySet<string> = new Set()): Pendencia[] {
  const todas: Pendencia[] = [];
  const porChave = new Set<string>();
  for (const t of textos) {
    if (!t.data || t.encerrado || diferencaDias(t.data, hoje) > DIAS_PENDENCIA) continue;
    for (const inteira of frases(t.texto)) {
      const frase = inteira.replace(/[;,\s]+$/, '');
      // "cirurgiã(o)" é a médica, não uma cirurgia (sem acento as duas palavras ficariam iguais).
      const baixo = semAcento(frase.replace(/cirurgi(?:ões|ãs|ão|ã)/gi, 'médico'));
      const tipo = frase.length < 12 ? null : tipoDaPendencia(baixo);
      if (!tipo) continue;
      const chave = `${moradorId}|p-${codigo(frase)}`;
      if (porChave.has(chave)) continue;
      porChave.add(chave);
      todas.push({ chave, chaves: [chave], tipo, frase, data: t.data, origem: t.origem, quando: diaMarcado(baixo, t.data) });
    }
  }
  // O mesmo assunto contado em dois textos do mesmo dia (o relato da VD e o caso): fica o mais completo.
  const unicas: Pendencia[] = [];
  for (const p of todas.sort((a, b) => b.frase.length - a.frase.length)) {
    const igual = unicas.find((u) => u.tipo === p.tipo && u.data === p.data && u.origem !== p.origem);
    if (igual) igual.chaves.push(p.chave);
    else unicas.push(p);
  }
  const abertas = unicas.filter((p) => {
    if (p.chaves.some((k) => escondidas.has(k))) return false; // o ACS marcou como resolvida
    if (p.quando && diferencaDias(p.quando, hoje) > 60) return false; // o dia marcado já passou faz tempo
    const resolve = RESOLVE[p.tipo];
    return !resolve || !textos.some((t) => t.data > p.data && frases(t.texto).some((fr) => resolve.test(semAcento(fr))));
  });
  // As duas mais novas de cada tipo; primeiro as que têm dia marcado (o mais perto antes).
  const porTipo = new Map<TipoPendencia, number>();
  return abertas
    .sort((a, b) => b.data.localeCompare(a.data))
    .filter((p) => {
      const n = (porTipo.get(p.tipo) ?? 0) + 1;
      porTipo.set(p.tipo, n);
      return n <= 2;
    })
    .sort((a, b) => (a.quando ?? '9').localeCompare(b.quando ?? '9') || b.data.localeCompare(a.data))
    .slice(0, 6);
}

// ---------------------------------------------------------------- queixas ("melhorou?")

const QUEIXA = /\b(dor(?:es)?|tontura|falta de ar|cansaco|ferida|lesao|queda|caiu|sangramento|febre|tosse|inchaco|inchad[oa]|enjoo|nausea|vomito|diarreia|fraqueza|esquec\w+|insonia|nao dorme|ansios[oa]|triste|chora\w*|sem apetite|nao come|emagrec\w+|perda de peso|queimacao|formigamento|dormencia|coceira|alucinac\w+|confus[oa]|desorientac\w+)\b/g;

/** As queixas do texto mais recente sobre a pessoa (para perguntar se melhorou). */
export function queixasRecentes(textos: TextoDaFamilia[], hoje: string): { texto: string; data: string }[] {
  const recentes = textos.filter((t) => t.data && !t.lista && diferencaDias(t.data, hoje) <= 120).sort((a, b) => b.data.localeCompare(a.data));
  const ultima = recentes[0]?.data;
  let lista: { texto: string; data: string }[] = [];
  for (const t of recentes) {
    if (t.data !== ultima) break;
    for (const frase of frases(t.texto)) {
      const baixo = semAcento(frase);
      if (/\b(orient\w+|prevenc\w+|cuidados com)\b/.test(baixo)) continue; // orientação dada, não queixa
      for (const x of baixo.matchAll(QUEIXA)) {
        const i = x.index ?? 0;
        const antes = baixo.slice(0, i);
        const perto = antes.slice(antes.lastIndexOf(',') + 1);
        if (NEGACAO.test(perto) || OUTRA_PESSOA.test(antes.split(RELATOU).pop() ?? '')) continue;
        if (/\bdas\s*$/.test(antes) || (i > 0 && frase.slice(i, i + 5) === 'Dores')) continue; // "Maria das Dores" é nome
        const resto = baixo.slice(i);
        const fim = resto.search(/[,;.(\n]|\s(?:mas|porem|que|pois|porque|em \d+|e (?:precisa|sofreu|nao|esta|foi|vai|tem|teve|ja|manter))\b/);
        const texto = frase.slice(i, i + Math.min(fim < 0 ? resto.length : fim, 70)).trim();
        if (/\b(passou|diminui\w*|melhor\w*|cess\w+|sumiu|controlad\w+|cicatriz\w+)\b/.test(semAcento(texto))) break; // já melhorou
        if (texto) lista.push({ texto: texto.includes('(') ? texto : texto.replace(/[)\s]+$/, ''), data: t.data });
        break; // uma queixa por frase
      }
    }
  }
  // "dores" e "dores nos ossos" são a mesma queixa: fica a mais completa.
  lista = lista.filter((q, k) => !lista.some((o, j) => j !== k && (o.texto.length > q.texto.length || (o.texto.length === q.texto.length && j < k)) && semAcento(o.texto).includes(semAcento(q.texto))));
  return lista.slice(0, 2);
}

// ---------------------------------------------------------------- tudo junto

export interface Acompanhamento {
  /** Condições (ou mudança de situação) achadas nos textos e ainda não confirmadas na ficha. */
  achadas: SugestaoDasVDs[];
  remedios: Remedio[];
  medidas: { pa: Medida[]; glicemia: Medida[] };
  pendencias: Pendencia[];
  /** Os três textos mais novos sobre a pessoa. */
  noticias: TextoDaFamilia[];
  perguntas: string[];
  /** Não há nada para mostrar. */
  vazio: boolean;
}

export interface Contexto {
  visitas: Visita[];
  casos: Caso[];
  prioritarios: Prioritario[];
  /** Chaves que o ACS escondeu ("não é", "resolvida"). */
  escondidas?: Iterable<string>;
  /** Nomes de remédios que o ACS ensinou ao app (separados por vírgula). */
  remediosExtras?: string;
  hoje: string;
}

const dm = (iso: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '');
const curto = (t: string, max = 110) => (t.length > max ? `${t.slice(0, max).trimEnd()}…` : t);
const juntar = (l: string[]) => (l.length > 1 ? `${l.slice(0, -1).join(', ')} e ${l[l.length - 1]}` : (l[0] ?? ''));

const PERGUNTA: Record<TipoPendencia, string> = {
  receita: 'Renovou a receita?', cirurgia: 'Cirurgia: alguma novidade?', resultado: 'Já pegou o resultado?', exame: 'Já fez o exame?',
  consulta: 'Já marcou ou foi à consulta?', encaminhamento: 'Já foi chamado(a) no encaminhamento?', fazer: 'Resolveu?', confirmar: 'Confirmar:',
};
const COMO_FOI: Partial<Record<TipoPendencia, string>> = { cirurgia: 'a cirurgia', exame: 'o exame', consulta: 'a consulta' };

/** O que perguntar à pessoa na próxima VD, a partir do que está em aberto. */
export function perguntasDaPessoa(a: Omit<Acompanhamento, 'perguntas' | 'vazio' | 'noticias'>, queixas: { texto: string; data: string }[], hoje: string): string[] {
  const lista: string[] = [];
  for (const p of a.pendencias.slice(0, 3)) {
    const oQue = p.tipo === 'fazer' || p.tipo === 'confirmar' ? '' : `${NOMES_PENDENCIA[p.tipo].toLowerCase()} `;
    const cabeca = !p.quando
      ? PERGUNTA[p.tipo]
      : p.quando >= hoje
        ? `Lembrar: ${oQue}dia ${dm(p.quando)}.`
        : `Como foi ${COMO_FOI[p.tipo] ?? 'o que estava marcado'} do dia ${dm(p.quando)}?`;
    lista.push(`${cabeca} “${curto(p.frase.replace(/[.\s]+$/, ''))}” (${dm(p.data)})`);
  }
  const usa = a.remedios.filter((r) => r.situacao === 'usa').map((r) => (r.nome === r.nome.toUpperCase() ? r.nome : r.nome.toLowerCase()));
  if (usa.length) lista.push(`Ainda toma ${usa.length > 4 ? `${usa.slice(0, 4).join(', ')} e os outros` : juntar(usa)}? Mudou algum remédio ou dose?`);
  for (const r of a.remedios.filter((x) => x.situacao === 'parou' && x.data && diferencaDias(x.data, hoje) <= 120).slice(0, 2)) {
    lista.push(`${r.nome}: continua sem tomar? (${dm(r.data)})`);
  }
  for (const q of queixas) lista.push(`Melhorou? “${q.texto}” (${dm(q.data)})`);
  for (const s of a.achadas) {
    if (s.sugestao.tipo === 'grupo') lista.push(`Confirmar: ${NOMES_GRUPO[s.sugestao.grupo].toLowerCase()}?`);
  }
  const pa = a.medidas.pa[0];
  if (pa) lista.push(`Última P.A.: ${pa.valor} (${dm(pa.data)}). Medir de novo.`);
  const gl = a.medidas.glicemia[0];
  if (gl) lista.push(`Última glicemia: ${gl.valor} (${dm(gl.data)}).`);
  return lista.slice(0, 8);
}

/** O acompanhamento de uma pessoa, lido de tudo o que já foi escrito sobre ela. */
export function acompanhamentoDaPessoa(m: Morador, f: Familia, c: Contexto): Acompanhamento {
  const fora = c.escondidas instanceof Set ? (c.escondidas as Set<string>) : new Set(c.escondidas ?? []);
  const prio = c.prioritarios.find((p) => p.moradorId === m.id);
  const textos = textosDaPessoa(m, f, c.visitas, c.casos, prio);
  const achadas = m.situacao === 'mora' ? sugestoesDaPessoa(m, f, textos, fora) : [];
  const remedios = remediosDaPessoa(m.id, textos, c.remediosExtras ?? '').filter((r) => !fora.has(r.chave));
  const medidas = medidasDaPessoa(m, f, c.visitas, textos);
  const pendencias = pendenciasDaPessoa(m.id, textos, c.hoje, fora);
  const noticias = [...textos].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 3);
  const base = { achadas, remedios, medidas, pendencias };
  const perguntas = perguntasDaPessoa(base, queixasRecentes(textos, c.hoje), c.hoje);
  const vazio = !achadas.length && !remedios.length && !pendencias.length && !medidas.pa.length && !medidas.glicemia.length && !noticias.length;
  return { ...base, noticias, perguntas, vazio };
}

// ---------------------------------------------------------------- achados pelo app (aba Prioritários)

/** Condições de saúde que põem a pessoa na aba Prioritários mesmo fora da lista importada. */
const SAUDE: Grupo[] = ['acamado', 'oxigenio', 'avc', 'cancer', 'saude_mental', 'alzheimer', 'diabetico', 'hipertenso', 'cirurgia', 'gestante', 'puerpera', 'deficiencia'];
const GRAVES: Grupo[] = ['oxigenio', 'acamado', 'avc', 'cancer', 'saude_mental', 'alzheimer'];
const CRONICOS: Grupo[] = ['diabetico', 'hipertenso', 'cirurgia'];

/** "Rua das Acácias" → "Acácias" (como a lista de prioritários escreve). */
export const ruaCurta = (rua: string) =>
  rua.replace(/^\s*(rua|r\.|avenida|av\.|travessa|tv\.|alameda|estrada|viela|pra[cç]a|beco)\s+/i, '').replace(/^(d[aeo]s?)\s+/i, '').trim() || rua;

/**
 * Pessoas que não estão na lista de prioritários, mas o app reconheceu alguma coisa: condição de saúde
 * marcada na ficha, condição achada nas VDs (a confirmar) ou remédio em uso. Não são gravadas: a lista é
 * refeita a cada mudança. Devolve também o acompanhamento de quem tem algo escrito.
 */
export function achadosPeloApp(familias: Familia[], c: Contexto): { achados: Prioritario[]; acompanhamentos: Map<string, Acompanhamento> } {
  const naLista = new Set(c.prioritarios.map((p) => p.moradorId).filter(Boolean));
  const fora = new Set(c.escondidas ?? []);
  const comTexto = new Set<string>([...c.visitas.map((v) => v.familiaId), ...c.casos.map((x) => x.familiaId)]);
  const ruasDaLista = [...new Set(c.prioritarios.map((p) => p.rua).filter(Boolean))];
  const achados: Prioritario[] = [];
  const acompanhamentos = new Map<string, Acompanhamento>();
  for (const f of familias) {
    if (f.situacaoCasa !== 'habitada') continue;
    const temTexto = comTexto.has(f.id) || !!f.relatosAnteriores?.length;
    const curta = ruaCurta(f.rua);
    const rua = ruasDaLista.find((r) => semAcento(curta).includes(semAcento(r)) || semAcento(r).includes(semAcento(curta))) ?? curta;
    for (const m of f.moradores) {
      if (m.situacao !== 'mora') continue;
      const a = temTexto || naLista.has(m.id) ? acompanhamentoDaPessoa(m, f, { ...c, escondidas: fora }) : null;
      if (a && !a.vazio) acompanhamentos.set(m.id, a);
      if (naLista.has(m.id)) continue;
      const grupos = m.grupos.filter((g) => SAUDE.includes(g));
      const aConfirmar = a?.achadas.some((s) => s.sugestao.tipo === 'grupo') ?? false;
      const usaRemedio = a?.remedios.some((r) => r.situacao === 'usa') ?? false;
      if (!grupos.length && !aConfirmar && !usaRemedio) continue;
      const anos = idade(m.nascimento, c.hoje);
      const nivel = (anos !== null && anos >= 80) || grupos.some((g) => GRAVES.includes(g)) ? 'A' : (anos !== null && anos >= 60) || grupos.some((g) => CRONICOS.includes(g)) ? 'B' : 'C';
      achados.push({
        id: `app-${m.id}`, nome: m.nome, nascimento: m.nascimento ?? '', nivel, rua, casa: [f.numero, f.complemento].filter(Boolean).join(' '),
        prontuario: f.prontuario, etiquetas: [...new Set(grupos.map(etiquetaDoGrupo).filter((e): e is string => !!e))], resumo: '', ultimaInfo: '',
        familiaId: f.id, moradorId: m.id, atualizadoEm: '', doApp: true,
      });
    }
  }
  return { achados, acompanhamentos };
}
