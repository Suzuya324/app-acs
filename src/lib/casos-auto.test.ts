import { describe, expect, it } from 'vitest';
import { casoDoAchado, casosAchados, casosDaPauta, diasParado, motivoDaFrase, ordenarCasos, textoDaPauta, textoParado } from './casos-auto';
import { nivelDaFamilia } from './nivel';
import type { Caso, Familia, Morador, Visita } from './tipos';

// Tudo inventado.
const mot = (f: string) => {
  const m = motivoDaFrase(f);
  return m ? `${m.categoria}${m.emulti ? `|${m.emulti}` : ''}${m.reuniao ? '|R' : ''}` : null;
};

describe('o que a frase pede', () => {
  it('eMulti quando alguém precisa', () => {
    expect(mot('Seu Ciclano precisa de uma ajuda da assistente social.')).toBe('social|Serviço social|R');
    expect(mot('Pediu encaminhamento para a psicóloga.')).toBe('importante|Psicologia|R');
    expect(mot('Precisa de fisioterapia no joelho.')).toBe('importante|Fisioterapia|R');
    expect(mot('Acompanha com a psicóloga toda semana.')).toBeNull();
  });
  it('urgente, sem precisar de "precisa"; respeita negação', () => {
    expect(mot('Caiu no banheiro ontem.')).toBe('urgente|R');
    expect(mot('Está sem insulina há 3 dias.')).toBe('urgente|R');
    expect(mot('Pressão 190x110 hoje.')).toBe('urgente|R');
    expect(mot('Pressão 130x80.')).toBeNull();
    expect(mot('Nega dor no peito e falta de ar.')).toBeNull();
    expect(mot('Orientada sobre prevenção de quedas.')).toBeNull();
  });
  it('reconhece muitos jeitos de escrever (inclusive erro de ditado)', () => {
    expect(mot('A família está passando necessidade, sem gás.')).toBe('social|Serviço social|R');
    expect(mot('Quer falar com a acistente social sobre o benefício.')).toBe('social|Serviço social|R');
    expect(mot('Chora muito desde que o marido morreu.')).toBe('importante|Psicologia|R');
    expect(mot('Engasga com a comida.')).toBe('importante|Fonoaudiologia|R');
    expect(mot('Confunde os remédios, precisa de ajuda para organizar.')).toBe('importante|Farmácia|R');
    expect(mot('Está com dor de dente, pede dentista.')).toBe('importante|Odontologia|R');
    expect(mot('Não consegue ir até a UBS.')).toBe('importante|R');
    expect(mot('Receita vencida.')).toBe('importante|R');
    expect(mot('Filho parou de frequentar a escola.')).toBe('importante|R');
    expect(mot('Está bebendo muito.')).toBe('importante|R');
    expect(mot('Gestante sem pré-natal.')).toBe('urgente|R');
  });
  it('não cai em armadilhas', () => {
    expect(mot('Risco de queda, orientada.')).toBeNull();
    expect(mot('Falta de ar melhorando com a bombinha.')).toBeNull();
    expect(mot('PA normal (09/2026).')).toBeNull();
    expect(mot('Visita domiciliar realizada no período da manhã.')).toBeNull();
    expect(mot('Diabética, sem insulina, só comprimidos.')).toBeNull();
    // Resumo antigo (lista, observação): só pedido explícito.
    expect(motivoDaFrase('Depressão e ansiedade, caiu em 2024.', true)).toBeNull();
    expect(motivoDaFrase('Precisa de psicólogo.', true)?.emulti).toBe('Psicologia');
  });
  it('reunião de equipe', () => {
    expect(mot('Pedir VD da enfermeira para avaliar a ferida.')).toBe('importante|R');
    expect(mot('Levar para a reunião de equipe.')).toBe('importante|R');
    expect(mot('Todos bem.')).toBeNull();
  });
});

const mor = (id: string, nome: string, nascimento = '1950-01-01'): Morador => ({ id, nome, sexo: 'M', nascimento, situacao: 'mora', situacaoDesde: '', grupos: [], obs: '' });
const fam = (id: string, moradores: Morador[]): Familia => ({
  id, rua: 'Rua das Acácias', numero: '12', complemento: '', bairro: '', colmeia: '', prontuario: '', situacaoCasa: 'habitada', obs: '', responsavelId: moradores[0].id, moradores,
});
const vd = (familiaId: string, data: string, anotacoes: Record<string, string>): Visita => ({
  id: `v${data}`, familiaId, data, presentes: [], conversouComFamilia: true, desfecho: 'realizada', motivo: 'Outros', compartilhadaCom: '', sinais: {}, orientacoes: '', relato: '', lancadaNoFast: false, anotacoes,
});
const caso = (extra: Partial<Caso>): Caso => ({ id: 'c', familiaId: 'f1', categoria: 'importante', titulo: 'X', texto: '', criadoEm: '', atualizadoEm: '2026-11-01T00:00:00Z', ...extra });

