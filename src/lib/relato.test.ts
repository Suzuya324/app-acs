import { describe, expect, it } from 'vitest';
import { gerarRelato, indiceModelo, juntarNomes, textoSinais, VISITAS_POR_MODELO, type EntradaRelato } from './relato';
import type { Morador } from './tipos';

const pessoa = (id: string, nome: string): Morador => ({
  id, nome, sexo: 'F', nascimento: '1980-01-01', situacao: 'mora', grupos: [], obs: '',
});
const ana = pessoa('1', 'Ana Teste');
const bia = pessoa('2', 'Bia Exemplo');
const caio = pessoa('3', 'Caio Ficticio');

const base: EntradaRelato = {
  desfecho: 'ausente_realizada',
  presentes: [ana],
  ausentes: [bia, caio],
  conversouComFamilia: false,
  sinais: {},
  orientacoes: '',
  compartilhadaCom: '',
  contador: 0,
};

describe('gerador de relato', () => {
  it('cita quem estava presente e quem estava ausente', () => {
    const t = gerarRelato(base);
    expect(t).toContain('Ana Teste');
    expect(t).toContain('Bia Exemplo e Caio Ficticio');
  });

  it('inclui os sinais vitais preenchidos e ignora os vazios', () => {
    const t = gerarRelato({ ...base, sinais: { pa: '120/80', glicemia: '98', peso: '' } });
    expect(t).toContain('P.A. 120x80 mmHg');
    expect(t).toContain('glicemia capilar 98 mg/dL');
    expect(t).not.toContain('peso');
  });

  it('formata temperatura com vírgula', () => {
    expect(textoSinais({ temperatura: '36.5' })).toBe('temperatura 36,5 °C.');
  });

  it('inclui orientações e visita compartilhada', () => {
    const t = gerarRelato({ ...base, orientacoes: 'Orientada sobre vacinas', compartilhadaCom: 'técnica de enfermagem Rosa' });
    expect(t).toContain('Orientada sobre vacinas.');
    expect(t).toContain('técnica de enfermagem Rosa');
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

  it('varia também na ausência completa e na recusa', () => {
    const a = gerarRelato({ ...base, desfecho: 'ausencia_completa', contador: 0 });
    const b = gerarRelato({ ...base, desfecho: 'ausencia_completa', contador: 5 });
    expect(a).not.toBe(b);
    const r1 = gerarRelato({ ...base, desfecho: 'recusa', contador: 0 });
    const r2 = gerarRelato({ ...base, desfecho: 'recusa', contador: 5 });
    expect(r1).not.toBe(r2);
  });

  it('ausência completa não cita nomes', () => {
    const t = gerarRelato({ ...base, desfecho: 'ausencia_completa', presentes: [] });
    expect(t).not.toContain('Ana');
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
