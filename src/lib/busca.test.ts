import { describe, expect, it } from 'vitest';
import { buscar } from './busca';
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
