import type { Config, Grupo, SituacaoCasa, SituacaoMorador } from './tipos';

export const CONFIG_PADRAO: Config = {
  nomeAcs: '',
  micro: '',
  metaMensal: 200,
  nomesDesfecho: {
    realizada: 'Visita realizada',
    ausente_realizada: 'Ausente realizada',
    ausencia_completa: 'Ausência da família completa',
    recusa: 'Recusa',
  },
  motivos: [
    'Outros',
    'Visita periódica',
    'Cadastramento/Atualização',
    'Busca ativa',
    'Acompanhamento',
    'Egresso de internação',
  ],
  motivoPadrao: 'Outros',
  ruas: [],
  minutosParado: 5,
  minutosFora: 1,
  ultimoBackup: '',
  usandoExemplo: false,
};

export const NOMES_GRUPO: Record<Grupo, string> = {
  gestante: 'Gestante',
  puerpera: 'Puérpera',
  crianca: 'Criança pequena',
  idoso: 'Idoso',
  acamado: 'Acamado',
  hipertenso: 'Hipertenso',
  diabetico: 'Diabético',
  deficiencia: 'Pessoa com deficiência',
  saude_mental: 'Saúde mental',
  outros: 'Outros',
};

export const NOMES_SITUACAO_MORADOR: Record<SituacaoMorador, string> = {
  mora: 'Mora aqui',
  mudou: 'Mudou-se',
  nao_pertence: 'Não pertence à área',
  faleceu: 'Faleceu',
  recusa: 'Recusa',
};

export const NOMES_SITUACAO_CASA: Record<SituacaoCasa, string> = {
  habitada: 'Habitada',
  fechada: 'Fechada',
  vazia: 'Vazia',
  comercio: 'Comércio',
  demolida: 'Demolida',
  construcao: 'Em construção',
};

/** Assuntos rápidos de orientação (viram "orientados sobre consultas, dengue e vacinas"). */
export const TEMAS_ORIENTACAO = [
  'consultas',
  'saúde',
  'dengue',
  'vacinas',
  'medicações',
  'exames',
  'alimentação',
];
