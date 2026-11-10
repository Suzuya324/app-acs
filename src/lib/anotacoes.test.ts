import { describe, expect, it } from 'vitest';
import {
  linhaDoTempo, OBS_SISTEMA_DE_VISITAS, sugestoesDasVDs, sugestoesDaAnotacao, textoEscritoDaVD, textoSinais, trechosDaPessoa, ultimaAnotacao,
} from './anotacoes';
import type { Familia, Morador, Visita } from './tipos';

const mor = (extra: Partial<Morador> = {}): Morador => ({
  id: 'm1', nome: 'Joana Teste Silva', sexo: 'F', nascimento: '1950-03-10', situacao: 'mora', situacaoDesde: '', grupos: [], obs: '', ...extra,
});
const ids = (t: string, m = mor()) => sugestoesDaAnotacao(t, m).map((s) => s.id);

describe('sugestões a partir da anotação', () => {
  it('reconhece condições e situação', () => {
    expect(ids('Começou insulina, pressão alta hoje.')).toEqual(['g-hipertenso', 'g-diabetico']);
    expect(ids('Ficou acamada depois do AVC')).toEqual(['g-acamado', 'g-avc']);
    expect(ids('Está grávida de 3 meses')).toEqual(['g-gestante']);
    expect(ids('Filha contou que ela faleceu semana passada')).toEqual(['faleceu']);
    expect(ids('Não mora mais aqui, se mudou para a Bahia')).toEqual(['mudou']);
  });

  it('não sugere com negação, outra pessoa ou o que já está marcado', () => {
    expect(ids('Nega diabetes. Sem hipertensão.')).toEqual([]);
    expect(ids('A mãe era hipertensa; o marido faleceu em 2020')).toEqual([]);
    expect(ids('Pressão alta', mor({ grupos: ['hipertenso'] }))).toEqual([]);
    expect(ids('Está grávida', mor({ sexo: 'M' }))).toEqual([]);
    expect(ids('faleceu', mor({ situacao: 'faleceu' }))).toEqual([]);
    expect(ids('')).toEqual([]);
  });
});

describe('sugestões: frases e pedaços', () => {
  it('olha cada frase e cada pedaço entre vírgulas', () => {
    expect(ids('A filha veio. Ela tem diabetes')).toEqual(['g-diabetico']);
    expect(ids('Sem febre, tem diabetes')).toEqual(['g-diabetico']);
    expect(ids('A mãe, que é hipertensa, mora junto')).toEqual([]);
    expect(ids('Orientada sobre hipertensão e dengue')).toEqual([]);
  });

  it('não confunde pré-diabetes, a cirurgiã nem a condição de outra pessoa', () => {
    expect(ids('É pré-diabética')).toEqual([]);
    expect(ids('Tem consulta com a cirurgiã dia 17')).toEqual([]);
    expect(ids('Veio avisar do pré-natal da irmã')).toEqual([]);
    expect(ids('Cuida do câncer do marido')).toEqual([]);
    expect(ids('Aguarda cirurgia de hérnia')).toEqual(['g-cirurgia']);
  });
});

