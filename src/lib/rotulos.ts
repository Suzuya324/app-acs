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
  diaInicioPeriodo: 0,
  feriadosIgnorados: [],
  diasSemCampo: [],
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

/** Motivos comuns para marcar uma revisita, e como aparecem no relato quando feitos. */
export const MOTIVOS_REVISITA: { motivo: string; feito: string }[] = [
  { motivo: 'Entregar guia de encaminhamento', feito: 'entregue guia de encaminhamento' },
  { motivo: 'Entregar resultado de exame', feito: 'entregue resultado de exame' },
  { motivo: 'Avisar consulta agendada', feito: 'avisada a família sobre consulta agendada' },
  { motivo: 'Levar medicação/receita', feito: 'entregue medicação/receita' },
  { motivo: 'Acompanhar morador', feito: 'realizado acompanhamento' },
];

/** Texto do relato para uma revisita feita. */
export function textoRevisitaFeita(motivo: string): string {
  const conhecido = MOTIVOS_REVISITA.find((m) => m.motivo.toLowerCase() === motivo.trim().toLowerCase());
  if (conhecido) return conhecido.feito;
  const t = motivo.trim().replace(/[.;,]+$/, '');
  return t ? `realizado: ${t.charAt(0).toLowerCase()}${t.slice(1)}` : '';
}
