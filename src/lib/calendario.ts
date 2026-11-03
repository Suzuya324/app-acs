// Calendário de trabalho: feriados, dias sem campo e o período da meta.
import { deISO, ehDiaUtil, paraISO, somarDias } from './datas';

export interface DiaSemCampo {
  /** aaaa-mm-dd */
  data: string;
  motivo: string;
}

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher). */
export function pascoa(ano: number): string {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return paraISO(new Date(ano, mes - 1, dia));
}

/** Feriados nacionais (e pontos facultativos de Carnaval e Corpus Christi) do ano. */
export function feriadosNacionais(ano: number): DiaSemCampo[] {
  const p = pascoa(ano);
  const fixo = (mmdd: string, motivo: string): DiaSemCampo => ({ data: `${ano}-${mmdd}`, motivo });
  return [
    fixo('01-01', 'Confraternização Universal'),
    { data: somarDias(p, -48), motivo: 'Carnaval (segunda)' },
    { data: somarDias(p, -47), motivo: 'Carnaval (terça)' },
    { data: somarDias(p, -2), motivo: 'Sexta-feira Santa' },
    fixo('04-21', 'Tiradentes'),
    fixo('05-01', 'Dia do Trabalho'),
    { data: somarDias(p, 60), motivo: 'Corpus Christi' },
    fixo('09-07', 'Independência'),
    fixo('10-12', 'Nossa Senhora Aparecida'),
    fixo('11-02', 'Finados'),
    fixo('11-15', 'Proclamação da República'),
    fixo('11-20', 'Consciência Negra'),
    fixo('12-25', 'Natal'),
  ].sort((a, b) => a.data.localeCompare(b.data));
}

/** Feriados locais comuns, para adicionar com um toque (dia e mês). */
export const FERIADOS_LOCAIS_SUGERIDOS = [
  { mmdd: '01-25', motivo: 'Aniversário de São Paulo' },
  { mmdd: '07-09', motivo: 'Revolução Constitucionalista (SP)' },
];

export interface OpcoesCalendario {
  /** Datas de feriado nacional em que o ACS trabalha mesmo assim. */
  feriadosIgnorados: string[];
  /** Dias sem campo marcados pelo ACS (folga, férias, capacitação, feriado local). */
  diasSemCampo: DiaSemCampo[];
}

/** Por que este dia não é dia de campo? ('' = é dia de campo). */
export function motivoSemCampo(iso: string, o: OpcoesCalendario): string {
  if (!ehDiaUtil(iso)) return 'fim de semana';
  const proprio = o.diasSemCampo.find((d) => d.data === iso);
  if (proprio) return proprio.motivo || 'dia sem campo';
  if (o.feriadosIgnorados.includes(iso)) return '';
  const feriado = feriadosNacionais(deISO(iso).getFullYear()).find((f) => f.data === iso);
  return feriado ? feriado.motivo : '';
}

export function criarDiaDeCampo(o: OpcoesCalendario): (iso: string) => boolean {
  const cache = new Map<string, boolean>();
  return (iso) => {
    let r = cache.get(iso);
    if (r === undefined) {
      r = motivoSemCampo(iso, o) === '';
      cache.set(iso, r);
    }
    return r;
  };
}

// ---------------- Período da meta ----------------

export interface Periodo {
  inicio: string;
  fim: string;
  /** "novembro de 2026" ou "21/10 a 20/11/2026" */
  rotulo: string;
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/**
 * Período da meta que contém a data. `diaInicio` = 1 é o mês do calendário;
 * outro valor (2 a 28) faz o período ir do dia X de um mês ao dia X-1 do mês seguinte.
 */
export function periodoDe(iso: string, diaInicio = 1): Periodo {
  const d = deISO(iso);
  const di = Math.min(28, Math.max(1, Math.round(diaInicio)));
  let ano = d.getFullYear();
  let mes = d.getMonth();
  if (d.getDate() < di) {
    mes--;
    if (mes < 0) {
      mes = 11;
      ano--;
    }
  }
  const inicio = paraISO(new Date(ano, mes, di));
  const fim = somarDias(paraISO(new Date(ano, mes + 1, di)), -1);
  const dd = (x: string) => `${x.slice(8, 10)}/${x.slice(5, 7)}`;
  const rotulo = di === 1 ? `${MESES[mes]} de ${ano}` : `${dd(inicio)} a ${dd(fim)}/${fim.slice(0, 4)}`;
  return { inicio, fim, rotulo };
}

/** Período anterior (-1) ou seguinte (+1). */
export function periodoVizinho(p: Periodo, direcao: -1 | 1, diaInicio = 1): Periodo {
  return periodoDe(direcao < 0 ? somarDias(p.inicio, -1) : somarDias(p.fim, 1), diaInicio);
}

export function dentroDoPeriodo(iso: string, p: Periodo): boolean {
  return iso >= p.inicio && iso <= p.fim;
}

/** Dias de campo de `de` até `ate` (inclusive). */
export function contarDiasDeCampo(de: string, ate: string, ehDiaDeCampo: (iso: string) => boolean): number {
  let n = 0;
  for (let d = de; d <= ate; d = somarDias(d, 1)) if (ehDiaDeCampo(d)) n++;
  return n;
}
