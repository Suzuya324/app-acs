import { describe, expect, it } from 'vitest';
import { linhasDoRelatorio, registradaEm, resumoDoRelatorio, textoDoRelatorio } from './relatorio-vds';
import type { Familia, Visita } from './tipos';

// Tudo inventado.
const fam = (id: string, numero: string, nomes: string[]): Familia => ({
  id, rua: 'Rua das Acácias', numero, complemento: '', bairro: '', colmeia: '', prontuario: `0000.04.${id}`, situacaoCasa: 'habitada', obs: '', responsavelId: `${id}-0`,
  moradores: nomes.map((nome, i) => ({ id: `${id}-${i}`, nome, sexo: 'F', nascimento: '', situacao: 'mora', situacaoDesde: '', grupos: [], obs: '' })),
});
const vd = (id: string, familiaId: string, data: string, extra: Partial<Visita> = {}): Visita => ({
  id, familiaId, data, presentes: [], conversouComFamilia: false, desfecho: 'realizada', motivo: 'Outros', compartilhadaCom: '', sinais: {}, orientacoes: '', relato: '', lancadaNoFast: false, ...extra,
});
const NOMES: Record<string, string> = { realizada: 'Visita realizada', ausente_realizada: 'Ausente realizada', ausencia_completa: 'Ausência', recusa: 'Recusa' };
const nome = (d: string) => NOMES[d];
const fs = [fam('1', '90', ['Ana Teste Silva', 'Beto Teste Silva']), fam('2', '10', ['Caio Exemplo Rocha'])];

describe('relatório das minhas VDs', () => {
  it('a hora do registro vem do campo novo ou do código da VD', () => {
    expect(registradaEm(vd('x', '1', '2026-11-19', { criadaEm: '2026-11-19T13:05:00.000Z' }))).toBe('2026-11-19T13:05:00.000Z');
    const t = Date.UTC(2026, 10, 19, 12, 30);
    expect(registradaEm(vd(`v${t.toString(36)}abc`, '1', '2026-11-19'))).toBe(new Date(t).toISOString());
    expect(registradaEm(vd('sv-123', '1', '2026-11-19'))).toBe('');
  });

  it('lista por dia e hora, com presentes, ausentes, sinais e Fast; resumo conta famílias e pessoas', () => {
    const vs = [
      vd('b', '1', '2026-11-19', { presentes: ['1-0'], desfecho: 'ausente_realizada', sinais: { '1-0': { pa: '130x80' } }, criadaEm: '2026-11-19T15:00:00Z', lancadaNoFast: true, lancadaEm: '2026-11-19T20:00:00Z' }),
      vd('a', '2', '2026-11-19', { presentes: ['2-0'], criadaEm: '2026-11-19T12:00:00Z', relato: 'Realizada VD.' }),
      vd('c', '2', '2026-11-18', { desfecho: 'ausencia_completa' }),
      vd('d', '1', '2026-10-01'),
    ];
    const l = linhasDoRelatorio(vs, fs, '2026-11-01', '2026-11-30', nome);
    expect(l.map((x) => x.visita.id)).toEqual(['c', 'a', 'b']);
    expect(l[2]).toMatchObject({ presentes: ['Ana Teste Silva'], ausentes: ['Beto Teste Silva'], sinais: 'Ana: P.A. 130x80', lancada: true, conta: true });
    expect(l[0]).toMatchObject({ conta: false, presentes: [], ausentes: [] });
    const r = resumoDoRelatorio(l);
    expect(r).toMatchObject({ total: 3, familias: 2, familiasQueContam: 2, pessoas: 2, lancadas: 1, faltaLancar: 2 });
    expect(r.dias).toEqual([{ data: '2026-11-18', vds: 1, familias: 1 }, { data: '2026-11-19', vds: 2, familias: 2 }]);
    const t = textoDoRelatorio(l, 'novembro de 2026');
    expect(t).toContain('3 VDs · 2 famílias · 2 famílias que contam para a meta · 2 pessoas atendidas');
    expect(t).toContain('=== 19/11/2026 (quinta) – 2 VDs ===');
    expect(t).toContain('Presentes: Ana Teste Silva');
    expect(t).toContain('Fast: FALTA LANÇAR');
    expect(textoDoRelatorio(l, 'x', false)).not.toContain('Relato:');
  });
});
