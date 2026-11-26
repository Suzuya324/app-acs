import { describe, expect, it } from 'vitest';
import type { Contexto } from './acompanhamento';
import { casasDescansando, casasGraves, casasPausadas, maisImportantes, periodoDaTentativa, puladaHoje, roteiroDoDia, vezesPulada } from './dia';
import { listaParaApa, listaParaEnfermeira, listaParaMedica, textoParaEquipe } from './equipe';
import { agruparPorRua, ordenarParaAndar } from './roteiro';
import type { Caso, Familia, Morador, Revisita, Visita } from './tipos';

// Tudo inventado.
const HOJE = '2026-11-11';
const mor = (id: string, nome: string, extra: Partial<Morador> = {}): Morador => ({
  id, nome, sexo: 'F', nascimento: '1980-01-01', situacao: 'mora', situacaoDesde: '', grupos: [], obs: '', ...extra,
});
const fam = (id: string, numero: string, moradores: Morador[], extra: Partial<Familia> = {}): Familia => ({
  id, rua: 'Rua das Acácias', numero, complemento: '', bairro: '', colmeia: '', prontuario: '', situacaoCasa: 'habitada', obs: '', responsavelId: moradores[0]?.id ?? '', moradores, ...extra,
});
const vd = (familiaId: string, data: string, extra: Partial<Visita> = {}): Visita => ({
  id: `v${familiaId}${data}`, familiaId, data, presentes: [], conversouComFamilia: true, desfecho: 'realizada', motivo: 'Outros', compartilhadaCom: '',
  sinais: {}, orientacoes: '', relato: '', lancadaNoFast: false, ...extra,
});
const ausente = (familiaId: string, data: string, extra: Partial<Visita> = {}) => vd(familiaId, data, { desfecho: 'ausencia_completa', conversouComFamilia: false, ...extra });
const caso = (familiaId: string, categoria: Caso['categoria'], texto: string, extra: Partial<Caso> = {}): Caso => ({
  id: `c${familiaId}${categoria}`, familiaId, categoria, titulo: 'Fulana Teste, 70 anos', texto, criadoEm: '2026-11-01T00:00:00Z', atualizadoEm: '', ...extra,
});
const ctx = (visitas: Visita[], casos: Caso[] = []): Contexto & { casos: Caso[] } => ({ visitas, casos, prioritarios: [], hoje: HOJE });
/** Hora local de um dia (o teste não depende do fuso do computador). */
const as = (dia: string, hora: number) => new Date(Number(dia.slice(0, 4)), Number(dia.slice(5, 7)) - 1, Number(dia.slice(8, 10)), hora, 0).toISOString();

describe('pular hoje', () => {
  const f = fam('f1', '9', [mor('a', 'Ana Teste')], { puladas: ['2026-11-11'] });
  const rev: Revisita = { id: 'r', familiaId: 'f1', motivo: 'Levar o pedido', ate: '2026-11-01', criadaEm: '' };

  it('a casa pulada some hoje e volta amanhã', () => {
    expect(puladaHoje(f, HOJE)).toBe(true);
    expect(roteiroDoDia([f], [rev], ctx([])).length).toBe(0);
    const amanha = { ...ctx([]), hoje: '2026-11-12' };
    expect(roteiroDoDia([f], [rev], amanha).length).toBe(1);
  });

  it('conta quantas vezes foi pulada nos últimos 14 dias', () => {
    const g = fam('f2', '5', [mor('b', 'Beto Teste')], { puladas: ['2026-10-01', '2026-11-05', '2026-11-08', '2026-11-11'] });
    expect(vezesPulada(g, HOJE)).toBe(3);
    const casas = roteiroDoDia([{ ...g, puladas: ['2026-11-05', '2026-11-08'] }], [{ ...rev, familiaId: 'f2' }], ctx([]));
    expect(casas[0].puladas).toBe(2);
  });
});

