import { describe, expect, it } from 'vitest';
import {
  achadosPeloApp, acompanhamentoDaPessoa, diaMarcado, medidasDaPessoa, pendenciasDaPessoa, queixasRecentes, remediosDaPessoa, ruaCurta,
} from './acompanhamento';
import type { TextoDaFamilia } from './anotacoes';
import type { Prioritario } from './prioritarios';
import type { Caso, Familia, Morador, Visita } from './tipos';

// Tudo inventado: nomes, casas e textos.
const mor = (extra: Partial<Morador> = {}): Morador => ({
  id: 'a', nome: 'Ana Teste', sexo: 'F', nascimento: '1950-03-10', situacao: 'mora', situacaoDesde: '', grupos: [], obs: '', ...extra,
});
const casa = (moradores: Morador[], extra: Partial<Familia> = {}): Familia => ({
  id: 'f1', rua: 'Rua das Acácias', numero: '12', complemento: '', bairro: '', colmeia: '', prontuario: '00.0001', situacaoCasa: 'habitada', obs: '',
  responsavelId: moradores[0].id, moradores, ...extra,
});
const vd = (data: string, extra: Partial<Visita> = {}): Visita => ({
  id: `v-${data}`, familiaId: 'f1', data, presentes: [], conversouComFamilia: true, desfecho: 'realizada', motivo: 'Outros', compartilhadaCom: '',
  sinais: {}, orientacoes: '', relato: '', lancadaNoFast: false, ...extra,
});
const t = (data: string, texto: string, extra: Partial<TextoDaFamilia> = {}): TextoDaFamilia => ({ data, origem: `VD de ${data.slice(8)}/${data.slice(5, 7)}`, texto, ...extra });
const HOJE = '2026-11-10';

describe('remédios', () => {
  const rem = (textos: TextoDaFamilia[], extras = '') => remediosDaPessoa('a', textos, extras).map((r) => `${r.nome}${r.dose ? ` ${r.dose}` : ''}:${r.situacao}`);

  it('acha os remédios citados, com a dose', () => {
    expect(rem([t('2026-10-07', 'Faz uso de Glifage XR 500 mg e losartana. Toma AAS à noite.')])).toEqual(['AAS:usa', 'Glifage XR 500 mg:usa', 'Losartana:usa']);
  });

  it('entende parou, trocou, alergia e listas', () => {
    expect(rem([t('2026-10-07', 'Parou a fluoxetina. Trocou captopril por enalapril. Alérgica a dipirona.')])).toEqual(['Dipirona:alergia', 'Enalapril:usa', 'Captopril:parou', 'Fluoxetina:parou']);
    expect(rem([t('2026-10-07', 'Parou sinvastatina, omeprazol e AAS, mas segue com atenolol.')])).toEqual(['Atenolol:usa', 'AAS:parou', 'Omeprazol:parou', 'Sinvastatina:parou']);
    expect(rem([t('2026-10-07', 'Está sem a insulina há uma semana.')])).toEqual(['Insulina:parou']);
    expect(rem([t('2026-10-07', 'Parou captopril e toma losartana. Toma atenolol e parou AAS.')])).toEqual(['Atenolol:usa', 'Losartana:usa', 'AAS:parou', 'Captopril:parou']);
  });

  it('vale a citação mais recente de cada remédio', () => {
    expect(rem([t('2026-10-20', 'Parou a metformina.'), t('2026-09-01', 'Toma metformina 850 mg.')])).toEqual(['Metformina:parou']);
    expect(rem([t('2026-09-01', 'Parou a metformina.'), t('2026-10-20', 'Voltou a tomar metformina.')])).toEqual(['Metformina:usa']);
  });

  it('não pega o remédio de outra pessoa; pega nomes pelo final e os ensinados', () => {
    expect(rem([t('2026-10-07', 'O marido toma varfarina. A filha contou que ela toma sertralina.')])).toEqual(['Sertralina:usa']);
    expect(rem([t('2026-10-07', 'Começou candesartana.')])).toEqual(['Candesartana:usa']);
    expect(rem([t('2026-10-07', 'Toma remedex toda manhã.')])).toEqual([]);
    expect(rem([t('2026-10-07', 'Toma remedex toda manhã.')], 'Remedex, Outro')).toEqual(['Remedex:usa']);
  });
});

