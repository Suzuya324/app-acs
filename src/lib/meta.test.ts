import { describe, expect, it } from 'vitest';
import { calcularPainel } from './meta';
import type { Desfecho, Familia, Visita } from './tipos';

const fam = (id: string): Familia => ({
  id, rua: 'Rua Teste', numero: id, complemento: '', colmeia: '', prontuario: '', situacaoCasa: 'habitada', obs: '',
  moradores: [{ id: `${id}-1`, nome: 'Pessoa Teste', sexo: 'M', nascimento: '', situacao: 'mora', grupos: [], obs: '' }],
});
let n = 0;
const vd = (familiaId: string, data: string, desfecho: Desfecho): Visita => ({
  id: `v${++n}`, familiaId, data, desfecho, presentes: [], conversouComFamilia: false, motivo: 'Outros',
  compartilhadaCom: '', sinais: {}, orientacoes: '', relato: '', lancadaNoFast: false,
});

const familias = ['1', '2', '3', '4', '5'].map(fam);
const hoje = '2026-11-18'; // quarta-feira

describe('contagem da meta', () => {
  it('conta só realizada e ausente realizada, uma vez por família no mês', () => {
    const visitas = [
      vd('1', '2026-11-03', 'realizada'),
      vd('1', '2026-11-10', 'realizada'), // mesma família: conta uma vez só
      vd('2', '2026-11-04', 'ausente_realizada'),
      vd('3', '2026-11-05', 'ausencia_completa'), // não conta
      vd('4', '2026-11-06', 'recusa'), // não conta
      vd('5', '2026-10-30', 'realizada'), // mês passado: não conta
    ];
    const p = calcularPainel(familias, visitas, hoje, 200);
    expect(p.familiasVisitadas).toBe(2);
    expect(p.totalVisitasMes).toBe(5);
    expect(p.faltam).toBe(198);
    expect(p.porDesfecho).toEqual({ realizada: 2, ausente_realizada: 1, ausencia_completa: 1, recusa: 1 });
  });

  it('lista para revisitar quem teve ausência completa e ainda não foi visitado', () => {
    const visitas = [
      vd('3', '2026-11-05', 'ausencia_completa'),
      vd('2', '2026-11-04', 'ausencia_completa'),
      vd('2', '2026-11-12', 'realizada'), // já revisitada: sai da lista
    ];
    const p = calcularPainel(familias, visitas, hoje, 200);
    expect(p.revisitar.map((r) => r.familia.id)).toEqual(['3']);
  });

  it('calcula famílias por dia útil até o fim do mês', () => {
    // De 18/11/2026 (qua) a 30/11/2026: 18,19,20,23,24,25,26,27,30 = 9 dias úteis
    const p = calcularPainel(familias, [], hoje, 200);
    expect(p.diasUteisRestantes).toBe(9);
    expect(p.porDiaUtil).toBe(Math.ceil(200 / 9));
  });

  it('sugestão do dia: nunca visitada primeiro, depois a visita mais antiga', () => {
    const visitas = [
      vd('1', '2026-09-01', 'realizada'),
      vd('2', '2026-10-20', 'realizada'),
      vd('3', '2026-08-15', 'realizada'),
      vd('4', '2026-11-02', 'realizada'), // já visitada no mês: não aparece
    ];
    const p = calcularPainel(familias, visitas, hoje, 200);
    expect(p.sugestoes.map((s) => s.familia.id)).toEqual(['5', '3', '1', '2']);
  });

  it('conta visitas de hoje e da semana', () => {
    const visitas = [
      vd('1', '2026-11-18', 'realizada'),
      vd('2', '2026-11-16', 'ausencia_completa'), // segunda desta semana
      vd('3', '2026-11-13', 'realizada'), // semana passada
    ];
    const p = calcularPainel(familias, visitas, hoje, 200);
    expect(p.visitasHoje).toBe(1);
    expect(p.visitasSemana).toBe(2);
  });
});
