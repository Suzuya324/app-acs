import { describe, expect, it } from 'vitest';
import { armazenamentoMemoria } from './armazenamento';
import { Cofre } from './cofre';
import { gerarRelato } from './relato';
import { CONFIG_PADRAO, textoRevisitaFeita } from './rotulos';
import type { Morador } from './tipos';

const ana: Morador = { id: 'a', nome: 'Ana Teste', sexo: 'F', nascimento: '', situacao: 'mora', situacaoDesde: '', grupos: [], obs: '' };

describe('revisitas no relato', () => {
  it('motivos conhecidos viram frase de "feito"', () => {
    expect(textoRevisitaFeita('Entregar guia de encaminhamento')).toBe('entregue guia de encaminhamento');
    expect(textoRevisitaFeita('Avisar consulta agendada')).toBe('avisada a família sobre consulta agendada');
    expect(textoRevisitaFeita('Levar cartão SUS')).toBe('realizado: levar cartão SUS');
  });

  it('entra no relato depois das orientações', () => {
    const t = gerarRelato({
      desfecho: 'realizada', presentes: [ana], ausentes: [], conversouComFamilia: false, sinais: {},
      orientacoes: 'consultas', compartilhadaCom: '', contador: 0, feitos: ['entregue guia de encaminhamento'],
    });
    expect(t).toBe('Realizada VD, presente Ana, orientada sobre consultas, entregue guia de encaminhamento.');
  });
});

describe('revisitas no cofre', () => {
  it('são guardadas e voltam; cofre antigo abre com lista vazia', async () => {
    const armaz = armazenamentoMemoria();
    const c = new Cofre(armaz, 1000);
    await c.criar('482916', { config: { ...CONFIG_PADRAO }, familias: [], visitas: [], historico: [] });
    expect((await (async () => { c.trancar(); return c.abrir('482916'); })()).revisitas).toEqual([]);
    const r = { id: 'r1', familiaId: 'f1', motivo: 'Entregar guia de encaminhamento', ate: '2026-11-05', criadaEm: '2026-11-03T10:00:00Z' };
    await c.gravar({ revisitas: [r] });
    c.trancar();
    expect((await c.abrir('482916')).revisitas).toEqual([r]);
  });
});
