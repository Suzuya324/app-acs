// Sincronização entre os aparelhos do próprio ACS (celular, tablet, computador).
// Só sai do aparelho uma cópia CRIPTOGRAFADA com a "senha de sincronização", guardada num
// repositório PRIVADO do GitHub do próprio ACS. O GitHub nunca vê os dados legíveis.
// A junção usa a mesma regra do "Juntar backup": nada é apagado, vale a alteração mais recente.
import type { Dados } from './cofre';
import { bytesAleatorios, deBase64, derivarChave, ITERACOES_PADRAO, paraBase64 } from './cripto';

export interface ConfigSinc {
  /** "usuario/repositorio" (privado). */
  repo: string;
  /** Chave de acesso do GitHub (fine-grained token, só Contents deste repositório). */
  token: string;
  /** Senha de sincronização (a mesma em todos os aparelhos). */
  senha: string;
  /** Nome deste aparelho, ex.: "Celular". */
  aparelho: string;
}

export const FORMATO_SINC = 'facilitador-sinc';
const ARQUIVO = 'dados.json';

interface ArquivoSinc {
  formato: typeof FORMATO_SINC;
  versao: 1;
  atualizadoEm: string;
  aparelho: string;
  sal: string;
  iteracoes: number;
  iv: string;
  /** Os dados foram comprimidos (gzip) antes de criptografar. */
  gz: boolean;
  dados: string;
}

export class SenhaSincErrada extends Error {
  constructor() {
    super('A senha de sincronização não confere com a dos outros aparelhos.');
  }
}
export class ArquivoSincInvalido extends Error {
  constructor(mensagem = 'O arquivo na nuvem não é do Facilitador de VDs.') {
    super(mensagem);
  }
}

/** O arquivo escolhido para ligar o aparelho não é o de conexão. */
function naoEConexao(texto: string): ArquivoSincInvalido {
  const t = texto.trim();
  const qual = t.includes('facilitador-importacao')
    ? 'Esse é o arquivo do Sistema de Visitas, não o de conexão.'
    : t.includes('app-acs-backup')
      ? 'Esse é um arquivo de backup, não o de conexão.'
      : 'Esse não é o arquivo de conexão.';
  return new ArquivoSincInvalido(`${qual} No outro aparelho, toque em “Salvar arquivo para ligar outro aparelho” e use o arquivo conexao-facilitador.`);
}
export class ErroGitHub extends Error {
  constructor(
    public status: number,
    mensagem: string,
  ) {
    super(mensagem);
  }
}

const enc = new TextEncoder();
const dec = new TextDecoder();

// ---------------------------------------------------------------- compressão

async function passarPor(bytes: Uint8Array, stream: { writable: WritableStream<Uint8Array>; readable: ReadableStream<Uint8Array> }): Promise<Uint8Array> {
  const escritor = stream.writable.getWriter();
  void escritor.write(bytes as Uint8Array<ArrayBuffer>);
  void escritor.close();
  return new Uint8Array(await new Response(stream.readable).arrayBuffer());
}
const temGzip = () => typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';
const comprimir = (b: Uint8Array) => passarPor(b, new CompressionStream('gzip') as never);
const descomprimir = (b: Uint8Array) => passarPor(b, new DecompressionStream('gzip') as never);

// ---------------------------------------------------------------- criptografia

/** Guarda na memória a chave derivada da senha (o PBKDF2 é lento de propósito: não recalcula a cada vez). */
export class ChavesSinc {
  private cache = new Map<string, Promise<CryptoKey>>();
  constructor(private senha: string) {}
  chave(sal: string, iteracoes: number): Promise<CryptoKey> {
    const k = `${sal}:${iteracoes}`;
    let c = this.cache.get(k);
    if (!c) {
      c = derivarChave(this.senha, deBase64(sal), iteracoes);
      this.cache.set(k, c);
    }
    return c;
  }
}

/** O que vai para a nuvem: tudo, menos a VD pela metade (essa fica só no aparelho). */
export function paraSinc(d: Dados): Dados {
  return { ...d, rascunho: null };
}

/**
 * Criptografa os dados para a nuvem. Reaproveita o "sal" do arquivo que já está lá
 * (assim a chave fica na memória e não precisa ser recalculada).
 */
export async function cifrarSinc(
  dados: Dados,
  chaves: ChavesSinc,
  aparelho: string,
  sal: string | null,
  iteracoes = ITERACOES_PADRAO,
): Promise<{ texto: string; sal: string }> {
  const s = sal ?? paraBase64(bytesAleatorios(16));
  const chave = await chaves.chave(s, iteracoes);
  const gz = temGzip();
  const bruto = enc.encode(JSON.stringify(paraSinc(dados)));
  const conteudo = gz ? await comprimir(bruto) : bruto;
  const iv = bytesAleatorios(12);
  const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, chave, conteudo as BufferSource));
  const arquivo: ArquivoSinc = {
    formato: FORMATO_SINC,
    versao: 1,
    atualizadoEm: new Date().toISOString(),
    aparelho,
    sal: s,
    iteracoes,
    iv: paraBase64(iv),
    gz,
    dados: paraBase64(cifrado),
  };
  return { texto: JSON.stringify(arquivo), sal: s };
}

