// Edição do app. A "completa" é a do ACS (endereço …/app-acs/). A "básica" é uma cópia separada para colegas
// testarem (endereço …/app-acs/basico/): outro nome, outro ícone na tela, OUTRO banco de dados no aparelho
// (as duas nunca se misturam, nem no mesmo celular) e só as funções essenciais.
// A básica é montada com `vite build --mode basica`.

export const EDICAO_BASICA = import.meta.env.MODE === 'basica';

/** Nome que aparece no topo, na tela do PIN e no ícone. */
export const NOME_APP = EDICAO_BASICA ? 'VDs básico' : 'Facilitador de VDs';

/** Nome do banco de dados no aparelho (cada edição tem o seu). */
export const NOME_BANCO = EDICAO_BASICA ? 'app-acs-basico' : 'app-acs';

/** Começo das chaves do armazenamento simples do navegador (cada edição tem as suas). */
export const PREFIXO_LOCAL = EDICAO_BASICA ? 'basico.facilitador' : 'facilitador';
