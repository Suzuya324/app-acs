import { describe, expect, it } from 'vitest';
import { diasDeCampoEntre, planoDaMeta, textoDoPlano } from './plano-meta';
import type { Familia, Visita } from './tipos';

// Tudo inventado.
const fam = (id: string, rua: string, numero: string, extra: Partial<Familia> = {}): Familia => ({
  id, rua, numero, complemento: '', bairro: '', colmeia: '', prontuario: '', situacaoCasa: 'habitada', obs: '', responsavelId: `m${id}`,
  moradores: [{ id: `m${id}`, nome: `Pessoa ${id}`, sexo: 'F', nascimento: '', situacao: 'mora', situacaoDesde: '', grupos: [], obs: '' }], ...extra,
});
const vd = (familiaId: string, data: string): Visita => ({
  id: `v${familiaId}`, familiaId, data, presentes: [], conversouComFamilia: true, desfecho: 'realizada', motivo: 'Outros', compartilhadaCom: '', sinais: {}, orientacoes: '', relato: '', lancadaNoFast: false,
});
const HOJE = '2026-11-18';
const util = (d: string) => ![0, 6].includes(new Date(`${d}T12:00:00`).getDay());

describe('plano para fechar a meta', () => {
  it('dias de campo sem fim de semana', () => {
    expect(diasDeCampoEntre('2026-11-18', '2026-11-24', util)).toEqual(['2026-11-18', '2026-11-19', '2026-11-20', '2026-11-23', '2026-11-24']);
  });

  it('escolhe as mais esquecidas, junta por rua e divide pelos dias', () => {
    const fs = [
      fam('a', 'Rua das Acácias', '30'), fam('b', 'Rua das Acácias', '12'), fam('c', 'Rua dos Ipês', '7'),
      fam('d', 'Rua dos Ipês', '3'), fam('e', 'Rua das Acácias', '50'),
    ];
    const visitas = [vd('e', '2026-10-30')]; // a mais recente: fica de fora se só faltam 4
    const p = planoDaMeta(fs, visitas, 4, ['2026-11-18', '2026-11-19', '2026-11-20'], HOJE, ['Rua das Acácias', 'Rua dos Ipês']);
    expect(p.map((d) => `${d.data}: ${d.ruas.map((r) => `${r.rua} ${r.familias.map((f) => f.numero).join(',')}`).join(' | ')}`)).toEqual([
      '2026-11-18: Rua das Acácias 12,30',
      '2026-11-19: Rua dos Ipês 3,7',
    ]);
    expect(textoDoPlano(p, (d) => d.slice(8))).toBe('18 (2 casas)\n  Rua das Acácias: 12, 30\n\n19 (2 casas)\n  Rua dos Ipês: 3, 7');
  });

  it('nada a planejar com a meta batida ou sem dias', () => {
    expect(planoDaMeta([fam('a', 'R', '1')], [], 0, ['2026-11-18'], HOJE)).toEqual([]);
    expect(planoDaMeta([fam('a', 'R', '1')], [], 3, [], HOJE)).toEqual([]);
  });
});
