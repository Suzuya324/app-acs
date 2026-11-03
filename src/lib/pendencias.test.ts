import { describe, expect, it } from 'vitest';
import { mudancasFamilia, mudancasMorador } from './historico';
import { listarPendencias, prontuarioIncompleto } from './pendencias';
import type { Familia, Morador } from './tipos';

const morador = (id: string, extra: Partial<Morador> = {}): Morador => ({
  id, nome: `Pessoa ${id}`, sexo: 'F', nascimento: '1980-01-01', situacao: 'mora', situacaoDesde: '', grupos: [], obs: '', ...extra,
});
const familia = (id: string, extra: Partial<Familia> = {}): Familia => ({
  id, rua: 'Rua Teste', numero: '1', complemento: '', bairro: '', colmeia: '', prontuario: '00.0001',
  situacaoCasa: 'habitada', obs: '', responsavelId: `${id}-a`, moradores: [morador(`${id}-a`)], ...extra,
});

const tipos = (f: Familia[]) => listarPendencias(f).map((p) => `${p.familia.id}:${p.tipo}${p.morador ? `:${p.morador.id}` : ''}`);

describe('o que falta completar', () => {
  it('família completa não aparece', () => {
    expect(tipos([familia('1')])).toEqual([]);
  });

  it('prontuário vazio ou incompleto', () => {
    expect(tipos([familia('1', { prontuario: '' })])).toEqual(['1:sem_prontuario']);
    expect(tipos([familia('1', { prontuario: '04.' })])).toEqual(['1:prontuario_incompleto']);
    expect(prontuarioIncompleto('04.0123')).toBe(false);
    expect(prontuarioIncompleto('04-')).toBe(true);
    expect(prontuarioIncompleto('abc')).toBe(true);
  });

  it('morador sem data de nascimento ou sem sexo', () => {
    const f = familia('1', { moradores: [morador('1-a', { nascimento: '', sexo: '' })] });
    expect(tipos([f])).toEqual(['1:sem_nascimento:1-a', '1:sem_sexo:1-a']);
  });

  it('casa sem responsável (inclusive quando o responsável mudou-se)', () => {
    expect(tipos([familia('1', { responsavelId: '' })])).toEqual(['1:sem_responsavel']);
    const mudou = familia('2', { moradores: [morador('2-a', { situacao: 'mudou' }), morador('2-b')] });
    expect(tipos([mudou])).toEqual(['2:sem_responsavel']);
  });

  it('casa habitada sem moradores; quem não mora mais não conta', () => {
    const f = familia('1', { moradores: [morador('1-a', { situacao: 'faleceu', nascimento: '' })] });
    expect(tipos([f])).toEqual(['1:sem_moradores']);
  });

  it('casas fechadas, vazias ou comércio ficam de fora', () => {
    expect(tipos([familia('1', { situacaoCasa: 'fechada', prontuario: '' })])).toEqual([]);
  });
});

describe('histórico de alterações', () => {
  it('descreve mudança de situação do morador com a data', () => {
    const antes = morador('a', { nome: 'Ana Teste' });
    const depois = { ...antes, situacao: 'mudou' as const, situacaoDesde: '2026-10-15' };
    expect(mudancasMorador(antes, depois)).toEqual(['Ana Teste: Mora aqui → Mudou-se (desde 15/10/2026)']);
  });

  it('descreve grupos incluídos e retirados', () => {
    const antes = morador('a', { nome: 'Ana Teste', grupos: ['hipertenso'] });
    const depois = { ...antes, grupos: ['diabetico' as const] };
    expect(mudancasMorador(antes, depois)).toEqual(['Ana Teste: incluído em Diabético', 'Ana Teste: retirado de Hipertenso']);
  });

  it('morador novo', () => {
    expect(mudancasMorador(null, morador('a', { nome: 'Bebê Teste', situacaoDesde: '2026-11-01' }))).toEqual([
      'Bebê Teste: morador incluído (desde 01/11/2026)',
    ]);
  });

  it('descreve mudanças da família, incluindo responsável', () => {
    const antes = familia('1', { moradores: [morador('1-a', { nome: 'Ana' }), morador('1-b', { nome: 'Bia' })] });
    const depois = { ...antes, prontuario: '00.0002', situacaoCasa: 'fechada' as const, responsavelId: '1-b' };
    expect(mudancasFamilia(antes, depois)).toEqual([
      'Prontuário: 00.0001 → 00.0002',
      'Situação da casa: Habitada → Fechada',
      'Responsável: Ana → Bia',
    ]);
  });

  it('nada mudou = nenhum registro', () => {
    const f = familia('1');
    expect(mudancasFamilia(f, { ...f })).toEqual([]);
    expect(mudancasMorador(f.moradores[0], { ...f.moradores[0] })).toEqual([]);
  });
});
