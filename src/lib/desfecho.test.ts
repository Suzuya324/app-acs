import { describe, expect, it } from 'vitest';
import { contaParaMeta, sugerirDesfecho } from './desfecho';

describe('desfecho automático', () => {
  const base = { totalMoradores: 3, presentes: 0, conversouComFamilia: false, recusou: false };

  it('todos presentes → Visita realizada', () => {
    expect(sugerirDesfecho({ ...base, presentes: 3 })).toBe('realizada');
  });

  it('conversou com a família → Visita realizada, mesmo sem todos presentes', () => {
    expect(sugerirDesfecho({ ...base, presentes: 1, conversouComFamilia: true })).toBe('realizada');
  });

  it('alguém atendeu, mas não todos → Ausente realizada', () => {
    expect(sugerirDesfecho({ ...base, presentes: 1 })).toBe('ausente_realizada');
    expect(sugerirDesfecho({ ...base, presentes: 2 })).toBe('ausente_realizada');
  });

  it('ninguém em casa → Ausência da família completa', () => {
    expect(sugerirDesfecho(base)).toBe('ausencia_completa');
  });

  it('família não quis receber → Recusa (tem prioridade)', () => {
    expect(sugerirDesfecho({ ...base, presentes: 3, recusou: true })).toBe('recusa');
  });

  it('família de uma pessoa só, presente → Visita realizada', () => {
    expect(sugerirDesfecho({ ...base, totalMoradores: 1, presentes: 1 })).toBe('realizada');
  });

  it('só realizada e ausente realizada contam para a meta', () => {
    expect(contaParaMeta('realizada')).toBe(true);
    expect(contaParaMeta('ausente_realizada')).toBe(true);
    expect(contaParaMeta('ausencia_completa')).toBe(false);
    expect(contaParaMeta('recusa')).toBe(false);
  });
});
