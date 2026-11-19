import { describe, expect, it } from 'vitest';
import { conferirComFast, efeitosDaConferencia, lerListaFast } from './conferir-fast';
import { juntarDados } from './juntar';
import type { Dados } from './cofre';
import type { Familia, Visita } from './tipos';
import { CONFIG_PADRAO } from './rotulos';

// Tudo inventado.
const fam = (id: string, prontuario: string, nome: string): Familia => ({
  id, rua: 'Rua das Acácias', numero: id, complemento: '', bairro: '', colmeia: '', prontuario, situacaoCasa: 'habitada', obs: '', responsavelId: `m${id}`,
  moradores: [{ id: `m${id}`, nome, sexo: 'F', nascimento: '', situacao: 'mora', situacaoDesde: '', grupos: [], obs: '' }],
});
const vd = (id: string, familiaId: string, data: string): Visita => ({
  id, familiaId, data, presentes: [], conversouComFamilia: true, desfecho: 'realizada', motivo: 'Outros', compartilhadaCom: '', sinais: {}, orientacoes: '', relato: '', lancadaNoFast: false,
});

describe('conferir com o Fast', () => {
  const fs = [fam('1', '0000.04.015', 'Ana Teste Silva'), fam('2', '0000.04.020', 'Beto Exemplo Lima'), fam('3', '0000.04.030', 'Caio Teste Rocha')];
  const visitas = [vd('a', '1', '2026-11-03'), vd('b', '2', '2026-11-04'), vd('c', '3', '2026-11-05'), vd('d', '1', '2026-10-20')];

  it('lê data e prontuário de cada linha colada; ignora cabeçalho', () => {
    const l = lerListaFast('Data  Prontuário  Nome\n03/11/2026  0000.04.015  ANA TESTE SILVA  Visita realizada\n\n04/11/26 BETO EXEMPLO LIMA');
    expect(l.map((x) => `${x.data ?? '-'}|${x.pront ?? '-'}`)).toEqual(['-|-', '2026-11-03|0000.04.015', '2026-11-04|-']);
  });

  it('mostra o que falta lançar, o que foi lançado duas vezes e o que só está no Fast', () => {
    const texto = [
      '03/11/2026 0000.04.015 ANA TESTE SILVA',
      '04/11/2026 BETO EXEMPLO LIMA',
      '04/11/2026 0000.04.020 BETO EXEMPLO LIMA',
      '06/11/2026 DUDA DESCONHECIDA SOUZA',
      '20/10/2026 0000.04.015 ANA TESTE SILVA',
    ].join('\n');
    const r = conferirComFast(lerListaFast(texto), fs, visitas, '2026-11-01', '2026-11-30');
    expect(r.achadas.map((x) => x.visita.id)).toEqual(['a', 'b']);
    expect(r.repetidas.map((x) => `${x.visita.id}:${x.linhas.length}`)).toEqual(['b:2']);
    expect(r.faltando.map((v) => v.id)).toEqual(['c']);
    expect(r.sumiram).toEqual([]);
    // Marcada como lançada no app, mas não está na lista do Fast: o Fast perdeu.
    const lancadaC = visitas.map((v) => (v.id === 'c' ? { ...v, lancadaNoFast: true } : v));
    expect(conferirComFast(lerListaFast(texto), fs, lancadaC, '2026-11-01', '2026-11-30').sumiram.map((v) => v.id)).toEqual(['c']);
    expect(r.soNoFast.map((l) => l.texto)).toEqual(['06/11/2026 DUDA DESCONHECIDA SOUZA']);
    expect(conferirComFast(lerListaFast('Data Prontuário Nome Situação'), fs, visitas, '2026-11-01', '2026-11-30').soNoFast).toEqual([]);
  });
});

