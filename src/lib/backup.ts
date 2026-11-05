// Backup: um arquivo com TODOS os dados, criptografado com uma senha.
// Quem pegar o arquivo sem a senha não consegue ler nada.
import type { Dados } from './cofre';
import { bytesAleatorios, cifrar, decifrar, deBase64, derivarChave, ITERACOES_PADRAO, paraBase64 } from './cripto';

export const FORMATO_BACKUP = 'app-acs-backup';

interface ArquivoBackup {
  formato: typeof FORMATO_BACKUP;
  versao: 1;
  criadoEm: string;
  sal: string;
  iteracoes: number;
  iv: string;
  dados: string;
}

export class ArquivoInvalido extends Error {
  constructor() {
    super('Este arquivo não é um backup do Facilitador de VDs.');
  }
}
export class SenhaBackupErrada extends Error {
  constructor() {
    super('Senha do backup errada.');
  }
}

export async function criarBackup(dados: Dados, senha: string, iteracoes = ITERACOES_PADRAO): Promise<string> {
  const sal = bytesAleatorios(16);
  const chave = await derivarChave(senha, sal, iteracoes);
  const c = await cifrar(chave, dados);
  const arquivo: ArquivoBackup = {
    formato: FORMATO_BACKUP,
    versao: 1,
    criadoEm: new Date().toISOString(),
    sal: paraBase64(sal),
    iteracoes,
    iv: paraBase64(c.iv),
    dados: paraBase64(c.dados),
  };
  return JSON.stringify(arquivo);
}

export async function lerBackup(texto: string, senha: string): Promise<Dados> {
  let a: ArquivoBackup;
  try {
    a = JSON.parse(texto);
  } catch {
    throw new ArquivoInvalido();
  }
  if (a?.formato !== FORMATO_BACKUP || a.versao !== 1) throw new ArquivoInvalido();
  const chave = await derivarChave(senha, deBase64(a.sal), a.iteracoes);
  let dados: Dados;
  try {
    dados = await decifrar<Dados>(chave, { iv: deBase64(a.iv), dados: deBase64(a.dados) });
  } catch {
    throw new SenhaBackupErrada();
  }
  if (!dados?.config || !Array.isArray(dados.familias) || !Array.isArray(dados.visitas)) throw new ArquivoInvalido();
  if (!Array.isArray(dados.historico)) dados.historico = []; // backups antigos não tinham histórico
  dados.rascunho ??= null;
  if (!Array.isArray(dados.revisitas)) dados.revisitas = [];
  if (!Array.isArray(dados.lixeira)) dados.lixeira = [];
  return dados;
}

export function nomeArquivoBackup(hoje: string): string {
  return `backup-facilitador-${hoje}.json`;
}