describe('caso grave descansa menos', () => {
  const rev = (id: string): Revisita => ({ id: `r${id}`, familiaId: id, motivo: 'Levar o pedido', ate: '2026-11-01', criadaEm: '' });

  it('caso urgente aberto: volta depois de 2 dias, e a lista avisa', () => {
    const f = fam('f1', '9', [mor('a', 'Ana Teste')]);
    const casos = [caso('f1', 'urgente', 'Febre alta.')];
    const visitas = [vd('f1', '2026-11-08')]; // 3 dias atrás
    expect(roteiroDoDia([f], [rev('f1')], ctx(visitas)).length).toBe(0); // casa comum: ainda descansa
    expect(roteiroDoDia([f], [rev('f1')], ctx(visitas, casos)).length).toBe(1);
    const graves = casasGraves([f], ctx(visitas, casos));
    expect(graves.has('f1')).toBe(true);
    const l = casasDescansando([f], [vd('f1', '2026-11-10')], HOJE, 5, graves);
    expect(l[0]).toMatchObject({ grave: true, voltaEm: '2026-11-12' });
  });

  it('acamado e oxigênio também; o número de dias pode ser mudado', () => {
    const f = fam('f2', '4', [mor('b', 'Beto Teste', { grupos: ['acamado'] })]);
    expect(casasGraves([f], ctx([])).has('f2')).toBe(true);
    const visitas = [vd('f2', '2026-11-09')]; // 2 dias atrás
    expect(roteiroDoDia([f], [rev('f2')], ctx(visitas)).length).toBe(1);
    expect(roteiroDoDia([f], [rev('f2')], { ...ctx(visitas), diasDescansoGrave: 3 }).length).toBe(0);
  });

  it('casa comum não é grave', () => {
    expect(casasGraves([fam('f3', '1', [mor('c', 'Caio Teste')])], ctx([])).size).toBe(0);
  });
});

describe('ninguém em casa: outro horário e pausa', () => {
  const f = fam('f1', '9', [mor('a', 'Ana Teste')]);

  it('descobre o período da tentativa pela hora do registro (só se foi no próprio dia)', () => {
    expect(periodoDaTentativa(ausente('f1', '2026-11-04', { criadaEm: as('2026-11-04', 9) }))).toBe('manha');
    expect(periodoDaTentativa(ausente('f1', '2026-11-04', { criadaEm: as('2026-11-04', 15) }))).toBe('tarde');
    expect(periodoDaTentativa(ausente('f1', '2026-11-04', { criadaEm: as('2026-11-04', 19) }))).toBe('noite');
    expect(periodoDaTentativa(ausente('f1', '2026-11-04', { criadaEm: as('2026-11-09', 9) }))).toBeNull();
    expect(periodoDaTentativa(ausente('f1', '2026-11-04'))).toBeNull();
  });

  it('a casa que ficou ausente volta depois do descanso, sugerindo o outro período', () => {
    const v = ausente('f1', '2026-11-04', { criadaEm: as('2026-11-04', 9) });
    const casas = roteiroDoDia([f], [], ctx([v]));
    expect(casas[0].motivos[0].texto).toBe('Ninguém em casa em 04/11 (de manhã): tentar à tarde');
    const tarde = ausente('f1', '2026-11-04', { criadaEm: as('2026-11-04', 16) });
    expect(roteiroDoDia([f], [], ctx([tarde]))[0].motivos[0].texto).toBe('Ninguém em casa em 04/11 (à tarde): tentar de manhã');
    expect(roteiroDoDia([f], [], ctx([ausente('f1', '2026-11-04')]))[0].motivos[0].texto).toBe('Ninguém em casa em 04/11: tentar em outro horário');
  });

  it('mostra o melhor horário da família', () => {
    const g = { ...f, melhorHorario: 'à tarde, depois das 14h' };
    expect(roteiroDoDia([g], [], ctx([ausente('f1', '2026-11-04')]))[0].motivos[0].texto).toContain('melhor horário: à tarde, depois das 14h');
  });

  it('3 ausências seguidas: sai do roteiro e vai para a lista de pausadas', () => {
    const vs = [ausente('f1', '2026-10-28'), ausente('f1', '2026-11-01'), ausente('f1', '2026-11-04')];
    expect(roteiroDoDia([f], [], ctx(vs)).length).toBe(0);
    const p = casasPausadas([f], vs, HOJE);
    expect(p.map((x) => [x.familia.id, x.tentativas])).toEqual([['f1', ['2026-11-04', '2026-11-01', '2026-10-28']]]);
  });

  it('pausada volta se houver motivo forte (caso urgente)', () => {
    const vs = [ausente('f1', '2026-10-28'), ausente('f1', '2026-11-01'), ausente('f1', '2026-11-04')];
    expect(roteiroDoDia([f], [], ctx(vs, [caso('f1', 'urgente', 'Febre.')])).length).toBe(1);
  });

  it('uma VD realizada no meio zera a contagem', () => {
    const vs = [ausente('f1', '2026-10-28'), vd('f1', '2026-11-01'), ausente('f1', '2026-11-04')];
    expect(casasPausadas([f], vs, HOJE)).toEqual([]);
  });
});

describe('ordem de caminhada', () => {
  const a = fam('a', '10', [mor('x', 'A Teste')]);
  const b = fam('b', '2', [mor('y', 'B Teste')]);
  const c = fam('c', '30', [mor('z', 'C Teste')]);

  it('sem ordem montada segue o número; com ordem segue a do ACS e as novas ficam no fim', () => {
    expect(ordenarParaAndar([a, b, c]).map((f) => f.id)).toEqual(['b', 'a', 'c']);
    const com = [{ ...a, ordemNaRua: 2 }, { ...b }, { ...c, ordemNaRua: 1 }];
    expect(ordenarParaAndar(com).map((f) => f.id)).toEqual(['c', 'a', 'b']);
    expect(agruparPorRua(com)[0].familias.map((f) => f.id)).toEqual(['c', 'a', 'b']);
  });
});

