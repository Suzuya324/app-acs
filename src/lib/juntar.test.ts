import { describe, expect, it } from 'vitest';
import type { Dados } from './cofre';
import { juntarDados, textoResumoJuncao } from './juntar';
import { CONFIG_PADRAO } from './rotulos';
import type { Familia, Revisita, Visita } from './tipos';

const fam = (id: string, extra: Partial<Familia> = {}): Familia => ({
  id, rua: 'Rua Teste', numero: id, complemento: '', bairro: '', colmeia: '', prontuario: '', situacaoCasa: 'habitada',
  obs: '', responsavelId: '', moradores: [], ...extra,
});
const vd = (id: string, extra: Partial<Visita> = {}): Visita => ({
  id, familiaId: 'f1', data: '2026-11-03', presentes: [], conversouComFamilia: false, desfecho: 'realizada',
  motivo: 'Outros', compartilhadaCom: '', sinais: {}, orientacoes: '', relato: 'x', lancadaNoFast: false, ...extra,
});
const rv = (id: string, extra: Partial<Revisita> = {}): Revisita => ({
  id, familiaId: 'f1', motivo: 'Entregar guia', ate: '2026-11-05', criadaEm: '2026-11-03T10:00:00Z', ...extra,
});
const dados = (extra: Partial<Dados> = {}): Dados => ({
  config: { ...CONFIG_PADRAO }, familias: [], visitas: [], historico: [], revisitas: [], ...extra,
});

describe('juntar backup do celular com o do computador', () => {
  it('soma o que só existe de um lado, sem apagar nada', () => {
    const celular = dados({ familias: [fam('f1'), fam('f2')], visitas: [vd('v1'), vd('v2')] });
    const pc = dados({ familias: [fam('f1'), fam('f3')], visitas: [vd('v1'), vd('v3')] });
    const { dados: d, resumo } = juntarDados(pc, celular);
    expect(d.familias.map((f) => f.id).sort()).toEqual(['f1', 'f2', 'f3']);
    expect(d.visitas.map((v) => v.id).sort()).toEqual(['v1', 'v2', 'v3']);
    expect(resumo.familiasNovas).toBe(1);
    expect(resumo.visitasNovas).toBe(1);
  });

  it('fica a alteração mais recente', () => {
    const aqui = dados({ familias: [fam('f1', { prontuario: 'velho', atualizadoEm: '2026-11-03T10:00:00Z' })] });
    const la = dados({ familias: [fam('f1', { prontuario: 'novo', atualizadoEm: '2026-11-03T12:00:00Z' })] });
    expect(juntarDados(aqui, la).dados.familias[0].prontuario).toBe('novo');
    expect(juntarDados(la, aqui).dados.familias[0].prontuario).toBe('novo');
  });

  it('VD marcada como lançada no PC vale no celular', () => {
    const celular = dados({ visitas: [vd('v1', { atualizadoEm: '2026-11-03T09:00:00Z' })] });
    const pc = dados({ visitas: [vd('v1', { lancadaNoFast: true, atualizadoEm: '2026-11-03T18:00:00Z' })] });
    const { dados: d, resumo } = juntarDados(celular, pc);
    expect(d.visitas[0].lancadaNoFast).toBe(true);
    expect(resumo.visitasAtualizadas).toBe(1);
  });

  it('sem data nos dois lados: lançada vence pendente; no resto fica a deste aparelho', () => {
    const aqui = dados({ visitas: [vd('v1')], familias: [fam('f1', { obs: 'daqui' })] });
    const la = dados({ visitas: [vd('v1', { lancadaNoFast: true })], familias: [fam('f1', { obs: 'de lá' })] });
    const { dados: d, resumo } = juntarDados(aqui, la);
    expect(d.visitas[0].lancadaNoFast).toBe(true);
    expect(d.familias[0].obs).toBe('daqui');
    expect(resumo.semData).toBe(1);
  });

  it('revisita feita ou cancelada num lado vale para os dois', () => {
    const aqui = dados({ revisitas: [rv('r1'), rv('r2')] });
    const la = dados({ revisitas: [rv('r1', { feitaEm: '2026-11-04' }), rv('r2'), rv('r3')] });
    const { dados: d, resumo } = juntarDados(aqui, la);
    expect(d.revisitas!.find((r) => r.id === 'r1')!.feitaEm).toBe('2026-11-04');
    expect(resumo.revisitasNovas).toBe(1);
    expect(resumo.revisitasAtualizadas).toBe(1);
  });

  it('histórico junta sem repetir; ajustes e VD pela metade ficam os deste aparelho', () => {
    const h = (id: string, quando: string) => ({ id, quando, familiaId: 'f1', texto: id });
    const aqui = dados({ historico: [h('h1', '2026-11-01T00:00:00Z')], config: { ...CONFIG_PADRAO, metaMensal: 180 } });
    const la = dados({ historico: [h('h1', '2026-11-01T00:00:00Z'), h('h0', '2026-10-01T00:00:00Z')] });
    const { dados: d } = juntarDados(aqui, la);
    expect(d.historico.map((x) => x.id)).toEqual(['h0', 'h1']);
    expect(d.config.metaMensal).toBe(180);
  });

  it('resumo em texto', () => {
    const { resumo } = juntarDados(dados({ visitas: [vd('v1')] }), dados({ visitas: [vd('v1'), vd('v2'), vd('v3')] }));
    expect(textoResumoJuncao(resumo)).toBe('2 VDs novas');
    expect(textoResumoJuncao(juntarDados(dados(), dados()).resumo)).toBe('Nada novo: os dois já estavam iguais');
  });
});
