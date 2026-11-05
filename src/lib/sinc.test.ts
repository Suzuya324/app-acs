import { describe, expect, it } from 'vitest';
import type { Dados } from './cofre';
import { juntarDados } from './juntar';
import { CONFIG_PADRAO } from './rotulos';
import {
  abrirSinc,
  ChavesSinc,
  cifrarSinc,
  criarArquivoConexao,
  ErroGitHub,
  GitHub,
  lerArquivoConexao,
  limparRepo,
  mesmoConteudo,
  SenhaSincErrada,
} from './sinc';
import type { Familia, Visita } from './tipos';

const fam = (id: string, extra: Partial<Familia> = {}): Familia => ({
  id, rua: 'Rua Teste', numero: id, complemento: '', bairro: '', colmeia: '', prontuario: '', situacaoCasa: 'habitada', obs: '',
  responsavelId: '', moradores: [], ...extra,
});
const vd = (id: string, familiaId: string, extra: Partial<Visita> = {}): Visita => ({
  id, familiaId, data: '2026-11-03', presentes: [], conversouComFamilia: true, desfecho: 'realizada', motivo: 'Outros',
  compartilhadaCom: '', sinais: {}, orientacoes: '', relato: 'Relato inventado', lancadaNoFast: false, ...extra,
});
const dados = (extra: Partial<Dados> = {}): Dados => ({
  config: { ...CONFIG_PADRAO, nomeAcs: 'Agente Teste' }, familias: [fam('f1')], visitas: [vd('v1', 'f1')], historico: [], revisitas: [], lixeira: [],
  rascunho: null, ...extra,
});
const ITER = 1000; // poucas repetições: só para o teste ser rápido

/** GitHub de mentira, na memória. */
function githubFalso() {
  const objetos = new Map<string, unknown>();
  let cabeca: string | null = null;
  let n = 0;
  const novo = (o: unknown) => {
    const sha = `sha${++n}`;
    objetos.set(sha, o);
    return sha;
  };
  const resp = (status: number, corpo: unknown) => new Response(JSON.stringify(corpo), { status });
  const f = (async (url: string, init: RequestInit = {}) => {
    const caminho = url.replace('https://api.github.com/repos/eu/dados', '');
    const metodo = init.method ?? 'GET';
    const corpo = init.body ? JSON.parse(init.body as string) : null;
    if (caminho === '') return resp(200, { private: true, default_branch: 'main', permissions: { push: true } });
    if (caminho === '/git/ref/heads/main') return cabeca ? resp(200, { object: { sha: cabeca } }) : resp(409, { message: 'Git Repository is empty.' });
    if (caminho === '/contents/dados.json' && metodo === 'PUT') {
      const blob = novo({ content: corpo.content });
      const tree = novo({ tree: [{ path: 'dados.json', sha: blob, type: 'blob' }] });
      cabeca = novo({ tree: { sha: tree } });
      return resp(201, { commit: { sha: cabeca } });
    }
    if (caminho === '/git/blobs' && metodo === 'POST') return resp(201, { sha: novo({ content: corpo.content }) });
    if (caminho === '/git/trees' && metodo === 'POST') return resp(201, { sha: novo({ tree: corpo.tree.map((t: { path: string; sha: string }) => ({ ...t, type: 'blob' })) }) });
    if (caminho === '/git/commits' && metodo === 'POST') return resp(201, { sha: novo({ tree: { sha: corpo.tree }, parents: corpo.parents }) });
    if (caminho === '/git/refs/heads/main' && metodo === 'PATCH') {
      cabeca = corpo.sha;
      return resp(200, {});
    }
    const m = caminho.match(/^\/git\/(commits|trees|blobs)\/(.+)$/);
    if (m && objetos.has(m[2])) {
      const o = objetos.get(m[2]) as Record<string, unknown>;
      return resp(200, m[1] === 'blobs' ? { content: o.content, encoding: 'base64' } : o);
    }
    return resp(404, { message: 'Not Found' });
  }) as typeof fetch;
  return { f, objetos: () => objetos.size };
}

