// Números da equipe: VDs feitas junto com técnica, enfermeira, médica ou APA, e se eles foram nos pacientes.
// Lido só do que já está salvo no app (VD compartilhada e o botão "Foi" das listas da equipe). Funções "puras".
import { semAcento } from './anotacoes';
import { ORIGEM_APA } from './equipe';
import { ORIGEM_TECNICA } from './tecnica';
import type { Familia, Visita } from './tipos';

export type Funcao = 'tecnica' | 'enfermeira' | 'medica' | 'apa' | 'outro';

export const NOMES_FUNCAO: Record<Funcao, string> = {
  tecnica: 'Técnica de enfermagem',
  enfermeira: 'Enfermeira',
  medica: 'Médica',
  apa: 'APA',
  outro: 'Outro profissional',
};

/** Meta própria das VDs feitas junto com a equipe, se o ACS ainda não definiu uma. */
export const META_JUNTO_PADRAO = 20;

/** Que profissional é, pelo que foi escrito (ex.: "técnica", "Dra. Fulana", "enfermeira"). Sem pista: "outro". */
export function funcaoDoTexto(texto: string): Funcao {
  const t = semAcento(texto);
  if (/\bapa\b|promocao ambiental/.test(t)) return 'apa';
  if (/\btecnic[oa]s?\b|\btec\b|enfermagem/.test(t) && !/\benfermeir[oa]s?\b/.test(t)) return 'tecnica';
  if (/\benfermeir[oa]s?\b/.test(t)) return 'enfermeira';
  if (/\bmedic[oa]s?\b|\bdra?\.?\b|\bdoutora?\b/.test(t)) return 'medica';
  return 'outro';
}

/** "Mariluci e Dra. Ju" vira duas pessoas. */
function separar(texto: string): string[] {
  return texto
    .split(/\s*(?:,|;|\/|\+|\be\b)\s*/i)
    .map((p) => p.trim())
    .filter(Boolean);
}

export interface Ocorrencia {
  data: string;
  familiaId: string;
  funcao: Funcao;
  /** Como foi escrito (ou o nome da função). */
  rotulo: string;
  /** Foi junto com o ACS (VD compartilhada) ou o profissional foi sozinho (botão "Foi")? */
  junto: boolean;
  visitaId?: string;
}

const ORIGENS_SOZINHO: Record<string, Funcao> = {
  [ORIGEM_TECNICA]: 'tecnica',
  Enfermeira: 'enfermeira',
  Médica: 'medica',
  [ORIGEM_APA]: 'apa',
};

/** Todas as idas da equipe nas casas: VDs compartilhadas e idas sozinhas anotadas com "Foi". */
export function ocorrenciasDaEquipe(familias: Familia[], visitas: Visita[]): Ocorrencia[] {
  const out: Ocorrencia[] = [];
  for (const v of visitas) {
    const com = (v.compartilhadaCom ?? '').trim();
    if (!com) continue;
    const vistos = new Set<string>();
    for (const parte of separar(com)) {
      const funcao = funcaoDoTexto(parte);
      const chave = funcao !== 'outro' ? funcao : `outro:${semAcento(parte)}`;
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      out.push({ data: v.data, familiaId: v.familiaId, funcao, rotulo: funcao === 'outro' ? parte : NOMES_FUNCAO[funcao], junto: true, visitaId: v.id });
    }
  }
  for (const f of familias) {
    for (const r of f.relatosAnteriores ?? []) {
      const funcao = ORIGENS_SOZINHO[r.origem];
      if (!funcao || !r.data) continue;
      out.push({ data: r.data, familiaId: f.id, funcao, rotulo: NOMES_FUNCAO[funcao], junto: false });
    }
  }
  return out;
}

export interface LinhaEquipe {
  chave: string;
  nome: string;
  funcao: Funcao;
  /** Casas em que foi junto com o ACS (uma por casa e dia). */
  junto: number;
  /** Idas sozinho anotadas com "Foi" (uma por casa e dia). */
  sozinho: number;
  total: number;
  /** Última ida (junto ou sozinho), no período. */
  ultima: string;
}

export interface CasaAtendida {
  familiaId: string;
  /** Data mais recente no período. */
  ultima: string;
  vezes: number;
  /** Quem foi (nomes das funções). */
  quem: string[];
  /** Moradores marcados como presentes nas VDs junto com a equipe (ids). */
  presentes: string[];
}

export interface MesEquipe {
  /** aaaa-mm */
  mes: string;
  junto: number;
  sozinho: number;
}

export interface ResumoEquipe {
  /** VDs (casa + dia) feitas junto com a equipe no período. */
  vdsJunto: number;
  /** VDs do período que contam para a meta (as 200). */
  vdsDoPeriodo: number;
  /** Quantas % das VDs do período foram junto com a equipe. */
  pctJunto: number;
  linhas: LinhaEquipe[];
  casas: CasaAtendida[];
  /** Total de idas sozinho + junto por função, para os cartões "quem foi". */
  porFuncao: Record<Funcao, { junto: number; sozinho: number; ultima: string }>;
  /** Últimos 6 meses (o mais recente por último). */
  porMes: MesEquipe[];
}

