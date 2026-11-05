// Números de prontuário: quais números da micro estão em uso pelas famílias do app, quais estão livres
// para criar pasta física nova, e a conferência com as pastas que estão na colmeia.
// Tudo calculado no aparelho; nada é enviado.
import { prontuarioIncompleto } from './pendencias';
import type { Familia } from './tipos';

export interface PartesProntuario {
  /** Micro com 2 dígitos, ex.: "04". */
  micro: string;
  numero: number;
  /** Quantos dígitos tinha o número (para escrever do mesmo jeito: 123 → "123" ou "0123"). */
  digitos: number;
}

/** "04.123" → { micro: "04", numero: 123 }. Prontuário vazio ou incompleto ("04.") → null. */
export function partesProntuario(p: string): PartesProntuario | null {
  const m = p.trim().match(/^(\d{1,3})\s*[.\-/]\s*(\d+)$/);
  if (!m) return null;
  return { micro: m[1].padStart(2, '0'), numero: Number(m[2]), digitos: m[2].length };
}

/** Micros encontradas nos prontuários, da mais comum para a menos comum. */
export function microsEncontradas(familias: Familia[]): { micro: string; familias: number }[] {
  const n = new Map<string, number>();
  for (const f of familias) {
    const p = partesProntuario(f.prontuario);
    if (p) n.set(p.micro, (n.get(p.micro) ?? 0) + 1);
  }
  return [...n].map(([micro, familias]) => ({ micro, familias })).sort((a, b) => b.familias - a.familias || a.micro.localeCompare(b.micro));
}

/** Micro do ACS: a escrita nos ajustes ("Micro 04") se bater com algum prontuário; senão, a mais comum. */
export function microPrincipal(familias: Familia[], configMicro = ''): string {
  const achadas = microsEncontradas(familias);
  const doAjuste = configMicro.match(/\d{1,3}/)?.[0]?.padStart(2, '0');
  if (doAjuste && achadas.some((a) => a.micro === doAjuste)) return doAjuste;
  return achadas[0]?.micro ?? doAjuste ?? '';
}

/**
 * Lê números digitados: "1, 2, 5-10, 12 a 15, 04.123". Ignora o que não for número.
 * Intervalos muito grandes (mais de 2000) são ignorados para não travar.
 */
export function lerNumeros(texto: string): number[] {
  const nums = new Set<number>();
  const limpo = texto.replace(/\b\d{1,3}\s*[.]\s*(\d+)/g, '$1'); // "04.123" → "123"
  const re = /(\d+)(?:\s*(?:-|–|a|até)\s*(\d+))?/g;
  for (const m of limpo.matchAll(re)) {
    const a = Number(m[1]);
    const b = m[2] !== undefined ? Number(m[2]) : a;
    const [de, ate] = a <= b ? [a, b] : [b, a];
    if (ate - de > 2000) continue;
    for (let i = de; i <= ate; i++) if (i > 0) nums.add(i);
  }
  return [...nums].sort((x, y) => x - y);
}

/** Junta números em intervalos para mostrar curto: [1,2,3,5,7,8] → "1–3, 5, 7–8". */
export function emIntervalos(nums: number[]): string {
  const s = [...new Set(nums)].sort((a, b) => a - b);
  const partes: string[] = [];
  for (let i = 0; i < s.length; i++) {
    let j = i;
    while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++;
    partes.push(j > i ? `${s[i]}–${s[j]}` : `${s[i]}`);
    i = j;
  }
  return partes.join(', ');
}

export interface AnaliseNumeros {
  micro: string;
  /** Número → famílias do app com esse número (na micro escolhida). */
  usados: Map<number, Familia[]>;
  /** Números usados por mais de uma família (erro provável). */
  repetidos: { numero: number; familias: Familia[] }[];
  /** Famílias com prontuário de outra micro. */
  outraMicro: Familia[];
  /** Famílias sem prontuário ou com prontuário incompleto. */
  semNumero: Familia[];
  /** Maior número em uso (pelas famílias ou pelas pastas da colmeia). */
  maior: number;
  /** Livres de 1 até o maior, sem família e sem pasta na colmeia: usar primeiro. */
  livres: number[];
  /** Livres, mas ainda com pasta antiga na colmeia (de quem não é da sua área): liberam ao tirar a pasta. */
  livresComPasta: number[];
  /** Conferência da colmeia (só quando as pastas foram digitadas). */
  colmeia: null | {
    /** Pastas na colmeia sem nenhuma família sua com esse número: tirar da colmeia. */
    sobrando: number[];
    /** Famílias suas (habitadas) que não têm pasta na colmeia: criar a pasta física. */
    semPasta: { numero: number; familia: Familia }[];
  };
  /** Quantos dígitos usar ao escrever um número novo (o mais comum na micro). */
  digitos: number;
}

export function analisarNumeros(familias: Familia[], micro: string, pastasNaColmeia: number[] = []): AnaliseNumeros {
  const usados = new Map<number, Familia[]>();
  const outraMicro: Familia[] = [];
  const semNumero: Familia[] = [];
  const contDigitos = new Map<number, number>();
  for (const f of familias) {
    const p = partesProntuario(f.prontuario);
    if (!p) {
      if (!f.prontuario.trim() || prontuarioIncompleto(f.prontuario)) semNumero.push(f);
      continue;
    }
    if (p.micro !== micro) {
      outraMicro.push(f);
      continue;
    }
    usados.set(p.numero, [...(usados.get(p.numero) ?? []), f]);
    contDigitos.set(p.digitos, (contDigitos.get(p.digitos) ?? 0) + 1);
  }
  const pastas = new Set(pastasNaColmeia);
  const maior = Math.max(0, ...usados.keys(), ...pastas);
  const livres: number[] = [];
  const livresComPasta: number[] = [];
  for (let n = 1; n <= maior; n++) {
    if (usados.has(n)) continue;
    (pastas.has(n) ? livresComPasta : livres).push(n);
  }
  const repetidos = [...usados].filter(([, fs]) => fs.length > 1).map(([numero, fs]) => ({ numero, familias: fs })).sort((a, b) => a.numero - b.numero);
  const colmeia = pastas.size
    ? {
        sobrando: [...pastas].filter((n) => !usados.has(n)).sort((a, b) => a - b),
        semPasta: [...usados]
          .filter(([n]) => !pastas.has(n))
          .flatMap(([numero, fs]) => fs.filter((f) => f.situacaoCasa === 'habitada').map((familia) => ({ numero, familia })))
          .sort((a, b) => a.numero - b.numero),
      }
    : null;
  const digitos = [...contDigitos].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 3;
  return { micro, usados, repetidos, outraMicro, semNumero, maior, livres, livresComPasta, colmeia, digitos };
}

/** Próximo número para uma pasta nova: o primeiro livre sem pasta; se não houver, o seguinte ao maior. */
export function proximoLivre(a: AnaliseNumeros): number {
  return a.livres[0] ?? a.maior + 1;
}

/** Escreve o prontuário no mesmo formato da micro: (04, 7, 3 dígitos) → "04.007". */
export function escreverProntuario(micro: string, numero: number, digitos: number): string {
  return `${micro}.${String(numero).padStart(digitos, '0')}`;
}