describe('lista para a enfermeira', () => {
  it('acamado sem VD de enfermagem; some quando a enfermeira foi há pouco', () => {
    const f = fam('f1', '9', [mor('a', 'Ana Teste', { grupos: ['acamado'] })]);
    const l = listaParaEnfermeira([f], [], [], [], HOJE);
    expect(l.map((i) => i.motivos[0].texto)).toEqual(['Acamado: VD de enfermagem (nenhuma VD de enfermagem registrada)']);
    expect(listaParaEnfermeira([f], [vd('f1', '2026-11-01', { compartilhadaCom: 'Enfermeira' })], [], [], HOJE)).toEqual([]);
  });

  it('caso que cita a enfermeira entra; a rotina de P.A. (peso baixo) fica com a técnica', () => {
    const f = fam('f1', '9', [mor('a', 'Ana Teste', { grupos: ['hipertenso'] })]);
    expect(listaParaEnfermeira([f], [], [], [], HOJE)).toEqual([]);
    const l = listaParaEnfermeira([f], [], [caso('f1', 'importante', 'A enfermeira precisa chamar a família.')], [], HOJE);
    expect(l[0].motivos[0].texto).toMatch(/^Caso: Fulana Teste/);
  });
});

describe('lista para a Dra.', () => {
  it('caso urgente, receita vencida e acamado sem VD médica', () => {
    const f1 = fam('f1', '9', [mor('a', 'Ana Teste')]);
    const f2 = fam('f2', '5', [mor('b', 'Beto Teste', { grupos: ['hipertenso'], receitaEm: '2026-05-01' })]);
    const f3 = fam('f3', '7', [mor('c', 'Caio Teste', { grupos: ['acamado'] })]);
    const l = listaParaMedica([f1, f2, f3], [], [caso('f1', 'urgente', 'Febre alta.')], [], HOJE);
    const por = Object.fromEntries(l.map((i) => [i.familia.id, i.motivos.map((m) => m.texto)]));
    expect(por.f1[0]).toMatch(/^Caso urgente: Fulana Teste/);
    expect(por.f2[0]).toMatch(/^Receita venceu em /);
    expect(por.f3[0]).toBe('Acamado: VD médica em casa (nenhuma registrada)');
  });

  it('acamado visto pela médica há pouco não entra', () => {
    const f = fam('f3', '7', [mor('c', 'Caio Teste', { grupos: ['acamado'] })]);
    expect(listaParaMedica([f], [vd('f3', '2026-10-20', { compartilhadaCom: 'Dra. Teste' })], [], [], HOJE)).toEqual([]);
  });

  it('caso importante que pede avaliação médica entra', () => {
    const f = fam('f1', '9', [mor('a', 'Ana Teste')]);
    expect(listaParaMedica([f], [], [caso('f1', 'importante', 'Pedir avaliação médica em casa.')], [], HOJE)).toHaveLength(1);
    expect(listaParaMedica([f], [], [caso('f1', 'social', 'Pedir avaliação médica em casa.')], [], HOJE)).toHaveLength(0);
  });
});

describe('lista para o APA', () => {
  const casa = (extra: Partial<Familia> = {}) => fam('f1', '9', [mor('a', 'Ana Teste')], extra);

  it('casa fechada, vazia ou em construção entram para conferir', () => {
    const l = listaParaApa([casa({ situacaoCasa: 'fechada' }), fam('f2', '5', [], { situacaoCasa: 'vazia' }), fam('f3', '3', [], { situacaoCasa: 'demolida' })], [], [], HOJE);
    expect(l.map((i) => i.familia.id).sort()).toEqual(['f1', 'f2']);
  });

  it('foco, lixo e dengue escritos nas VDs; nega, orienta e resolvido ficam de fora', () => {
    const textos = [
      vd('f1', '2026-11-05', { observacao: 'Tem pneus com água parada no quintal. Sem lixo acumulado. Orientei sobre dengue.' }),
      vd('f1', '2026-11-08', { anotacoes: { a: 'Filho com suspeita de dengue, febre desde ontem.' } }),
    ];
    const l = listaParaApa([casa()], textos, [], HOJE);
    expect(l).toHaveLength(1);
    const m = l[0].motivos.map((x) => x.texto);
    expect(m[0]).toMatch(/^Suspeita de dengue/);
    expect(m.some((t) => t.startsWith('Possível criadouro'))).toBe(true);
    expect(m.some((t) => t.startsWith('Lixo'))).toBe(false);
    const resolvido = [vd('f1', '2026-11-05', { observacao: 'Pneus com água parada, mas ele removeu tudo.' })];
    expect(listaParaApa([casa()], resolvido, [], HOJE)).toEqual([]);
  });

  it('o que é antigo (mais de 90 dias) não vale', () => {
    expect(listaParaApa([casa()], [vd('f1', '2026-06-01', { observacao: 'Muito lixo e esgoto aberto na frente.' })], [], HOJE)).toEqual([]);
  });

  it('depois que o APA foi, só aparece o que foi escrito depois', () => {
    const f = casa({ relatosAnteriores: [{ id: 'r', titulo: 'APA', texto: 'APA foi na casa: removeu pneus.', data: '2026-11-09', origem: 'APA' }] });
    const antigo = vd('f1', '2026-11-05', { observacao: 'Pneus com água parada no quintal.' });
    expect(listaParaApa([f], [antigo], [], HOJE)).toEqual([]);
    const novo = vd('f1', '2026-11-10', { observacao: 'De novo água parada no vaso grande.' });
    expect(listaParaApa([f], [antigo, novo], [], HOJE)).toHaveLength(1);
    // Casa fechada que o APA viu há menos de 30 dias não volta.
    expect(listaParaApa([{ ...f, situacaoCasa: 'fechada' }], [], [], HOJE)).toEqual([]);
  });
});

