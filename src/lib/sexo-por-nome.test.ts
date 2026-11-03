import { describe, expect, it } from 'vitest';
import { importarTexto } from './importar';
import { listarPendencias } from './pendencias';
import { sugerirSexo, sugerirSexoNasFamilias } from './sexo-por-nome';
import type { Familia } from './tipos';

describe('sexo sugerido pelo primeiro nome', () => {
  it('nomes comuns femininos', () => {
    for (const n of ['Maria', 'Ana Paula', 'Juliana', 'Beatriz', 'Isabel', 'Raquel', 'Alice', 'Denise', 'Gisele', 'Ingrid', 'Thaís', 'Kelly', 'Sarah', 'Ruth', 'Yasmin', 'Lilian', 'Carmen', 'Aparecida', 'Leonor', 'Ione', 'Débora']) {
      expect(sugerirSexo(`${n} Teste`), n).toBe('F');
    }
  });

  it('nomes comuns masculinos', () => {
    for (const n of ['José', 'João Pedro', 'Pedro', 'Carlos', 'Lucas', 'Matheus', 'Rafael', 'Gabriel', 'Davi', 'Levi', 'André', 'Jorge', 'Felipe', 'Henrique', 'Guilherme', 'Vitor', 'Heitor', 'Wesley', 'Wellington', 'Edson', 'Luiz', 'Joaquim', 'Arthur', 'Enzo', 'Luca', 'Kevin']) {
      expect(sugerirSexo(`${n} Teste`), n).toBe('M');
    }
  });

  it('não chuta quando não dá para saber', () => {
    for (const n of ['Darci', 'Ruben', 'Jaci', 'X', '']) {
      expect(sugerirSexo(n), n).toBe('');
    }
  });

  it('ignora maiúsculas e acentos', () => {
    expect(sugerirSexo('MARIA DA SILVA')).toBe('F');
    expect(sugerirSexo('josé')).toBe('M');
  });
});

describe('aplicando nas famílias', () => {
  const familia = (): Familia => ({
    id: 'f1', rua: 'Rua Teste', numero: '1', complemento: '', bairro: '', colmeia: '', prontuario: '00.0001',
    situacaoCasa: 'habitada', obs: '', responsavelId: 'a',
    moradores: [
      { id: 'a', nome: 'Maria Teste', sexo: '', nascimento: '1980-01-01', situacao: 'mora', situacaoDesde: '', grupos: [], obs: '' },
      { id: 'b', nome: 'Darci Teste', sexo: '', nascimento: '1980-01-01', situacao: 'mora', situacaoDesde: '', grupos: [], obs: '' },
      { id: 'c', nome: 'Joana Teste', sexo: 'M', nascimento: '1980-01-01', situacao: 'mora', situacaoDesde: '', grupos: [], obs: '' },
    ],
  });

  it('preenche só quem está em branco e marca "a conferir"', () => {
    const f = familia();
    expect(sugerirSexoNasFamilias([f])).toBe(1);
    expect(f.moradores.map((m) => [m.sexo, !!m.sexoAConferir])).toEqual([
      ['F', true],
      ['', false],
      ['M', false], // já tinha sexo: não mexe
    ]);
  });

  it('aparece em "o que falta completar" como "a conferir"; quem ficou em branco continua "sem sexo"', () => {
    const f = familia();
    sugerirSexoNasFamilias([f]);
    expect(listarPendencias([f]).map((p) => `${p.tipo}:${p.morador?.id}`)).toEqual(['sexo_a_conferir:a', 'sem_sexo:b']);
  });

  it('a importação já sugere e conta quantos', () => {
    const r = importarTexto('RUA UM\nUm 1\n - Maria Teste (01/01/1980)\n - José Teste (01/01/1980)\n - Darci Teste (01/01/1980)\n', '2026-11-03');
    expect(r.sexoSugerido).toBe(2);
    expect(r.familias[0].moradores.map((m) => m.sexo)).toEqual(['F', 'M', '']);
  });
});