export interface AbertoSinc {
  dados: Dados;
  sal: string;
  iteracoes: number;
  atualizadoEm: string;
  aparelho: string;
}

export async function abrirSinc(texto: string, chaves: ChavesSinc): Promise<AbertoSinc> {
  let a: ArquivoSinc;
  try {
    a = JSON.parse(texto);
  } catch {
    throw new ArquivoSincInvalido();
  }
  if (a?.formato !== FORMATO_SINC || a.versao !== 1) throw new ArquivoSincInvalido();
  const chave = await chaves.chave(a.sal, a.iteracoes);
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: deBase64(a.iv) as BufferSource }, chave, deBase64(a.dados) as BufferSource));
  } catch {
    throw new SenhaSincErrada();
  }
  const dados = JSON.parse(dec.decode(a.gz ? await descomprimir(bytes) : bytes)) as Dados;
  if (!dados?.config || !Array.isArray(dados.familias) || !Array.isArray(dados.visitas)) throw new ArquivoSincInvalido();
  dados.historico ??= [];
  dados.revisitas ??= [];
  dados.lixeira ??= [];
  dados.casos ??= [];
  dados.prioritarios ??= [];
  dados.rascunho = null;
  return { dados, sal: a.sal, iteracoes: a.iteracoes, atualizadoEm: a.atualizadoEm, aparelho: a.aparelho };
}

/** Os dois têm o mesmo conteúdo (sem contar a VD pela metade e a ordem das listas)? */
export function mesmoConteudo(a: Dados, b: Dados): boolean {
  const porId = <T extends { id: string }>(l: T[] | undefined) => [...(l ?? [])].sort((x, y) => x.id.localeCompare(y.id));
  const canon = (d: Dados) =>
    JSON.stringify([
      d.config,
      porId(d.familias),
      porId(d.visitas),
      porId(d.historico),
      porId(d.revisitas),
      porId(d.lixeira),
      porId(d.casos),
      porId(d.prioritarios),
    ]);
  return canon(a) === canon(b);
}

// ---------------------------------------------------------------- arquivo de conexão

/** Para ligar outro aparelho sem digitar a chave do GitHub: arquivo com repositório e chave, trancado com a senha. */
export const FORMATO_CONEXAO = 'facilitador-conexao';

export async function criarArquivoConexao(cfg: ConfigSinc): Promise<string> {
  const sal = paraBase64(bytesAleatorios(16));
  const chave = await new ChavesSinc(cfg.senha).chave(sal, ITERACOES_PADRAO);
  const iv = bytesAleatorios(12);
  const cifrado = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, chave, enc.encode(JSON.stringify({ repo: cfg.repo, token: cfg.token })) as BufferSource),
  );
  return JSON.stringify({ formato: FORMATO_CONEXAO, versao: 1, sal, iteracoes: ITERACOES_PADRAO, iv: paraBase64(iv), dados: paraBase64(cifrado) });
}

export async function lerArquivoConexao(texto: string, senha: string): Promise<{ repo: string; token: string }> {
  let a: { formato?: string; sal: string; iteracoes: number; iv: string; dados: string };
  try {
    a = JSON.parse(texto.trim());
  } catch {
    throw naoEConexao(texto);
  }
  if (a?.formato !== FORMATO_CONEXAO) throw naoEConexao(texto);
  const chave = await new ChavesSinc(senha).chave(a.sal, a.iteracoes);
  try {
    const b = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: deBase64(a.iv) as BufferSource }, chave, deBase64(a.dados) as BufferSource);
    return JSON.parse(dec.decode(b));
  } catch {
    throw new SenhaSincErrada();
  }
}

// ---------------------------------------------------------------- GitHub

export interface Remoto {
  /** Versão (commit) do arquivo na nuvem. */
  commit: string;
  texto: string;
}

export interface InfoRepo {
  privado: boolean;
  podeGravar: boolean;
  ramo: string;
}

const MENSAGENS: Record<number, string> = {
  401: 'A chave do GitHub não vale (errada ou vencida). Crie uma nova no GitHub e use Ajustes → Sincronizar aparelhos → Trocar a chave.',
  403: 'A chave do GitHub não tem permissão para gravar neste repositório (precisa de "Contents: Read and write").',
  404: 'Não achei o repositório. Confira o nome (ex.: seu-usuario/facilitador-dados) e se a chave tem acesso a ele.',
};

