import { describe, expect, it } from 'vitest';
import { armazenamentoMemoria } from './armazenamento';
import { Cofre, type Dados } from './cofre';
import { mudancasVisita } from './historico';
import { juntarNomes, separarNomes } from './relato';
import { CONFIG_PADRAO } from './rotulos';
import type { RascunhoVD, Visita } from './tipos';

const visita = (extra: Partial<Visita> = {}): Visita => ({
  id: 'v1', familiaId: 'f1', data: '2026-11-03', presentes: ['a'], conversouComFamilia: false,
  desfecho: 'ausente_realizada', motivo: 'Outros', compartilhadaCom: '', sinais: {}, orientacoes: 'consultas',
  relato: 'Realizada VD, presente Ana, ausente Bia, orientada sobre consultas.', lancadaNoFast: true, ...extra,
});
const nome = (id: string) => ({ a: 'Ana', b: 'Bia' })[id] ?? '?';
const nomeDesfecho = (d: string) => ({ realizada: 'Visita realizada', ausente_realizada: 'Ausente realizada' })[d] ?? d;

describe('corrigir VD: o que vai para o histórico', () => {
  it('descreve data, desfecho e presentes alterados numa linha só', () => {
    const antes = visita();
    const depois = visita({ data: '2026-11-02', presentes: ['a', 'b'], desfecho: 'realizada', relato: 'outro' });
    expect(mudancasVisita(antes, depois, nome, nomeDesfecho)).toEqual([
      'VD de 03/11/2026 corrigida: data 03/11/2026 → 02/11/2026; desfecho Ausente realizada → Visita realizada; presentes + Bia; relato alterado',
    ]);
  });

  it('nada mudou = nenhum registro', () => {
    expect(mudancasVisita(visita(), visita(), nome, nomeDesfecho)).toEqual([]);
  });

  it('lançamento no Fast não conta como correção', () => {
    expect(mudancasVisita(visita(), visita({ lancadaNoFast: false }), nome, nomeDesfecho)).toEqual([]);
  });
});

describe('orientações: ida e volta', () => {
  it('separarNomes desfaz juntarNomes', () => {
    for (const lista of [[], ['consultas'], ['consultas', 'dengue'], ['consultas', 'dengue', 'cartão SUS']]) {
      expect(separarNomes(juntarNomes(lista))).toEqual(lista);
    }
  });
});

describe('rascunho da VD no cofre', () => {
  const dados = (): Dados => ({ config: { ...CONFIG_PADRAO }, familias: [], visitas: [], historico: [] });
  const rascunho: RascunhoVD = {
    familiaId: 'f1', salvoEm: '2026-11-03T12:00:00Z', data: '2026-11-03', presentes: ['a'], conversou: false,
    recusou: false, desfechoManual: null, motivo: 'Outros', compartilhada: true, compartilhadaCom: 'técnica Rosa Teste',
    sinais: { a: { pa: '130/85' } }, temas: ['consultas'], outrosTemas: '', relatoEditado: null,
  };

  it('fica guardado criptografado e volta depois do PIN', async () => {
    const armaz = armazenamentoMemoria();
    const c = new Cofre(armaz, 1000);
    await c.criar('482916', dados());
    await c.gravar({ rascunho });
    c.trancar();
    const bruto = JSON.stringify([...armaz.bruto.values()], (_k, v) => (v instanceof Uint8Array ? '' : v));
    expect(bruto).not.toContain('Rosa');
    const lidos = await c.abrir('482916');
    expect(lidos.rascunho).toEqual(rascunho);
  });

  it('cofre antigo, sem rascunho, abre com rascunho vazio', async () => {
    const armaz = armazenamentoMemoria();
    const c = new Cofre(armaz, 1000);
    await c.criar('482916', dados());
    armaz.bruto.delete('dados:rascunho');
    c.trancar();
    expect((await c.abrir('482916')).rascunho).toBeNull();
  });
});
