import { describe, expect, it } from 'vitest';
import { campo, csvFamilias, csvVisitas, iniciais, type OpcoesExportar } from './exportar-visitas';
import type { Familia, Visita } from './tipos';

// Tudo inventado.
const fam = (id: string, numero: string, nomes: string[]): Familia => ({
  id, rua: 'Rua das Acácias', numero, complemento: '', bairro: '', colmeia: '', prontuario: `0000.04.${id}`, situacaoCasa: 'habitada', obs: '', responsavelId: `${id}-0`,
  moradores: nomes.map((nome, i) => ({ id: `${id}-${i}`, nome, sexo: 'F', nascimento: '', situacao: 'mora', situacaoDesde: '', grupos: [], obs: '' })),
});
const vd = (id: string, familiaId: string, data: string, desfecho: Visita['desfecho'], presentes: string[] = [], relato = ''): Visita => ({
  id, familiaId, data, presentes, conversouComFamilia: false, desfecho, motivo: 'Outros', compartilhadaCom: '', sinais: {}, orientacoes: '', relato, lancadaNoFast: id === 'a',
});
const NOMES: Record<string, string> = { realizada: 'Visita realizada', ausente_realizada: 'Ausente realizada', ausencia_completa: 'Ausência', recusa: 'Recusa' };
const op = (o: Partial<OpcoesExportar> = {}): OpcoesExportar => ({ de: '2026-11-01', ate: '2026-11-30', nomes: true, relato: true, nomeDesfecho: (d) => NOMES[d], ...o });

const fs = [fam('1', '90', ['Ana Teste da Silva', 'Beto Teste Silva']), fam('2', '10', ['Caio Exemplo Rocha']), fam('3', '200', ['Duda Ficticia Lima'])];
const vs = [
  vd('a', '1', '2026-11-05', 'ausente_realizada', ['1-0'], 'Falei com a Ana; "tudo bem".'),
  vd('b', '2', '2026-11-03', 'ausencia_completa'),
  vd('c', '1', '2026-10-20', 'realizada', ['1-0', '1-1']),
  vd('d', '3', '2026-11-06', 'realizada'),
];

describe('exportar visitas', () => {
  it('iniciais e campos com ; ou aspas', () => {
    expect(iniciais('Ana Teste da Silva')).toBe('A. T. S.');
    expect(campo('a;b')).toBe('"a;b"');
    expect(campo('diz "oi"\nfim')).toBe('"diz ""oi"" fim"');
  });

  it('uma linha por VD do período, mais antiga primeiro, com presentes e ausentes', () => {
    const l = csvVisitas(vs, fs, op()).replace(/^﻿/, '').trim().split('\r\n');
    expect(l).toHaveLength(4);
    expect(l[3]).toContain('Duda Ficticia Lima;;;Visita realizada'); // ninguém marcado: não inventa ausentes
    expect(l[0]).toMatch(/^Data;Dia;Rua;Numero/);
    expect(l[1]).toBe('03/11/2026;ter;Rua das Acácias;10;;0000.04.2;Caio Exemplo Rocha;;;Ausência;Não;Outros;;Não;App;');
    expect(l[2]).toContain('05/11/2026;qui;Rua das Acácias;90;;0000.04.1;Ana Teste da Silva;Ana Teste da Silva;Beto Teste Silva;Ausente realizada;Sim;Outros;;Sim;App;"Falei com a Ana; ""tudo bem""."');
  });

  it('sem nomes: só iniciais; sem relato: sem a coluna', () => {
    const t = csvVisitas(vs, fs, op({ nomes: false, relato: false }));
    expect(t).not.toContain('Ana Teste');
    expect(t).toContain('A. T. S.');
    expect(t).not.toContain('Relato');
  });

  it('período vazio = tudo', () => {
    expect(csvVisitas(vs, fs, op({ de: '', ate: '' })).trim().split('\r\n')).toHaveLength(5);
  });

  it('famílias: visitada ou não no período, última VD e dias sem VD', () => {
    const l = csvFamilias(fs, vs, op(), '2026-11-18').replace(/^﻿/, '').trim().split('\r\n');
    expect(l.slice(1)).toEqual([
      'Rua das Acácias;10;;0000.04.2;Habitada;Caio Exemplo Rocha;Caio Exemplo Rocha;Não;0;1;;',
      'Rua das Acácias;90;;0000.04.1;Habitada;Ana Teste da Silva;Ana Teste da Silva, Beto Teste Silva;Sim;1;0;05/11/2026;13',
      'Rua das Acácias;200;;0000.04.3;Habitada;Duda Ficticia Lima;Duda Ficticia Lima;Sim;1;0;06/11/2026;12',
    ]);
  });
});
