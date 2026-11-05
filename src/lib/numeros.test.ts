import { describe, expect, it } from 'vitest';
import { analisarNumeros, emIntervalos, numerosDaMicro, escreverProntuario, lerNumeros, microPrincipal, partesProntuario, proximoLivre } from './numeros';
import type { Familia } from './tipos';

const fam = (id: string, prontuario: string, extra: Partial<Familia> = {}): Familia => ({
  id, rua: 'Rua Teste', numero: id, complemento: '', bairro: '', colmeia: '', prontuario, situacaoCasa: 'habitada', obs: '',
  responsavelId: '', moradores: [], ...extra,
});

describe('números de prontuário', () => {
  it('lê o prontuário em partes', () => {
    expect(partesProntuario('04.123')).toEqual({ prefixo: '', micro: '04', numero: 123, digitos: 3 });
    expect(partesProntuario('4.0007')).toEqual({ prefixo: '', micro: '04', numero: 7, digitos: 4 });
    expect(partesProntuario('0000.09.045')).toEqual({ prefixo: '0000.', micro: '09', numero: 45, digitos: 3 });
    expect(partesProntuario('04.')).toBeNull();
    expect(partesProntuario('0000.09.')).toBeNull();
    expect(partesProntuario('-')).toBeNull();
    expect(partesProntuario('')).toBeNull();
  });

  it('acha a micro principal (ajustes ou a mais comum)', () => {
    const f = [fam('a', '09.001'), fam('b', '09.002'), fam('c', '08.001')];
    expect(microPrincipal(f)).toBe('09');
    expect(microPrincipal(f, 'Micro 8')).toBe('08');
    expect(microPrincipal(f, 'Equipe azul')).toBe('09');
  });

  it('lê números digitados com intervalos e prefixo', () => {
    expect(lerNumeros('1, 2, 5-7; 10 a 12\n09.020 e 3')).toEqual([1, 2, 3, 5, 6, 7, 10, 11, 12, 20]);
    expect(emIntervalos([8, 1, 2, 3, 5, 7])).toBe('1–3, 5, 7–8');
  });

  it('separa usados, livres, repetidos, outra micro e sem número', () => {
    const f = [fam('a', '09.001'), fam('b', '09.003'), fam('c', '09.003'), fam('d', '08.002'), fam('e', ''), fam('g', '09.'), fam('h', '09.006')];
    const a = analisarNumeros(f, '09');
    expect([...a.usados.keys()].sort()).toEqual([1, 3, 6]);
    expect(a.livres).toEqual([2, 4, 5]);
    expect(a.repetidos.map((r) => r.numero)).toEqual([3]);
    expect(a.outraMicro.map((x) => x.id)).toEqual(['d']);
    expect(a.semNumero.map((x) => x.id)).toEqual(['e', 'g']);
    expect(proximoLivre(a)).toBe(2);
    expect(escreverProntuario('09', proximoLivre(a), a.digitos)).toBe('09.002');
  });

  it('confere com as pastas da colmeia', () => {
    const f = [fam('a', '09.001'), fam('b', '09.002'), fam('c', '09.004', { situacaoCasa: 'vazia' })];
    const a = analisarNumeros(f, '09', [1, 3, 5, 8]);
    expect(a.colmeia!.sobrando).toEqual([3, 5, 8]); // pastas de quem não é da área: tirar
    expect(a.colmeia!.semPasta.map((s) => s.familia.id)).toEqual(['b']); // casa vazia não precisa de pasta
    expect(a.livres).toEqual([6, 7]); // sem família e sem pasta
    expect(a.livresComPasta).toEqual([3, 5, 8]); // liberam quando tirar a pasta
    expect(proximoLivre(a)).toBe(6);
  });

  it('formato unidade.micro.família: mantém o começo ao sugerir', () => {
    const f = [fam('a', '0000.09.001'), fam('b', '0000.09.003'), fam('c', '0000.08.002'), fam('d', '-'), fam('e', '0000.09.')];
    expect(microPrincipal(f)).toBe('09');
    const a = analisarNumeros(f, '09');
    expect(a.livres).toEqual([2]);
    expect(a.outraMicro.map((x) => x.id)).toEqual(['c']);
    expect(a.semNumero.map((x) => x.id)).toEqual(['d', 'e']);
    expect(escreverProntuario('09', proximoLivre(a), a.digitos, a.prefixo)).toBe('0000.09.002');
  });

  it('lê os números em uso no Fast só da micro certa', () => {
    const texto = 'Fulano Inventado 0000.09.004 10/03/1950\n0000.08.007\n09.010\n12-14';
    expect(numerosDaMicro(texto, '09')).toEqual([4, 10, 12, 13, 14]);
  });

  it('número em uso no Fast não aparece como livre', () => {
    const f = [fam('a', '09.001'), fam('b', '09.005')];
    const a = analisarNumeros(f, '09', [], [2, 3, 8]);
    expect(a.livres).toEqual([4, 6, 7]);
    expect(a.soNoFast).toEqual([2, 3, 8]);
    expect(proximoLivre(a)).toBe(4);
  });

  it('sem nenhum livre, o próximo é depois do maior', () => {
    const a = analisarNumeros([fam('a', '09.001'), fam('b', '09.002')], '09');
    expect(proximoLivre(a)).toBe(3);
  });
});
