import { describe, expect, it } from 'vitest';
import { casarComMoradores, gruposQueFaltam, lerArquivoGrupos, lerListaGrupos } from './importar-grupos';
import type { Familia, Morador } from './tipos';

const mor = (id: string, nome: string, nascimento = '', extra: Partial<Morador> = {}): Morador => ({
  id, nome, sexo: 'F', nascimento, situacao: 'mora', situacaoDesde: '', grupos: [], obs: '', ...extra,
});
const fam = (id: string, moradores: Morador[]): Familia => ({
  id, rua: 'Rua Teste', numero: id, complemento: '', bairro: '', colmeia: '', prontuario: '', situacaoCasa: 'habitada', obs: '',
  responsavelId: '', moradores,
});

describe('marcar grupos colando uma lista', () => {
  it('lê nome, data e grupo em vários formatos', () => {
    const texto = [
      'NOME\tDATA DE NASCIMENTO\tCONDIÇÃO',
      'JOANA TESTE DA SILVA\t10/03/1950\tHAS',
      'Pedro Exemplo Souza;02/01/1961;DM2, Hipertensão',
      'MÁRCIA FICTÍCIA LIMA   15/07/1948   ACAMADA',
      'Lúcio Inventado',
    ].join('\n');
    const l = lerListaGrupos(texto, null);
    expect(l).toEqual([
      { nome: 'joana teste da silva', nascimento: '1950-03-10', grupos: ['hipertenso'] },
      { nome: 'pedro exemplo souza', nascimento: '1961-01-02', grupos: ['hipertenso', 'diabetico'] },
      { nome: 'marcia ficticia lima', nascimento: '1948-07-15', grupos: ['acamado'] },
    ]);
  });

  it('com o grupo da lista escolhido, toda linha com nome entra', () => {
    const l = lerListaGrupos('Lúcio Inventado Reis\nAna Joana Prado 01/02/1940', 'acamado');
    expect(l.map((x) => `${x.nome}:${x.grupos.join(',')}`)).toEqual(['lucio inventado reis:acamado', 'ana joana prado:acamado']);
  });

  it('acha pelo nome, desempata pela data e avisa nome parecido', () => {
    const familias = [
      fam('1', [mor('a', 'Joana Teste da Silva', '1950-03-10'), mor('b', 'Pedro Exemplo Souza')]),
      fam('2', [mor('c', 'Maria Inventada Costa', '1960-01-01'), mor('d', 'Maria Inventada Costa', '1985-05-05')]),
      fam('3', [mor('e', 'Ana Paula Prado'), mor('f', 'Lúcio Reis', '', { situacao: 'mudou' })]),
    ];
    const linhas = lerListaGrupos(
      ['JOANA TESTE SILVA 10/03/1950', 'Maria Inventada Costa 05/05/1985', 'Maria Inventada Costa', 'Ana Prado', 'Lucio Reis', 'Fulano Ninguem'].join('\n'),
      'hipertenso',
    );
    const r = casarComMoradores(linhas, familias).map((c) => `${c.situacao}:${c.candidatos.map((x) => x.morador.id).join(',')}`);
    expect(r).toEqual([
      'achado:a', // "da" não importa
      'achado:d', // mesma pessoa pelo nome + data
      'varios:c,d', // duas Marias, sem data: escolher
      'parecido:e', // primeiro e último nome
      'nao_achado:', // quem mudou não entra
      'nao_achado:',
    ]);
  });
});

describe('ler arquivo de pacientes (JSON, CSV, TXT)', () => {
  it('JSON com lista de pacientes, campos de condição e campos ignorados', () => {
    const json = JSON.stringify({
      unidade: 'Unidade Teste',
      pacientes: [
        { nome: 'Joana Teste da Silva', dataNascimento: '1950-03-10', nomeMae: 'Maria Inventada', condicoes: ['HAS', 'DM'], rua: 'Rua das Acácias' },
        { nome_paciente: 'Pedro Exemplo Souza', dn: '02/01/1961', acamado: true, idoso: 'Sim', gestante: false },
        { NOME: 'Ana Fictícia Prado', prioridade: 'Gestante', telefone: '0000-0000' },
        { nome: 'Lúcio Inventado Reis', observacao: 'mudou-se' },
      ],
    });
    const r = lerArquivoGrupos(json, null);
    expect(r.formato).toBe('json');
    expect(r.linhas).toEqual([
      { nome: 'joana teste da silva', nascimento: '1950-03-10', grupos: ['hipertenso', 'diabetico'] },
      { nome: 'pedro exemplo souza', nascimento: '1961-01-02', grupos: ['acamado', 'idoso'] },
      { nome: 'ana ficticia prado', nascimento: '', grupos: ['gestante'] },
    ]);
    expect(r.semCondicao).toBe(1);
  });

  it('CSV com cabeçalho, aspas e vírgula', () => {
    const csv = 'Nome,Data de nascimento,Condição,Endereço\n"JOANA TESTE DA SILVA",10/03/1950,"HAS, DM","Rua X, 10"\nPEDRO EXEMPLO SOUZA,02/01/1961,Acamado,Rua Y\n';
    const r = lerArquivoGrupos(csv, null);
    expect(r.formato).toBe('colunas');
    expect(r.linhas.map((l) => `${l.nome}:${l.grupos.join(',')}`)).toEqual(['joana teste da silva:hipertenso,diabetico', 'pedro exemplo souza:acamado']);
  });

  it('TXT sem colunas usa a leitura livre', () => {
    const r = lerArquivoGrupos('JOANA TESTE DA SILVA 10/03/1950 HAS\nPEDRO EXEMPLO SOUZA DM', null);
    expect(r.formato).toBe('texto');
    expect(r.linhas.map((l) => l.grupos.join(','))).toEqual(['hipertenso', 'diabetico']);
  });
});

it('não marca gestante nem puérpera em homem', () => {
  const h = mor('h', 'Pedro Exemplo', '', { sexo: 'M', grupos: ['hipertenso'] });
  expect(gruposQueFaltam(h, ['gestante', 'hipertenso', 'diabetico'])).toEqual(['diabetico']);
});
