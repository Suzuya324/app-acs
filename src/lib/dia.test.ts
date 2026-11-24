import { describe, expect, it } from 'vitest';
import type { Contexto } from './acompanhamento';
import { agenda, casasDescansando, emOrdemDeRua, lembretes, proximaCasa, quandoE, roteiroDoDia, sumidos, type CasaDoDia } from './dia';
import type { Caso, Familia, Morador, Revisita, Visita } from './tipos';

// Tudo inventado.
const HOJE = '2026-11-11';
const mor = (id: string, nome: string, extra: Partial<Morador> = {}): Morador => ({
  id, nome, sexo: 'F', nascimento: '1980-01-01', situacao: 'mora', situacaoDesde: '', grupos: [], obs: '', ...extra,
});
const fam = (id: string, rua: string, numero: string, moradores: Morador[], extra: Partial<Familia> = {}): Familia => ({
  id, rua, numero, complemento: '', bairro: '', colmeia: '', prontuario: '', situacaoCasa: 'habitada', obs: '', responsavelId: moradores[0].id, moradores, ...extra,
});
const vd = (familiaId: string, data: string, extra: Partial<Visita> = {}): Visita => ({
  id: `v${familiaId}${data}`, familiaId, data, presentes: [], conversouComFamilia: true, desfecho: 'realizada', motivo: 'Outros', compartilhadaCom: '',
  sinais: {}, orientacoes: '', relato: '', lancadaNoFast: false, ...extra,
});
const ctx = (visitas: Visita[], casos: Caso[] = []): Contexto & { casos: Caso[] } => ({ visitas, casos, prioritarios: [], hoje: HOJE });

describe('agenda', () => {
  const ana = mor('a', 'Ana Teste');
  const f1 = fam('f1', 'Rua das Acácias', '12', [ana]);
  const visitas = [vd('f1', '2026-11-03', { anotacoes: { a: 'Tem consulta com o cardiologista no dia 12/11. Cirurgia marcada para o dia 09/11.' } })];
  const rev: Revisita = { id: 'r', familiaId: 'f1', motivo: 'Levar o pedido de exame', ate: '2026-11-14', criadaEm: '' };

  it('junta as datas escritas nas VDs e as revisitas, em ordem', () => {
    const l = agenda([f1], [rev], ctx(visitas));
    expect(l.map((c) => `${c.data} ${c.tipo}`)).toEqual(['2026-11-09 Cirurgia', '2026-11-12 Consulta', '2026-11-14 Revisita']);
    expect(l.map((c) => quandoE(c.data, HOJE))).toEqual(['passou', 'amanha', 'semana']);
    expect(lembretes(l, HOJE).map((c) => c.tipo)).toEqual(['Cirurgia', 'Consulta']);
  });
});

describe('quem está sumido', () => {
  it('sem VD há 60 dias ou nunca; a mais esquecida primeiro; ignora casa vazia', () => {
    const fs = [
      fam('f1', 'Rua das Acácias', '1', [mor('a', 'Ana Teste')]),
      fam('f2', 'Rua das Acácias', '2', [mor('b', 'Beto Teste')]),
      fam('f3', 'Rua das Acácias', '3', [mor('c', 'Caio Teste')], { ultimaVdFora: '2026-08-01' }),
      fam('f4', 'Rua das Acácias', '4', [mor('d', 'Duda Teste')], { situacaoCasa: 'vazia' }),
    ];
    const l = sumidos(fs, [vd('f1', '2026-11-01')], HOJE, 60);
    expect(l.map((s) => `${s.familia.id}:${s.dias}`)).toEqual(['f2:null', 'f3:102']);
  });
});

describe('roteiro do dia', () => {
  it('junta os motivos, deixa de fora quem já foi visitado hoje e põe em ordem de rua', () => {
    const fs = [
      fam('f1', 'Rua das Acácias', '30', [mor('a', 'Ana Teste', { nascimento: '1940-01-01' })]),
      fam('f2', 'Rua das Acácias', '12', [mor('b', 'Beto Teste')]),
      fam('f3', 'Rua dos Ipês', '7', [mor('c', 'Caio Teste')]),
      fam('f4', 'Rua dos Ipês', '9', [mor('d', 'Duda Teste')]),
    ];
    const visitas = [vd('f1', '2026-10-01'), vd('f2', '2026-11-01'), vd('f3', '2026-11-05'), vd('f4', '2026-11-11')];
    const casos: Caso[] = [{ id: 'c', familiaId: 'f2', categoria: 'urgente', titulo: 'Beto Teste, 46 anos', texto: 'Caiu.', criadoEm: '2026-11-10T00:00:00Z', atualizadoEm: '' }];
    const revisitas: Revisita[] = [{ id: 'r', familiaId: 'f3', motivo: 'Levar o pedido', ate: '2026-11-10', criadaEm: '' }];
    const casas = roteiroDoDia(fs, revisitas, ctx(visitas, casos));
    const resumo = Object.fromEntries(casas.map((c) => [c.familia.id, c.motivos.map((m) => m.texto)]));
    expect(resumo.f1[0]).toMatch(/^Nível A vencido \(última VD 01\/10\)/);
    expect(resumo.f2).toContain('Caso urgente: Beto Teste');
    expect(resumo.f3).toEqual(['Revisita: Levar o pedido']);
    expect(resumo.f4).toBeUndefined(); // visitada hoje
    expect(emOrdemDeRua(casas, ['Rua das Acácias', 'Rua dos Ipês']).map((g) => `${g.rua}: ${g.casas.map((c) => c.familia.numero).join(',')}`)).toEqual([
      'Rua das Acácias: 12,30',
      'Rua dos Ipês: 7',
    ]);
  });
});

