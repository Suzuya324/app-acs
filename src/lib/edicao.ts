// Edição do app. A "completa" é a do ACS (endereço …/app-acs/). A "básica" é um app SEPARADO para colegas
// testarem (endereço …/app-acs/basico/): outro nome, outro ícone na tela, OUTRO banco de dados no aparelho
// (as duas nunca se misturam, nem no mesmo celular) e só as funções essenciais.
// A básica é montada com `vite build --mode basica`.
// ATENÇÃO: nunca mudar o banco nem as chaves de uma edição (quem usa perderia o acesso aos dados) e nunca fazer
// as duas usarem o mesmo banco. O teste edicao.test.ts confere isso antes de cada publicação.

export interface Edicao {
  basica: boolean;
  /** Nome que aparece no topo, na tela do PIN e no ícone. */
  nome: string;
  /** Nome do banco de dados no aparelho (cada edição tem o seu). */
  banco: string;
  /** Começo das chaves do armazenamento simples do navegador (cada edição tem as suas). */
  prefixo: string;
}

export function edicaoDoModo(modo: string): Edicao {
  return modo === 'basica'
    ? { basica: true, nome: 'VDs básico', banco: 'app-acs-basico', prefixo: 'basico.facilitador' }
    : { basica: false, nome: 'Facilitador de VDs', banco: 'app-acs', prefixo: 'facilitador' };
}

const EDICAO = edicaoDoModo(import.meta.env.MODE);

/** Assinatura do autor, mostrada no canto de baixo do app (nas duas edições). */
export const AUTOR = 'KAWAN A. S. DEL GRECCO';

export const EDICAO_BASICA = EDICAO.basica;
export const NOME_APP = EDICAO.nome;
export const NOME_BANCO = EDICAO.banco;
export const PREFIXO_LOCAL = EDICAO.prefixo;
