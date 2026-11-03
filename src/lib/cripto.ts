// Criptografia dos dados com a Web Crypto (já vem no navegador; nada baixado de fora).
// - A chave é derivada do PIN com PBKDF2-SHA256 (muitas repetições = atrasa quem tenta adivinhar).
// - Os dados são embaralhados com AES-GCM 256 (se alguém mexer no arquivo, a abertura falha).
// - A chave existe só na memória enquanto o app está desbloqueado. Nunca é gravada.

/** Repetições do PBKDF2. Mais = mais seguro, porém mais lento para abrir (~1 s num celular comum). */
export const ITERACOES_PADRAO = 600_000;

export interface Cifrado {
  /** Vetor de inicialização (12 bytes, novo a cada gravação). */
  iv: Uint8Array;
  dados: Uint8Array;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

export function bytesAleatorios(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n));
}

export async function derivarChave(pin: string, sal: Uint8Array, iteracoes = ITERACOES_PADRAO): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: sal as BufferSource, iterations: iteracoes, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false, // a chave não pode ser exportada
    ['encrypt', 'decrypt'],
  );
}

export async function cifrar(chave: CryptoKey, valor: unknown): Promise<Cifrado> {
  const iv = bytesAleatorios(12);
  const texto = enc.encode(JSON.stringify(valor));
  const dados = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, chave, texto));
  return { iv, dados };
}

/** Lança erro se a chave estiver errada ou os dados tiverem sido alterados. */
export async function decifrar<T>(chave: CryptoKey, c: Cifrado): Promise<T> {
  const texto = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: c.iv as BufferSource }, chave, c.dados as BufferSource);
  return JSON.parse(dec.decode(texto)) as T;
}

// ---- Conversão para texto (usada no arquivo de backup) ----

export function paraBase64(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}

export function deBase64(t: string): Uint8Array {
  const s = atob(t);
  const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
  return b;
}

// ---- Regras do PIN ----

/** Avalia o PIN. Retorna uma mensagem de problema, ou '' se estiver bom. */
export function problemaNoPin(pin: string): string {
  if (!/^\d+$/.test(pin)) return 'Use só números.';
  if (pin.length < 6) return 'O PIN precisa ter pelo menos 6 números.';
  if (/^(\d)\1+$/.test(pin)) return 'Não use o mesmo número repetido (ex.: 111111).';
  const seq = '01234567890';
  const seqInv = '09876543210';
  if (seq.includes(pin) || seqInv.includes(pin)) return 'Não use números em sequência (ex.: 123456).';
  return '';
}

/** Espera (em segundos) antes da próxima tentativa, depois de `erros` PINs errados seguidos. */
export function esperaAposErros(erros: number): number {
  if (erros < 3) return 0;
  return Math.min(300, 5 * 2 ** (erros - 3)); // 5 s, 10 s, 20 s, 40 s… até 5 minutos
}
