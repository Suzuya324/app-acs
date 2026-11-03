// Funções de data. Trabalhamos sempre com texto "aaaa-mm-dd" (data local, sem fuso).

export function paraISO(d: Date): string {
  const a = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${a}-${m}-${dia}`;
}

export function deISO(iso: string): Date {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d);
}

export function hojeISO(): string {
  return paraISO(new Date());
}

/** "03/11/2026" */
export function formatarData(iso: string): string {
  if (!iso) return '';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

/** "terça-feira, 03/11/2026" */
export function formatarDataLonga(iso: string, maiuscula = false): string {
  const d = deISO(iso);
  const dia = DIAS[d.getDay()];
  const sufixo = d.getDay() === 0 || d.getDay() === 6 ? '' : '-feira';
  const texto = `${dia}${sufixo}, ${formatarData(iso)}`;
  return maiuscula ? texto[0].toUpperCase() + texto.slice(1) : texto;
}

export function nomeMes(iso: string): string {
  return MESES[deISO(iso).getMonth()];
}

/** "2026-11" */
export function mesDe(iso: string): string {
  return iso.slice(0, 7);
}

export function somarDias(iso: string, n: number): string {
  const d = deISO(iso);
  d.setDate(d.getDate() + n);
  return paraISO(d);
}

export function diferencaDias(deIso: string, ateIso: string): number {
  const ms = deISO(ateIso).getTime() - deISO(deIso).getTime();
  return Math.round(ms / 86_400_000);
}

export function ehDiaUtil(iso: string): boolean {
  const dia = deISO(iso).getDay();
  return dia !== 0 && dia !== 6;
}

/** Dias úteis (seg a sex) de `iso` até o fim do mês, contando o próprio dia. */
export function diasUteisAteFimDoMes(iso: string): number {
  let n = 0;
  let atual = iso;
  const mes = mesDe(iso);
  while (mesDe(atual) === mes) {
    if (ehDiaUtil(atual)) n++;
    atual = somarDias(atual, 1);
  }
  return n;
}

/** Segunda-feira da semana de `iso`. */
export function inicioDaSemana(iso: string): string {
  const dia = deISO(iso).getDay(); // 0 = domingo
  const voltar = dia === 0 ? 6 : dia - 1;
  return somarDias(iso, -voltar);
}

export function idade(nascimentoIso: string, referenciaIso: string): number | null {
  if (!nascimentoIso) return null;
  const n = deISO(nascimentoIso);
  const r = deISO(referenciaIso);
  let anos = r.getFullYear() - n.getFullYear();
  if (r.getMonth() < n.getMonth() || (r.getMonth() === n.getMonth() && r.getDate() < n.getDate())) {
    anos--;
  }
  return anos;
}