/**
 * Fala com a API do GitHub. Guarda só a versão mais recente do arquivo (cada envio troca a anterior),
 * para o repositório não crescer sem parar.
 */
export class GitHub {
  private ramo: string | null = null;
  constructor(
    private repo: string,
    private token: string,
    private f: typeof fetch = (...a) => fetch(...a),
  ) {}

  private async api<T>(caminho: string, init: RequestInit = {}): Promise<T> {
    let r: Response;
    try {
      r = await this.f(`https://api.github.com/repos/${this.repo}${caminho}`, {
        ...init,
        cache: 'no-store',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${this.token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        },
      });
    } catch {
      throw new ErroGitHub(0, 'Sem internet agora. Sincroniza quando a conexão voltar.');
    }
    if (!r.ok) {
      let msg = '';
      try {
        msg = ((await r.json()) as { message?: string }).message ?? '';
      } catch {
        /* sem corpo */
      }
      throw new ErroGitHub(r.status, MENSAGENS[r.status] ?? `Erro do GitHub (${r.status}${msg ? `: ${msg}` : ''}).`);
    }
    return (await r.json()) as T;
  }

  async info(): Promise<InfoRepo> {
    const r = await this.api<{ private: boolean; default_branch: string; permissions?: { push?: boolean } }>('');
    this.ramo = r.default_branch || 'main';
    return { privado: r.private, podeGravar: r.permissions?.push !== false, ramo: this.ramo };
  }

  private async ramoAtual(): Promise<string> {
    return this.ramo ?? (await this.info()).ramo;
  }

  /** Versão atual na nuvem (commit), ou null se o repositório ainda está vazio. */
  async versao(): Promise<string | null> {
    const ramo = await this.ramoAtual();
    try {
      const r = await this.api<{ object: { sha: string } }>(`/git/ref/heads/${encodeURIComponent(ramo)}`);
      return r.object.sha;
    } catch (e) {
      if (e instanceof ErroGitHub && (e.status === 404 || e.status === 409)) return null; // repositório vazio
      throw e;
    }
  }

  /** Lê o arquivo de dados da nuvem (ou null se ainda não existe). */
  async ler(): Promise<Remoto | null> {
    const commit = await this.versao();
    return commit ? this.lerVersao(commit) : null;
  }

  /** Lê o arquivo de uma versão (commit) já conhecida. */
  async lerVersao(commit: string): Promise<Remoto | null> {
    const c = await this.api<{ tree: { sha: string } }>(`/git/commits/${commit}`);
    const t = await this.api<{ tree: { path: string; sha: string; type: string }[] }>(`/git/trees/${c.tree.sha}`);
    const item = t.tree.find((x) => x.path === ARQUIVO && x.type === 'blob');
    if (!item) return null;
    const b = await this.api<{ content: string; encoding: string }>(`/git/blobs/${item.sha}`);
    const texto = b.encoding === 'base64' ? dec.decode(deBase64(b.content.replace(/\s/g, ''))) : b.content;
    return { commit, texto };
  }

  /** Grava o arquivo como a única versão (sem guardar as anteriores). Devolve a nova versão (commit). */
  async gravar(texto: string, aparelho: string): Promise<string> {
    const ramo = await this.ramoAtual();
    const conteudo = paraBase64(enc.encode(texto));
    const mensagem = `Sincronização (${aparelho})`;
    if (!(await this.versao())) {
      // Repositório vazio: o primeiro arquivo precisa ser criado pela API de conteúdo.
      const r = await this.api<{ commit: { sha: string } }>(`/contents/${ARQUIVO}`, {
        method: 'PUT',
        body: JSON.stringify({ message: mensagem, content: conteudo, branch: ramo }),
      });
      return r.commit.sha;
    }
    const blob = await this.api<{ sha: string }>('/git/blobs', { method: 'POST', body: JSON.stringify({ content: conteudo, encoding: 'base64' }) });
    const arvore = await this.api<{ sha: string }>('/git/trees', {
      method: 'POST',
      body: JSON.stringify({ tree: [{ path: ARQUIVO, mode: '100644', type: 'blob', sha: blob.sha }] }),
    });
    const commit = await this.api<{ sha: string }>('/git/commits', {
      method: 'POST',
      body: JSON.stringify({ message: mensagem, tree: arvore.sha, parents: [] }),
    });
    await this.api(`/git/refs/heads/${encodeURIComponent(ramo)}`, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha, force: true }) });
    return commit.sha;
  }
}

/** "usuario/repositorio" a partir do que o ACS colar (aceita o endereço inteiro do GitHub). */
export function limparRepo(t: string): string {
  return t
    .trim()
    .replace(/[\s,;'"]+/g, '')
    .replace(/^https?:\/\/github\.com\//i, '')
    .replace(/\/+$/, '')
    .replace(/\.git$/i, '')
    .split('/')
    .slice(0, 2)
    .join('/');
}
