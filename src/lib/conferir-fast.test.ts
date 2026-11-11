import { describe, expect, it } from 'vitest';
import { conferirComFast, lerListaFast } from './conferir-fast';
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
