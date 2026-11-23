// Tela "Grupos": gestantes (pré-natal), crianças, idosos, hipertensos, diabéticos e acamados, cada um dividido
// por faixa etária e ordenado por quem está há mais tempo sem VD. Funções "puras" (fáceis de testar); tudo no aparelho.
import { acompanhamentoDaPessoa, type Contexto, type Medida } from './acompanhamento';
import { gestantes, type Gestante } from './bloco4';
import { DIAS_ACOMPANHAR, DIAS_SINAIS } from './atencao';
import { diferencaDias, idade } from './datas';
import { ultimaVisita } from './nivel';
import type { Familia, Grupo, Morador, PreNatal } from './tipos';

export type AbaGrupo = 'prenatal' | 'criancas' | 'idosos' | 'hipertensos' | 'diabeticos' | 'acamados';

export const ABAS: { id: AbaGrupo; nome: string }[] = [
  { id: 'prenatal', nome: 'Pré-natal' },
  { id: 'criancas', nome: 'Crianças' },
  { id: 'idosos', nome: 'Idosos' },
  { id: 'hipertensos', nome: 'Hipertensos' },
  { id: 'diabeticos', nome: 'Diabéticos' },
  { id: 'acamados', nome: 'Acamados' },
];

export interface Faixa {
  id: string;
  nome: string;
  /** Idade mínima (em anos completos) e máxima, nas duas pontas incluídas. */
  min: number;
  max: number;
}

const ADULTOS: Faixa[] = [
  { id: 'a0', nome: 'Menos de 60 anos', min: 0, max: 59 },
  { id: 'a60', nome: '60 a 79 anos', min: 60, max: 79 },
  { id: 'a80', nome: '80 anos ou mais', min: 80, max: 200 },
];

/** Faixas de idade de cada aba (combinadas com o ACS). */
export const FAIXAS: Record<Exclude<AbaGrupo, 'prenatal'>, Faixa[]> = {
  criancas: [
    { id: 'c0', nome: 'Menos de 2 anos', min: 0, max: 1 },
    { id: 'c2', nome: '2 a 5 anos', min: 2, max: 5 },
    { id: 'c6', nome: '6 a 11 anos', min: 6, max: 11 },
  ],
  idosos: [
    { id: 'i60', nome: '60 a 69 anos', min: 60, max: 69 },
    { id: 'i70', nome: '70 a 79 anos', min: 70, max: 79 },
    { id: 'i80', nome: '80 anos ou mais', min: 80, max: 200 },
  ],
  hipertensos: ADULTOS,
  diabeticos: ADULTOS,
  acamados: ADULTOS,
};

export const SEM_NASCIMENTO: Faixa = { id: 'sem', nome: 'Sem data de nascimento', min: -1, max: -1 };

/** Quantos dias sem VD até o app avisar, por aba (acamado volta mais rápido). */
export const DIAS_SEM_VD: Record<AbaGrupo, number> = {
  prenatal: DIAS_ACOMPANHAR,
  criancas: DIAS_ACOMPANHAR,
  idosos: 45,
  hipertensos: DIAS_ACOMPANHAR,
  diabeticos: DIAS_ACOMPANHAR,
  acamados: 15,
};

const GRUPO_DA_ABA: Partial<Record<AbaGrupo, Grupo>> = {
  hipertensos: 'hipertenso',
  diabeticos: 'diabetico',
  acamados: 'acamado',
};

export interface PessoaDoGrupo {
  familia: Familia;
  morador: Morador;
  /** Idade em anos completos, ou null se não tem data de nascimento. */
  anos: number | null;
  faixa: Faixa;
  /** Data da última VD da casa (aaaa-mm-dd), ou vazio se nunca teve. */
  ultimaVd: string;
  /** Dias desde a última VD, ou null se nunca teve. */
  diasSemVd: number | null;
  /** Avisos curtos (sem VD, P.A. alta, receita vencida…). */
  alertas: string[];
  pa?: Medida;
  glicemia?: Medida;
  receita?: { vence: string; vencida: boolean };
}

