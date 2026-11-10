import { describe, expect, it } from 'vitest';
import {
  etiquetasParaMostrar, gruposDasEtiquetas, infoEtiqueta, lerListaPrioritarios, ligar, ordenarPrioritarios,
  pareceObitoAConfirmar, prepararPrioritarios, textoParaCopiar, type Prioritario, separarCoracao, temAvcOuInfarto,
} from './prioritarios';
import type { Familia, Morador } from './tipos';

const HOJE = '2026-11-05';
const mor = (id: string, nome: string, nascimento = ''): Morador => ({ id, nome, sexo: 'F', nascimento, situacao: 'mora', situacaoDesde: '', grupos: [], obs: '' });
const fam = (id: string, numero: string, complemento: string, prontuario: string, moradores: Morador[]): Familia => ({
  id, rua: 'RUA DAS ACACIAS', numero, complemento, bairro: '', colmeia: '', prontuario, situacaoCasa: 'habitada', obs: '', responsavelId: '', moradores,
});
const familias = [
  fam('a', '333', '', '0000.09.101', [mor('a1', 'JOANA TESTE SILVA', '1950-03-10')]),
  fam('b', '111', 'CS 1', '0000.09.043', [mor('b1', 'PEDRO EXEMPLO SOUZA', '1960-01-02')]),
  fam('c', '400', 'NUMERO 13A', '', [mor('c1', 'ANA FICTICIA PRADO', '1940-05-05')]),
];
const LISTA = JSON.stringify([
  { nivel: 'A', rua: 'Acacias', casa: '333', prontuario: '0000.09.101', nome: 'JOANA TESTE SILVA', nascimento: '10/03/1950', idade: 76,
    condicoes: ['HAS', 'DM', 'GESTANTE? (registro antigo - confirmar)'], resumo: 'Resumo inventado.', ultimaInfo: '12/08/2026 Agente' },
  { nivel: 'B', rua: 'Acacias', casa: '111 CS1', prontuario: '', nome: 'PEDRO EXEMPLO SOUZA', nascimento: '02/01/1960', idade: 66,
    condicoes: ['SAUDE MENTAL', 'PNEUMONIA (27/10)'], resumo: '08/2026 relato: veio a OBITO (confirmar)', ultimaInfo: '' },
  { nivel: 'A', rua: 'Acacias', casa: '400 NUMERO 13A', prontuario: '', nome: 'ANA FICTICIA PRADO', nascimento: '05/05/1940', idade: 85,
    condicoes: ['ACAMADO/DOMICILIADO', 'O2'], resumo: 'Outro resumo inventado.', ultimaInfo: '' },
  { nivel: 'C', rua: 'Flores', casa: '1', prontuario: '', nome: 'PESSOA QUE NAO EXISTE', nascimento: '01/01/1990', idade: 36, condicoes: [], resumo: '', ultimaInfo: '' },
]);