describe('medidas', () => {
  it('junta os sinais das VDs e o que foi escrito, a mais nova primeiro', () => {
    const m = mor();
    const f = casa([m]);
    const visitas = [vd('2026-11-03', { sinais: { a: { pa: '14x9', glicemia: '180' } } })];
    const textos = [
      t('2026-10-13', 'Aferidos pela técnica: pressão 180x100 e dextro 111.'),
      t('2026-10-20', 'Histórico: PA 180x100. HAS com PA 230x80 em 03/2026.'),
    ];
    const r = medidasDaPessoa(m, f, visitas, textos);
    expect(r.pa).toEqual([{ valor: '14x9', data: '2026-11-03' }, { valor: '180x100', data: '2026-10-13' }]);
    expect(r.glicemia).toEqual([{ valor: '180', data: '2026-11-03' }, { valor: '111', data: '2026-10-13' }]);
  });
});

describe('dia marcado', () => {
  it('só vale o dia que vem depois de quando foi escrito', () => {
    expect(diaMarcado('cirurgia prevista para o dia 23/11/2026', '2026-10-29')).toBe('2026-11-23');
    expect(diaMarcado('consulta no dia 17 de dezembro', '2026-10-07')).toBe('2026-12-17');
    expect(diaMarcado('guia 22/10, sem data, oftalmo 16/11 13h44', '2026-10-27')).toBe('2026-11-16');
    expect(diaMarcado('retorno dia 10/01', '2026-12-15')).toBe('2027-01-10');
    expect(diaMarcado('pa 230x80 em 03/2026', '2026-08-12')).toBeUndefined();
    expect(diaMarcado('28/10: filha diz que esta bem', '2026-08-13')).toBeUndefined();
    expect(diaMarcado('precisa de vacina (desde 27/08)', '2026-10-29')).toBeUndefined();
  });
});

describe('pendências', () => {
  const pend = (textos: TextoDaFamilia[], fora: string[] = []) => pendenciasDaPessoa('a', textos, HOJE, new Set(fora));

  it('reconhece o assunto e o dia marcado', () => {
    const l = pend([
      t('2026-10-07', 'Irá buscar os resultados amanhã. Aguarda cirurgia de hérnia. Tem consulta com a cirurgiã no dia 17 de dezembro.'),
      t('2026-10-20', 'Está marcando consulta para avaliar seu exame. Com a receita vencida. Encaminhada para cardiologia.'),
    ]);
    expect(l.map((p) => `${p.tipo}${p.quando ? ` ${p.quando}` : ''}`)).toEqual(['consulta 2026-12-17', 'consulta', 'encaminhamento', 'receita', 'resultado', 'cirurgia']);
  });

  it('some quando um texto mais novo mostra que resolveu, ou quando o ACS marca', () => {
    const antigo = t('2026-10-07', 'Aguarda resultado do exame de sangue.');
    expect(pend([antigo])).toHaveLength(1);
    expect(pend([antigo, t('2026-10-20', 'Pegou o resultado, tudo normal.')])).toHaveLength(0);
    expect(pend([antigo, t('2026-09-01', 'Pegou o resultado do exame anterior.')])).toHaveLength(1);
    expect(pend([antigo], [pend([antigo])[0].chave])).toHaveLength(0);
  });

  it('junta o mesmo assunto contado em dois textos do dia; ignora caso resolvido e texto antigo', () => {
    const l = pend([
      t('2026-10-07', 'Ana está começando a esquecer as coisas e precisa marcar consulta.'),
      t('2026-10-07', 'precisa marcar consulta.', { origem: 'Caso: Ana Teste' }),
    ]);
    expect(l).toHaveLength(1);
    expect(l[0].frase).toBe('Ana está começando a esquecer as coisas e precisa marcar consulta.');
    expect(l[0].chaves).toHaveLength(2);
    expect(pend([l[0]].map(() => t('2026-10-07', 'precisa marcar consulta.', { origem: 'Caso: Ana Teste' })), [l[0].chaves[1]])).toHaveLength(0);
    expect(pend([t('2026-10-07', 'Precisa de VD da enfermagem.', { encerrado: true })])).toHaveLength(0);
    expect(pend([t('2026-01-07', 'Aguarda resultado do exame.')])).toHaveLength(0);
    expect(pend([t('2026-10-07', 'Todos bem, sem queixas.')])).toHaveLength(0);
  });
});

describe('queixas', () => {
  it('pega a queixa do texto mais novo, sem orientação, negação, nome ou o que já melhorou', () => {
    const q = (texto: string) => queixasRecentes([t('2026-10-20', texto), t('2026-09-01', 'Refere tontura.')], HOJE).map((x) => x.texto);
    expect(q('Relata dor no meio do peito, que aperta bastante.')).toEqual(['dor no meio do peito']);
    expect(q('Orientada sobre cuidados com dor de garganta.')).toEqual([]);
    expect(q('Nega dor. Sem febre.')).toEqual([]);
    expect(q('Maria das Dores está bem.')).toEqual([]);
    expect(q('A dor já passou.')).toEqual([]);
    expect(q('Tem dores. Refere dores nos ossos.')).toEqual(['dores nos ossos']);
  });
});