describe('VDs já feitas', () => {
  const casa = (moradores: Morador[], extra: Partial<Familia> = {}): Familia => ({
    id: 'f9', rua: 'Rua Teste', numero: '9', complemento: '', bairro: '', colmeia: '', prontuario: '', situacaoCasa: 'habitada', obs: '',
    responsavelId: moradores[0].id, moradores, ...extra,
  });
  const ana = mor({ id: 'a', nome: 'Ana Teste' });
  const beto = mor({ id: 'b', nome: 'Beto Teste', sexo: 'M' });
  const visita = (relato: string, extra: Partial<Visita> = {}): Visita => ({
    id: 'v', familiaId: 'f9', data: '2026-10-10', presentes: [], conversouComFamilia: true, desfecho: 'realizada', motivo: 'Outros',
    compartilhadaCom: '', sinais: {}, orientacoes: '', relato, lancadaNoFast: false, observacao: OBS_SISTEMA_DE_VISITAS, ...extra,
  });

  it('separa o texto da casa por pessoa, a partir do nome', () => {
    const f = casa([ana, beto]);
    const t = 'Realizada VD. Ana é diabética e usa insulina. Beto, o marido, está acamado após AVC.';
    expect(trechosDaPessoa(t, ana, f)).toEqual(['Ana é diabética e usa insulina.']);
    expect(trechosDaPessoa(t, beto, f)).toEqual(['Beto, o marido, está acamado após AVC.']);
    expect(trechosDaPessoa('Todos bem.', ana, f)).toEqual([]);
  });

  it('quem só está contando de outra pessoa não vira o assunto', () => {
    const f = casa([ana, beto]);
    const t = 'Beto Teste. Ana disse que ele está bem. Antes: acamado.';
    expect(trechosDaPessoa(t, beto, f)).toEqual([t]);
    expect(trechosDaPessoa(t, ana, f)).toEqual([]);
  });

  it('quem mora sozinho fica com o texto todo; acentos e maiúsculas não atrapalham', () => {
    const f = casa([ana, mor({ id: 'c', nome: 'Caio Teste', situacao: 'mudou' })]);
    expect(trechosDaPessoa('Hipertensa. ANA refere dor.', ana, f)).toEqual(['Hipertensa.', 'ANA refere dor.']);
    const g = casa([mor({ id: 'j', nome: 'Antônio Teste', sexo: 'M' }), ana]);
    expect(trechosDaPessoa('Sr Antonio tem diabetes', g.moradores[0], g)).toEqual(['Antonio tem diabetes']);
  });

  it('dois com o mesmo primeiro nome: procura os dois primeiros nomes', () => {
    const a1 = mor({ id: 'a1', nome: 'Ana Clara Teste' });
    const a2 = mor({ id: 'a2', nome: 'Ana Paula Teste' });
    const f = casa([a1, a2]);
    expect(trechosDaPessoa('Ana Paula grávida. Ana Clara bem.', a2, f)).toEqual(['Ana Paula grávida.']);
    expect(trechosDaPessoa('Ana está bem.', a1, f)).toEqual([]);
  });

  it('lê só o que o ACS escreveu (relato trazido ou observação), não o relato montado pelo app', () => {
    expect(textoEscritoDaVD(visita('Ana bem.'))).toBe('Ana bem.');
    expect(textoEscritoDaVD(visita('Orientada sobre diabetes.', { observacao: 'Ana com pressão alta.' }))).toBe('Ana com pressão alta.');
    expect(textoEscritoDaVD(visita('Orientada sobre diabetes.', { observacao: '' }))).toBe('');
  });

  it('junta as sugestões de VDs, relatos antigos e casos, com os trechos', () => {
    const f = casa([ana, beto], {
      relatosAnteriores: [{ id: 'r', titulo: '01/09 · VD', texto: 'Beto usa oxigênio em casa (inventado).', data: '2026-09-01', origem: 'Sistema de Visitas' }],
    });
    const visitas = [visita('Ana diabética. Beto acamado.'), visita('Ana segue com insulina.', { id: 'v2', data: '2026-10-20' })];
    const casos = [{ id: 'c', familiaId: 'f9', categoria: 'outros', titulo: 'Ana, 60 anos', texto: 'Aguarda cirurgia (inventado).', criadoEm: '2026-10-01T12:00:00Z', atualizadoEm: '' }] as never[];
    const l = sugestoesDasVDs([f], visitas, casos);
    expect(l.map((s) => s.chave).sort()).toEqual(['a|g-cirurgia', 'a|g-diabetico', 'b|g-acamado', 'b|g-oxigenio']);
    const dia = l.find((s) => s.chave === 'a|g-diabetico')!;
    expect(dia.provas.map((p) => `${p.origem}: ${p.frase}`)).toEqual(['VD de 20/10: Ana segue com insulina.', 'VD de 10/10: Ana diabética.']);
    expect(l.find((s) => s.chave === 'b|g-acamado')!.provas[0].frase).toBe('Beto acamado.');
    expect(sugestoesDasVDs([f], visitas, casos, ['a|g-diabetico']).some((s) => s.chave === 'a|g-diabetico')).toBe(false);
    // O que já está na ficha não aparece.
    const f2 = { ...f, moradores: [{ ...ana, grupos: ['diabetico' as const] }, beto] };
    expect(sugestoesDasVDs([f2], visitas, []).some((s) => s.chave === 'a|g-diabetico')).toBe(false);
  });
});

describe('linha do tempo da pessoa', () => {
  const f: Familia = {
    id: 'f1', rua: 'Rua Teste', numero: '1', complemento: '', bairro: '', colmeia: '', prontuario: '', situacaoCasa: 'habitada', obs: '',
    responsavelId: 'm1', moradores: [mor(), mor({ id: 'm2', nome: 'Pedro Teste Silva', sexo: 'M' })],
    relatosAnteriores: [
      { id: 'r1', titulo: '07/10 · VD', texto: 'Joana refere dor (inventado).', data: '2026-10-07', origem: 'Sistema de Visitas' },
      { id: 'r2', titulo: '08/10 · VD', texto: 'Pedro refere tosse (inventado).', data: '2026-10-08', origem: 'Sistema de Visitas' },
    ],
  };
  const vd = (id: string, data: string, extra: Partial<Visita> = {}): Visita => ({
    id, familiaId: 'f1', data, presentes: [], conversouComFamilia: true, desfecho: 'realizada', motivo: 'Outros', compartilhadaCom: '',
    sinais: {}, orientacoes: '', relato: '', lancadaNoFast: false, ...extra,
  });
  const visitas = [
    vd('v1', '2026-11-03', { presentes: ['m1'], anotacoes: { m1: 'Começou insulina (inventado).' }, sinais: { m1: { pa: '14x9', glicemia: '180' } } }),
    vd('v2', '2026-11-05', { presentes: [] }),
    vd('v3', '2026-11-07', { presentes: ['m1'] }),
    vd('v4', '2026-10-20', { observacao: OBS_SISTEMA_DE_VISITAS, relato: 'Pedro bem. Joana com dor no joelho (inventado).' }),
  ];

  it('junta VDs, sinais, lista e relatos antigos que citam o nome, do mais novo ao mais antigo', () => {
    const l = linhaDoTempo(mor(), f, visitas, (d) => (d === 'realizada' ? 'Visita realizada' : d), {
      id: 'p', nome: 'JOANA TESTE SILVA', nascimento: '1950-03-10', nivel: 'A', rua: '', casa: '', prontuario: '', etiquetas: [], resumo: 'Resumo inventado.',
      ultimaInfo: '12/08/2026 Agente', atualizadoEm: '',
    });
    expect(l.map((i) => `${i.data}|${i.origem}|${i.texto}|${i.sinais ?? ''}`)).toEqual([
      '2026-11-07|vd||',
      '2026-11-03|vd|Começou insulina (inventado).|P.A. 14x9 · glicemia 180',
      '2026-10-20|vd|Joana com dor no joelho (inventado).|',
      '2026-10-07|relato|Joana refere dor (inventado).|',
      '2026-08-12|lista|Resumo inventado.|',
    ]);
    expect(ultimaAnotacao('m1', 'f1', visitas)).toEqual({ data: '2026-11-03', texto: 'Começou insulina (inventado).' });
    expect(textoSinais({ pa: '12x8' })).toBe('P.A. 12x8');
  });
});