export interface GrupoPorFaixa {
  faixa: Faixa;
  pessoas: PessoaDoGrupo[];
}

/** "140x90" → P.A. alta (140 ou mais, ou 90 ou mais). */
export function paAlta(valor: string): boolean {
  const x = valor.match(/(\d{2,3})\s*[x/]\s*(\d{2,3})/);
  return !!x && (Number(x[1]) >= 140 || Number(x[2]) >= 90);
}

/** Glicemia capilar fora do esperado (180 ou mais, ou abaixo de 70). */
export function glicemiaFora(valor: string): 'alta' | 'baixa' | null {
  const n = Number(valor.replace(/\D/g, ''));
  if (!n) return null;
  return n >= 180 ? 'alta' : n < 70 ? 'baixa' : null;
}

export function faixaDaIdade(aba: Exclude<AbaGrupo, 'prenatal'>, anos: number | null): Faixa | null {
  if (anos === null) return SEM_NASCIMENTO;
  return FAIXAS[aba].find((f) => anos >= f.min && anos <= f.max) ?? null;
}

/** A pessoa entra na aba? Idade ou marca do grupo na ficha. */
function entra(aba: Exclude<AbaGrupo, 'prenatal'>, m: Morador, anos: number | null): boolean {
  if (aba === 'criancas') return (anos !== null && anos <= 11) || (anos === null && m.grupos.includes('crianca'));
  if (aba === 'idosos') return (anos !== null && anos >= 60) || (anos === null && m.grupos.includes('idoso'));
  return m.grupos.includes(GRUPO_DA_ABA[aba] as Grupo);
}

/** Lista de uma aba, dividida por faixa etária; dentro de cada faixa, quem está há mais tempo sem VD vem primeiro. */
export function listaDoGrupo(aba: Exclude<AbaGrupo, 'prenatal'>, familias: Familia[], ctx: Contexto): GrupoPorFaixa[] {
  const { hoje } = ctx;
  const porFaixa = new Map<string, PessoaDoGrupo[]>();
  for (const f of familias) {
    if (f.situacaoCasa !== 'habitada') continue;
    const ultimaVd = ultimaVisita(f, ctx.visitas, hoje);
    for (const m of f.moradores) {
      if (m.situacao !== 'mora') continue;
      const anos = m.nascimento ? idade(m.nascimento, hoje) : null;
      if (!entra(aba, m, anos)) continue;
      const faixa = faixaDaIdade(aba, anos);
      if (!faixa) continue;
      const diasSemVd = ultimaVd ? diferencaDias(ultimaVd, hoje) : null;
      const a = acompanhamentoDaPessoa(m, f, ctx);
      const pa = a.medidas.pa[0];
      const glicemia = a.medidas.glicemia[0];
      const alertas: string[] = [];
      if (diasSemVd === null) alertas.push('Sem VD registrada');
      else if (diasSemVd >= DIAS_SEM_VD[aba]) alertas.push(`Sem VD há ${diasSemVd} dias`);
      const recente = (x?: Medida) => !!x && diferencaDias(x.data, hoje) <= DIAS_ACOMPANHAR;
      if (pa && recente(pa) && paAlta(pa.valor)) alertas.push(`P.A. alta (${pa.valor})`);
      const g = glicemia && recente(glicemia) ? glicemiaFora(glicemia.valor) : null;
      if (glicemia && g) alertas.push(`Glicemia ${g} (${glicemia.valor})`);
      if (aba === 'hipertensos' && (!pa || diferencaDias(pa.data, hoje) > DIAS_SINAIS)) alertas.push(pa ? `Sem P.A. há ${diferencaDias(pa.data, hoje)} dias` : 'Sem P.A. registrada');
      if (aba === 'diabeticos' && (!glicemia || diferencaDias(glicemia.data, hoje) > DIAS_SINAIS)) {
        alertas.push(glicemia ? `Sem glicemia há ${diferencaDias(glicemia.data, hoje)} dias` : 'Sem glicemia registrada');
      }
      let receita: PessoaDoGrupo['receita'];
      if (a.receita) {
        const vencida = a.receita.vence < hoje;
        if (vencida || diferencaDias(hoje, a.receita.vence) <= 30) {
          receita = { vence: a.receita.vence, vencida };
          alertas.push(vencida ? 'Receita vencida' : 'Receita vence em breve');
        }
      }
      if (a.hospital) alertas.push(a.hospital.tipo === 'alta' ? 'Teve alta do hospital' : 'Internado(a)');
      const lista = porFaixa.get(faixa.id) ?? [];
      lista.push({ familia: f, morador: m, anos, faixa, ultimaVd, diasSemVd, alertas, ...(pa ? { pa } : {}), ...(glicemia ? { glicemia } : {}), ...(receita ? { receita } : {}) });
      porFaixa.set(faixa.id, lista);
    }
  }
  const faixas = [...FAIXAS[aba], SEM_NASCIMENTO];
  return faixas
    .filter((faixa) => porFaixa.has(faixa.id))
    .map((faixa) => ({
      faixa,
      // Nunca visitada primeiro, depois a VD mais antiga; empate: quem tem mais avisos.
      pessoas: (porFaixa.get(faixa.id) ?? []).sort(
        (a, b) => (a.ultimaVd || '0000').localeCompare(b.ultimaVd || '0000') || b.alertas.length - a.alertas.length || a.morador.nome.localeCompare(b.morador.nome),
      ),
    }));
}

