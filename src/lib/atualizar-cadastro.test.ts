import { describe, expect, it } from 'vitest';
import { ArquivoSbcdInvalido, compararComSbcd, lerArquivoSbcd, type CasaSbcd } from './atualizar-cadastro';
import type { Familia, Morador } from './tipos';

// Tudo inventado: ruas, nomes, prontuários.
const mor = (id: string, nome: string, extra: Partial<Morador> = {}): Morador => ({
  id, nome, sexo: 'F', nascimento: '1980-01-01', situacao: 'mora', situacaoDesde: '', grupos: [], obs: '', ...extra,
});
const fam = (id: string, numero: string, complemento: string, prontuario: string, moradores: Morador[]): Familia => ({
  id, rua: 'Rua das Acácias', numero, complemento, bairro: 'Bairro Exemplo', colmeia: '', prontuario, situacaoCasa: 'habitada', obs: '',
  responsavelId: moradores[0]?.id ?? '', moradores,
});
const casa = (numero: string, complemento: string, prontuario: string, nomes: [string, string?][], extra: Partial<CasaSbcd> = {}): CasaSbcd => ({
  rua: 'Acácias', ruaCurta: 'Acácias', numero, complemento, prontuario,
  moradores: nomes.map(([nome, nascimento]) => ({ nome, nascimento: nascimento ?? '1980-01-01', sexo: 'F' })), ...extra,
});
const arquivo = (casas: CasaSbcd[], extra: Record<string, unknown> = {}) =>
  lerArquivoSbcd(JSON.stringify({ tipo: 'facilitador-vds/importacao-sbcd', geradoEm: '2026-11-10', casas, ...extra }));
let n = 0;
const id = (p: string) => `${p}${++n}`;
const comparar = (casas: CasaSbcd[], familias: Familia[], extra: Record<string, unknown> = {}) => compararComSbcd(arquivo(casas, extra), familias, '2026-11-10', id);
const resumo = (r: ReturnType<typeof comparar>) =>
  r.mudancas.map((m) => `${m.tipo}${r.marcadasDeInicio.includes(m.id) ? '+' : ''}:${
    m.tipo === 'prontuario' ? `${m.de}>${m.para}` : m.tipo === 'endereco' ? `${m.de}>${m.rotulo}` : m.tipo === 'pessoa' ? `${m.morador.nome}${m.mover ? `<${m.mover.de}` : ''}${m.parecido ? '~' : ''}`
    : m.tipo === 'casa' ? `${m.rotulo}[${m.familia.moradores.map((x) => x.nome).join(',')}]${m.mover.length ? `<${m.mover.length}` : ''}` : m.tipo === 'nascimento' ? `${m.nome} ${m.de}>${m.para}`
    : m.tipo === 'tirar' ? `${m.rotulo} ${m.motivo}` : 'nome' in m ? m.nome : ''}`);

describe('ler o arquivo', () => {
  it('aceita o arquivo do SBCD e recusa os outros', () => {
    expect(arquivo([casa('12', '', '00.04.001', [['Ana Teste']])]).casas).toHaveLength(1);
    expect(() => lerArquivoSbcd('{"formato":"facilitador-importacao","itens":[]}')).toThrow(/Trazer do Sistema de Visitas/);
    expect(() => lerArquivoSbcd('[1,2]')).toThrow(ArquivoSbcdInvalido);
    expect(() => lerArquivoSbcd('não é json')).toThrow(ArquivoSbcdInvalido);
  });
});

