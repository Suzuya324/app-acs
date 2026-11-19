import { describe, expect, it } from 'vitest';
import { buscar, combina, distancia, fonetica } from './busca';
import type { Familia } from './tipos';

const fam = (id: string, rua: string, numero: string, prontuario: string, nomes: string[]): Familia => ({
  id, rua, numero, complemento: '', bairro: '', colmeia: '', prontuario, situacaoCasa: 'habitada', obs: '', responsavelId: '',
  moradores: nomes.map((nome, i) => ({ id: `${id}-${i}`, nome, sexo: 'F', nascimento: '', situacao: 'mora', situacaoDesde: '', grupos: [], obs: '' })),
});

const familias = [
  fam('a', 'Rua das Acácias', '90', '00.0012', ['Joana Teste Silva']),
  fam('b', 'Rua das Acácias', '90', '', ['Pedro Exemplo']),
  fam('c', 'Rua dos Ipês Amarelos', '310', '00.0450', ['Márcia Ficticia']),
  fam('d', 'Travessa Beija-Flor', 'S/N', '00.', ['Lúcio Inventado']),
  fam('e', 'Rua dos Ipês Amarelos', '9', '00.0090', ['Ana Joana']),
];

const ids = (q: string) => buscar(familias, q).map((r) => r.familia.id);

describe('busca única', () => {
  it('acha por rua + número, inclusive várias famílias no mesmo número', () => {
    expect(ids('Acácias 90')).toEqual(['a', 'b']);
  });

  it('aceita sem acento, minúsculas e abreviações', () => {
    expect(ids('acacias 90')).toEqual(['a', 'b']);
    expect(ids('ac 90')).toEqual(['a', 'b']);
    expect(ids('Ipe 310')).toEqual(['c']);
    expect(ids('r. ipes am 310')).toEqual(['c']);
    expect(ids('flor s/n')).toEqual(['d']);
  });

  it('não confunde número da casa', () => {
    expect(ids('Ipê 31')).toEqual([]);
  });

  it('acha por nome de morador (partes do nome, sem acento)', () => {
    expect(ids('joana')).toEqual(['a', 'e']);
    expect(ids('marcia fic')).toEqual(['c']);
  });

  it('acha por prontuário', () => {
    expect(ids('00.0450')).toEqual(['c']);
    expect(ids('0450')).toEqual(['c']);
  });

  it('só a rua lista todas as casas da rua', () => {
    expect(ids('ipes')).toEqual(['c', 'e']);
  });

  it('busca vazia não traz nada', () => {
    expect(ids('   ')).toEqual([]);
  });
});

describe('busca por grupo', () => {
  const comGrupo = (id: string, grupos: Familia['moradores'][number]['grupos'], situacao: 'mora' | 'mudou' = 'mora'): Familia => {
    const f = fam(id, 'Rua Teste', id, '', ['Pessoa Inventada']);
    f.moradores[0] = { ...f.moradores[0], grupos, situacao };
    return f;
  };
  const lista = [comGrupo('g', ['gestante']), comGrupo('h', ['hipertenso', 'diabetico']), comGrupo('x', ['gestante'], 'mudou')];

  it('acha pelo nome do grupo, no plural e pelo começo', () => {
    for (const q of ['gestante', 'Gestantes', 'gest', 'grávida']) {
      expect(buscar(lista, q).map((r) => `${r.familia.id}:${r.motivo}`)).toEqual(['g:grupo']);
    }
    expect(buscar(lista, 'hipert').map((r) => r.familia.id)).toEqual(['h']);
    expect(buscar(lista, 'diabéticos').map((r) => r.familia.id)).toEqual(['h']);
    expect(buscar(lista, 'pressão alta').map((r) => r.familia.id)).toEqual(['h']);
  });

  it('não confunde nomes curtos e não muda a busca por rua', () => {
    expect(buscar(lista, 'ge').every((r) => r.motivo !== 'grupo')).toBe(true);
    expect(ids('Acácias 90')).toEqual(['a', 'b']);
    expect(ids('joana')).toEqual(['a', 'e']);
  });
});