describe('casos achados nas VDs', () => {
  const f = fam('f1', [mor('a', 'Ciclano Teste'), mor('b', 'Fulana Teste', '1990-01-01')]);
  const visitas = [
    vd('f1', '2026-11-05', { a: 'Precisa de ajuda da assistente social para o BPC.', b: 'Caiu na escada ontem.' }),
    vd('f1', '2026-10-01', { b: 'Caiu no quintal.' }),
  ];
  it('acha, com título, categoria e eMulti; urgente antigo vira importante', () => {
    const l = casosAchados([f], visitas, [], '2026-11-10');
    expect(l.map((a) => `${a.titulo}|${a.categoria}|${a.emulti ?? ''}|${a.provas.length}`)).toEqual([
      'Fulana Teste, 36 anos|urgente||1',
      'Fulana Teste, 36 anos|importante||1',
      'Ciclano Teste, 76 anos|social|Serviço social|1',
    ]);
    const c = casoDoAchado(l[2]);
    expect(c).toMatchObject({ familiaId: 'f1', categoria: 'social', emulti: 'Serviço social' });
    expect(c.texto).toBe('05/11: Precisa de ajuda da assistente social para o BPC.');
    expect(c.npv).toContain('reunião de equipe');
  });
  it('não sugere de novo o que já virou caso nem o que o ACS disse que não é', () => {
    const l = casosAchados([f], visitas, [], '2026-11-10');
    const abertos = [caso({ id: 'c1', emulti: 'Serviço social', categoria: 'social' }), caso({ id: 'c2', texto: '05/11: Caiu na escada ontem.', categoria: 'urgente' })];
    expect(casosAchados([f], visitas, abertos, '2026-11-10').map((a) => a.categoria)).toEqual(['importante']);
    expect(casosAchados([f], visitas, [], '2026-11-10', [l[0].chave]).map((a) => a.categoria)).toEqual(['importante', 'social']);
  });
});

describe('prioridade e pauta', () => {
  const casos = [
    caso({ id: '1', categoria: 'importante', titulo: 'B', atualizadoEm: '2026-11-01' }),
    caso({ id: '2', categoria: 'urgente', titulo: 'A', atualizadoEm: '2026-11-05' }),
    caso({ id: '3', categoria: 'importante', titulo: 'C', emulti: 'Psicologia', atualizadoEm: '2026-11-03' }),
    caso({ id: '4', categoria: 'social', titulo: 'D', resolvidoEm: '2026-11-04' }),
  ];
  it('urgente primeiro, depois os da reunião/eMulti', () => {
    expect(ordenarCasos(casos).map((c) => c.id)).toEqual(['2', '3', '1', '4']);
    expect(casosDaPauta(casos).map((c) => c.id)).toEqual(['2', '3']);
    expect(textoDaPauta(casos, () => 'Rua das Acácias, 12', '12/11/2026').split('\n')[0]).toBe('Pauta da reunião de equipe 12/11/2026 (2 casos)');
  });
  it('caso aberto sobe o nível da casa', () => {
    const f = fam('f1', [mor('a', 'Ciclano Teste', '1990-01-01')]);
    expect(nivelDaFamilia(f, '2026-11-10').nivel).toBe('C');
    expect(nivelDaFamilia(f, '2026-11-10', [], [casos[0]]).nivel).toBe('B');
    expect(nivelDaFamilia(f, '2026-11-10', [], [casos[1]]).nivel).toBe('A');
    expect(nivelDaFamilia(f, '2026-11-10', [], [casos[3]]).nivel).toBe('C');
  });
});

describe('casos parados e respostas', () => {
  const c = (id: string, extra: Partial<Caso>): Caso => ({ id, familiaId: 'f1', categoria: 'importante', titulo: id, texto: 'x', criadoEm: '2026-10-01T12:00:00Z', atualizadoEm: '2026-11-10T12:00:00Z', ...extra });
  it('conta dias sem novidade pela resposta, pela edição ou pela abertura', () => {
    expect(diasParado(c('a', {}), '2026-11-11')).toBe(41);
    expect(diasParado(c('a', { novidadeEm: '2026-11-01T10:00:00Z' }), '2026-11-11')).toBe(10);
    expect(diasParado(c('a', { respostas: [{ data: '2026-11-09', texto: 'VD médica marcada' }] }), '2026-11-11')).toBe(2);
    expect(textoParado(41)).toBe('há 5 semanas');
  });
  it('parado sobe na pauta e entra nela sozinho; a última resposta vai junto', () => {
    const casos = [
      c('novo', { emulti: 'Psicologia', novidadeEm: '2026-11-10T00:00:00Z' }),
      c('parado', { novidadeEm: '2026-10-01T00:00:00Z' }),
      c('urgente', { categoria: 'urgente', novidadeEm: '2026-11-10T00:00:00Z' }),
      c('respondido', { npv: 'x', respostas: [{ data: '2026-11-05', texto: 'Encaminhado para a psicologia', reuniao: true }] }),
    ];
    expect(ordenarCasos(casos, '2026-11-11').map((x) => x.id)).toEqual(['urgente', 'parado', 'respondido', 'novo']);
    expect(casosDaPauta(casos, '2026-11-11').map((x) => x.id)).toEqual(['urgente', 'parado', 'respondido', 'novo']);
    const muitos = Array.from({ length: 8 }, (_, i) => c(`p${i}`, { novidadeEm: `2026-09-0${i + 1}T00:00:00Z` }));
    expect(casosDaPauta(muitos, '2026-11-11').map((x) => x.id)).toEqual(['p0', 'p1', 'p2', 'p3', 'p4']);
    expect(casosDaPauta(casos).map((x) => x.id)).not.toContain('parado');
    const t = textoDaPauta(casos, () => 'Rua das Acácias, 12', '12/11', '2026-11-11');
    expect(t).toContain('2. [Importante] parado – Rua das Acácias, 12 – SEM RESPOSTA HÁ 5 SEMANAS');
    expect(t).toContain('Última resposta (05/11): Encaminhado para a psicologia');
  });
});