describe('comparar com o app', () => {
  it('casa igual não gera nada; prontuário novo e pessoa nova vêm marcados', () => {
    const app = [fam('f1', '12', '', '0000.04.001', [mor('a', 'Ana Teste')]), fam('f2', '30', '', '0000.03.005', [mor('b', 'Beto Teste', { sexo: 'M' })])];
    const r = comparar([
      casa('12', '', '0000.04.001', [['ANA TESTE']]),
      { ...casa('30', '', '0000.03.005', [['BETO TESTE'], ['Caio Teste', '2025-05-05']]), prontuarioNovo: '0000.04.107' },
    ], app);
    expect(r.iguais).toBe(1);
    expect(resumo(r)).toEqual(['prontuario+:0000.03.005>0000.04.107', 'pessoa+:Caio Teste']);
  });

  it('não confunde duas famílias no mesmo endereço (usa os nomes)', () => {
    const app = [
      fam('f1', '50', 'CS 3', '0000.03.018', [mor('a', 'Ana Teste'), mor('b', 'Bia Teste')]),
      fam('f2', '50', 'CS 3', '0000.03.015', [mor('c', 'Caio Exemplo'), mor('d', 'Dani Exemplo')]),
    ];
    const r = comparar([casa('50', 'CS 3', '0000.03.015', [['Ana Teste'], ['Bia Teste']]), casa('50', 'CS 3', '0000.03.015', [['Caio Exemplo'], ['Dani Exemplo']])], app);
    expect(resumo(r)).toEqual(['prontuario+:0000.03.018>0000.03.015']);
    expect(r.conferir.pessoasQueNaoVieram).toEqual([]);
  });

  it('casa que mudou de número é achada pelo prontuário; a casa nova no número antigo vira casa nova', () => {
    const app = [fam('f1', '283', 'Casa 4', '0000.04.175', [mor('a', 'Ana Teste'), mor('b', 'Bia Teste')])];
    const r = comparar([casa('283', 'Casa 4', '0000.04.069', [['Duda Exemplo']]), casa('447', '', '0000.04.175', [['Ana Teste'], ['Bia Teste']])], app);
    expect(resumo(r)).toEqual(['endereco+:Rua das Acácias 283 Casa 4>Acácias 447', 'casa+:Acácias 283 Casa 4[Duda Exemplo]']);
  });

  it('casa dividida em duas: quem foi para a casa nova muda junto, com a mesma ficha', () => {
    const app = [fam('f1', '80', 'CASA 02', '0000.04.018', [mor('a', 'Ana Teste'), mor('b', 'Bia Teste', { grupos: ['hipertenso'] })])];
    const r = comparar([casa('80', 'CASA 02', '0000.04.018', [['Ana Teste']]), casa('80', 'CASA-3', '0000.04.014', [['Bia Teste']])], app);
    expect(resumo(r)).toEqual(['casa+:Acácias 80 CASA-3[Bia Teste]<1']);
    const nova = r.mudancas[0];
    expect(nova.tipo === 'casa' && nova.familia.moradores[0]).toMatchObject({ id: 'b', grupos: ['hipertenso'] });
    expect(r.conferir.pessoasQueNaoVieram).toEqual([]);
  });

  it('nome mais completo no SBCD é a mesma pessoa; nome parecido vem desmarcado', () => {
    const app = [fam('f1', '127', 'CS 3', '0000.03.051', [mor('a', 'Luna Teste'), mor('b', 'Maria Exemplo')])];
    const r = comparar([casa('127', 'CS 3', '0000.03.051', [['LUNA TESTE SILVA ARRUDA'], ['MARIA EXEMPLA'], ['Maria Exemplo']])], app);
    expect(resumo(r)).toEqual(['pessoa:MARIA EXEMPLA~']);
  });

  it('nascimento: vazio completa (marcado), diferente fica para o ACS decidir; sexo vazio completa', () => {
    const app = [fam('f1', '12', '', '0000.04.001', [mor('a', 'Ana Teste', { nascimento: '' , sexo: '' }), mor('b', 'Bia Teste', { nascimento: '1990-01-01' })])];
    const r = comparar([casa('12', '', '0000.04.001', [['Ana Teste', '1950-03-10'], ['Bia Teste', '1991-01-01']])], app);
    expect(resumo(r)).toEqual(['nascimento+:Ana Teste >1950-03-10', 'sexo+:Ana Teste', 'nascimento:Bia Teste 1990-01-01>1991-01-01']);
  });

  it('erro de digitação no complemento não vira endereço novo; casa sem número "0" é S/N', () => {
    const app = [fam('f1', '392', 'SALAO DE CABELEIREIRO', '0000.04.090', [mor('a', 'Ana Teste')]), fam('f2', 'S/N', '', '0000.04.015', [mor('b', 'Bia Teste')])];
    const r = comparar([casa('392', 'SALAO DE CABELEIREIR', '0000.04.090', [['Ana Teste']]), casa('0', '', '0000.04.015', [['Bia Teste']])], app);
    expect(r.mudancas).toEqual([]);
  });

  it('óbito e casas que não vieram ficam desmarcados; quem não veio aparece para conferir', () => {
    const app = [
      fam('f1', '12', '', '0000.04.001', [mor('a', 'Ana Teste', { nascimento: '1940-02-02' }), mor('b', 'Bia Teste')]),
      fam('f2', '73', 'FUNDOS', '0000.01.009', [mor('c', 'Caio Exemplo')]),
      fam('f3', '99', '', '', [mor('d', 'Duda Exemplo')]),
    ];
    const r = comparar([casa('12', '', '0000.04.001', [['Ana Teste', '1940-02-02']])], app, {
      casasNaRuaDeOutraMicro: [{ rua: 'Rua das Acácias', casa: '73 FUNDOS', microArea: '01', motivo: 'cadastro em outra micro' }],
      pendenciasCadastro: [{ tipo: 'óbito - dar baixa no cadastro', nome: 'ANA TESTE', nascimento: '02/02/1940' }, { tipo: 'sem CNS', nome: 'Bia Teste' }],
    });
    expect(resumo(r)).toEqual(['obito:Ana Teste', 'tirar:Rua das Acácias 73 FUNDOS no SBCD: cadastro em outra micro', 'tirar:Rua das Acácias 99 não veio no arquivo do SBCD']);
    expect(r.conferir.pessoasQueNaoVieram.map((x) => x.nome)).toEqual(['Bia Teste']);
    expect(r.pendencias).toHaveLength(2);
  });

  it('guarda os códigos do SBCD e usa na próxima vez', () => {
    const app = [fam('f1', '12', '', '0000.04.001', [mor('a', 'Ana Teste')])];
    const c = { ...casa('12', '', '0000.04.001', [['Ana Teste']]), codDomicilioSbcd: '714' };
    c.moradores[0].codUsuarioSbcd = '1042';
    const r = comparar([c], app);
    expect(r.ligacoes).toEqual([{ familiaId: 'f1', codSbcd: '714', moradores: [{ moradorId: 'a', codSbcd: '1042' }] }]);
    // Na próxima, mesmo com outro endereço e outro nome escrito, acha pelo código.
    const ligada = [{ ...app[0], codSbcd: '714', moradores: [{ ...app[0].moradores[0], codSbcd: '1042' }] }];
    const c2 = { ...casa('12', 'A', '0000.04.001', [['Ana T. Silva']]), codDomicilioSbcd: '714' };
    c2.moradores[0].codUsuarioSbcd = '1042';
    expect(resumo(comparar([c2], ligada))).toEqual([]);
  });
});