describe('aparelhos sem sincronizar', () => {
  it('na junção vale a sincronização mais recente de cada aparelho', () => {
    const base = (cfg: Partial<typeof CONFIG_PADRAO>): Dados => ({ config: { ...CONFIG_PADRAO, ...cfg }, familias: [], visitas: [], historico: [] });
    const daqui = base({ alteradaEm: '2026-11-10T00:00:00Z', aparelhos: { Celular: '2026-11-11T10:00:00Z', Tablet: '2026-11-01T10:00:00Z' } });
    const dela = base({ alteradaEm: '2026-11-01T00:00:00Z', aparelhos: { Tablet: '2026-11-09T10:00:00Z', Computador: '2026-11-05T10:00:00Z' } });
    expect(juntarDados(daqui, dela).dados.config.aparelhos).toEqual({ Celular: '2026-11-11T10:00:00Z', Tablet: '2026-11-09T10:00:00Z', Computador: '2026-11-05T10:00:00Z' });
  });
});

describe('memória do Fast: qual VD sumiu e desde quando', () => {
  const fam = (id: string, prontuario: string, nome: string): Familia => ({
    id, rua: 'Rua das Acácias', numero: id, complemento: '', bairro: '', colmeia: '', prontuario, situacaoCasa: 'habitada', obs: '', responsavelId: `m${id}`,
    moradores: [{ id: `m${id}`, nome, sexo: 'F', nascimento: '', situacao: 'mora', situacaoDesde: '', grupos: [], obs: '' }],
  });
  const vd = (id: string, familiaId: string, data: string, extra: Partial<Visita> = {}): Visita => ({
    id, familiaId, data, presentes: [], conversouComFamilia: true, desfecho: 'realizada', motivo: 'Outros', compartilhadaCom: '', sinais: {}, orientacoes: '', relato: '', lancadaNoFast: true, ...extra,
  });
  const fs = [fam('1', '0000.04.015', 'Ana Teste Silva'), fam('2', '0000.04.020', 'Beto Exemplo Lima'), fam('3', '0000.04.030', 'Caio Teste Rocha')];
  const lista = (...l: string[]) => lerListaFast(l.join('\n'));

  it('1ª conferência: guarda as vistas; 2ª: a que já esteve lá e sumiu aparece em "sumiram do Fast"', () => {
    const vs = [vd('a', '1', '2026-11-03'), vd('b', '2', '2026-11-04'), vd('c', '3', '2026-11-05')];
    const r1 = conferirComFast(lista('03/11/2026 0000.04.015 ANA', '04/11/2026 0000.04.020 BETO', '05/11/2026 0000.04.030 CAIO'), fs, vs, '2026-11-01', '2026-11-30');
    expect(efeitosDaConferencia(r1)).toEqual({ vistas: ['a', 'b', 'c'], sumiram: [] });
    // O app guardou: as 3 foram vistas no Fast em 06/11.
    const depois = vs.map((v) => ({ ...v, vistaNoFastEm: '2026-11-06' }));
    // Na semana seguinte, a VD de 04/11 não está mais no Fast.
    const r2 = conferirComFast(lista('03/11/2026 0000.04.015 ANA', '05/11/2026 0000.04.030 CAIO'), fs, depois, '2026-11-01', '2026-11-30');
    expect(r2.sumiramDoFast.map((v) => v.id)).toEqual(['b']);
    expect(r2.sumiram).toEqual([]); // não repete no outro grupo
    expect(efeitosDaConferencia(r2)).toEqual({ vistas: ['a', 'c'], sumiram: ['b'] });
  });

  it('só acusa o que a lista colada cobre (datas da primeira à última linha)', () => {
    const vs = [vd('a', '1', '2026-11-03', { vistaNoFastEm: '2026-11-06' }), vd('c', '3', '2026-11-20', { vistaNoFastEm: '2026-11-21' })];
    // Lista só de 01/11 a 10/11: a VD de 20/11 não foi conferida, então não "sumiu".
    const r = conferirComFast(lista('01/11/2026 0000.04.020 BETO', '10/11/2026 0000.04.020 BETO'), fs, vs, '2026-11-01', '2026-11-30');
    expect(r.cobertura).toEqual({ de: '2026-11-01', ate: '2026-11-10' });
    expect(r.sumiramDoFast.map((v) => v.id)).toEqual(['a']);
    expect(r.sumiram).toEqual([]);
  });
});
