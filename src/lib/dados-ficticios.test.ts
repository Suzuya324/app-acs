import { describe, expect, it } from 'vitest';
import { gerarDadosFicticios } from './dados-ficticios';

describe('dados fictícios do protótipo', () => {
  const { familias, visitas } = gerarDadosFicticios('2026-11-18');
  const moradores = familias.flatMap((f) => f.moradores);

  it('tem tamanho parecido com uma área real (cerca de 200 famílias)', () => {
    expect(familias.length).toBe(198);
    expect(moradores.length).toBeGreaterThan(350);
  });

  it('toda casa habitada tem pelo menos um morador', () => {
    for (const f of familias.filter((x) => x.situacaoCasa === 'habitada')) {
      expect(f.moradores.some((m) => m.situacao === 'mora')).toBe(true);
    }
  });

  it('identificadores não se repetem', () => {
    expect(new Set(familias.map((f) => f.id)).size).toBe(familias.length);
    expect(new Set(moradores.map((m) => m.id)).size).toBe(moradores.length);
    expect(new Set(visitas.map((v) => v.id)).size).toBe(visitas.length);
  });

  it('gera sempre os mesmos dados (sorteio repetível)', () => {
    const outra = gerarDadosFicticios('2026-11-18');
    expect(outra.familias[10]).toEqual(familias[10]);
  });
});
