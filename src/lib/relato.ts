import type { Desfecho, Morador, SinaisVitais } from './tipos';

/** De quantas em quantas visitas o modelo de frase muda. */
export const VISITAS_POR_MODELO = 5;

export interface EntradaRelato {
  desfecho: Desfecho;
  presentes: Morador[];
  ausentes: Morador[];
  conversouComFamilia: boolean;
  /** Sinais vitais por morador (chave = id do morador). */
  sinais: Record<string, SinaisVitais>;
  /** Assuntos das orientações, ex.: "consultas, dengue e vacinas". */
  orientacoes: string;
  compartilhadaCom: string;
  /** Usar o nome completo dos moradores (padrão: só o primeiro nome). */
  nomeCompleto?: boolean;
  /** O que foi feito de revisita marcada (ex.: "entregue guia de encaminhamento"). */
  feitos?: string[];
  /**
   * Número de ordem desta visita (0, 1, 2…). O modelo de frase muda a cada
   * VISITAS_POR_MODELO visitas, para o texto não ficar sempre igual.
   */
  contador: number;
}

/** Como começa a frase quando a visita foi atendida (estilo curto, com vírgulas). */
interface Modelo {
  /** `p` = nomes dos presentes; `todos` = toda a família estava; `plural` = mais de um presente. */
  abertura: (p: string, todos: boolean, plural: boolean) => string;
}

const presentesTxt = (p: string, plural: boolean) => `${plural ? 'presentes' : 'presente'} ${p}`;

const MODELOS_ATENDIDA: Modelo[] = [
  { abertura: (p, _t, pl) => `Realizada VD, ${presentesTxt(p, pl)}` },
  { abertura: (p, _t, pl) => `VD realizada, ${presentesTxt(p, pl)}` },
  { abertura: (p) => `Realizada VD com ${p}` },
  { abertura: (p, todos, pl) => (todos && pl ? `Feita VD, família presente (${p})` : `Feita VD, ${presentesTxt(p, pl)}`) },
  { abertura: (p, _t, pl) => `Realizada visita, ${presentesTxt(p, pl)}` },
];

const MODELOS_AUSENCIA = [
  'Realizada tentativa de VD, ninguém em casa',
  'Tentativa de VD, ninguém em casa',
  'VD não realizada, ninguém em casa',
  'Realizada tentativa de VD, família ausente',
  'Tentativa de VD, família ausente no momento',
];

const MODELOS_RECUSA = [
  'Família recusou a VD',
  'VD recusada pela família',
  'Família não quis receber a VD',
  'Realizada tentativa de VD, família recusou',
  'Família recusou receber a VD',
];

/** Escolhe qual modelo usar a partir do número da visita. */
export function indiceModelo(contador: number, totalModelos: number): number {
  const bloco = Math.floor(Math.max(0, contador) / VISITAS_POR_MODELO);
  return bloco % totalModelos;
}

