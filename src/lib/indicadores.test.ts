import { describe, expect, it } from 'vitest';
import { indicadores, previsaoDaMeta } from './indicadores';
import { calcularPainel } from './meta';
import { ehDiaUtil } from './datas';
import type { Familia, Morador, Visita } from './tipos';

// Tudo inventado.
const mor = (id: string, grupos: Morador['grupos']): Morador => ({ id, nome: `Pessoa ${id}`, sexo: 'F', nascimento: '1950-01-01', situacao: 'mora', situacaoDesde: '', grupos, obs: '' });
const fam = (id: string, moradores: Morador[]): Familia => ({
  id, rua: 'Rua das Acácias', numero: id, complemento: '', bairro: '', colmeia: '', prontuario: '', situacaoCasa: 'habitada', obs: '', responsavelId: moradores[0].id, moradores,
});
const vd = (familiaId: string, data: string, extra: Partial<Visita> = {}): Visita => ({
  id: `v${familiaId}${data}`, familiaId, data, presentes: [], conversouComFamilia: true, desfecho: 'realizada', motivo: 'Outros', compartilhadaCom: '', sinais: {}, orientacoes: '', relato: '', lancadaNoFast: false, ...extra,
});

describe('previsão da meta', () => {
  it('pelo ritmo dos dias de campo que já passaram', () => {
    // 10 famílias visitadas entre 02/11 e 06/11 (5 dias úteis); hoje é 06/11 (sexta) e já teve VD hoje.
    const fs = Array.from({ length: 30 }, (_, i) => fam(`f${i}`, [mor(`m${i}`, [])]));
    const visitas = fs.slice(0, 10).map((f, i) => vd(f.id, `2026-11-0${2 + (i % 5)}`));
    const p = calcularPainel(fs, visitas, '2026-11-06', 200, { diaInicioPeriodo: 1 });
    const prev = previsaoDaMeta(p, '2026-11-06', ehDiaUtil)!;
    expect(prev.diasPassados).toBe(5);
    expect(prev.ritmo).toBe(2);
    expect(prev.previsto).toBe(10 + 2 * (p.diasUteisRestantes - 1));
    expect(prev.vaiBater).toBe(false);
  });
});

describe('indicadores do mês', () => {
  it('conta pessoas por grupo, casas visitadas e medidas registradas', () => {
    const fs = [fam('1', [mor('a', ['hipertenso', 'diabetico']), mor('b', ['hipertenso'])]), fam('2', [mor('c', ['hipertenso'])]), fam('3', [mor('d', ['gestante'])])];
    const visitas = [
      vd('1', '2026-11-03', { sinais: { a: { pa: '13x8', glicemia: '110' } } }),
      vd('3', '2026-11-04', { desfecho: 'ausencia_completa' }),
      vd('2', '2026-10-20'),
    ];
    const l = indicadores(fs, visitas, '2026-11-01', '2026-11-30');
    expect(l).toEqual([
      { grupo: 'hipertenso', nome: 'Hipertensos', total: 3, visitadas: 2, medida: { nome: 'P.A. medida', feitas: 1 } },
      { grupo: 'diabetico', nome: 'Diabéticos', total: 1, visitadas: 1, medida: { nome: 'glicemia medida', feitas: 1 } },
      { grupo: 'gestante', nome: 'Gestantes', total: 1, visitadas: 0 },
    ]);
  });
});