describe('sincronização', () => {
  it('criptografa e abre com a mesma senha; a VD pela metade não vai para a nuvem', async () => {
    const d = dados({ rascunho: { familiaId: 'f1' } as Dados['rascunho'] });
    const { texto } = await cifrarSinc(d, new ChavesSinc('senha-de-teste-123'), 'Celular', null, ITER);
    expect(texto).not.toContain('Relato inventado');
    expect(texto).not.toContain('Agente Teste');
    const aberto = await abrirSinc(texto, new ChavesSinc('senha-de-teste-123'));
    expect(aberto.dados.visitas[0].relato).toBe('Relato inventado');
    expect(aberto.dados.rascunho).toBeNull();
    expect(aberto.aparelho).toBe('Celular');
  });

  it('senha errada não abre', async () => {
    const { texto } = await cifrarSinc(dados(), new ChavesSinc('senha-certa-123'), 'PC', null, ITER);
    await expect(abrirSinc(texto, new ChavesSinc('senha-errada-123'))).rejects.toThrow(SenhaSincErrada);
  });

  it('mesmo conteúdo ignora a ordem das listas e a VD pela metade', () => {
    const a = dados({ familias: [fam('f1'), fam('f2')] });
    const b = dados({ familias: [fam('f2'), fam('f1')], rascunho: { familiaId: 'f1' } as Dados['rascunho'] });
    expect(mesmoConteudo(a, b)).toBe(true);
    expect(mesmoConteudo(a, dados())).toBe(false);
  });

  it('dois aparelhos: o que um grava, o outro lê e junta', async () => {
    const gh = githubFalso();
    const chaves = new ChavesSinc('senha-de-teste-123');
    const celular = new GitHub('eu/dados', 'token', gh.f);
    expect(await celular.ler()).toBeNull(); // repositório vazio
    const dCel = dados({ visitas: [vd('v1', 'f1'), vd('v2', 'f1')] });
    const { texto } = await cifrarSinc(dCel, chaves, 'Celular', null, ITER);
    const c1 = await celular.gravar(texto, 'Celular');

    const pc = new GitHub('eu/dados', 'token', gh.f);
    const remoto = await pc.ler();
    expect(remoto?.commit).toBe(c1);
    const aberto = await abrirSinc(remoto!.texto, chaves);
    const dPc = dados({ visitas: [vd('v1', 'f1'), vd('v3', 'f1')] });
    const { dados: junto } = juntarDados(dPc, aberto.dados);
    expect(junto.visitas.map((v) => v.id).sort()).toEqual(['v1', 'v2', 'v3']);
    const { texto: t2 } = await cifrarSinc(junto, chaves, 'PC', aberto.sal, ITER);
    const c2 = await pc.gravar(t2, 'PC');
    expect(c2).not.toBe(c1);
    expect((await abrirSinc((await celular.ler())!.texto, chaves)).dados.visitas).toHaveLength(3);
  });

  it('erros do GitHub viram mensagens em português', async () => {
    const f = (async () => new Response('{"message":"Bad credentials"}', { status: 401 })) as typeof fetch;
    await expect(new GitHub('eu/dados', 'x', f).info()).rejects.toThrow(/chave do GitHub não vale/);
    const semRede = (async () => {
      throw new TypeError('Failed to fetch');
    }) as typeof fetch;
    const erro = await new GitHub('eu/dados', 'x', semRede).info().catch((e) => e);
    expect(erro).toBeInstanceOf(ErroGitHub);
    expect(erro.status).toBe(0);
  });

  it('arquivo de conexão abre só com a senha', async () => {
    const cfg = { repo: 'eu/dados', token: 'github_pat_inventado', senha: 'senha-de-teste-123', aparelho: 'Celular' };
    const t = await criarArquivoConexao(cfg);
    expect(t).not.toContain('github_pat_inventado');
    expect(await lerArquivoConexao(t, 'senha-de-teste-123')).toEqual({ repo: 'eu/dados', token: 'github_pat_inventado' });
    await expect(lerArquivoConexao(t, 'outra-senha-1234')).rejects.toThrow(SenhaSincErrada);
  });

  it('aceita o endereço inteiro do repositório', () => {
    expect(limparRepo(' https://github.com/Fulano/facilitador-dados.git/ ')).toBe('Fulano/facilitador-dados');
    expect(limparRepo('fulano/dados')).toBe('fulano/dados');
  });
});
