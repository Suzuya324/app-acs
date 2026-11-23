import { describe, expect, it } from 'vitest';
import { faixaDaIdade, faltaNoPreNatal, glicemiaFora, listaDoGrupo, listaPreNatal, paAlta, totais } from './grupos';
import type { Familia, Morador, Visita } from './tipos';

// Tudo inventado.
const HOJE = '2026-11-23';
const mor = (id: string, nome: string, nascimento: string, extra: Partial<Morador> = {}): Morador => ({
  id, nome, sexo: 'F', nascimento, situacao: 'mora', situacaoDesde: '', grupos: [], obs: '', ...extra,
});
const fam = (id: string, numero: string, moradores: Morador[], extra: Partial<Familia> = {}): Familia => ({
  id, rua: 'Rua das Acácias', numero, complemento: '', bairro: '', colmeia: '', prontuario: '00.0001', situacaoCasa: 'habitada', obs: '', responsavelId: moradores[0].id, moradores, ...extra,
});
const vd = (familiaId: string, data: string, sinais: Visita['sinais'] = {}): Visita => ({
  id: `v${familiaId}${data}`, familiaId, data, presentes: [], conversouComFamilia: true, desfecho: 'realizada', motivo: 'Outros', compartilhadaCom: '', sinais, orientacoes: '', relato: '', lancadaNoFast: false,
});
const ctx = (visitas: Visita[]) => ({ visitas, casos: [], prioritarios: [], hoje: HOJE });

describe('faixas de idade', () => {
  it('crianças: menos de 2, 2 a 5 e 6 a 11', () => {
    expect(faixaDaIdade('criancas', 1)?.id).toBe('c0');
    expect(faixaDaIdade('criancas', 2)?.id).toBe('c2');
    expect(faixaDaIdade('criancas', 5)?.id).toBe('c2');
    expect(faixaDaIdade('criancas', 6)?.id).toBe('c6');
    expect(faixaDaIdade('criancas', 11)?.id).toBe('c6');
    expect(faixaDaIdade('criancas', 12)).toBeNull();
  });
  it('idosos: 60-69, 70-79 e 80+', () => {
    expect(faixaDaIdade('idosos', 60)?.id).toBe('i60');
    expect(faixaDaIdade('idosos', 69)?.id).toBe('i60');
    expect(faixaDaIdade('idosos', 70)?.id).toBe('i70');
    expect(faixaDaIdade('idosos', 80)?.id).toBe('i80');
    expect(faixaDaIdade('idosos', 95)?.id).toBe('i80');
  });
  it('sem data de nascimento vai para uma faixa à parte', () => {
    expect(faixaDaIdade('idosos', null)?.id).toBe('sem');
  });
});

describe('P.A. e glicemia fora do esperado', () => {
  it('P.A. 140 ou mais, ou 90 ou mais, é alta', () => {
    expect(paAlta('140x80')).toBe(true);
    expect(paAlta('130x90')).toBe(true);
    expect(paAlta('130x80')).toBe(false);
    expect(paAlta('180/100')).toBe(true);
  });
  it('glicemia 180 ou mais é alta e abaixo de 70 é baixa', () => {
    expect(glicemiaFora('183')).toBe('alta');
    expect(glicemiaFora('111')).toBeNull();
    expect(glicemiaFora('65')).toBe('baixa');
  });
});

