import { describe, expect, it } from 'vitest';
import { calcularAtencao, proximoAniversario } from './atencao';
import type { Familia, Morador, Visita } from './tipos';

const HOJE = '2026-11-05'; // quinta-feira
const mor = (id: string, extra: Partial<Morador> = {}): Morador => ({
  id, nome: `Pessoa ${id}`, sexo: 'F', nascimento: '1980-03-10', situacao: 'mora', situacaoDesde: '', grupos: [], obs: '', ...extra,
});
const fam = (id: string, moradores: Morador[], extra: Partial<Familia> = {}): Familia => ({
  id, rua: 'Rua Teste', numero: id, complemento: '', bairro: '', colmeia: '', prontuario: '', situacaoCasa: 'habitada',
  obs: '', responsavelId: moradores[0]?.id ?? '', moradores, ...extra,
});
const vd = (familiaId: string, data: string, extra: Partial<Visita> = {}): Visita => ({
  id: `${familiaId}-${data}`, familiaId, data, presentes: [], conversouComFamilia: true, desfecho: 'realizada', motivo: 'Outros',
  compartilhadaCom: '', sinais: {}, orientacoes: '', relato: '', lancadaNoFast: false, ...extra,
});
const tipos = (f: Familia[], v: Visita[] = []) => calcularAtencao(f, v, HOJE).map((a) => `${a.morador.id}:${a.tipo}`);

describe('atenção', () => {
  it('gestante sem VD há 30 dias aparece; com VD recente não', () => {
    const f = [fam('1', [mor('g', { grupos: ['gestante'] })])];
    expect(tipos(f)).toEqual(['g:acompanhar']);
    expect(tipos(f, [vd('1', '2026-10-01')])).toEqual(['g:acompanhar']);
    expect(tipos(f, [vd('1', '2026-10-20')])).toEqual([]);
  });

  it('ausência completa não conta como acompanhamento', () => {
    const f = [fam('1', [mor('a', { grupos: ['acamado'] })])];
    expect(tipos(f, [vd('1', '2026-11-01', { desfecho: 'ausencia_completa' })])).toEqual(['a:acamado']);
  });

  it('hipertenso sem P.A. e diabético sem glicemia há 60 dias', () => {
    const f = [fam('1', [mor('h', { grupos: ['hipertenso', 'diabetico'] })])];
    expect(tipos(f).sort()).toEqual(['h:glicemia', 'h:pa']);
    const v = [vd('1', '2026-10-01', { sinais: { h: { pa: '12x8' } } })];
    expect(tipos(f, v)).toEqual(['h:glicemia']);
  });

  it('idades: fez 60, criança cresceu, bebê fora do grupo', () => {
    const f = [fam('1', [
      mor('i', { nascimento: '1966-01-02' }),
      mor('c', { nascimento: '2023-01-01', grupos: ['crianca'] }),
      mor('b', { nascimento: '2026-01-01' }),
    ])];
    const a = calcularAtencao(f, [vd('1', '2026-11-01')], HOJE);
    expect(a.map((x) => `${x.morador.id}:${x.tipo}`).sort()).toEqual(['b:crianca_fora', 'c:crianca_cresceu', 'i:virou_idoso']);
    expect(a.find((x) => x.tipo === 'virou_idoso')!.acao).toEqual({ incluir: 'idoso', rotulo: 'Incluir em Idoso' });
  });

  it('aniversário nos próximos 7 dias, com o dia da semana', () => {
    const f = [fam('1', [mor('x', { nascimento: '1990-11-07' }), mor('y', { nascimento: '1990-11-20' })])];
    const a = calcularAtencao(f, [vd('1', '2026-11-01')], HOJE);
    expect(a.map((x) => x.texto)).toEqual(['Faz 36 anos sábado (07/11)']);
  });

  it('ignora quem mudou e casa que não é habitada', () => {
    const f = [
      fam('1', [mor('m', { grupos: ['gestante'], situacao: 'mudou' })]),
      fam('2', [mor('n', { grupos: ['gestante'] })], { situacaoCasa: 'vazia' }),
    ];
    expect(tipos(f)).toEqual([]);
  });

  it('próximo aniversário vira o ano e trata 29/02', () => {
    expect(proximoAniversario('2000-01-03', HOJE)).toBe('2027-01-03');
    expect(proximoAniversario('2000-11-05', HOJE)).toBe('2026-11-05');
    expect(proximoAniversario('2000-02-29', HOJE)).toBe('2027-02-28');
  });
});
