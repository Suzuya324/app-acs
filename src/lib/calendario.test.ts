import { describe, expect, it } from 'vitest';
import { contarDiasDeCampo, criarDiaDeCampo, feriadosNacionais, motivoSemCampo, pascoa, periodoDe, periodoVizinho } from './calendario';
import { calcularPainel } from './meta';
import { agruparPorRua, ordenarPorNumero } from './roteiro';
import type { Desfecho, Familia, Visita } from './tipos';

describe('feriados', () => {
  it('Páscoa e feriados móveis', () => {
    expect(pascoa(2026)).toBe('2026-04-05');
    expect(pascoa(2027)).toBe('2027-03-28');
    const f2026 = feriadosNacionais(2026);
    const datas = (m: string) => f2026.find((f) => f.motivo.startsWith(m))!.data;
    expect(datas('Carnaval (segunda)')).toBe('2026-02-16');
    expect(datas('Carnaval (terça)')).toBe('2026-02-17');
    expect(datas('Sexta-feira Santa')).toBe('2026-04-03');
    expect(datas('Corpus Christi')).toBe('2026-06-04');
    expect(datas('Consciência Negra')).toBe('2026-11-20');
  });

  it('dia de campo: desconta fim de semana, feriado e dias próprios; feriado ignorado volta a contar', () => {
    const o = { feriadosIgnorados: [] as string[], diasSemCampo: [{ data: '2026-11-25', motivo: 'Capacitação' }] };
    expect(motivoSemCampo('2026-11-20', o)).toBe('Consciência Negra');
    expect(motivoSemCampo('2026-11-21', o)).toBe('fim de semana');
    expect(motivoSemCampo('2026-11-25', o)).toBe('Capacitação');
    expect(motivoSemCampo('2026-11-24', o)).toBe('');
    expect(motivoSemCampo('2026-11-20', { ...o, feriadosIgnorados: ['2026-11-20'] })).toBe('');
  });

  it('novembro de 2026 tem 19 dias de campo (21 dias úteis menos Finados e Consciência Negra)', () => {
    const campo = criarDiaDeCampo({ feriadosIgnorados: [], diasSemCampo: [] });
    expect(contarDiasDeCampo('2026-11-01', '2026-11-30', campo)).toBe(19);
  });
});

describe('período da meta', () => {
  it('mês do calendário', () => {
    expect(periodoDe('2026-11-18')).toEqual({ inicio: '2026-11-01', fim: '2026-11-30', rotulo: 'novembro de 2026' });
    expect(periodoDe('2026-02-10').fim).toBe('2026-02-28');
  });

  it('período que começa no dia 21', () => {
    expect(periodoDe('2026-11-18', 21)).toEqual({ inicio: '2026-10-21', fim: '2026-11-20', rotulo: '21/10 a 20/11/2026' });
    expect(periodoDe('2026-11-21', 21).inicio).toBe('2026-11-21');
    expect(periodoDe('2026-01-05', 21).inicio).toBe('2025-12-21');
  });

  it('anterior e seguinte', () => {
    const nov = periodoDe('2026-11-18');
    expect(periodoVizinho(nov, -1).rotulo).toBe('outubro de 2026');
    expect(periodoVizinho(nov, 1).rotulo).toBe('dezembro de 2026');
    expect(periodoVizinho(periodoDe('2026-01-10'), -1).rotulo).toBe('dezembro de 2025');
  });
});

const fam = (id: string, rua = 'Rua Teste', numero = id, complemento = ''): Familia => ({
  id, rua, numero, complemento, bairro: '', colmeia: '', prontuario: '', situacaoCasa: 'habitada', obs: '', responsavelId: `${id}-1`,
  moradores: [{ id: `${id}-1`, nome: 'Pessoa Teste', sexo: 'M', nascimento: '', situacao: 'mora', situacaoDesde: '', grupos: [], obs: '' }],
});
let n = 0;
const vd = (familiaId: string, data: string, desfecho: Desfecho): Visita => ({
  id: `v${++n}`, familiaId, data, desfecho, presentes: [], conversouComFamilia: false, motivo: 'Outros',
  compartilhadaCom: '', sinais: {}, orientacoes: '', relato: '', lancadaNoFast: false,
});

