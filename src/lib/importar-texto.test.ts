import { describe, expect, it } from 'vitest';
import { importarTexto } from './importar';
import { textoResumo } from './importar-csv';
import { pareceListaEmTexto } from './importar-texto';

const HOJE = '2026-11-03';

// Lista INVENTADA no mesmo formato do relatório em texto (rua no título, casa, moradores com "-").
const LISTA = `CASAS E MORADORES - ACS FULANO (MICRO 00)
UBS Exemplo - atualizado em 01/11/2026
Fonte: dados inventados para teste
TOTAL: 6 casas/famílias e 10 moradores cadastrados


============================================================
RUA DAS ACÁCIAS AMARELAS - 4 casas/famílias, 7 moradores
============================================================

Acácias 1 DEPOIS DA PONTE  (pront. 0000.00.101, 2 moradores)
   - Fulana de Tal Teste (08/04/1984)
   - Ciclano de Tal Teste (06/05/2019)

Acácias 30 CASA 2  (pront. 0000.00.102, 3 moradores)
   - Beltrana Exemplo Souza (17/02/1992)
   - Joãozinho Exemplo Souza (29/06/2014)
   - Bebê Exemplo (recém-nascido, AINDA NÃO CADASTRADO)

Acácias 30  (pront. -, 1 morador)
   - Paulo Inventado Lima (30/09/1972)

Acácias S/Nº  (pront. 0000.00.104, 1 morador)
   - Rita Ficticia Gomes (11/12/1949)

============================================================
RUA DOS IPÊS ROXOS - 2 casas/famílias, 3 moradores
============================================================

Ipês 7 CS 1  (pront. 0000.00.201, 2 moradores)
   - Ana Exemplo Prado (08/08/1985)
   - Bruno Exemplo Prado (17/02/1983)

Ipês 45 B  (pront. 0000.00.202, 1 morador)
   - Diego Ficticio Moura (01/01/2000)
`;

describe('lista em texto (não é planilha)', () => {
  const r = importarTexto(LISTA, HOJE);

  it('reconhece que é uma lista', () => {
    expect(pareceListaEmTexto(LISTA)).toBe(true);
    expect(pareceListaEmTexto('Casa;Rua;Nome\nC1;Rua Um;Ana')).toBe(false);
    expect(r.agrupamento).toBe('lista');
  });

  it('lê ruas, casas e moradores e confere com o TOTAL do texto', () => {
    expect(r.erros).toEqual([]);
    expect(textoResumo(r.resumo)).toBe('2 ruas, 6 famílias, 10 moradores');
    expect(r.totalInformado).toEqual({ familias: 6, moradores: 10 });
    expect(r.resumo.ruas).toEqual([
      { rua: 'Rua das Acácias Amarelas', familias: 4 },
      { rua: 'Rua dos Ipês Roxos', familias: 2 },
    ]);
  });

  it('entende a abreviação da rua, o número e o complemento', () => {
    const [a1, a30c2, a30, asn, i7, i45] = r.familias;
    expect([a1.rua, a1.numero, a1.complemento]).toEqual(['Rua das Acácias Amarelas', '1', 'DEPOIS DA PONTE']);
    expect([a30c2.numero, a30c2.complemento]).toEqual(['30', 'CASA 2']);
    expect([a30.numero, a30.complemento]).toEqual(['30', '']);
    expect(asn.numero).toBe('S/N');
    expect([i7.rua, i7.numero, i7.complemento]).toEqual(['Rua dos Ipês Roxos', '7', 'CS 1']);
    expect([i45.numero, i45.complemento]).toEqual(['45', 'B']);
  });

  it('prontuário "-" fica vazio; os outros são mantidos', () => {
    expect(r.familias.map((f) => f.prontuario)).toEqual([
      '0000.00.101', '0000.00.102', '', '0000.00.104', '0000.00.201', '0000.00.202',
    ]);
  });

  it('moradores com data; o primeiro de cada casa é o responsável', () => {
    const f = r.familias[0];
    expect(f.moradores.map((m) => [m.nome, m.nascimento])).toEqual([
      ['Fulana de Tal Teste', '1984-04-08'],
      ['Ciclano de Tal Teste', '2019-05-06'],
    ]);
    expect(f.responsavelId).toBe(f.moradores[0].id);
  });

  it('anotação entre parênteses vai para as observações, com aviso', () => {
    const bebe = r.familias[1].moradores[2];
    expect(bebe.nome).toBe('Bebê Exemplo');
    expect(bebe.nascimento).toBe('');
    expect(bebe.obs).toBe('recém-nascido, AINDA NÃO CADASTRADO');
    expect(r.avisos.some((a) => a.texto.includes('Bebê Exemplo') && a.texto.includes('observações'))).toBe(true);
  });

  it('sem avisos de contagem quando tudo bate', () => {
    expect(r.avisos.filter((a) => a.texto.includes('encontrei'))).toEqual([]);
  });
});

