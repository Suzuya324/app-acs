import type { Desfecho, Morador, SinaisVitais } from './tipos';

/** De quantas em quantas visitas o modelo de frase muda. */
export const VISITAS_POR_MODELO = 5;

export interface EntradaRelato {
  desfecho: Desfecho;
  presentes: Morador[];
  ausentes: Morador[];
  conversouComFamilia: boolean;
  sinais: SinaisVitais;
  orientacoes: string;
  compartilhadaCom: string;
  /**
   * Número de ordem desta visita (0, 1, 2…). O modelo de frase muda a cada
   * VISITAS_POR_MODELO visitas, para o texto não ficar sempre igual.
   */
  contador: number;
}

interface Modelo {
  abertura: (presentes: string) => string;
  semPresentes: string;
  ausentes: (nomes: string) => string;
  sinais: string;
  orientacoes: string;
  compartilhada: (quem: string) => string;
}

const MODELOS_ATENDIDA: Modelo[] = [
  {
    abertura: (p) => `Realizada visita domiciliar. Presentes: ${p}.`,
    semPresentes: 'Realizada visita domiciliar com contato com a família.',
    ausentes: (a) => `Ausentes no momento: ${a}.`,
    sinais: 'Sinais aferidos:',
    orientacoes: 'Orientações:',
    compartilhada: (q) => `Visita compartilhada com ${q}.`,
  },
  {
    abertura: (p) => `Visita domiciliar realizada com a presença de ${p}.`,
    semPresentes: 'Visita domiciliar realizada; conversado com a família.',
    ausentes: (a) => `Não estavam em casa: ${a}.`,
    sinais: 'Aferido:',
    orientacoes: 'Orientações repassadas:',
    compartilhada: (q) => `VD feita em conjunto com ${q}.`,
  },
  {
    abertura: (p) => `Família visitada. Estavam em casa: ${p}.`,
    semPresentes: 'Família visitada; contato feito com a família.',
    ausentes: (a) => `Ausentes: ${a}.`,
    sinais: 'Sinais vitais:',
    orientacoes: 'Orientações dadas:',
    compartilhada: (q) => `Visita acompanhada por ${q}.`,
  },
  {
    abertura: (p) => `VD realizada. Participaram da visita: ${p}.`,
    semPresentes: 'VD realizada por meio de conversa com a família.',
    ausentes: (a) => `Não se encontravam no domicílio: ${a}.`,
    sinais: 'Dados verificados na visita:',
    orientacoes: 'Orientações realizadas:',
    compartilhada: (q) => `Visita realizada junto com ${q}.`,
  },
  {
    abertura: (p) => `Realizada VD de acompanhamento. Em domicílio no momento da visita: ${p}.`,
    semPresentes: 'Realizada VD de acompanhamento; conversado com a família.',
    ausentes: (a) => `Ausentes no momento da visita: ${a}.`,
    sinais: 'Verificado durante a visita:',
    orientacoes: 'Foram passadas as seguintes orientações:',
    compartilhada: (q) => `VD compartilhada com ${q}.`,
  },
];

const MODELOS_AUSENCIA = [
  'Realizada tentativa de visita domiciliar; ninguém em casa no momento.',
  'Tentativa de VD sem sucesso: família ausente no momento da visita.',
  'Compareci ao domicílio, porém não havia ninguém em casa.',
  'Visita não realizada por ausência de todos os moradores no momento.',
  'Domicílio visitado sem resposta; família completa ausente.',
];

const MODELOS_RECUSA = [
  'Família recusou receber a visita domiciliar.',
  'Visita domiciliar não realizada: a família não quis receber a visita.',
  'Realizada abordagem no domicílio; a família recusou a visita.',
  'Família optou por não receber a VD neste momento.',
  'VD recusada pela família.',
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

function comPonto(texto: string): string {
  const t = texto.trim();
  if (!t) return '';
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

/** Monta o texto dos sinais vitais preenchidos, ex.: "P.A. 120x80 mmHg; temperatura 36,5 °C." */
export function textoSinais(s: SinaisVitais): string {
  const partes: string[] = [];
  const v = (x?: string) => (x ?? '').trim().replace('.', ',');
  if (s.pa?.trim()) partes.push(`P.A. ${s.pa.trim().replace(/\s*[/xX]\s*/, 'x')} mmHg`);
  if (v(s.temperatura)) partes.push(`temperatura ${v(s.temperatura)} °C`);
  if (v(s.peso)) partes.push(`peso ${v(s.peso)} kg`);
  if (v(s.altura)) partes.push(`altura ${v(s.altura)} m`);
  if (v(s.glicemia)) partes.push(`glicemia capilar ${v(s.glicemia)} mg/dL`);
  return partes.length ? `${partes.join('; ')}.` : '';
}

/** Gera o texto do relato pronto para copiar e colar no Fast. */
export function gerarRelato(e: EntradaRelato): string {
  const extra: string[] = [];

  if (e.desfecho === 'ausencia_completa') {
    return MODELOS_AUSENCIA[indiceModelo(e.contador, MODELOS_AUSENCIA.length)];
  }

  if (e.desfecho === 'recusa') {
    const base = MODELOS_RECUSA[indiceModelo(e.contador, MODELOS_RECUSA.length)];
    const quem = e.compartilhadaCom.trim();
    const obs = comPonto(e.orientacoes);
    return [base, quem ? `Abordagem feita junto com ${quem}.` : '', obs].filter(Boolean).join(' ');
  }

  const m = MODELOS_ATENDIDA[indiceModelo(e.contador, MODELOS_ATENDIDA.length)];
  const nomesPresentes = e.presentes.map((p) => p.nome);

  extra.push(nomesPresentes.length ? m.abertura(juntarNomes(nomesPresentes)) : m.semPresentes);

  if (e.ausentes.length) extra.push(m.ausentes(juntarNomes(e.ausentes.map((p) => p.nome))));

  const sinais = textoSinais(e.sinais);
  if (sinais) extra.push(`${m.sinais} ${sinais}`);

  const orient = comPonto(e.orientacoes);
  if (orient) extra.push(`${m.orientacoes} ${orient}`);

  const quem = e.compartilhadaCom.trim();
  if (quem) extra.push(m.compartilhada(quem));

  return extra.join(' ');
}