describe('painel com feriados e períodos', () => {
  const familias = ['1', '2', '3'].map((id) => fam(id));
  const campo = criarDiaDeCampo({ feriadosIgnorados: [], diasSemCampo: [] });

  it('desconta feriados dos dias que faltam', () => {
    // 18/11/2026 até 30/11: 9 dias úteis, menos 20/11 (Consciência Negra) = 8
    const p = calcularPainel(familias, [], '2026-11-18', 200, { ehDiaDeCampo: campo });
    expect(p.diasUteisRestantes).toBe(8);
    expect(p.porDiaUtil).toBe(25);
  });

  it('mês anterior: mostra o resultado fechado', () => {
    const visitas = [vd('1', '2026-10-05', 'realizada'), vd('2', '2026-10-06', 'ausencia_completa'), vd('3', '2026-11-03', 'realizada')];
    const p = calcularPainel(familias, visitas, '2026-11-18', 200, { referencia: '2026-10-15', ehDiaDeCampo: campo });
    expect(p.periodo.rotulo).toBe('outubro de 2026');
    expect(p.passado).toBe(true);
    expect(p.atual).toBe(false);
    expect(p.familiasVisitadas).toBe(1);
    expect(p.diasUteisRestantes).toBe(0);
    expect(p.porDia).toHaveLength(31);
  });

  it('período começando no dia 21', () => {
    const visitas = [vd('1', '2026-10-25', 'realizada'), vd('2', '2026-11-19', 'realizada'), vd('3', '2026-11-21', 'realizada')];
    const p = calcularPainel(familias, visitas, '2026-11-19', 200, { diaInicioPeriodo: 21 });
    expect(p.familiasVisitadas).toBe(2);
  });

  it('gráfico: cada família conta uma vez, no primeiro dia', () => {
    const visitas = [
      vd('1', '2026-11-03', 'realizada'),
      vd('1', '2026-11-04', 'realizada'),
      vd('2', '2026-11-04', 'ausencia_completa'),
      vd('2', '2026-11-05', 'ausente_realizada'),
    ];
    const p = calcularPainel(familias, visitas, '2026-11-05', 200, { ehDiaDeCampo: campo });
    const dias = Object.fromEntries(p.porDia.map((d) => [d.data, [d.contam, d.naoContam]]));
    expect(dias['2026-11-03']).toEqual([1, 0]);
    expect(dias['2026-11-04']).toEqual([0, 2]);
    expect(dias['2026-11-05']).toEqual([1, 0]);
    expect(p.porDia.find((d) => d.data === '2026-11-02')!.diaDeCampo).toBe(false); // Finados
  });
});

describe('ordem das casas na rua', () => {
  it('número em ordem crescente (2 antes de 10), complemento e S/N no fim', () => {
    const f = [fam('a', 'R', '10'), fam('b', 'R', 'S/N'), fam('c', 'R', '2'), fam('d', 'R', '10', 'Fundos'), fam('e', 'R', '10', 'Casa 2'), fam('g', 'R', '13A')];
    expect(ordenarPorNumero(f).map((x) => `${x.numero} ${x.complemento}`.trim())).toEqual(['2', '10', '10 Casa 2', '10 Fundos', '13A', 'S/N']);
  });

  it('agrupa por rua respeitando a ordem das ruas da área', () => {
    const f = [fam('a', 'Rua B', '1'), fam('b', 'Rua A', '5'), fam('c', 'Rua B', '3')];
    expect(agruparPorRua(f, ['Rua B', 'Rua A']).map((g) => `${g.rua}: ${g.familias.map((x) => x.numero).join(',')}`)).toEqual([
      'Rua B: 1,3',
      'Rua A: 5',
    ]);
  });
});
