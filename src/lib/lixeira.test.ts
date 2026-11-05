import { describe, expect, it } from 'vitest';
import type { Dados } from './cofre';
import { juntarDados } from './juntar';
import { excluirFamilia, excluirMorador, excluirVisita, itensNaLixeira, NaoDaParaRestaurar, restaurar } from './lixeira';
import { CONFIG_PADRAO } from './rotulos';
import type { Familia, Morador, Revisita, Visita } from './tipos';

const mor = (id: string): Morador => ({ id, nome: `Pessoa ${id}`, sexo: 'F', nascimento: '', situacao: 'mora', situacaoDesde: '', grupos: [], obs: '' });
const fam = (id: string, moradores = [mor(`${id}-a`), mor(`${id}-b`)]): Familia => ({
  id, rua: 'Rua Teste', numero: '1', complemento: '', bairro: '', colmeia: '', prontuario: '', situacaoCasa: 'habitada',
  obs: '', responsavelId: moradores[0]?.id ?? '', moradores,
});
const vd = (id: string, familiaId: string, extra: Partial<Visita> = {}): Visita => ({
  id, familiaId, data: '2026-11-03', presentes: [], conversouComFamilia: false, desfecho: 'realizada', motivo: 'Outros',
  compartilhadaCom: '', sinais: {}, orientacoes: '', relato: 'x', lancadaNoFast: false, ...extra,
});
const rv = (id: string, familiaId: string, extra: Partial<Revisita> = {}): Revisita => ({
  id, familiaId, motivo: 'Entregar guia', ate: '2026-11-05', criadaEm: '2026-11-01T00:00:00Z', ...extra,
});
const dados = (extra: Partial<Dados> = {}): Dados => ({
  config: { ...CONFIG_PADRAO }, familias: [fam('f1'), fam('f2')], visitas: [vd('v1', 'f1'), vd('v2', 'f2')], historico: [], revisitas: [], lixeira: [], ...extra,
});

describe('lixeira', () => {
  it('excluir VD tira da lista e guarda na lixeira; restaurar devolve', () => {
    const d1 = excluirVisita(dados(), 'v1', 'VD de 03/11');
    expect(d1.visitas.map((v) => v.id)).toEqual(['v2']);
    const [item] = itensNaLixeira(d1);
    expect(item.descricao).toBe('VD de 03/11');
    const d2 = restaurar(d1, item.id);
    expect(d2.visitas.map((v) => v.id).sort()).toEqual(['v1', 'v2']);
    expect(itensNaLixeira(d2)).toEqual([]);
  });

  it('excluir VD reabre a revisita resolvida nela; restaurar resolve de novo', () => {
    const d0 = dados({
      visitas: [vd('v1', 'f1', { revisitasFeitas: ['r1'] })],
      revisitas: [rv('r1', 'f1', { feitaEm: '2026-11-03', visitaId: 'v1' })],
    });
    const d1 = excluirVisita(d0, 'v1', 'VD');
    expect(d1.revisitas![0].feitaEm).toBeUndefined();
    const d2 = restaurar(d1, itensNaLixeira(d1)[0].id);
    expect(d2.revisitas![0].feitaEm).toBe('2026-11-03');
  });

  it('excluir família leva junto as VDs e revisitas dela', () => {
    const d1 = excluirFamilia(dados({ revisitas: [rv('r1', 'f1'), rv('r2', 'f2')] }), 'f1', 'Família');
    expect(d1.familias.map((f) => f.id)).toEqual(['f2']);
    expect(d1.visitas.map((v) => v.id)).toEqual(['v2']);
    expect(d1.revisitas!.map((r) => r.id)).toEqual(['r2']);
    const d2 = restaurar(d1, itensNaLixeira(d1)[0].id);
    expect(d2.familias.map((f) => f.id).sort()).toEqual(['f1', 'f2']);
    expect(d2.visitas.map((v) => v.id).sort()).toEqual(['v1', 'v2']);
    expect(d2.revisitas!.map((r) => r.id).sort()).toEqual(['r1', 'r2']);
  });

  it('excluir o responsável deixa a casa sem responsável; restaurar volta', () => {
    const d1 = excluirMorador(dados(), 'f1', 'f1-a', 'Pessoa');
    const f1 = d1.familias.find((f) => f.id === 'f1')!;
    expect(f1.moradores.map((m) => m.id)).toEqual(['f1-b']);
    expect(f1.responsavelId).toBe('');
    const d2 = restaurar(d1, itensNaLixeira(d1)[0].id);
    const f1b = d2.familias.find((f) => f.id === 'f1')!;
    expect(f1b.moradores.map((m) => m.id).sort()).toEqual(['f1-a', 'f1-b']);
    expect(f1b.responsavelId).toBe('f1-a');
  });

  it('não restaura morador nem VD se a família também está na lixeira', () => {
    let d = excluirMorador(dados(), 'f1', 'f1-a', 'Pessoa');
    d = excluirFamilia(d, 'f1', 'Família');
    const morador = itensNaLixeira(d).find((i) => i.tipo === 'morador')!;
    expect(() => restaurar(d, morador.id)).toThrow(NaoDaParaRestaurar);
  });

  it('juntar: o que foi para a lixeira num aparelho sai do outro também', () => {
    const celular = excluirVisita(dados(), 'v1', 'VD');
    const pc = dados();
    const { dados: noPc } = juntarDados(pc, celular);
    expect(noPc.visitas.map((v) => v.id)).toEqual(['v2']);
    expect(itensNaLixeira(noPc)).toHaveLength(1);
  });

  it('juntar: restaurado num aparelho volta no outro', () => {
    const excluido = excluirVisita(dados(), 'v1', 'VD');
    const restaurado = restaurar(excluido, itensNaLixeira(excluido)[0].id);
    const { dados: d } = juntarDados(excluido, restaurado);
    expect(d.visitas.map((v) => v.id).sort()).toEqual(['v1', 'v2']);
    expect(itensNaLixeira(d)).toEqual([]);
  });
});
