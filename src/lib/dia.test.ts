import { describe, expect, it } from 'vitest';
import type { Contexto } from './acompanhamento';
import { agenda, emOrdemDeRua, lembretes, quandoE, roteiroDoDia, sumidos } from './dia';
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
