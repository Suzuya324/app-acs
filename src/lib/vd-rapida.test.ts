import { describe, expect, it } from 'vitest';
import { emAbertoNaCasa, montarVisitaSemNovidade, OBSERVACAO_PADRAO, temasDaUltimaVD } from './vd-rapida';
import type { Caso, Familia, Morador, Revisita, Visita } from './tipos';

// Tudo inventado.
const mor = (id: string, nome: string, extra: Partial<Morador> = {}): Morador => ({
  id, nome, sexo: 'F', nascimento: '1980-01-01', situacao: 'mora', situacaoDesde: '', grupos: [], obs: '', ...extra,
});
const fam = (moradores: Morador[]): Familia => ({
  id: 'f1', rua: 'Rua das Acácias', numero: '12', complemento: '', bairro: '', colmeia: '', prontuario: '00.0001', situacaoCasa: 'habitada', obs: '', responsavelId: moradores[0].id, moradores,
});
const base = (f: Familia, extra: Partial<Parameters<typeof montarVisitaSemNovidade>[0]> = {}) => ({
  familia: f, presentes: f.moradores.map((m) => m.id), conversou: false, data: '2026-11-23', motivo: 'Outros', motivoPadrao: 'Outros',
  compartilhadaCom: '', temas: [], observacao: OBSERVACAO_PADRAO, visitas: [] as Visita[], nomeCompleto: false, ...extra,
});
const vd = (data: string, orientacoes = ''): Visita => ({
  id: `v${data}`, familiaId: 'f1', data, presentes: [], conversouComFamilia: true, desfecho: 'realizada', motivo: 'Outros', compartilhadaCom: '', sinais: {}, orientacoes, relato: '', lancadaNoFast: false,
});

describe('VD sem novidade', () => {
  const f = fam([mor('a', 'Ana Teste'), mor('b', 'Bia Teste')]);

  it('todos presentes: visita realizada, que conta para a meta, com o relato pronto', () => {
    const r = montarVisitaSemNovidade(base(f))!;
    expect(r.desfecho).toBe('realizada');
    expect(r.visita.presentes).toEqual(['a', 'b']);
    expect(r.visita.lancadaNoFast).toBe(false);
    expect(r.relato).toContain('Ana');
    expect(r.relato).toContain('Bia');
    expect(r.relato).toContain('sem queixas');
    expect(r.visita.relato).toBe(r.relato);
    expect(r.visita.data).toBe('2026-11-23');
  });

  it('só um presente: ausente realizada; conversando com a família: realizada', () => {
    expect(montarVisitaSemNovidade(base(f, { presentes: ['a'] }))!.desfecho).toBe('ausente_realizada');
    expect(montarVisitaSemNovidade(base(f, { presentes: ['a'], conversou: true }))!.desfecho).toBe('realizada');
  });

  it('ninguém presente: não monta VD (é "ninguém em casa")', () => {
    expect(montarVisitaSemNovidade(base(f, { presentes: [] }))).toBeNull();
  });

  it('ignora presente que não mora mais na casa', () => {
    const g = fam([mor('a', 'Ana Teste'), mor('b', 'Bia Teste', { situacao: 'mudou' })]);
    const r = montarVisitaSemNovidade(base(g, { presentes: ['a', 'b'] }))!;
    expect(r.visita.presentes).toEqual(['a']);
    expect(r.desfecho).toBe('realizada');
  });

  it('orientações, compartilhada e motivo diferente do padrão entram no texto', () => {
    const r = montarVisitaSemNovidade(base(f, { temas: ['dengue', 'vacinas'], compartilhadaCom: 'técnica de enfermagem', motivo: 'Busca ativa' }))!;
    expect(r.visita.orientacoes).toBe('dengue e vacinas');
    expect(r.visita.compartilhadaCom).toBe('técnica de enfermagem');
    expect(r.relato).toContain('técnica de enfermagem');
    expect(r.relato.toLowerCase()).toContain('busca ativa');
  });
});

describe('o que está em aberto na casa e orientações da última VD', () => {
  it('conta revisitas abertas e casos abertos só dessa casa', () => {
    const rev = (extra: Partial<Revisita>): Revisita => ({ id: 'r', familiaId: 'f1', motivo: 'x', ate: '2026-11-30', criadaEm: '2026-11-01', ...extra });
    const caso = (extra: Partial<Caso>): Caso => ({ id: 'c', familiaId: 'f1', categoria: 'importante', titulo: 't', texto: 'x', criadoEm: '', atualizadoEm: '', ...extra });
    const r = emAbertoNaCasa('f1', [rev({}), rev({ feitaEm: '2026-11-10' }), rev({ canceladaEm: 'x' }), rev({ familiaId: 'f2' })], [caso({}), caso({ resolvidoEm: 'x' }), caso({ familiaId: 'f2' })]);
    expect(r).toEqual({ revisitas: 1, casos: 1 });
  });

  it('repete os temas da última VD (só os conhecidos)', () => {
    const v = [vd('2026-10-01', 'dengue'), vd('2026-11-01', 'consultas, vacinas e algo diferente')];
    expect(temasDaUltimaVD('f1', v, '2026-11-23')).toEqual(['consultas', 'vacinas']);
    expect(temasDaUltimaVD('f1', [], '2026-11-23')).toEqual([]);
  });
});
