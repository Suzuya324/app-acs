import { describe, expect, it } from 'vitest';
import { edicaoDoModo } from './edicao';

// Trava: o app dos colegas ("VDs básico") é sempre separado do app do ACS.
describe('o app dos colegas é sempre separado', () => {
  const completa = edicaoDoModo('production');
  const basica = edicaoDoModo('basica');

  it('cada um tem o seu banco de dados e as suas chaves no aparelho', () => {
    expect(basica.banco).not.toBe(completa.banco);
    expect(basica.prefixo).not.toBe(completa.prefixo);
    expect(basica.nome).not.toBe(completa.nome);
  });

  it('os nomes dos bancos nunca mudam (senão quem usa perde o acesso aos dados)', () => {
    expect(completa.banco).toBe('app-acs');
    expect(basica.banco).toBe('app-acs-basico');
    expect(completa.prefixo).toBe('facilitador');
    expect(basica.prefixo).toBe('basico.facilitador');
  });

  it('a básica é só a do modo "basica"', () => {
    expect(basica.basica).toBe(true);
    expect(completa.basica).toBe(false);
    expect(edicaoDoModo('test').basica).toBe(false);
  });
});