describe('prioritários', () => {
  it('lê a lista, normaliza etiquetas e marca óbito a confirmar só quando o resumo diz', () => {
    const l = lerListaPrioritarios(LISTA, 'agora');
    expect(l).toHaveLength(4);
    expect(l[0]).toMatchObject({ nascimento: '1950-03-10', nivel: 'A', etiquetas: ['HAS', 'DM', 'GESTANTE?'] });
    expect(l[0].obito).toBeUndefined();
    expect(l[1].obito).toBe(true);
    expect(pareceObitoAConfirmar('Esposo veio a óbito em 2024.')).toBe(false);
    expect(pareceObitoAConfirmar('RELATO 10/2025 - (pode ter falecido/mudado)')).toBe(true);
    expect(() => lerListaPrioritarios('{"formato":"outra coisa"}', 'agora')).toThrow();
  });

  it('etiquetas: nome, cor, grupo; gestante só "confirmar"; 80+ pela idade de hoje', () => {
    expect(infoEtiqueta('GESTANTE?')).toMatchObject({ nome: 'Gestante? confirmar', cor: 'azul' });
    expect(infoEtiqueta('PNEUMONIA (27/10)')).toMatchObject({ nome: 'Pneumonia (27/10)', cor: 'cinza' });
    expect(infoEtiqueta('O2').cor).toBe('vermelho');
    expect(gruposDasEtiquetas(['HAS', 'DM', 'GESTANTE?', 'PALIATIVO'])).toEqual(['hipertenso', 'diabetico', 'alzheimer']);
    const [, , ana] = lerListaPrioritarios(LISTA, 'agora');
    expect(etiquetasParaMostrar(ana, HOJE)).toContain('IDOSO 80+');
  });

  it('liga com a casa: prontuário, endereço com complemento escrito diferente e nome', () => {
    const l = lerListaPrioritarios(LISTA, 'agora');
    expect(l.map((p) => ligar(p, familias))).toEqual([
      { familiaId: 'a', moradorId: 'a1' },
      { familiaId: 'b', moradorId: 'b1' }, // "111 CS1" = "111 CS 1"
      { familiaId: 'c', moradorId: 'c1' },
      {},
    ]);
  });

  it('lista nova: atualiza, inclui, não apaga e pergunta sobre o que foi editado à mão', () => {
    const atuais = prepararPrioritarios(lerListaPrioritarios(LISTA, 't1'), [], familias).novos;
    expect(atuais).toHaveLength(4);
    const editados: Prioritario[] = atuais.map((p) => (p.nome.startsWith('PEDRO') ? { ...p, nivel: 'A', editadoEm: 't2' } : p));
    const nova = JSON.parse(LISTA).slice(0, 2).map((p: Record<string, unknown>) => ({ ...p, resumo: `${p.resumo} Novo.` }));
    nova.push({ nivel: 'B', rua: 'Acacias', casa: '333', prontuario: '', nome: 'NOVA PESSOA TESTE', nascimento: '01/01/1980', idade: 46, condicoes: ['DM'], resumo: '', ultimaInfo: '' });
    const p = prepararPrioritarios(lerListaPrioritarios(JSON.stringify(nova), 't3'), editados, familias);
    expect(p.atualizados.map((x) => x.nome)).toEqual(['JOANA TESTE SILVA']);
    expect(p.conflitos.map((c) => c.atual.nome)).toEqual(['PEDRO EXEMPLO SOUZA']);
    expect(p.novos.map((x) => x.nome)).toEqual(['NOVA PESSOA TESTE']);
    expect(p.ficam).toBe(2); // Ana e a pessoa sem casa continuam
  });

  it('ordem: nível, rua (na ordem dada) e número; texto para copiar', () => {
    const l = lerListaPrioritarios(LISTA, 'agora');
    expect(ordenarPrioritarios(l, ['RUA DAS ACACIAS']).map((p) => `${p.nivel}${p.casa}`)).toEqual(['A333', 'A400 NUMERO 13A', 'B111 CS1', 'C1']);
    expect(textoParaCopiar(l[0], HOJE)).toBe('JOANA TESTE SILVA (76 anos) - Acacias 333 - Pront. 0000.09.101 - HAS, DM, Gestante? confirmar - Resumo inventado.');
  });
});

describe('etiqueta de coração', () => {
  it('só fica como AVC/infarto quem tem AVC ou infarto no resumo', () => {
    expect(temAvcOuInfarto('Infarto em 2024 (inventado).')).toBe(true);
    expect(temAvcOuInfarto('2 AVCs com sequela (inventado).')).toBe(true);
    expect(temAvcOuInfarto('BEBE: cirurgia cardíaca (inventado).')).toBe(false);
    expect(separarCoracao(['AVC/INFARTO/CORACAO', 'HAS'], 'Arritmia, usa marca-passo (inventado).')).toEqual(['CORACAO', 'HAS']);
    expect(separarCoracao(['AVC/INFARTO/CORACAO'], 'Teve derrame (inventado).')).toEqual(['AVC/INFARTO/CORACAO']);
    expect(gruposDasEtiquetas(['CORACAO'])).toEqual(['coracao']);
  });

  it('a lista importada já chega separada', () => {
    const l = lerListaPrioritarios(JSON.stringify([
      { nome: 'Bebe Teste', nascimento: '12/04/2024', nivel: 'A', condicoes: ['AVC/INFARTO/CORACAO'], resumo: 'Cirurgia cardíaca (inventado).' },
      { nome: 'Adulto Teste', nascimento: '12/04/1960', nivel: 'A', condicoes: ['AVC/INFARTO/CORACAO'], resumo: 'Infarto em 2024 (inventado).' },
    ]), 'x');
    expect(l.map((p) => p.etiquetas)).toEqual([['CORACAO'], ['AVC/INFARTO/CORACAO']]);
  });
});
