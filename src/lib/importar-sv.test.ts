import { describe, expect, it } from 'vitest';
import { acharFamilia, lerArquivoImportacao, prepararImportacao, type ArquivoImportacao } from './importar-sv';
import type { Familia, Morador, Visita } from './tipos';

const mor = (id: string, nome: string): Morador => ({ id, nome, sexo: 'F', nascimento: '', situacao: 'mora', situacaoDesde: '', grupos: [], obs: '' });
const fam = (id: string, rua: string, numero: string, complemento: string, prontuario: string, nomes: string[]): Familia => ({
  id, rua, numero, complemento, bairro: '', colmeia: '', prontuario, situacaoCasa: 'habitada', obs: '', responsavelId: '',
  moradores: nomes.map((n, i) => mor(`${id}-${i}`, n)),
});
const familias = [
  fam('a', 'Rua das Acácias', '12', '', '0000.09.001', ['Joana Teste Silva']),
  fam('b', 'Rua das Acácias', '12', 'CASA 2', '0000.09.002', ['Pedro Exemplo']),
  fam('c', 'Rua dos Ipês', 'S/N', '', '', ['Márcia Fictícia']),
  fam('d', 'Rua dos Ipês', '40', 'CS 1', '0000.08.010', ['Lúcio Inventado']),
  fam('e', 'Rua dos Ipês', '40', 'CS 2', '0000.08.010', ['Ana Prado']), // mesmo prontuário por engano
];

describe('trazer do Sistema de Visitas', () => {
  it('acha a família pelo prontuário em qualquer formato', () => {
    expect(acharFamilia({ pront: '09.1', rotulo: 'x' }, familias)?.id).toBe('a');
    expect(acharFamilia({ pront: '0000.09.002', rotulo: 'x' }, familias)?.id).toBe('b');
  });

  it('acha pelo endereço com complemento escrito diferente', () => {
    expect(acharFamilia({ rua: 'Acácias', numero: '12', complemento: 'Casa 02', rotulo: 'x' }, familias)?.id).toBe('b');
    expect(acharFamilia({ rua: 'ipes', numero: 'S/Nº', rotulo: 'x' }, familias)?.id).toBe('c');
  });

  it('desempata prontuário repetido pelo nome; sem jeito de saber, não chuta', () => {
    expect(acharFamilia({ pront: '08.10', nomes: ['ANA PRADO'], rotulo: 'x' }, familias)?.id).toBe('e');
    expect(acharFamilia({ pront: '08.10', rotulo: 'x' }, familias)).toBeNull();
    expect(acharFamilia({ pessoa: 'Pedro Exemplo', rotulo: 'x' }, familias)?.id).toBe('b');
    expect(acharFamilia({ rua: 'Flores', numero: '1', rotulo: 'Flores 1' }, familias)).toBeNull();
    // número com duas casas e complemento que não bate: o nome do morador decide
    expect(acharFamilia({ rua: 'ipes', numero: '40', complemento: '', nomes: ['Lucio Inventado'], rotulo: 'x' }, familias)?.id).toBe('d');
  });

  it('prepara VDs e relatos sem duplicar', () => {
    const arq: ArquivoImportacao = {
      formato: 'facilitador-importacao', versao: 1, origem: 'Sistema de Visitas',
      itens: [
        { tipo: 'vd', id: 'sv-1', casa: { pront: '09.1', rotulo: 'Acácias 12' }, data: '2026-10-07', desfecho: 'realizada', relato: 'Relato inventado', lancada: true },
        { tipo: 'vd', id: 'sv-2', casa: { pront: '09.2', rotulo: 'Acácias 12 c2' }, data: '2026-10-08', desfecho: 'ausencia_completa', relato: '', lancada: true },
        { tipo: 'vd', id: 'sv-3', casa: { pront: '09.1', rotulo: 'Acácias 12' }, data: '2026-10-20', desfecho: 'realizada', relato: 'x', lancada: true },
        { tipo: 'vd', id: 'sv-4', casa: { rua: 'Flores', numero: '1', rotulo: 'Flores 1' }, data: '2026-10-09', desfecho: 'realizada', relato: '', lancada: true },
        { tipo: 'vd', id: 'sv-5', casa: { rua: 'acacias', numero: '12', complemento: 'casa 2', rotulo: 'x' }, data: '2026-10-08', desfecho: 'realizada', relato: 'Outro relato inventado', lancada: true },
        { tipo: 'relato', id: 'r-1', casa: { pront: '09.1', rotulo: 'Acácias 12' }, titulo: '07/10 · VD', texto: 'Texto inventado', data: '2026-10-07' },
      ],
    };
    const ja: Visita[] = [{ id: 'outra', familiaId: 'a', data: '2026-10-20', presentes: [], conversouComFamilia: true, desfecho: 'realizada', motivo: 'Outros', compartilhadaCom: '', sinais: {}, orientacoes: '', relato: '', lancadaNoFast: true }];
    const p = prepararImportacao(lerArquivoImportacao(JSON.stringify(arq)), familias, ja, { motivoPadrao: 'Outros', quando: '2026-11-05T00:00:00Z' });
    expect(p.visitas.map((v) => `${v.id}:${v.familiaId}:${v.desfecho}`)).toEqual(['sv-1:a:realizada', 'sv-2:b:realizada']);
    expect(p.juntadas).toBe(1); // sv-5: mesma casa e dia de sv-2 → um registro só, com o relato
    expect(p.visitas[1].relato).toBe('Outro relato inventado');
    expect(p.jaExistiam).toBe(1); // sv-3: a família já tinha VD nesse dia
    expect(p.naoAchados).toEqual([{ rotulo: 'Flores 1', tipo: 'vd' }]);
    expect(p.relatos.get('a')?.[0]).toMatchObject({ id: 'r-1', origem: 'Sistema de Visitas' });
    expect(p.visitas[0]).toMatchObject({ lancadaNoFast: true, conversouComFamilia: true, relato: 'Relato inventado' });
    // abrir de novo depois de trazer: nada novo
    const depois = familias.map((f) => (f.id === 'a' ? { ...f, relatosAnteriores: p.relatos.get('a') } : f));
    const p2 = prepararImportacao(arq, depois, [...ja, ...p.visitas], { motivoPadrao: 'Outros', quando: '' });
    expect(p2.visitas).toHaveLength(0);
    expect(p2.jaExistiam).toBe(5);
  });

  it('recusa arquivo de outro tipo', () => {
    expect(() => lerArquivoImportacao('{"formato":"app-acs-backup"}')).toThrow();
  });
});