describe('ninguém em casa várias vezes', () => {
  it('3 tentativas seguidas sem ninguém (as mais recentes)', async () => {
    const { ausentesSeguidos } = await import('./dia');
    const f1 = fam('f1', 'Rua das Acácias', '1', [mor('a', 'Ana Teste')]);
    const f2 = fam('f2', 'Rua das Acácias', '2', [mor('b', 'Beto Teste')]);
    const aus = (familiaId: string, data: string) => vd(familiaId, data, { desfecho: 'ausencia_completa' });
    const visitas = [aus('f1', '2026-11-02'), aus('f1', '2026-11-04'), aus('f1', '2026-11-06'), vd('f2', '2026-11-01'), aus('f2', '2026-11-03'), aus('f2', '2026-11-05')];
    const l = ausentesSeguidos([f1, f2], visitas);
    expect(l.map((x) => `${x.familia.id}:${x.tentativas.length}:${x.dias}`)).toEqual(['f1:3:sex, qua, seg']);
  });
});

describe('próxima casa do roteiro', () => {
  const fs = [
    fam('f1', 'Rua das Acácias', '12', [mor('a', 'Ana Teste')]),
    fam('f2', 'Rua das Acácias', '30', [mor('b', 'Beto Teste')]),
    fam('f3', 'Rua dos Ipês', '7', [mor('c', 'Caio Teste')]),
    fam('f4', 'Rua das Acácias', '20', [mor('d', 'Duda Teste')]),
  ];
  const casa = (f: Familia): CasaDoDia => ({ familia: f, motivos: [{ texto: 'x', peso: 50 }], peso: 50, puladas: 0 });
  const ruas = ['Rua das Acácias', 'Rua dos Ipês'];

  it('segue a rua e o número, mesmo quando a casa atual já saiu do roteiro; no fim volta ao começo', () => {
    const casas = [fs[0], fs[1], fs[2]].map(casa);
    expect(proximaCasa(casas, fs[3], ruas)?.familia.id).toBe('f2'); // Acácias 20 → 30
    expect(proximaCasa(casas, fs[1], ruas)?.familia.id).toBe('f3'); // fim da rua → próxima rua
    expect(proximaCasa(casas, fs[2], ruas)?.familia.id).toBe('f1'); // fim → começo
    expect(proximaCasa([casa(fs[0])], fs[0], ruas)).toBeNull();
  });

  it('quem teve "ninguém em casa" hoje sai do roteiro de hoje', () => {
    const f = fam('f9', 'Rua das Acácias', '1', [mor('z', 'Zeca Teste')]);
    expect(roteiroDoDia([f], [], ctx([])).length).toBe(1);
    expect(roteiroDoDia([f], [], ctx([vd('f9', HOJE, { desfecho: 'ausencia_completa' })])).length).toBe(0);
  });
});

describe('receita no roteiro', () => {
  it('entra no roteiro quando vence em até 15 dias ou já venceu', () => {
    const f = fam('fr', 'Rua das Acácias', '5', [mor('r', 'Rosa Teste', { grupos: ['hipertenso'], receitaEm: '2026-05-20' })]);
    const casas = roteiroDoDia([f], [], ctx([vd('fr', '2026-11-01')]));
    expect(casas[0]?.motivos.map((m) => m.texto)).toContain('Rosa: receita vence 20/11 – lembrar de renovar');
  });
});

describe('descanso depois da VD', () => {
  // Revisita vencida: sem o descanso, a casa entraria no roteiro todo dia.
  const f = fam('fv', 'Rua das Acácias', '9', [mor('v', 'Vera Teste')]);
  const rev: Revisita = { id: 'rv', familiaId: 'fv', motivo: 'Levar o pedido de exame', ate: '2026-11-01', criadaEm: '' };
  const roteiro = (visitas: Visita[], extra: Partial<Contexto> = {}) => roteiroDoDia([f], [rev], { ...ctx(visitas), ...extra }).length;

  it('visitada ontem não volta hoje; volta quando passam 5 dias', () => {
    expect(roteiro([vd('fv', '2026-10-01')])).toBe(1);
    expect(roteiro([vd('fv', '2026-11-10')])).toBe(0);
    expect(roteiro([vd('fv', '2026-11-07')])).toBe(0);
    expect(roteiro([vd('fv', '2026-11-06')])).toBe(1);
  });

  it('ninguém em casa também faz a casa descansar', () => {
    expect(roteiro([vd('fv', '2026-11-09', { desfecho: 'ausencia_completa' })])).toBe(0);
  });

  it('VD feita fora do app (última VD fora) também vale', () => {
    const fora = { ...f, ultimaVdFora: '2026-11-10' };
    expect(roteiroDoDia([fora], [rev], ctx([])).length).toBe(0);
  });

  it('o número de dias pode ser mudado (4 dias)', () => {
    expect(roteiro([vd('fv', '2026-11-07')], { diasDescanso: 4 })).toBe(1);
    expect(roteiro([vd('fv', '2026-11-08')], { diasDescanso: 4 })).toBe(0);
  });

  it('lista quem está descansando e quando volta', () => {
    const l = casasDescansando([f], [vd('fv', '2026-11-09')], HOJE);
    expect(l.map((d) => [d.familia.id, d.ultima, d.voltaEm])).toEqual([['fv', '2026-11-09', '2026-11-14']]);
    expect(casasDescansando([f], [vd('fv', '2026-11-01')], HOJE)).toEqual([]);
  });
});