describe('texto para mandar', () => {
  it('monta o texto por casa, com o prontuário', () => {
    const f = fam('f1', '9', [mor('a', 'Ana Teste', { grupos: ['acamado'] })], { prontuario: '04.001' });
    const itens = listaParaEnfermeira([f], [], [], [], HOJE);
    const t = textoParaEquipe('enfermeira', itens, HOJE, (x) => `Rua ${x.numero}`);
    expect(t).toBe('Para a enfermeira (11/11): 1 item\n\nRua 9 (pront. 04.001)\n- Ana Teste: Acamado: VD de enfermagem (nenhuma VD de enfermagem registrada)');
  });
});

describe('casas que nunca tiveram VD', () => {
  // 12 casas com revisita vencida (peso 60) + 4 casas nunca visitadas (peso 30, nível C).
  const comRevisita = Array.from({ length: 12 }, (_, i) => fam(`r${i}`, String(100 + i), [mor(`m${i}`, `Pessoa ${i}`)], { ultimaVdFora: '2026-10-20' }));
  const nunca = Array.from({ length: 4 }, (_, i) => fam(`n${i}`, String(200 + i), [mor(`x${i}`, `Nova ${i}`)]));
  const revisitas: Revisita[] = comRevisita.map((f) => ({ id: `rv${f.id}`, familiaId: f.id, motivo: 'Levar o pedido', ate: '2026-11-01', criadaEm: '' }));

  it('a casa sem nenhuma VD entra no roteiro e é marcada como nunca visitada', () => {
    const casas = roteiroDoDia(nunca, [], ctx([]));
    expect(casas.length).toBe(4);
    expect(casas.every((c) => c.nunca)).toBe(true);
    expect(casas[0].motivos[0].texto).toBe('Nunca visitada');
  });

  it('com VD fora do app ela não é "nunca"', () => {
    const casas = roteiroDoDia([{ ...nunca[0], ultimaVdFora: '2026-01-10' }], [], ctx([]));
    expect(casas[0].nunca).toBeFalsy();
  });

  it('a lista curta reserva 1 vaga em 3 para as nunca visitadas', () => {
    const todas = roteiroDoDia([...comRevisita, ...nunca], revisitas, ctx([]));
    expect(todas.length).toBe(16);
    const dez = maisImportantes(todas, 10);
    expect(dez.length).toBe(10);
    expect(dez.filter((c) => c.nunca).length).toBe(3);
    // As mais importantes continuam lá: só saem as últimas do topo.
    expect(dez.filter((c) => !c.nunca).length).toBe(7);
  });

  it('sem nunca visitadas, a lista curta fica igual', () => {
    const todas = roteiroDoDia(comRevisita, revisitas, ctx([]));
    expect(maisImportantes(todas, 10).length).toBe(10);
    expect(maisImportantes(todas, 10).some((c) => c.nunca)).toBe(false);
  });

  it('com poucas nunca visitadas, usa só as que existem', () => {
    const todas = roteiroDoDia([...comRevisita, nunca[0]], revisitas, ctx([]));
    const quinze = maisImportantes(todas, 12);
    expect(quinze.length).toBe(12);
    expect(quinze.filter((c) => c.nunca).length).toBe(1);
  });

  it('pedindo "todas", não corta nada', () => {
    const todas = roteiroDoDia([...comRevisita, ...nunca], revisitas, ctx([]));
    expect(maisImportantes(todas, 0).length).toBe(16);
  });
});
