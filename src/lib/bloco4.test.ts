import { describe, expect, it } from 'vitest';
import { aConfirmar, criancas, diaDosMeses, dppDoTexto, gestantes, mudancasParaSbcd, textoMudancas } from './bloco4';
import { calcularAtencao } from './atencao';
import type { Prioritario } from './prioritarios';
import type { Alteracao, Familia, Morador, Visita } from './tipos';

// Tudo inventado.
const HOJE = '2026-11-11';
const mor = (id: string, nome: string, extra: Partial<Morador> = {}): Morador => ({
  id, nome, sexo: 'F', nascimento: '1995-01-01', situacao: 'mora', situacaoDesde: '', grupos: [], obs: '', ...extra,
});
const fam = (id: string, moradores: Morador[]): Familia => ({
  id, rua: 'Rua das Acácias', numero: '12', complemento: '', bairro: '', colmeia: '', prontuario: '00.0001', situacaoCasa: 'habitada', obs: '', responsavelId: moradores[0].id, moradores,
});
const vd = (data: string, anotacoes: Record<string, string>): Visita => ({
  id: `v${data}`, familiaId: 'f1', data, presentes: [], conversouComFamilia: true, desfecho: 'realizada', motivo: 'Outros', compartilhadaCom: '', sinais: {}, orientacoes: '', relato: '', lancadaNoFast: false, anotacoes,
});
const prio = (extra: Partial<Prioritario>): Prioritario => ({
  id: 'p', nome: 'ANA TESTE', nascimento: '1995-01-01', nivel: 'B', rua: 'Acácias', casa: '12', prontuario: '', etiquetas: [], resumo: '', ultimaInfo: '', familiaId: 'f1', moradorId: 'a', atualizadoEm: '', ...extra,
});

describe('a confirmar', () => {
  it('óbito e gestante? da lista, e o que foi anotado "a confirmar"', () => {
    const f = fam('f1', [mor('a', 'Ana Teste')]);
    const visitas = [vd('2026-11-01', { a: 'Toma losartana (nome do remédio a confirmar).' })];
    const r = aConfirmar([f], { visitas, casos: [], prioritarios: [prio({ obito: true, etiquetas: ['GESTANTE?'] })], hoje: HOJE });
    expect(r.obitos.map((x) => x.morador?.nome)).toEqual(['Ana Teste']);
    expect(r.gestantes).toHaveLength(1);
    expect(r.anotacoes.map((x) => x.pendencia.frase)).toEqual(['Toma losartana (nome do remédio a confirmar).']);
  });
});

describe('gestantes', () => {
  it('DPP pelo que foi escrito: "DPP 20/03" ou "28 semanas"', () => {
    expect(dppDoTexto([{ data: '2026-11-01', texto: 'Gestante, DPP 20/03.' }])).toBe('2027-03-20');
    expect(dppDoTexto([{ data: '2026-11-01', texto: 'Está com 28 semanas de gestação.' }])).toBe('2027-01-24');
    expect(dppDoTexto([{ data: '2026-11-01', texto: 'Voltou em 2 semanas.' }])).toBe('');
  });
  it('alertas: sem DPP, perto de ganhar, passou da DPP', () => {
    const a = mor('a', 'Ana Teste', { grupos: ['gestante'] });
    const b = mor('b', 'Bia Teste', { grupos: ['gestante'], dpp: '2026-11-20' });
    const c = mor('c', 'Cris Teste', { grupos: ['gestante'], dpp: '2026-11-01' });
    const l = gestantes([fam('f1', [a, b, c])], [], HOJE);
    expect(l.map((g) => `${g.morador.nome}|${g.semanas}|${g.alerta}`)).toEqual([
      'Cris Teste|41|Passou da DPP (10 dias): já ganhou? Marcar puérpera',
      'Bia Teste|38|Perto de ganhar: faltam 9 dias',
      'Ana Teste|null|Sem DPP: anotar a data provável do parto',
    ]);
  });
});

describe('crianças', () => {
  it('lembra de conferir a caderneta no marco que chegou; some depois de conferir', () => {
    expect(diaDosMeses('2026-07-10', 4)).toBe('2026-11-10');
    expect(diaDosMeses('2026-01-31', 1)).toBe('2026-02-28');
    const bebe = mor('b', 'Bebê Teste', { nascimento: '2026-07-10' });
    const l = criancas([fam('f1', [bebe])], HOJE);
    expect(l[0].conferir).toEqual({ texto: '4 meses: penta, VIP, pneumo e rotavírus', dia: '2026-11-10' });
    expect(l[0].proximo?.dia).toBe('2026-12-10');
    expect(criancas([fam('f1', [{ ...bebe, cadernetaEm: '2026-11-11' }])], HOJE)[0].conferir).toBeUndefined();
  });
});

describe('idade chegando', () => {
  it('avisa antes de fazer 2, 60 ou 80 anos', () => {
    const f = fam('f1', [
      mor('a', 'Ana Teste', { nascimento: '1966-11-20' }),
      mor('b', 'Beto Teste', { nascimento: '2024-12-01', grupos: ['crianca'] }),
      mor('c', 'Caio Teste', { nascimento: '1946-11-30', grupos: ['idoso'] }),
    ]);
    const l = calcularAtencao([f], [], HOJE).filter((x) => x.tipo === 'idade_chegando').map((x) => x.texto);
    expect(l).toContain('Faz 60 anos em 20/11 (entra em Idoso; prioridade B)');
    expect(l).toContain('Faz 2 anos em 01/12 (sai de Criança pequena)');
    expect(l).toContain('Faz 80 anos em 30/11 (prioridade A: VD a cada 10 dias)');
  });
});

describe('mudanças para o SBCD', () => {
  it('só as mudanças de cadastro, depois da última vez, fora as que vieram do próprio SBCD', () => {
    const f = fam('f1', [mor('a', 'Ana Teste')]);
    const h = (quando: string, texto: string): Alteracao => ({ id: quando + texto, quando, familiaId: 'f1', texto });
    const hist = [
      h('2026-11-02T10:00:00Z', 'Ana Teste: Mora aqui → Mudou-se (desde 01/11/2026)'),
      h('2026-11-03T10:00:00Z', 'Caso aberto: Ana Teste'),
      h('2026-11-04T10:00:00Z', 'Bebê Teste: morador incluído (desde 04/11/2026)'),
      h('2026-11-05T10:00:00Z', 'Prontuário 00.03.1 → 00.04.9 (cadastro do SBCD de 10/11/2026)'),
      h('2026-10-01T10:00:00Z', 'Prontuário: 1 → 2'),
    ];
    const l = mudancasParaSbcd(hist, [f], '2026-10-15T00:00:00Z');
    expect(l.map((x) => x.texto)).toEqual(['Ana Teste: Mora aqui → Mudou-se (desde 01/11/2026)', 'Bebê Teste: morador incluído (desde 04/11/2026)']);
    expect(textoMudancas(l, (x) => `${x.rua}, ${x.numero}`).split('\n')[2]).toBe('Rua das Acácias, 12 (pront. 00.0001)');
  });
});
