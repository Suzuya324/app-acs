import { describe, expect, it } from 'vitest';
import { funcaoDoTexto, META_JUNTO_PADRAO, ocorrenciasDaEquipe, resumoEquipe } from './equipe-numeros';
import type { Desfecho, Familia, Visita } from './tipos';

const fam = (id: string, relatos: Familia['relatosAnteriores'] = []): Familia => ({
  id, rua: 'Rua Teste', numero: id, complemento: '', bairro: '', colmeia: '', prontuario: '', situacaoCasa: 'habitada', obs: '', responsavelId: `${id}-1`,
  relatosAnteriores: relatos,
  moradores: [{ id: `${id}-1`, nome: 'Pessoa Teste', sexo: 'M', nascimento: '', situacao: 'mora', situacaoDesde: '', grupos: [], obs: '' }],
});
let n = 0;
const vd = (familiaId: string, data: string, compartilhadaCom = '', desfecho: Desfecho = 'realizada'): Visita => ({
  id: `v${++n}`, familiaId, data, desfecho, presentes: [`${familiaId}-1`], conversouComFamilia: false, motivo: 'Outros',
  compartilhadaCom, sinais: {}, orientacoes: '', relato: '', lancadaNoFast: false,
});

describe('quem é o profissional', () => {
  it('reconhece pela função escrita', () => {
    expect(funcaoDoTexto('Técnica de enfermagem')).toBe('tecnica');
    expect(funcaoDoTexto('técnica')).toBe('tecnica');
    expect(funcaoDoTexto('Enfermeira')).toBe('enfermeira');
    expect(funcaoDoTexto('Dra. Fulana')).toBe('medica');
    expect(funcaoDoTexto('Médica')).toBe('medica');
    expect(funcaoDoTexto('APA')).toBe('apa');
    expect(funcaoDoTexto('Fulano')).toBe('outro');
  });
});

describe('ocorrências da equipe', () => {
  it('conta VD compartilhada e ida sozinho (botão Foi), separando duas pessoas escritas juntas', () => {
    const familias = [fam('1', [{ id: 'r1', titulo: 'Enfermeira', texto: 'x', data: '2026-11-10', origem: 'Enfermeira' }]), fam('2')];
    const visitas = [vd('2', '2026-11-05', 'Técnica de enfermagem e Dra. Fulana'), vd('2', '2026-11-06')];
    const o = ocorrenciasDaEquipe(familias, visitas);
    expect(o.filter((x) => x.junto).map((x) => x.funcao).sort()).toEqual(['medica', 'tecnica']);
    expect(o.filter((x) => !x.junto)).toEqual([{ data: '2026-11-10', familiaId: '1', funcao: 'enfermeira', rotulo: 'Enfermeira', junto: false }]);
  });
});

describe('resumo da equipe no período', () => {
  const familias = [fam('1', [{ id: 'r1', titulo: 'Enfermeira', texto: 'x', data: '2026-11-10', origem: 'Enfermeira' }]), fam('2'), fam('3')];
  const visitas = [
    vd('1', '2026-11-03', 'Técnica de enfermagem'),
    vd('2', '2026-11-04', 'Técnica de enfermagem e Médica'), // duas pessoas, uma VD
    vd('3', '2026-11-05'), // só do ACS
    vd('1', '2026-10-20', 'Enfermeira'), // mês passado
  ];
  const r = resumoEquipe(familias, visitas, '2026-11-01', '2026-11-30', 10, '2026-11-26');

  it('VDs junto contam uma vez por casa e dia, e a % é sobre as VDs do período', () => {
    expect(r.vdsJunto).toBe(2);
    expect(r.vdsDoPeriodo).toBe(10);
    expect(r.pctJunto).toBe(20);
  });
  it('tabela por profissional', () => {
    const por = Object.fromEntries(r.linhas.map((l) => [l.funcao, [l.junto, l.sozinho, l.total]]));
    expect(por.tecnica).toEqual([2, 0, 2]);
    expect(por.medica).toEqual([1, 0, 1]);
    expect(por.enfermeira).toEqual([0, 1, 1]);
    expect(r.porFuncao.enfermeira).toEqual({ junto: 0, sozinho: 1, ultima: '2026-11-10' });
  });
  it('casas atendidas, a mais recente primeiro, com quem foi', () => {
    expect(r.casas.map((c) => c.familiaId)).toEqual(['1', '2']);
    expect(r.casas[0].vezes).toBe(2); // 03/11 junto e 10/11 sozinho
    expect(r.casas[1].quem.sort()).toEqual(['Médica', 'Técnica de enfermagem']);
  });
  it('seis meses, o mais recente por último', () => {
    expect(r.porMes).toHaveLength(6);
    expect(r.porMes[5]).toEqual({ mes: '2026-11', junto: 2, sozinho: 1 });
    expect(r.porMes[4]).toEqual({ mes: '2026-10', junto: 1, sozinho: 0 });
    expect(r.porMes[0].mes).toBe('2026-06');
  });
  it('meta padrão das VDs junto', () => {
    expect(META_JUNTO_PADRAO).toBe(20);
  });
});
