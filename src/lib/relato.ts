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
  /** Motivo da VD quando não é o padrão ("Outros"): entra no relato. */
  motivo?: string;
  /** O que foi conversado / observado (escrito pelo ACS). */
  observacao?: string;
  /** O que foi anotado sobre cada pessoa (chave = id do morador): entra como "Ana: …". */
  anotacoes?: Record<string, string>;
  /** VD anterior da família nos últimos 30 dias (para dar continuidade no texto). */
  anterior?: { data: string; desfecho: Desfecho };
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

const PARTICULAS = new Set(['da', 'de', 'do', 'das', 'dos', 'e']);

/** "JOANA TESTE DA SILVA" → "Joana Teste da Silva" (só mexe em nome todo maiúsculo ou todo minúsculo). */
export function nomeProprio(nome: string): string {
  const n = nome.trim().replace(/\s+/g, ' ');
  if (n !== n.toUpperCase() && n !== n.toLowerCase()) return n;
  return n
    .toLowerCase()
    .split(' ')
    .map((p, i) => (i > 0 && PARTICULAS.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(' ');
}

/**
 * Nome curto de cada morador: só o primeiro nome.
 * Se dois moradores da mesma família têm o mesmo primeiro nome, usa os dois primeiros nomes.
 */
export function nomesCurtos(moradores: Morador[]): Map<string, string> {
  const nome = (m: Morador) => nomeProprio(m.nome);
  const primeiro = (m: Morador) => nome(m).split(' ')[0] ?? nome(m);
  const contagem = new Map<string, number>();
  for (const m of moradores) contagem.set(primeiro(m), (contagem.get(primeiro(m)) ?? 0) + 1);
  const mapa = new Map<string, string>();
  for (const m of moradores) {
    const p = primeiro(m);
    mapa.set(m.id, (contagem.get(p) ?? 0) > 1 ? nome(m).split(' ').slice(0, 2).join(' ') : p);
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
    if (s.pa?.trim()) partes.push(`P.A. de ${n} ${s.pa.trim().replace(/\s*[/xX]\s*/, 'x').replace(/\s*mmhg$/i, '')}`);
    if (num(s.temperatura)) partes.push(`temperatura de ${n} ${num(s.temperatura)} °C`);
    if (num(s.peso)) partes.push(`peso de ${n} ${num(s.peso)} kg`);
    if (num(s.altura)) partes.push(`altura de ${n} ${num(s.altura)} m`);
    if (num(s.glicemia)) partes.push(`glicemia de ${n} ${num(s.glicemia)} mg/dL`);
  }
  return partes.join(', ');
}

const dataCurta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const limparTexto = (t?: string) => (t ?? '').trim().replace(/\s+/g, ' ').replace(/^[.,;:\s]+/, '').replace(/[.,;:\s]+$/, '');
const minuscula = (t: string) => (t ? t.charAt(0).toLowerCase() + t.slice(1) : t);

/** Estilo do ACS: uma frase só, com vírgulas, terminando em ponto (sem pontuação dobrada). */
function finalizar(partes: string[]): string {
  const texto = partes.map(limparTexto).filter(Boolean).join(', ').replace(/\s+([.,;])/g, '$1').replace(/,{2,}/g, ',');
  return `${texto}.`;
}

/** Títulos e palavras que continuam com maiúscula no meio da frase. */
const TITULOS = /^(dr|dra|sr|sra|srta|d|prof|profa|ubs|upa|ama|caps|sus|samu|cras|creas|inss|nasf|emulti|fast)$/i;

/**
 * Texto escrito pelo ACS no meio do relato: a primeira letra fica minúscula ("refere dor…"), menos quando a
 * primeira palavra é nome de alguém da casa, sigla ("UBS", "PA"), título ("Dra.") ou abreviação.
 */
function textoLivre(texto: string, nomesDaCasa: string[]): string {
  const t = limparTexto(texto);
  if (!t) return '';
  const bruta = t.split(/\s+/)[0];
  const palavra = bruta.replace(/[^\p{L}]/gu, '');
  const manter =
    !palavra ||
    (palavra.length > 1 && palavra === palavra.toUpperCase()) ||
    TITULOS.test(palavra) ||
    /\.$/.test(bruta) ||
    nomesDaCasa.some((n) => n.toLowerCase() === palavra.toLowerCase());
  return manter ? t : minuscula(t);
}

/** Começos de anotação que pedem o nome antes: "Ana refere dor", "Beto começou insulina". */
const VERBO = /^(refere|relata|relatou|informa|informou|diz|disse|conta|contou|est[áa]|esteve|segue|continua|mant[ée]m|faz|fez|toma|tomou|usa|usou|come[çc]ou|parou|voltou|aguarda|espera|tem|teve|foi|vai|ir[áa]|precisa|recebeu|nega|negou|apresenta|apresentou|realizou|levou|perdeu|ganhou|caiu|sente|sentiu|queixa|queixou|mora|trabalha|estuda|n[ãa]o|sem|ficou|anda|dorme|come|bebe|fuma|teve|passou|retornou|agendou|marcou|pegou|trocou|terminou|iniciou|interrompeu|abandonou|aceitou|recusou)(?![\p{L}])/iu;

/** O que foi escrito sobre a pessoa, no estilo do relato: "Ana refere tontura" ou "Ana: consulta de cardio dia 20". */
function sobreAPessoa(nome: string, texto: string, nomesDaCasa: string[]): string {
  const t = limparTexto(texto);
  if (!t) return '';
  const primeira = t.split(/\s+/)[0].replace(/[^\p{L}]/gu, '').toLowerCase();
  if (primeira === nome.split(' ')[0].toLowerCase()) return t;
  if (VERBO.test(t)) return `${nome} ${minuscula(t)}`;
  return `${nome}: ${textoLivre(t, nomesDaCasa)}`;
}

/** Funções que vêm com artigo: "com a técnica de enfermagem", "com o enfermeiro". */
const FUNCOES = /^(t[ée]cnic[ao]|enfermeir[ao]|m[ée]dic[ao]|psic[óo]log[ao]|farmac[êe]utic[ao]|agente|dentista|assistente|nutricionista|fisioterapeuta|fonoaudi[óo]log[ao]|terapeuta|educador[a]?|equipe|residente|estagi[áa]ri[ao]|acs)(?![\p{L}])/iu;

/** "Técnica de enfermagem" → "a técnica de enfermagem"; "Maria (técnica)" fica igual. */
export function comQuem(quem: string): string {
  const q = limparTexto(quem);
  const x = q.match(FUNCOES);
  if (!x) return q;
  const palavra = x[1].toLowerCase();
  const resto = palavra === 'acs' ? q : minuscula(q);
  if (palavra === 'equipe' || (/a$/.test(palavra) && !/(dentista|nutricionista|fisioterapeuta|terapeuta)$/.test(palavra))) return `a ${resto}`;
  if (/o$/.test(palavra)) return `o ${resto}`;
  return resto;
}

/** Gera o texto do relato pronto para copiar e colar no Fast. */
export function gerarRelato(e: EntradaRelato): string {
  const quem = e.compartilhadaCom.trim();
  const compartilhada = quem ? `VD compartilhada com ${comQuem(quem)}` : '';
  const orient = limparTexto(e.orientacoes);
  const motivo = limparTexto(e.motivo);
  const parteMotivo = motivo && motivo.toLowerCase() !== 'outros' ? `motivo: ${minuscula(motivo)}` : '';
  const anteriorFoiAusencia = e.anterior?.desfecho === 'ausencia_completa';
  const todos = [...e.presentes, ...e.ausentes];
  const primeiros = todos.map((m) => nomeProprio(m.nome).split(' ')[0]);
  const observacao = textoLivre(e.observacao ?? '', primeiros);

  if (e.desfecho === 'ausencia_completa') {
    const base = MODELOS_AUSENCIA[indiceModelo(e.contador, MODELOS_AUSENCIA.length)];
    const nova = anteriorFoiAusencia ? `nova tentativa (anterior em ${dataCurta(e.anterior!.data)})` : '';
    return finalizar([base, nova, parteMotivo, observacao, compartilhada]);
  }

  if (e.desfecho === 'recusa') {
    return finalizar([MODELOS_RECUSA[indiceModelo(e.contador, MODELOS_RECUSA.length)], parteMotivo, observacao, compartilhada]);
  }

  const nomes = e.nomeCompleto ? new Map(todos.map((m) => [m.id, nomeProprio(m.nome)])) : nomesCurtos(todos);
  const nomesPresentes = e.presentes.map((m) => nomes.get(m.id)!);
  const partes: string[] = [];

  let abertura: string;
  if (nomesPresentes.length) {
    const m = MODELOS_ATENDIDA[indiceModelo(e.contador, MODELOS_ATENDIDA.length)];
    abertura = m.abertura(juntarNomes(nomesPresentes), e.ausentes.length === 0, nomesPresentes.length > 1);
  } else {
    abertura = 'Realizada VD, conversado com a família';
  }
  // Continuidade com a VD anterior (até 30 dias): "Após tentativa sem sucesso em 28/10, realizada VD…"
  if (e.anterior) {
    const prefixo = anteriorFoiAusencia
      ? `Após tentativa sem sucesso em ${dataCurta(e.anterior.data)}`
      : `Em continuidade à VD de ${dataCurta(e.anterior.data)}`;
    abertura = `${prefixo}, ${minuscula(abertura)}`;
  }
  partes.push(abertura);

  if (e.ausentes.length && nomesPresentes.length) {
    const a = e.ausentes.map((m) => nomes.get(m.id)!);
    partes.push(`${a.length > 1 ? 'ausentes' : 'ausente'} ${juntarNomes(a)}`);
  }

  partes.push(parteMotivo);
  partes.push(observacao);
  for (const m of todos) partes.push(sobreAPessoa(nomes.get(m.id)!, e.anotacoes?.[m.id] ?? '', primeiros));

  partes.push(textoSinais(e.sinais, nomes, todos));

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
