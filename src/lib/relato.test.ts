import { describe, expect, it } from 'vitest';
import {
  concordancia,
  gerarRelato,
  indiceModelo,
  juntarNomes,
  nomesCurtos,
  VISITAS_POR_MODELO,
  type EntradaRelato,
} from './relato';
import type { Morador } from './tipos';

const pessoa = (id: string, nome: string, sexo: 'M' | 'F' | '' = 'F'): Morador => ({
  id, nome, sexo, nascimento: '1980-01-01', situacao: 'mora', situacaoDesde: '', grupos: [], obs: '',
});
const fulana = pessoa('1', 'Fulana Teste da Silva');
const ciclano = pessoa('2', 'Ciclano Exemplo', 'M');
const beltrana = pessoa('3', 'Beltrana Ficticia');

const base: EntradaRelato = {
  desfecho: 'realizada',
  presentes: [fulana, ciclano],
  ausentes: [],
  conversouComFamilia: false,
  sinais: {},
  orientacoes: '',
  compartilhadaCom: '',
  contador: 0,
};

describe('gerador de relato (estilo curto)', () => {
  it('segue o estilo do ACS: "Realizada VD, presentes Fulana e Ciclano, orientados sobre..."', () => {
    expect(gerarRelato({ ...base, orientacoes: 'consultas e dengue' })).toBe(
      'Realizada VD, presentes Fulana e Ciclano, orientados sobre consultas e dengue.',
    );
  });

  it('usa só o primeiro nome', () => {
    const t = gerarRelato(base);
    expect(t).toContain('Fulana');
    expect(t).not.toContain('Silva');
    expect(t).not.toContain('Exemplo');
  });

  it('cita presentes e ausentes, no singular e no plural', () => {
    expect(gerarRelato({ ...base, presentes: [fulana], ausentes: [ciclano] })).toBe(
      'Realizada VD, presente Fulana, ausente Ciclano.',
    );
    expect(gerarRelato({ ...base, presentes: [fulana], ausentes: [ciclano, beltrana] })).toContain(
      'ausentes Ciclano e Beltrana',
    );
  });

  it('coloca a P.A. com o nome da pessoa e os outros sinais preenchidos', () => {
    const t = gerarRelato({ ...base, sinais: { '1': { pa: '130/85', glicemia: '98', peso: '' } } });
    expect(t).toContain('P.A. de Fulana 130x85');
    expect(t).toContain('glicemia de Fulana 98 mg/dL');
    expect(t).not.toContain('peso');
  });

  it('formata temperatura com vírgula', () => {
    const t = gerarRelato({ ...base, sinais: { '2': { temperatura: '36.5' } } });
    expect(t).toContain('temperatura de Ciclano 36,5 °C');
  });

  it('ajusta "orientada/orientado/orientadas/orientados"', () => {
    expect(concordancia([fulana])).toBe('orientada');
    expect(concordancia([ciclano])).toBe('orientado');
    expect(concordancia([fulana, beltrana])).toBe('orientadas');
    expect(concordancia([fulana, ciclano])).toBe('orientados');
    expect(concordancia([pessoa('9', 'Sem Sexo', '')])).toBe('orientado(a)');
  });

  it('inclui visita compartilhada', () => {
    expect(gerarRelato({ ...base, compartilhadaCom: 'técnica de enfermagem Rosa' })).toContain(
      'VD compartilhada com técnica de enfermagem Rosa.',
    );
  });

  it('conversou com a família sem marcar presentes', () => {
    expect(gerarRelato({ ...base, presentes: [], ausentes: [fulana], conversouComFamilia: true, orientacoes: 'vacinas' })).toBe(
      'Realizada VD, conversado com a família, orientada a família sobre vacinas.',
    );
  });

  it('mesmo primeiro nome na família: usa os dois primeiros nomes', () => {
    const a = pessoa('a', 'Ana Maria Souza');
    const b = pessoa('b', 'Ana Clara Souza');
    const n = nomesCurtos([a, b]);
    expect(n.get('a')).toBe('Ana Maria');
    expect(n.get('b')).toBe('Ana Clara');
  });

  it('mantém o mesmo modelo dentro de um bloco de 5 visitas', () => {
    const textos = Array.from({ length: VISITAS_POR_MODELO }, (_, i) => gerarRelato({ ...base, contador: i }));
    expect(new Set(textos).size).toBe(1);
  });

  it('troca o modelo a cada 5 visitas, sem repetir o anterior', () => {
    const blocos = Array.from({ length: 5 }, (_, b) => gerarRelato({ ...base, contador: b * VISITAS_POR_MODELO }));
    expect(new Set(blocos).size).toBe(5);
    for (let i = 1; i < blocos.length; i++) expect(blocos[i]).not.toBe(blocos[i - 1]);
  });

  it('ausência completa e recusa: frases curtas, variando e sem nomes', () => {
    const a = gerarRelato({ ...base, desfecho: 'ausencia_completa', contador: 0 });
    expect(a).toBe('Realizada tentativa de VD, ninguém em casa.');
    expect(gerarRelato({ ...base, desfecho: 'ausencia_completa', contador: 5 })).not.toBe(a);
    expect(a).not.toContain('Fulana');
    const r = gerarRelato({ ...base, desfecho: 'recusa', contador: 0 });
    expect(r).toBe('Família recusou a VD.');
    expect(gerarRelato({ ...base, desfecho: 'recusa', contador: 5 })).not.toBe(r);
  });

  it('indiceModelo volta ao início depois de passar por todos', () => {
    expect(indiceModelo(0, 5)).toBe(0);
    expect(indiceModelo(4, 5)).toBe(0);
    expect(indiceModelo(5, 5)).toBe(1);
    expect(indiceModelo(25, 5)).toBe(0);
  });

  it('junta nomes com vírgula e "e"', () => {
    expect(juntarNomes(['A'])).toBe('A');
    expect(juntarNomes(['A', 'B'])).toBe('A e B');
    expect(juntarNomes(['A', 'B', 'C'])).toBe('A, B e C');
  });
});
