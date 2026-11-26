import { describe, expect, it } from 'vitest';
import { desfechoDaLinha, lerVdsDoTexto } from './importar-vds-texto';
import type { Familia, Visita } from './tipos';

// Tudo inventado.
const fam = (id: string, rua: string, numero: string, prontuario: string, nomes: string[], complemento = ''): Familia => ({
  id, rua, numero, complemento, bairro: '', colmeia: '', prontuario, situacaoCasa: 'habitada', obs: '', responsavelId: `${id}-0`,
  moradores: nomes.map((nome, i) => ({ id: `${id}-${i}`, nome, sexo: 'F', nascimento: '1950-03-10', situacao: 'mora', situacaoDesde: '', grupos: [], obs: '' })),
});
const casas = [
  fam('a', 'Rua das Acácias', '90', '0000.04.015', ['JOANA TESTE SILVA', 'PEDRO TESTE SILVA']),
  fam('b', 'Rua das Acácias', '30', '0000.04.020', ['RITA FICTICIA GOMES']),
  fam('c', 'Rua dos Ipês Amarelos', '310', '', ['CAIO EXEMPLO ROCHA']),
  fam('d', 'Rua dos Ipês Amarelos', '45', '', ['DUDA TESTE LIMA'], 'Apto 1'),
  fam('e', 'Rua dos Ipês Amarelos', '45', '', ['EDU TESTE LIMA'], 'Apto 2'),
];
const MOTIVOS = ['Outros', 'Visita periódica', 'Busca ativa'];
const ler = (t: string, vs: Visita[] = []) => lerVdsDoTexto(t, casas, vs, MOTIVOS, 'Outros');

describe('trazer VDs de texto colado (ex.: administração do SBCD)', () => {
  it('uma VD por linha: data, prontuário, desfecho, motivo e quem estava', () => {
    const r = ler([
      'Data\tProntuário\tCidadão\tDesfecho\tMotivo',
      '03/11/2026\t0000.04.015\tJOANA TESTE SILVA\tVisita realizada\tVisita periódica',
      '04/11/2026\t0000.04.020\tRITA FICTICIA GOMES\tAusência da família completa',
      '05/11/26 RUA DOS IPES AMARELOS, 310 CAIO EXEMPLO ROCHA recusou',
    ].join('\n'));
    expect(r.novas.map((v) => `${v.data} ${v.familia.id} ${v.desfecho} ${v.motivo} [${v.presentes.join(',')}]`)).toEqual([
      '2026-11-03 a realizada Visita periódica [a-0]',
      '2026-11-04 b ausencia_completa Outros []',
      '2026-11-05 c recusa Outros []',
    ]);
    expect(r.naoReconhecidas).toEqual([]);
  });

  it('lista por dia: a data numa linha e as casas embaixo; endereço com complemento', () => {
    const r = ler(['12/11/2026 - quinta-feira', 'Ipês Amarelos, 45 Apto 2 - EDU TESTE LIMA', 'Rua das Acácias, 30', '', 'Data: 13/11/2026', 'JOANA TESTE SILVA ausente realizada'].join('\n'));
    expect(r.novas.map((v) => `${v.data} ${v.familia.id} ${v.desfecho}`)).toEqual(['2026-11-12 e realizada', '2026-11-12 b realizada', '2026-11-13 a ausente_realizada']);
    // Linha embaixo de uma data, sem casa reconhecida: aparece para conferir.
    expect(ler('12/11/2026\nRua inventada, 7 FULANO').naoReconhecidas).toEqual(['Rua inventada, 7 FULANO']);
  });

  it('a data de nascimento junto não confunde: vale a data mais recente', () => {
    const r = ler('JOANA TESTE SILVA 10/03/1950 0000.04.015 visita em 20/11/2026');
    expect(r.novas.map((v) => v.data)).toEqual(['2026-11-20']);
  });

  it('não repete: o que já está no app e o que aparece duas vezes no texto', () => {
    const ja: Visita = { id: 'v1', familiaId: 'a', data: '2026-11-03', presentes: [], conversouComFamilia: true, desfecho: 'realizada', motivo: 'Outros', compartilhadaCom: '', sinais: {}, orientacoes: '', relato: '', lancadaNoFast: false };
    const r = ler('03/11/2026 0000.04.015 JOANA\n03/11/2026 0000.04.015 JOANA\n04/11/2026 0000.04.015 JOANA', [ja]);
    expect(r.jaEstavam.map((x) => x.visita.id)).toEqual(['v1']);
    expect(r.repetidasNoTexto).toBe(1);
    expect(r.novas.map((v) => v.data)).toEqual(['2026-11-04']);
  });

  it('casa que não reconhece aparece para conferir; número da casa ambíguo não chuta', () => {
    const r = ler('05/11/2026 FULANO QUE NAO EXISTE rua inventada 1\n06/11/2026 Ipês Amarelos, 45');
    expect(r.novas).toEqual([]);
    expect(r.naoReconhecidas).toHaveLength(2);
  });

  it('desfechos escritos', () => {
    expect(desfechoDaLinha('Visita realizada')).toBe('realizada');
    expect(desfechoDaLinha('AUSENTE REALIZADA')).toBe('ausente_realizada');
    expect(desfechoDaLinha('Ausência da família completa')).toBe('ausencia_completa');
    expect(desfechoDaLinha('ninguém em casa')).toBe('ausencia_completa');
    expect(desfechoDaLinha('Recusa')).toBe('recusa');
  });
});
