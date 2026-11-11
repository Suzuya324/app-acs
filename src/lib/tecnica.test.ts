import { describe, expect, it } from 'vitest';
import { listaParaTecnica, pedidosDaPessoa, textoParaTecnica } from './tecnica';
import type { Caso, Familia, Morador, Visita } from './tipos';

// Tudo inventado.
const mor = (id: string, nome: string, extra: Partial<Morador> = {}): Morador => ({
  id, nome, sexo: 'F', nascimento: '1950-01-01', situacao: 'mora', situacaoDesde: '', grupos: [], obs: '', ...extra,
});
const fam = (id: string, numero: string, moradores: Morador[]): Familia => ({
  id, rua: 'Rua das Acácias', numero, complemento: '', bairro: '', colmeia: '', prontuario: '00.0001', situacaoCasa: 'habitada', obs: '', responsavelId: moradores[0].id, moradores,
});
const vd = (familiaId: string, data: string, extra: Partial<Visita> = {}): Visita => ({
  id: `v${data}${familiaId}`, familiaId, data, presentes: [], conversouComFamilia: true, desfecho: 'realizada', motivo: 'Outros', compartilhadaCom: '',
  sinais: {}, orientacoes: '', relato: '', lancadaNoFast: false, ...extra,
});
const HOJE = '2026-11-11';
const ped = (m: Morador, f: Familia, visitas: Visita[], casos: Caso[] = []) => pedidosDaPessoa(m, f, visitas, casos, HOJE).map((p) => p.texto);

describe('lista para a técnica', () => {
  it('hipertenso e diabético sem medida há 60 dias', () => {
    const m = mor('a', 'Ana Teste', { grupos: ['hipertenso', 'diabetico'] });
    const f = fam('f1', '12', [m]);
    expect(ped(m, f, [])).toEqual(['P.A. (sem registro no app)', 'Glicemia (sem registro no app)']);
    expect(ped(m, f, [vd('f1', '2026-10-20', { sinais: { a: { pa: '13x8', glicemia: '120' } } })])).toEqual([]);
    expect(ped(m, f, [vd('f1', '2026-08-01', { sinais: { a: { pa: '13x8' } } })])[0]).toBe('P.A. (última 13x8 em 01/08)');
  });

  it('medida alta recente: repetir (mesmo sem a condição marcada)', () => {
    const m = mor('a', 'Ana Teste');
    const f = fam('f1', '12', [m]);
    expect(ped(m, f, [vd('f1', '2026-11-01', { sinais: { a: { pa: '18x11', glicemia: '320' } } })])).toEqual([
      'Repetir P.A. (última 18x11 em 01/11)',
      'Repetir glicemia (última 320 em 01/11)',
    ]);
  });

  it('curativo, sonda e pedidos escritos; some quando cicatrizou', () => {
    const m = mor('a', 'Ana Teste');
    const f = fam('f1', '12', [m]);
    const v1 = vd('f1', '2026-11-01', { anotacoes: { a: 'Ferida na perna, precisa de curativo. Trocar a sonda semana que vem.' } });
    expect(ped(m, f, [v1])).toEqual([
      'Curativo / ver ferida: “Ferida na perna, precisa de curativo.” (01/11)',
      'Sonda: “Trocar a sonda semana que vem.” (01/11)',
    ]);
    const v2 = vd('f1', '2026-11-08', { anotacoes: { a: 'A ferida cicatrizou.' } });
    expect(ped(m, f, [v1, v2])).toEqual(['Sonda: “Trocar a sonda semana que vem.” (01/11)']);
    expect(ped(m, f, [vd('f1', '2026-11-01', { anotacoes: { a: 'Sem ferida.' } })])).toEqual([]);
  });

  it('caso aberto que pede curativo também entra', () => {
    const m = mor('a', 'Ana Teste');
    const f = fam('f1', '12', [m]);
    const caso: Caso = { id: 'c', familiaId: 'f1', categoria: 'importante', titulo: 'Ana Teste, 76 anos', texto: 'Escara no calcanhar.', criadoEm: '2026-11-05T12:00:00Z', atualizadoEm: '' };
    expect(ped(m, f, [], [caso])[0]).toContain('Curativo / ver ferida');
  });

  it('em ordem de rua e número; texto para copiar', () => {
    const a = mor('a', 'Ana Teste', { grupos: ['hipertenso'] });
    const b = mor('b', 'Beto Teste', { grupos: ['diabetico'] });
    const l = listaParaTecnica([fam('f2', '30', [b]), fam('f1', '12', [a])], [], [], [], HOJE);
    expect(l.map((x) => x.morador.nome)).toEqual(['Ana Teste', 'Beto Teste']);
    const t = textoParaTecnica(l, HOJE, (f) => `${f.rua}, ${f.numero}`);
    expect(t.split('\n')).toEqual([
      'Para a técnica de enfermagem (11/11): 2 pessoas', '', 'Rua das Acácias, 12 (pront. 00.0001)', '- Ana Teste, 76 anos: P.A. (sem registro no app)',
      '', 'Rua das Acácias, 30 (pront. 00.0001)', '- Beto Teste, 76 anos: Glicemia (sem registro no app)',
    ]);
  });
});