describe('lista em texto: conferência das contagens', () => {
  it('avisa quando a casa diz N moradores e veio outro número', () => {
    const r = importarTexto('RUA UM\n\nUm 5  (pront. 1, 3 moradores)\n - Ana Teste (01/01/1990)\n - Bia Teste (01/01/1991)\n', HOJE);
    expect(r.avisos.some((a) => a.texto.includes('diz 3 morador(es), encontrei 2'))).toBe(true);
  });

  it('avisa quando o título da rua não bate', () => {
    const r = importarTexto('RUA UM - 2 casas/famílias, 1 moradores\n\nUm 5\n - Ana Teste (01/01/1990)\n', HOJE);
    expect(r.avisos.some((a) => a.texto.includes('o título diz 2 casas, encontrei 1'))).toBe(true);
  });
});

describe('lista em texto: outros jeitos de escrever', () => {
  it('endereço completo na linha da casa, data e sexo soltos', () => {
    const r = importarTexto(
      ['Rua das Flores, 90 - Fundos', '• Maria Teste - 05/05/1980 - F', '• José Teste, 10/10/1975, M', '', 'Rua das Flores 92', '* Ana Teste'].join('\n'),
      HOJE,
    );
    expect(r.erros).toEqual([]);
    const [f1, f2] = r.familias;
    expect([f1.rua, f1.numero, f1.complemento]).toEqual(['Rua das Flores', '90', 'Fundos']);
    expect(f1.moradores.map((m) => [m.nome, m.nascimento, m.sexo])).toEqual([
      ['Maria Teste', '1980-05-05', 'F'],
      ['José Teste', '1975-10-10', 'M'],
    ]);
    expect(f2.numero).toBe('92');
    expect(f2.moradores[0].nascimento).toBe('');
  });

  it('casa com abreviação que não bate com nenhuma rua: avisa e mantém o nome', () => {
    const r = importarTexto('Beco 3\n - Ana Teste (01/01/1990)\n', HOJE);
    expect(r.familias[0].rua).toBe('Beco');
    expect(r.avisos[0].texto).toContain('não bate com nenhum título de rua');
  });

  it('data inválida gera aviso e fica em branco', () => {
    const r = importarTexto('RUA UM\nUm 1\n - Ana Teste (31/02/1990)\n', HOJE);
    expect(r.familias[0].moradores[0].nascimento).toBe('');
    expect(r.avisos.some((a) => a.texto.includes('31/02/1990'))).toBe(true);
  });

  it('texto sem nenhuma casa: erro', () => {
    const r = importarTexto('- solto\n- outro solto\n', HOJE);
    expect(r.erros.length).toBe(1);
  });

  it('planilha continua indo para o importador de planilha', () => {
    const r = importarTexto('Casa;Rua;Numero;Nome\nC1;Rua Um;1;Ana Teste', HOJE);
    expect(r.agrupamento).toBe('casa');
  });
});

describe('lista em texto: complementos variados (dados inventados)', () => {
  const texto = `RUA MORRO DAS FLORES TESTE - 7 casas/famílias, 8 moradores
=====
Morro 400 NUMERO14  (pront. 0000.06.137, 1 morador)
   - Pessoa Um Teste (02/03/2013)

Morro 400 CASA 4 A1  (pront. 0000.04.128, 1 morador)
   - Pessoa Dois Teste (28/08/1998)

Morro 400 NUMERO 13A  (pront. 0000.04.141, 1 morador)
   - Pessoa Tres Teste (17/11/1960)

Morro 30 30F  (pront. 0000.04.187, 1 morador)
   - Pessoa Quatro Teste (09/10/2023)

Morro 56 CONJUNTO CASA CORETO  (pront. -, 1 morador)
   - Pessoa Cinco Teste (21/02/1978)

Morro S/Nº  (pront. 0000.04.015, 1 morador)
   - Pessoa Seis Teste (10/06/1972)

Morro 450  (pront. 0000.04.178, 1 morador)
   - Pessoa Sete Teste (22/04/2006)
   - Bebê Teste (recém-nascida, AINDA NÃO CADASTRADA)
`;
  const r = importarTexto(texto, HOJE);

  it('número e complemento certos em cada casa', () => {
    expect(r.familias.map((f) => `${f.numero}|${f.complemento}`)).toEqual([
      '400|NUMERO14',
      '400|CASA 4 A1',
      '400|NUMERO 13A',
      '30|30F',
      '56|CONJUNTO CASA CORETO',
      'S/N|',
      '450|',
    ]);
    expect(new Set(r.familias.map((f) => f.rua))).toEqual(new Set(['Rua Morro das Flores Teste']));
  });

  it('o recém-nascido conta, e o app avisa a diferença na casa (texto diz 1, encontrei 2)', () => {
    expect(r.resumo.moradores).toBe(8);
    expect(r.avisos.some((a) => a.texto.includes('450') && a.texto.includes('diz 1 morador(es), encontrei 2'))).toBe(true);
  });
});