/** "Ana", "Ana e Bia", "Ana, Bia e Caio" */
export function juntarNomes(nomes: string[]): string {
  if (nomes.length <= 1) return nomes.join('');
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`;
}

/**
 * Nome curto de cada morador: só o primeiro nome.
 * Se dois moradores da mesma família têm o mesmo primeiro nome, usa os dois primeiros nomes.
 */
export function nomesCurtos(moradores: Morador[]): Map<string, string> {
  const primeiro = (m: Morador) => m.nome.trim().split(/\s+/)[0] ?? m.nome;
  const contagem = new Map<string, number>();
  for (const m of moradores) contagem.set(primeiro(m), (contagem.get(primeiro(m)) ?? 0) + 1);
  const mapa = new Map<string, string>();
  for (const m of moradores) {
    const p = primeiro(m);
    mapa.set(m.id, (contagem.get(p) ?? 0) > 1 ? m.nome.trim().split(/\s+/).slice(0, 2).join(' ') : p);
  }
  return mapa;
}

/** "orientada", "orientado", "orientadas" ou "orientados", conforme quem estava presente. */
export function concordancia(presentes: Morador[]): string {
  if (presentes.length === 0) return 'orientada a família';
  const todasF = presentes.every((m) => m.sexo === 'F');
  if (presentes.length === 1) return todasF ? 'orientada' : presentes[0].sexo === 'M' ? 'orientado' : 'orientado(a)';
  return todasF ? 'orientadas' : 'orientados';
}

const num = (x?: string) => (x ?? '').trim().replace('.', ',');

/** "P.A. de Ana 130x85, glicemia de Ana 98 mg/dL" */
export function textoSinais(sinais: Record<string, SinaisVitais>, nomes: Map<string, string>, ordem: Morador[]): string {
  const partes: string[] = [];
  for (const m of ordem) {
    const s = sinais[m.id];
    if (!s) continue;
    const n = nomes.get(m.id) ?? m.nome;
    if (s.pa?.trim()) partes.push(`P.A. de ${n} ${s.pa.trim().replace(/\s*[/xX]\s*/, 'x')}`);
    if (num(s.temperatura)) partes.push(`temperatura de ${n} ${num(s.temperatura)} °C`);
    if (num(s.peso)) partes.push(`peso de ${n} ${num(s.peso)} kg`);
    if (num(s.altura)) partes.push(`altura de ${n} ${num(s.altura)} m`);
    if (num(s.glicemia)) partes.push(`glicemia de ${n} ${num(s.glicemia)} mg/dL`);
  }
  return partes.join(', ');
}

function finalizar(partes: string[]): string {
  const texto = partes.filter(Boolean).join(', ').trim().replace(/[.,;\s]+$/, '');
  return `${texto}.`;
}

/** Gera o texto do relato pronto para copiar e colar no Fast. */
export function gerarRelato(e: EntradaRelato): string {
  const quem = e.compartilhadaCom.trim();
  const compartilhada = quem ? `VD compartilhada com ${quem}` : '';
  const orient = e.orientacoes.trim().replace(/[.,;\s]+$/, '');

  if (e.desfecho === 'ausencia_completa') {
    return finalizar([MODELOS_AUSENCIA[indiceModelo(e.contador, MODELOS_AUSENCIA.length)], compartilhada]);
  }

  if (e.desfecho === 'recusa') {
    return finalizar([MODELOS_RECUSA[indiceModelo(e.contador, MODELOS_RECUSA.length)], compartilhada]);
  }

  const todos = [...e.presentes, ...e.ausentes];
  const nomes = e.nomeCompleto ? new Map(todos.map((m) => [m.id, m.nome.trim().replace(/\s+/g, ' ')])) : nomesCurtos(todos);
  const nomesPresentes = e.presentes.map((m) => nomes.get(m.id)!);
  const partes: string[] = [];

  if (nomesPresentes.length) {
    const m = MODELOS_ATENDIDA[indiceModelo(e.contador, MODELOS_ATENDIDA.length)];
    partes.push(m.abertura(juntarNomes(nomesPresentes), e.ausentes.length === 0, nomesPresentes.length > 1));
  } else {
    partes.push('Realizada VD, conversado com a família');
  }

  if (e.ausentes.length && nomesPresentes.length) {
    const a = e.ausentes.map((m) => nomes.get(m.id)!);
    partes.push(`${a.length > 1 ? 'ausentes' : 'ausente'} ${juntarNomes(a)}`);
  }

  partes.push(textoSinais(e.sinais, nomes, [...e.presentes, ...e.ausentes]));

  if (orient) partes.push(`${concordancia(e.presentes)} sobre ${orient}`);

  for (const f of e.feitos ?? []) if (f.trim()) partes.push(f.trim());

  partes.push(compartilhada);

  return finalizar(partes);
}

/** Faz o caminho de volta de juntarNomes: "consultas, dengue e vacinas" → ["consultas", "dengue", "vacinas"]. */
export function separarNomes(texto: string): string[] {
  const t = texto.trim();
  if (!t) return [];
  const partes = t.split(/,\s*/);
  const ultima = partes.pop()!;
  const i = ultima.lastIndexOf(' e ');
  if (i >= 0) partes.push(ultima.slice(0, i), ultima.slice(i + 3));
  else partes.push(ultima);
  return partes.map((p) => p.trim()).filter(Boolean);
}
