import { describe, expect, it } from 'vitest';
import { casasParaRevisitar, nivelDaFamilia, perguntasDaFamilia, proximaVisita } from './nivel';
import type { Familia, Morador, Visita } from './tipos';

const HOJE = '2026-11-05';
const mor = (id: string, extra: Partial<Morador> = {}): Morador => ({
  id, nome: `Pessoa${id} Teste`, sexo: 'F', nascimento: '1990-01-01', situacao: 'mora', situacaoDesde: '', grupos: [], obs: '', ...extra,
});
const fam = (id: string, moradores: Morador[], extra: Partial<Familia> = {}): Familia => ({
  id, rua: 'Rua Teste', numero: id, complemento: '', bairro: '', colmeia: '', prontuario: '', situacaoCasa: 'habitada', obs: '',
  responsavelId: '', moradores, ...extra,
});
const vd = (familiaId: string, data: string, desfecho: Visita['desfecho'] = 'realizada'): Visita => ({
  id: `${familiaId}${data}`, familiaId, data, presentes: [], conversouComFamilia: true, desfecho, motivo: 'Outros',
  compartilhadaCom: '', sinais: {}, orientacoes: '', relato: '', lancadaNoFast: true,
});

describe('nível da casa', () => {
  it('80+ ou condição grave = A; 60+ ou crônica = B; senão C', () => {
    expect(nivelDaFamilia(fam('1', [mor('a', { nascimento: '1940-01-01' })]), HOJE).nivel).toBe('A');
    expect(nivelDaFamilia(fam('1', [mor('a', { grupos: ['acamado'] })]), HOJE)).toEqual({ nivel: 'A', motivo: 'Pessoaa: acamado' });
    expect(nivelDaFamilia(fam('1', [mor('a', { nascimento: '1960-01-01' })]), HOJE).nivel).toBe('B');
    expect(nivelDaFamilia(fam('1', [mor('a', { grupos: ['hipertenso'] })]), HOJE).motivo).toBe('Pessoaa: hipertenso');
    expect(nivelDaFamilia(fam('1', [mor('a')]), HOJE).nivel).toBe('C');
    expect(nivelDaFamilia(fam('1', [mor('a')], { nivel: 'B' }), HOJE)).toEqual({ nivel: 'B', motivo: 'marcado por você' });
    // quem mudou não conta
    expect(nivelDaFamilia(fam('1', [mor('a', { grupos: ['acamado'], situacao: 'mudou' })]), HOJE).nivel).toBe('C');
  });

  it('próxima VD: 10 dias (A) ou 30 (B) depois da última que conta, inclusive a feita fora do app', () => {
    const a = fam('1', [mor('a', { grupos: ['oxigenio'] })]);
    expect(proximaVisita(a, [vd('1', '2026-10-20'), vd('1', '2026-10-30', 'ausencia_completa')], HOJE)).toBe('2026-10-30');
    expect(proximaVisita({ ...a, ultimaVdFora: '2026-11-01' }, [vd('1', '2026-10-20')], HOJE)).toBe('2026-11-11');
    expect(proximaVisita(fam('2', [mor('a', { grupos: ['diabetico'] })]), [], HOJE)).toBe(HOJE);
    expect(proximaVisita(fam('3', [mor('a')]), [], HOJE)).toBeNull();
  });

  it('lista para revisitar: A primeiro, mais atrasada antes; casa vazia não entra', () => {
    const fs = [
      fam('b', [mor('x', { grupos: ['hipertenso'] })]),
      fam('a', [mor('y', { grupos: ['acamado'] })]),
      fam('c', [mor('z', { grupos: ['acamado'] })], { situacaoCasa: 'vazia' }),
      fam('d', [mor('w', { grupos: ['hipertenso'] })]),
    ];
    const l = casasParaRevisitar(fs, [vd('a', '2026-10-01'), vd('d', '2026-11-01')], HOJE);
    expect(l.map((x) => `${x.familia.id}:${x.nivel}:${x.ate}`)).toEqual(['a:A:2026-10-11', 'b:B:2026-11-05']);
  });

  it('o que perguntar, por pessoa, 80+ e atenção da casa', () => {
    const f = fam('1', [mor('a', { grupos: ['diabetico', 'hipertenso'] }), mor('b', { nascimento: '1940-01-01' })], { atencao: 'Cuidadora sobrecarregada' });
    expect(perguntasDaFamilia(f, HOJE)).toEqual([
      'Pessoaa: glicemia, remédios, alimentação, pés; pressão, remédio, dor de cabeça/tontura',
      '80+: quedas, remédios, hidratação, quem ajuda em casa',
      'Atenção: Cuidadora sobrecarregada',
    ]);
    expect(perguntasDaFamilia(fam('2', [mor('a')]), HOJE)[0]).toMatch(/Sem condição marcada/);
  });
});