describe('trazer casos, condições, níveis e voltar', () => {
  const arq: ArquivoImportacao = {
    formato: 'facilitador-importacao', versao: 1, origem: 'Sistema de Visitas',
    itens: [
      { tipo: 'caso', id: 'svc-1', casa: { pront: '09.1', rotulo: 'Acácias 12' }, categoria: 'urgente', titulo: 'Joana Teste Silva', texto: 'Caso inventado', emulti: 'Psicologia', data: '2026-10-07' },
      { tipo: 'condicoes', id: 'svk-1', casa: { pront: '09.1', rotulo: 'Acácias 12' }, pessoa: 'JOANA TESTE SILVA', grupos: ['hipertenso', 'diabetico'], nota: 'Nota inventada' },
      { tipo: 'condicoes', id: 'svk-2', casa: { pront: '09.1', rotulo: 'Acácias 12' }, pessoa: 'Pessoa Que Nao Mora', grupos: ['hipertenso'] },
      { tipo: 'nivel', id: 'svn-1', casa: { pront: '09.2', rotulo: 'Acácias 12 c2' }, nivel: 'A', atencao: 'Recado inventado', ultimaVd: '2026-10-09' },
      { tipo: 'voltar', id: 'svv-1', casa: { pront: '09.2', rotulo: 'Acácias 12 c2' }, motivo: 'Entregar guia', data: '2026-10-19' },
    ],
  };
  it('prepara tudo e não repete ao abrir de novo', () => {
    const p = prepararImportacao(arq, familias, [], { motivoPadrao: 'Outros', quando: '2026-11-05T10:00:00Z' });
    expect(p.casos[0]).toMatchObject({ id: 'svc-1', familiaId: 'a', categoria: 'urgente', emulti: 'Psicologia', criadoEm: '2026-10-07T12:00:00.000Z' });
    expect(p.condicoes).toEqual([{ familiaId: 'a', moradorId: 'a-0', nome: 'Joana Teste Silva', grupos: ['hipertenso', 'diabetico'], nota: 'Nota inventada' }]);
    expect(p.naoAchados).toEqual([{ rotulo: 'Pessoa Que Nao Mora (Acácias 12)', tipo: 'condicoes' }]);
    expect(p.niveis).toEqual([{ familiaId: 'b', nivel: 'A', atencao: 'Recado inventado', ultimaVdFora: '2026-10-09' }]);
    expect(p.revisitas[0]).toMatchObject({ id: 'svv-1', familiaId: 'b', motivo: 'Entregar guia', ate: '2026-11-05' });

    const depois = familias.map((f) =>
      f.id === 'a'
        ? { ...f, moradores: f.moradores.map((m) => ({ ...m, grupos: ['hipertenso', 'diabetico'] as Familia['moradores'][0]['grupos'], obs: 'Nota inventada' })) }
        : f.id === 'b' ? { ...f, nivel: 'A' as const, atencao: 'Recado inventado', ultimaVdFora: '2026-10-09' } : f,
    );
    const p2 = prepararImportacao(arq, depois, [], { motivoPadrao: 'Outros', quando: '2026-11-06T10:00:00Z' }, { casos: p.casos, revisitas: p.revisitas });
    expect([p2.casos.length, p2.condicoes.length, p2.niveis.length, p2.revisitas.length]).toEqual([0, 0, 0, 0]);
    expect(p2.jaExistiam).toBe(4);
  });
});
