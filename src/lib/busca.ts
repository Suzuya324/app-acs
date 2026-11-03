import type { Familia, Morador } from './tipos';

/** Tira acentos, deixa minúsculo e remove pontuação extra. */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9/.\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Palavras que não ajudam a achar a rua. */
const PALAVRAS_IGNORADAS = new Set([
  'r', 'r.', 'rua', 'av', 'av.', 'avenida', 'tv', 'travessa', 'trav', 'trav.',
  'de', 'da', 'do', 'das', 'dos', 'e', 'n', 'no', 'n.', 'nº', 'numero',
]);

function palavras(texto: string): string[] {
  return normalizar(texto).split(' ').filter(Boolean);
}

function palavrasUteis(texto: string): string[] {
  return palavras(texto).filter((p) => !PALAVRAS_IGNORADAS.has(p));
}

/** Cada palavra da busca precisa ser o começo de alguma palavra do alvo. */
function todasComecam(busca: string[], alvo: string[]): boolean {
  return busca.every((b) => alvo.some((a) => a.startsWith(b)));
}

export interface ResultadoBusca {
  familia: Familia;
  /** Por que esta família apareceu. */
  motivo: 'endereco' | 'nome' | 'prontuario';
  /** Moradores cujo nome bateu com a busca (quando motivo = nome). */
  moradores: Morador[];
}

/**
 * Busca única: acha a família por "rua + número" ("Acácias 90", "Ipe 310", "ac 90"),
 * pelo nome de um morador ou pelo prontuário.
 */
export function buscar(familias: Familia[], consulta: string): ResultadoBusca[] {
  const q = normalizar(consulta);
  if (!q) return [];

  const termos = palavrasUteis(q);
  const numeros = termos.filter((t) => /^\d+$/.test(t) || t === 's/n' || t === 'sn');
  const textos = termos.filter((t) => !numeros.includes(t));
  const numero = numeros[0]?.replace(/^sn$/, 's/n');
  const qCompacto = q.replace(/\s/g, '');

  const resultados: ResultadoBusca[] = [];

  for (const f of familias) {
    // 1) Endereço: texto bate com a rua e número bate com o número da casa.
    const palavrasRua = palavrasUteis(f.rua);
    const numCasa = normalizar(f.numero);
    const ruaOk = textos.length > 0 && todasComecam(textos, palavrasRua);
    const numeroOk = numero !== undefined && numCasa === numero;

    if (ruaOk && (numero === undefined || numeroOk)) {
      resultados.push({ familia: f, motivo: 'endereco', moradores: [] });
      continue;
    }
    const soNumero = textos.length === 0 && numeros.length === 1;
    if (soNumero && numeroOk) {
      resultados.push({ familia: f, motivo: 'endereco', moradores: [] });
      continue;
    }

    // 2) Prontuário: só números (3 ou mais dígitos) ou com ponto, ex.: "04.0123".
    const pront = normalizar(f.prontuario).replace(/\s/g, '');
    const prontDigitos = pront.replace(/\D/g, '');
    const porDigitos = soNumero && qCompacto.length >= 3 && prontDigitos.includes(qCompacto);
    const comPonto = /\d/.test(qCompacto) && qCompacto.includes('.') && pront.includes(qCompacto);
    if (pront && (porDigitos || comPonto)) {
      resultados.push({ familia: f, motivo: 'prontuario', moradores: [] });
      continue;
    }

    // 3) Nome de morador.
    if (textos.length > 0 && numeros.length === 0) {
      const achados = f.moradores.filter((m) => todasComecam(palavras(q), palavras(m.nome)));
      if (achados.length) {
        resultados.push({ familia: f, motivo: 'nome', moradores: achados });
      }
    }
  }

  return resultados;
}