describe('busca melhorada', () => {
  const f = (id: string, extra: Partial<Familia>, nomes: [string, string?][]): Familia => ({
    id, rua: 'Rua das Acácias', numero: '1', complemento: '', bairro: '', colmeia: '', prontuario: '', situacaoCasa: 'habitada', obs: '', responsavelId: `${id}-0`,
    moradores: nomes.map(([nome, nascimento], i) => ({ id: `${id}-${i}`, nome, sexo: 'F', nascimento: nascimento ?? '', situacao: 'mora', situacaoDesde: '', grupos: [], obs: '' })),
    ...extra,
  });
  const lista = [
    f('a', { numero: '30' }, [['JOANA TESTE DA SILVA', '1950-03-10']]),
    f('b', { numero: '30', complemento: 'Casa 2' }, [['Rita Ficticia Souza']]),
    f('c', { numero: '30', complemento: 'Fundos' }, [['Thiago Exemplo Luiz']]),
    f('d', { rua: 'Rua Padre Exemplo', numero: '12', telefone: '(11) 98888-1234', referencia: 'portão azul, perto da padaria' }, [['Helena Inventada']]),
    f('e', { numero: '90A' }, [['Johanna Teste']]),
  ];
  const ids2 = (q: string) => buscar(lista, q).map((r) => r.familia.id);
  const como = (q: string) => buscar(lista, q).map((r) => `${r.familia.id}:${r.motivo}${r.parecido ? '~' : ''}`);

  it('complemento: "acácias 30 casa 2" e "acácias 30 fundos"', () => {
    expect(ids2('acacias 30 casa 2')).toEqual(['b']);
    expect(ids2('acacias 30 fundos')).toEqual(['c']);
    expect(ids2('acacias 30')).toEqual(['a', 'b', 'c']);
  });

  it('número com letra: "90" acha 90A; "90a" também', () => {
    expect(ids2('acacias 90')).toEqual(['e']);
    expect(ids2('acacias 90a')).toEqual(['e']);
    expect(ids2('acacias 9')).toEqual([]);
  });

  it('nome com número da casa e rua com nome', () => {
    expect(como('joana 30')).toEqual(['a:nome']);
    expect(como('rita 31')).toEqual([]);
    expect(como('acacias rita')).toEqual(['b:nome']);
  });

  it('"da/de" no nome não atrapalha', () => {
    expect(ids2('joana silva')).toEqual(['a']);
    expect(ids2('joana da silva')).toEqual(['a']);
  });

  it('escrita parecida e uma letra errada (marcados como parecidos)', () => {
    expect(como('acassias 30 casa 2')).toEqual(['b:endereco~']);
    expect(como('rita sousa')).toEqual(['b:nome~']);
    expect(como('tiago')).toEqual(['c:nome~']);
    expect(como('elena')).toEqual(['d:nome~']);
    expect(como('joanna').sort()).toEqual(['a:nome~', 'e:nome~']);
    expect(como('johanna')).toEqual(['e:nome']);
  });

  it('abreviação de rua: "pe exemplo 12" e "padre exem 12"', () => {
    expect(ids2('pe exemplo 12')).toEqual(['d']);
    expect(ids2('padre exem 12')).toEqual(['d']);
  });

  it('telefone, ponto de referência e data de nascimento', () => {
    expect(como('98888')).toEqual(['d:telefone']);
    expect(como('portao azul')).toEqual(['d:referencia']);
    expect(como('10/03/1950')).toEqual(['a:nascimento']);
    expect(como('10/03')).toEqual(['a:nascimento']);
    expect(como('10/03/50')).toEqual(['a:nascimento']);
  });

  it('não inventa: número errado continua sem resultado', () => {
    expect(ids2('acassias 31')).toEqual([]);
    expect(ids2('xyzw')).toEqual([]);
  });
});

describe('combina (buscas das outras telas)', () => {
  it('cada palavra bate com o começo de alguma palavra, com escrita parecida', () => {
    expect(combina('Rua das Acácias, 90 · Joana Teste da Silva', 'acacias 90')).toBe(true);
    expect(combina('Rua das Acácias, 90 · Joana Teste da Silva', 'joana silva')).toBe(true);
    expect(combina('Rua das Acácias, 90 · Joana Teste da Silva', 'acassias')).toBe(true);
    expect(combina('Rua das Acácias, 90 · Joana Teste da Silva', 'acacias 91')).toBe(false);
    expect(combina('Rita Souza', 'sousa')).toBe(true);
    expect(combina('Rita Souza', '')).toBe(true);
  });

  it('fonética e distância', () => {
    expect(fonetica('Souza')).toBe(fonetica('Sousa'));
    expect(fonetica('Thiago')).toBe(fonetica('Tiago'));
    expect(fonetica('Acássias')).toBe(fonetica('Acácias'));
    expect(distancia('joana', 'johana')).toBe(1);
  });
});