/** Quantas pessoas têm algum aviso, por aba (para o número no botão da aba). */
export function totais(aba: Exclude<AbaGrupo, 'prenatal'>, familias: Familia[], ctx: Contexto): { total: number; avisos: number } {
  const l = listaDoGrupo(aba, familias, ctx).flatMap((g) => g.pessoas);
  return { total: l.length, avisos: l.filter((p) => p.alertas.length).length };
}

// ---------------------------------------------------------------- pré-natal

export const CONSULTAS_MINIMAS = 6;

export const PRENATAL_VAZIO: PreNatal = { consultas: 0 };

export interface GestanteComPreNatal extends Gestante {
  prenatal: PreNatal;
  /** O que ainda falta (consultas, exames, vacina, teste rápido, odonto). */
  falta: string[];
  ultimaVd: string;
  diasSemVd: number | null;
}

/** O que falta no pré-natal, pelo que o ACS marcou. */
export function faltaNoPreNatal(p: PreNatal | undefined): string[] {
  const x = p ?? PRENATAL_VAZIO;
  const falta: string[] = [];
  if (x.consultas < CONSULTAS_MINIMAS) falta.push(`Consultas: ${x.consultas} de ${CONSULTAS_MINIMAS}`);
  if (!x.exames) falta.push('Exames do pré-natal');
  if (!x.testeRapido) falta.push('Testes rápidos (HIV, sífilis, hepatites)');
  if (!x.dtpa) falta.push('Vacina dTpa');
  if (!x.odonto) falta.push('Consulta odontológica');
  return falta;
}

export function listaPreNatal(familias: Familia[], ctx: Contexto): GestanteComPreNatal[] {
  const { hoje } = ctx;
  return gestantes(familias, ctx.visitas, hoje)
    .map((g) => {
      const ultimaVd = ultimaVisita(g.familia, ctx.visitas, hoje);
      const diasSemVd = ultimaVd ? diferencaDias(ultimaVd, hoje) : null;
      const prenatal = g.morador.prenatal ?? PRENATAL_VAZIO;
      return { ...g, prenatal, falta: faltaNoPreNatal(g.morador.prenatal), ultimaVd, diasSemVd };
    })
    .sort((a, b) => (a.dpp || '9').localeCompare(b.dpp || '9'));
}