const FUNCOES: Funcao[] = ['tecnica', 'enfermeira', 'medica', 'apa', 'outro'];

/** Resumo do período [inicio, fim]. `vdsDoPeriodo` vem do painel da meta (visitas contadas). */
export function resumoEquipe(familias: Familia[], visitas: Visita[], inicio: string, fim: string, vdsDoPeriodo: number, hoje: string): ResumoEquipe {
  const todas = ocorrenciasDaEquipe(familias, visitas);
  const doPeriodo = todas.filter((o) => o.data >= inicio && o.data <= fim);

  // Uma ocorrência por (casa, dia, tipo de profissional).
  const linhasMap = new Map<string, LinhaEquipe & { vistos: Set<string> }>();
  const porFuncao = Object.fromEntries(FUNCOES.map((f) => [f, { junto: 0, sozinho: 0, ultima: '' }])) as ResumoEquipe['porFuncao'];
  const vistosFuncao = new Set<string>();
  for (const o of doPeriodo) {
    const chave = o.funcao !== 'outro' ? o.funcao : `outro:${semAcento(o.rotulo)}`;
    const l = linhasMap.get(chave) ?? { chave, nome: o.funcao !== 'outro' ? NOMES_FUNCAO[o.funcao] : o.rotulo, funcao: o.funcao, junto: 0, sozinho: 0, total: 0, ultima: '', vistos: new Set<string>() };
    const k = `${o.familiaId}|${o.data}|${o.junto ? 'j' : 's'}`;
    if (!l.vistos.has(k)) {
      l.vistos.add(k);
      if (o.junto) l.junto++;
      else l.sozinho++;
      l.total++;
    }
    if (o.data > l.ultima) l.ultima = o.data;
    linhasMap.set(chave, l);
    const kf = `${o.funcao}|${k}`;
    if (!vistosFuncao.has(kf)) {
      vistosFuncao.add(kf);
      porFuncao[o.funcao][o.junto ? 'junto' : 'sozinho']++;
    }
    if (o.data > porFuncao[o.funcao].ultima) porFuncao[o.funcao].ultima = o.data;
  }
  const linhas = [...linhasMap.values()]
    .map(({ vistos: _v, ...l }) => l)
    .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, 'pt-BR'));

  // VDs junto (casa + dia), contadas uma vez mesmo com mais de um profissional.
  const casaDiaJunto = new Set(doPeriodo.filter((o) => o.junto).map((o) => `${o.familiaId}|${o.data}`));
  const vdsJunto = casaDiaJunto.size;

  // Casas atendidas.
  const porCasa = new Map<string, CasaAtendida & { dias: Set<string> }>();
  const visitaPorId = new Map(visitas.map((v) => [v.id, v]));
  for (const o of doPeriodo) {
    const c = porCasa.get(o.familiaId) ?? { familiaId: o.familiaId, ultima: '', vezes: 0, quem: [], presentes: [], dias: new Set<string>() };
    c.dias.add(o.data);
    if (o.data > c.ultima) c.ultima = o.data;
    const nome = o.funcao === 'outro' ? o.rotulo : NOMES_FUNCAO[o.funcao];
    if (!c.quem.includes(nome)) c.quem.push(nome);
    const v = o.visitaId ? visitaPorId.get(o.visitaId) : undefined;
    for (const p of v?.presentes ?? []) if (!c.presentes.includes(p)) c.presentes.push(p);
    porCasa.set(o.familiaId, c);
  }
  const casas = [...porCasa.values()]
    .map(({ dias, ...c }) => ({ ...c, vezes: dias.size }))
    .sort((a, b) => b.ultima.localeCompare(a.ultima));

  // Últimos 6 meses (do mês de "hoje" para trás).
  const porMes: MesEquipe[] = [];
  const [ano, mes] = hoje.split('-').map(Number);
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(ano, mes - 1 - i, 1));
    const m = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    const doMes = todas.filter((o) => o.data.startsWith(m));
    const j = new Set(doMes.filter((o) => o.junto).map((o) => `${o.familiaId}|${o.data}`)).size;
    const s = new Set(doMes.filter((o) => !o.junto).map((o) => `${o.familiaId}|${o.data}`)).size;
    porMes.push({ mes: m, junto: j, sozinho: s });
  }

  return {
    vdsJunto,
    vdsDoPeriodo,
    pctJunto: vdsDoPeriodo > 0 ? Math.round((vdsJunto / vdsDoPeriodo) * 100) : 0,
    linhas,
    casas,
    porFuncao,
    porMes,
  };
}
