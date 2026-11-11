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
  | 'oxigenio'
  | 'avc'
  | 'coracao'
  | 'cancer'
  | 'cirurgia'
  | 'alzheimer'
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
  /** Código da pessoa no SBCD (vem do arquivo de atualização do cadastro). */
  codSbcd?: string;
  /** Gestante: data provável do parto (aaaa-mm-dd). */
  dpp?: string;
  /** Criança: última vez que o ACS conferiu a caderneta de vacinas (aaaa-mm-dd). */
  cadernetaEm?: string;
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
  /** Relatos antigos trazidos de outro lugar (ex.: Sistema de Visitas). Só leitura; não contam como VD. */
  relatosAnteriores?: RelatoAnterior[];
  /** Nível de prioridade marcado à mão (A = voltar a cada 10 dias, B = a cada 30). Sem marcar: calculado. */
  nivel?: 'A' | 'B';
  /** Recado de atenção da casa (aparece na ficha e na VD). */
  atencao?: string;
  /** Data (aaaa-mm-dd) da última VD feita fora do app (ex.: lançada só no Fast), para calcular a próxima. */
  ultimaVdFora?: string;  /** Código do domicílio no SBCD (vem do arquivo de atualização do cadastro). */
  codSbcd?: string;
}

export type CategoriaCaso = 'urgente' | 'importante' | 'social' | 'npv';

/** Uma novidade do caso: a resposta da reunião de equipe ou outro andamento. */
export interface RespostaCaso {
  /** aaaa-mm-dd */
  data: string;
  texto: string;
  /** Veio da reunião de equipe. */
  reuniao?: boolean;
}

/** Caso para acompanhar (urgente, importante, social/cadastro ou NPV), ligado a uma família. */
export interface Caso {
  id: string;
  familiaId: string;
  categoria: CategoriaCaso;
  /** Quem (ex.: "Fulana, 76 anos"). */
  titulo: string;
  /** O que está acontecendo, o que já foi feito e o que falta. */
  texto: string;
  /** Encaminhamento para a eMulti (ex.: "Psicologia"), ou vazio. */
  emulti?: string;
  /** Ponto para levar à reunião de equipe (NPV), ou vazio. */
  npv?: string;
  criadoEm: string;
  atualizadoEm: string;
  /** Quando foi resolvido (ISO), se foi. */
  resolvidoEm?: string;
  /** O que a equipe decidiu / o que aconteceu, do mais antigo ao mais novo (ex.: resposta da reunião). */
  respostas?: RespostaCaso[];
  /** Última novidade de verdade (aberto, editado à mão ou com resposta), ISO. Sem ela, vale criadoEm. */
  novidadeEm?: string;
}

export interface RelatoAnterior {
  id: string;
  /** Ex.: "07/10 · VD do ACS". */
  titulo: string;
  texto: string;
  /** Data (aaaa-mm-dd), se souber. */
  data?: string;
  /** De onde veio, ex.: "Sistema de Visitas". */
  origem: string;
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
  observacao?: string;
  anotacoes?: Record<string, string>;
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
  /** O que foi conversado / observado (escrito pelo ACS). */
  observacao?: string;
  /** Anotações sobre cada pessoa (chave = id do morador): vão para a ficha dela. */
  anotacoes?: Record<string, string>;
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
  /** Relato com o nome completo dos moradores (em vez de só o primeiro nome). */
  relatoNomeCompleto: boolean;
  /** Escondeu o cartão "Primeiros passos" do Início. */
  primeirosPassosOcultos: boolean;
  /** Números das pastas físicas na colmeia, digitados pelo ACS (ex.: "1-50, 52"). */
  pastasNaColmeia: string;
  /** Números de prontuário em uso no Fast (lidos de uma lista colada), por micro. Só números. */
  emUsoNoFast: { micro: string; numeros: string };
  /** Dia da semana da reunião de equipe (0 = domingo … 3 = quarta … 6 = sábado; -1 = sem reunião fixa). */
  diaReuniao: number;
  /**
   * O que o ACS escondeu do acompanhamento, para não aparecer de novo: sugestões que "não são" (moradorId|g-…),
   * pendências resolvidas (moradorId|p-…) e remédios errados (moradorId|r-…).
   */
  sugestoesEscondidas?: string[];
  /** Frases prontas do ACS para a VD (uma por item). Vazio = as frases padrão do app. */
  frasesProntas?: string[];
  /** Modo rua: letra maior e mais contraste, para ler no sol. */
  modoRua?: boolean;
  /** Até quando (ISO) as mudanças do cadastro já foram passadas para o SBCD. */
  sbcdAtualizadoAte?: string;
  /** Nomes de remédios que o ACS ensinou ao app (separados por vírgula). Só nomes de remédio. */
  remediosExtras?: string;
  /** Quando os ajustes foram mudados pela última vez (ISO): na junção entre aparelhos vale o mais recente. */
  alteradaEm?: string;
}
