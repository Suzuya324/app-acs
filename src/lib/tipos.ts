// Tipos de dados do app (o "formato" de cada informação).

/** M, F, ou vazio quando não informado (ex.: veio em branco no CSV). */
export type Sexo = 'M' | 'F' | '';

export type SituacaoMorador = 'mora' | 'mudou' | 'nao_pertence' | 'faleceu' | 'recusa';

export type Grupo =
  | 'gestante'
  | 'puerpera'
  | 'crianca'
  | 'idoso'
  | 'acamado'
  | 'hipertenso'
  | 'diabetico'
  | 'deficiencia'
  | 'saude_mental'
  | 'outros';

export type SituacaoCasa =
  | 'habitada'
  | 'fechada'
  | 'vazia'
  | 'comercio'
  | 'demolida'
  | 'construcao';

export interface Morador {
  id: string;
  nome: string;
  sexo: Sexo;
  /** Data de nascimento no formato aaaa-mm-dd, ou vazio se não souber. */
  nascimento: string;
  situacao: SituacaoMorador;
  /** Desde quando está nessa situação (aaaa-mm-dd), ou vazio. */
  situacaoDesde: string;
  grupos: Grupo[];
  obs: string;
}

export interface Familia {
  id: string;
  rua: string;
  /** Número da casa ou "S/N". */
  numero: string;
  complemento: string;
  bairro: string;
  colmeia: string;
  /** Pode estar vazio ou incompleto (ex.: "04."). */
  prontuario: string;
  situacaoCasa: SituacaoCasa;
  obs: string;
  /** Id do morador responsável pela família, ou vazio. */
  responsavelId: string;
  /** Última alteração da família ou de algum morador (ISO). Usado para juntar backups. */
  atualizadoEm?: string;
  moradores: Morador[];
}

/** Volta marcada numa casa por um motivo (ex.: entregar guia de encaminhamento). */
export interface Revisita {
  id: string;
  familiaId: string;
  motivo: string;
  /** Data prevista (aaaa-mm-dd). */
  ate: string;
  criadaEm: string;
  /** Quando foi feita (aaaa-mm-dd), se já foi. */
  feitaEm?: string;
  /** VD em que foi feita. */
  visitaId?: string;
  /** Quando foi cancelada (ISO), se foi. */
  canceladaEm?: string;
}

/** Visita pela metade, guardada (criptografada) enquanto o ACS preenche. */
export interface RascunhoVD {
  familiaId: string;
  /** Preenchido quando é a correção de uma VD já salva. */
  visitaId?: string;
  salvoEm: string;
  data: string;
  presentes: string[];
  conversou: boolean;
  recusou: boolean;
  desfechoManual: Desfecho | null;
  motivo: string;
  compartilhada: boolean;
  compartilhadaCom: string;
  sinais: Record<string, SinaisVitais>;
  temas: string[];
  outrosTemas: string;
  relatoEditado: string | null;
  revisitasFeitas?: string[];
}

/** Um registro do histórico: o que mudou, quando e em qual família/morador. Nada é apagado. */
export interface Alteracao {
  id: string;
  /** Data e hora da alteração (ISO). */
  quando: string;
  familiaId: string;
  moradorId?: string;
  /** Texto para mostrar, ex.: "Ana: situação Mora aqui → Mudou-se (desde 03/11/2026)". */
  texto: string;
}

export type Desfecho = 'realizada' | 'ausente_realizada' | 'ausencia_completa' | 'recusa';

export interface SinaisVitais {
  pa?: string;
  temperatura?: string;
  peso?: string;
  altura?: string;
  glicemia?: string;
}

export interface Visita {
  id: string;
  familiaId: string;
  /** Data da visita no formato aaaa-mm-dd. */
  data: string;
  presentes: string[];
  conversouComFamilia: boolean;
  desfecho: Desfecho;
  motivo: string;
  compartilhadaCom: string;
  /** Sinais vitais por morador (chave = id do morador). */
  sinais: Record<string, SinaisVitais>;
  /** Assuntos das orientações, ex.: "consultas, dengue e vacinas". */
  orientacoes: string;
  relato: string;
  lancadaNoFast: boolean;
  /** Revisitas resolvidas nesta VD (ids). */
  revisitasFeitas?: string[];
  /** Última alteração (salvar, corrigir, marcar lançada) (ISO). Usado para juntar backups. */
  atualizadoEm?: string;
}

export interface Config {
  nomeAcs: string;
  micro: string;
  metaMensal: number;
  /** Nomes dos desfechos como aparecem no Fast da unidade (configurável). */
  nomesDesfecho: Record<Desfecho, string>;
  /** Lista de motivos como aparecem no Fast da unidade (configurável). */
  motivos: string[];
  motivoPadrao: string;
  /** Ruas da área (nomes completos). */
  ruas: string[];
  /** Tranca depois de X minutos parado dentro do app. */
  minutosParado: number;
  /** Tranca se ficar mais de X minutos fora do app (em outro app ou com a tela apagada). */
  minutosFora: number;
  /** Data (aaaa-mm-dd) do último backup, ou vazio se nunca fez. */
  ultimoBackup: string;
  /** Está usando os dados de exemplo (inventados), e não a área de verdade. */
  usandoExemplo: boolean;
  /** 0 = a meta fecha no último dia útil do mês (padrão); 1 = mês do calendário; 21 = do dia 21 ao dia 20. */
  diaInicioPeriodo: number;
  /** Feriados nacionais (aaaa-mm-dd) em que o ACS trabalha mesmo assim. */
  feriadosIgnorados: string[];
  /** Dias sem campo marcados pelo ACS (folga, férias, capacitação, feriado local). */
  diasSemCampo: { data: string; motivo: string }[];
  /** Endereço do Fast, só para o botão "Abrir o Fast" (nenhum dado é enviado). */
  urlFast: string;
}
