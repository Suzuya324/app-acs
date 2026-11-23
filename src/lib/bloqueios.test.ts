import { beforeEach, describe, expect, it } from 'vitest';
import { lerBloqueios, marcarSessao, quandoFoi, registrarBloqueio, sessaoEstavaAberta, textoDoBloqueio } from './bloqueios';

// Armazenamento simples de mentira (no teste não há navegador).
const memoria = new Map<string, string>();
beforeEach(() => {
  memoria.clear();
  (globalThis as unknown as { localStorage: Pick<Storage, 'getItem' | 'setItem'> }).localStorage = {
    getItem: (k) => memoria.get(k) ?? null,
    setItem: (k, v) => void memoria.set(k, v),
  };
});

describe('por que o app trancou', () => {
  it('guarda os últimos bloqueios (o mais novo primeiro, no máximo 15)', () => {
    for (let i = 0; i < 20; i++) registrarBloqueio({ em: `2026-11-23T10:${String(i).padStart(2, '0')}:00.000Z`, motivo: 'parado', minutos: 5 });
    const l = lerBloqueios();
    expect(l).toHaveLength(15);
    expect(l[0].em).toBe('2026-11-23T10:19:00.000Z');
  });

  it('sabe se o app estava destrancado quando fechou', () => {
    expect(sessaoEstavaAberta()).toBe(false);
    marcarSessao(true);
    expect(sessaoEstavaAberta()).toBe(true);
    marcarSessao(false);
    expect(sessaoEstavaAberta()).toBe(false);
  });

  it('explica cada motivo', () => {
    const lim = { minutosParado: 5, minutosFora: 1 };
    expect(textoDoBloqueio({ em: '', motivo: 'parado', minutos: 5 }, lim)).toBe('Trancou depois de 5 min sem tocar na tela.');
    expect(textoDoBloqueio({ em: '', motivo: 'fora', minutos: 3 }, lim)).toContain('3 min fora do app');
    expect(textoDoBloqueio({ em: '', motivo: 'fora', minutos: 3 }, lim)).toContain('limite: 1 min');
    expect(textoDoBloqueio({ em: '', motivo: 'fechado' }, lim)).toContain('pelo celular');
    expect(textoDoBloqueio({ em: '', motivo: 'atualizacao' }, lim)).toContain('versão nova');
  });

  it('sem armazenamento, não quebra', () => {
    (globalThis as unknown as { localStorage: unknown }).localStorage = undefined;
    expect(lerBloqueios()).toEqual([]);
    expect(() => registrarBloqueio({ em: '', motivo: 'cadeado' })).not.toThrow();
    expect(sessaoEstavaAberta()).toBe(false);
  });

  it('hora curta', () => {
    const agora = new Date(2026, 10, 23, 15, 0);
    expect(quandoFoi(new Date(2026, 10, 23, 14, 5).toISOString(), agora)).toBe('14:05');
    expect(quandoFoi(new Date(2026, 10, 22, 9, 7).toISOString(), agora)).toBe('22/11 09:07');
  });
});
