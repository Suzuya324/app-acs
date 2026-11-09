import { describe, expect, it } from 'vitest';
import { linhaDoTempo, sugestoesDaAnotacao, textoSinais, ultimaAnotacao } from './anotacoes';
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

describe('linha do tempo da pessoa', () => {
  const f: Familia = {
    id: 'f1', rua: 'Rua Teste', numero: '1', complemento: '', bairro: '', colmeia: '', prontuario: '', situacaoCasa: 'habitada', obs: '',
    responsavelId: 'm1', moradores: [mor()],
    relatosAnteriores: [
      { id: 'r1', titulo: '07/10 · VD', texto: 'Joana refere dor (inventado).', data: '2026-10-07', origem: 'Sistema de Visitas' },
      { id: 'r2', titulo: '08/10 · VD', texto: 'Outra pessoa (inventado).', data: '2026-10-08', origem: 'Sistema de Visitas' },
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
  ];

  it('junta VDs, sinais, lista e relatos antigos que citam o nome, do mais novo ao mais antigo', () => {
    const l = linhaDoTempo(mor(), f, visitas, (d) => (d === 'realizada' ? 'Visita realizada' : d), {
      id: 'p', nome: 'JOANA TESTE SILVA', nascimento: '1950-03-10', nivel: 'A', rua: '', casa: '', prontuario: '', etiquetas: [], resumo: 'Resumo inventado.',
      ultimaInfo: '12/08/2026 Agente', atualizadoEm: '',
    });
    expect(l.map((i) => `${i.data}|${i.origem}|${i.texto}|${i.sinais ?? ''}`)).toEqual([
      '2026-11-07|vd||',
      '2026-11-03|vd|Começou insulina (inventado).|P.A. 14x9 · glicemia 180',
      '2026-10-07|relato|Joana refere dor (inventado).|',
      '2026-08-12|lista|Resumo inventado.|',
    ]);
    expect(ultimaAnotacao('m1', 'f1', visitas)).toEqual({ data: '2026-11-03', texto: 'Começou insulina (inventado).' });
    expect(textoSinais({ pa: '12x8' })).toBe('P.A. 12x8');
  });
});
