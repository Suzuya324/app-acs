import { describe, expect, it } from 'vitest';
import { coresDoMapa, ordenarPorColmeia, ordenarPorProntuario } from './mapa';
import type { Familia, Revisita, Visita } from './tipos';

const fam = (id: string, extra: Partial<Familia> = {}): Familia => ({
  id, rua: 'Rua Teste', numero: id, complemento: '', bairro: '', colmeia: '', prontuario: '', situacaoCasa: 'habitada', obs: '',
  responsavelId: '', moradores: [{ id: `${id}-a`, nome: 'Pessoa Teste', sexo: 'F', nascimento: '', situacao: 'mora', situacaoDesde: '', grupos: [], obs: '' }],
  ...extra,
});
const vd = (familiaId: string, data: string, desfecho: Visita['desfecho']): Visita => ({
  id: `${familiaId}-${data}`, familiaId, data, presentes: [], conversouComFamilia: true, desfecho, motivo: 'Outros',
  compartilhadaCom: '', sinais: {}, orientacoes: '', relato: '', lancadaNoFast: false,
});
const periodo = { inicio: '2026-10-31', fim: '2026-11-30', rotulo: 'novembro' };

describe('mapa da área', () => {
  it('pinta cada casa conforme a situação no período', () => {
    const familias = [fam('1'), fam('2'), fam('3'), fam('4'), fam('5', { situacaoCasa: 'vazia' }), fam('6')];
    const visitas = [vd('1', '2026-11-03', 'realizada'), vd('2', '2026-11-03', 'ausencia_completa'), vd('6', '2026-10-15', 'realizada')];
    const revisitas: Revisita[] = [{ id: 'r', familiaId: '3', motivo: 'Entregar guia', ate: '2026-11-10', criadaEm: '' }];
    const c = coresDoMapa(familias, visitas, revisitas, periodo);
    expect(['1', '2', '3', '4', '5', '6'].map((id) => c.get(id))).toEqual(['conta', 'revisitar', 'marcada', 'falta', 'fora', 'falta']);
  });

  it('prontuário em ordem numérica; incompleto e vazio no fim', () => {
    const f = [fam('a', { prontuario: '04.0100' }), fam('b', { prontuario: '' }), fam('c', { prontuario: '04.0099' }), fam('d', { prontuario: '3.0500' }), fam('e', { prontuario: '04.' })];
    expect(ordenarPorProntuario(f).map((x) => x.id)).toEqual(['d', 'c', 'a', 'e', 'b']);
  });

  it('colmeia em ordem numérica, sem colmeia no fim', () => {
    const f = [fam('a', { colmeia: '12' }), fam('b'), fam('c', { colmeia: '3' })];
    expect(ordenarPorColmeia(f).map((x) => x.id)).toEqual(['c', 'a', 'b']);
  });
});