describe('lista por grupo', () => {
  const f1 = fam('f1', '10', [mor('a', 'Ana Idosa', '1950-05-01', { grupos: ['hipertenso', 'diabetico'] }), mor('b', 'Bia Menina', '2025-06-01')]);
  const f2 = fam('f2', '20', [mor('c', 'Caio Velho', '1940-01-01', { grupos: ['acamado'] }), mor('d', 'Davi Menino', '2018-03-10')]);
  const f3 = fam('f3', '30', [mor('e', 'Eva Adulta', '1985-01-01', { grupos: ['hipertenso'] }), mor('f', 'Fábio Antigo', '1950-01-01', { situacao: 'mudou' })]);
  const f4 = fam('f4', '40', [mor('g', 'Gil Fechada', '1950-01-01')], { situacaoCasa: 'fechada' });
  const familias = [f1, f2, f3, f4];
  const visitas = [vd('f1', '2026-11-20', { a: { pa: '150x90', glicemia: '190' } }), vd('f2', '2026-10-01'), vd('f3', '2026-06-01')];

  it('idosos: separa por faixa, ignora quem mudou e casa fechada', () => {
    const r = listaDoGrupo('idosos', familias, ctx(visitas));
    expect(r.map((g) => [g.faixa.id, g.pessoas.map((p) => p.morador.nome)])).toEqual([
      ['i70', ['Ana Idosa']],
      ['i80', ['Caio Velho']],
    ]);
  });

  it('crianças: por faixa de idade', () => {
    const r = listaDoGrupo('criancas', familias, ctx(visitas));
    expect(r.map((g) => [g.faixa.id, g.pessoas.map((p) => p.morador.nome)])).toEqual([
      ['c0', ['Bia Menina']],
      ['c6', ['Davi Menino']],
    ]);
  });

  it('hipertensos e diabéticos: usam a marca da ficha e avisam P.A./glicemia', () => {
    const h = listaDoGrupo('hipertensos', familias, ctx(visitas)).flatMap((g) => g.pessoas);
    expect(h.map((p) => p.morador.nome).sort()).toEqual(['Ana Idosa', 'Eva Adulta']);
    const ana = h.find((p) => p.morador.id === 'a')!;
    expect(ana.alertas).toContain('P.A. alta (150x90)');
    const d = listaDoGrupo('diabeticos', familias, ctx(visitas)).flatMap((g) => g.pessoas);
    expect(d.map((p) => p.morador.nome)).toEqual(['Ana Idosa']);
    expect(d[0].alertas).toContain('Glicemia alta (190)');
  });

  it('quem está há mais tempo sem VD vem primeiro e o aviso de dias aparece', () => {
    const h = listaDoGrupo('hipertensos', familias, ctx(visitas));
    const adultos = h.find((g) => g.faixa.id === 'a0')!.pessoas;
    expect(adultos[0].morador.nome).toBe('Eva Adulta');
    expect(adultos[0].alertas).toContain('Sem VD há 175 dias');
    expect(adultos[0].alertas).toContain('Sem P.A. registrada');
  });

  it('acamados avisam com 15 dias sem VD', () => {
    const a = listaDoGrupo('acamados', familias, ctx(visitas)).flatMap((g) => g.pessoas);
    expect(a).toHaveLength(1);
    expect(a[0].alertas).toContain('Sem VD há 53 dias');
    const recente = listaDoGrupo('acamados', familias, ctx([vd('f2', '2026-11-15')])).flatMap((g) => g.pessoas);
    expect(recente[0].alertas.some((x) => x.startsWith('Sem VD'))).toBe(false);
  });

  it('nunca visitado aparece primeiro e conta no total de avisos', () => {
    const r = listaDoGrupo('idosos', familias, ctx([]));
    expect(r[0].pessoas[0].alertas).toContain('Sem VD registrada');
    expect(totais('idosos', familias, ctx([]))).toEqual({ total: 2, avisos: 2 });
  });

  it('sem data de nascimento entra pela marca da ficha', () => {
    const semData = fam('f5', '50', [mor('h', 'Hugo Sem Data', '', { grupos: ['idoso'] })]);
    const r = listaDoGrupo('idosos', [semData], ctx([]));
    expect(r[0].faixa.id).toBe('sem');
  });
});

describe('pré-natal', () => {
  const g = fam('f1', '10', [mor('a', 'Ana Gestante', '1998-01-01', { grupos: ['gestante'], dpp: '2027-01-10' })]);
  it('lista a gestante com o que falta', () => {
    const l = listaPreNatal([g], ctx([vd('f1', '2026-11-01')]));
    expect(l).toHaveLength(1);
    expect(l[0].diasSemVd).toBe(22);
    expect(l[0].falta).toEqual(['Consultas: 0 de 6', 'Exames do pré-natal', 'Testes rápidos (HIV, sífilis, hepatites)', 'Vacina dTpa', 'Consulta odontológica']);
  });
  it('tudo marcado = nada falta', () => {
    expect(faltaNoPreNatal({ consultas: 6, exames: true, testeRapido: true, dtpa: true, odonto: true })).toEqual([]);
    expect(faltaNoPreNatal({ consultas: 4, exames: true, testeRapido: true, dtpa: true, odonto: true })).toEqual(['Consultas: 4 de 6']);
  });
});