describe('acompanhamento da pessoa', () => {
  const ana = mor({ grupos: ['hipertenso'] });
  const beto = mor({ id: 'b', nome: 'Beto Teste', sexo: 'M', nascimento: '1990-05-05' });
  const f = casa([ana, beto]);
  const visitas = [
    vd('2026-10-07', { observacao: 'Trazida do Sistema de Visitas.', relato: 'Ana é diabética e usa Glifage. Relata dor no peito. Aguarda resultado do exame. Beto está bem.' }),
    vd('2026-11-03', { anotacoes: { a: 'Pegou o resultado, normal. Parou o Glifage, começou insulina. Consulta marcada para o dia 20/11.' }, sinais: { a: { pa: '15x9' } } }),
  ];
  const ctx = { visitas, casos: [] as Caso[], prioritarios: [] as Prioritario[], hoje: HOJE };

  it('monta remédios, pendências, medidas, notícias e perguntas', () => {
    const a = acompanhamentoDaPessoa(ana, f, ctx);
    expect(a.achadas.map((s) => s.chave)).toEqual(['a|g-diabetico']);
    expect(a.remedios.map((r) => `${r.nome}:${r.situacao}`)).toEqual(['Insulina:usa', 'Glifage:parou']);
    expect(a.pendencias.map((p) => `${p.tipo} ${p.quando ?? ''}`)).toEqual(['consulta 2026-11-20']);
    expect(a.medidas.pa[0]).toEqual({ valor: '15x9', data: '2026-11-03' });
    expect(a.noticias.map((n) => n.data)).toEqual(['2026-11-03', '2026-10-07']);
    expect(a.perguntas).toEqual([
      'Lembrar: consulta dia 20/11. “Consulta marcada para o dia 20/11” (03/11)',
      'Ainda toma insulina? Mudou algum remédio ou dose?',
      'Glifage: continua sem tomar? (03/11)',
      'Confirmar: diabético?',
      'Última P.A.: 15x9 (03/11). Medir de novo.',
    ]);
    expect(a.vazio).toBe(false);
  });

  it('esconde o que o ACS marcou e fica vazio para quem não tem nada escrito', () => {
    const a = acompanhamentoDaPessoa(ana, f, { ...ctx, escondidas: ['a|g-diabetico', 'a|r-insulina'] });
    expect(a.achadas).toEqual([]);
    expect(a.remedios.map((r) => r.nome)).toEqual(['Glifage']);
    const b = acompanhamentoDaPessoa(beto, f, ctx);
    expect(b.remedios).toEqual([]);
    expect(b.perguntas).toEqual([]);
    expect(acompanhamentoDaPessoa(mor({ id: 'z', nome: 'Zeca Teste' }), casa([mor({ id: 'z', nome: 'Zeca Teste' })], { id: 'f2' }), ctx).vazio).toBe(true);
  });

  it('achados pelo app: quem está fora da lista mas tem condição, condição a confirmar ou remédio', () => {
    const carla = mor({ id: 'c', nome: 'Carla Teste', nascimento: '1940-01-01', grupos: ['acamado'] });
    const davi = mor({ id: 'd', nome: 'Davi Teste', nascimento: '2000-01-01', grupos: ['idoso'] });
    const f2 = casa([carla, davi], { id: 'f2', rua: 'Rua dos Ipês Amarelos', numero: '7', complemento: 'Fundos' });
    const naLista: Prioritario = {
      id: 'p1', nome: 'BETO TESTE', nascimento: '1990-05-05', nivel: 'C', rua: 'Acácias', casa: '12', prontuario: '', etiquetas: [], resumo: 'Usa losartana (inventado).',
      ultimaInfo: '12/08/2026 Agente', familiaId: 'f1', moradorId: 'b', atualizadoEm: '',
    };
    const r = achadosPeloApp([f, f2], { ...ctx, prioritarios: [naLista] });
    expect(r.achados.map((p) => `${p.nome}|${p.nivel}|${p.rua} ${p.casa}|${p.etiquetas.join('+')}|${p.doApp}`)).toEqual([
      'Ana Teste|B|Acácias 12|HAS|true',
      'Carla Teste|A|Ipês Amarelos 7 Fundos|ACAMADO/DOMICILIADO|true',
    ]);
    expect([...r.acompanhamentos.keys()].sort()).toEqual(['a', 'b']);
    expect(r.acompanhamentos.get('b')!.remedios.map((x) => x.nome)).toEqual(['Losartana']);
    expect(ruaCurta('Avenida do Teste')).toBe('Teste');
  });
});
