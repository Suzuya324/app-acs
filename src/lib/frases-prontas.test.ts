import { describe, expect, it } from 'vitest';
import { FRASES_PADRAO, frasesMaisUsadas, frasesParaVD, juntarFrase, lerFrasesProprias } from './frases-prontas';
import type { Visita } from './tipos';

// Tudo inventado.
const vd = (data: string, observacao: string, anotacoes: Record<string, string> = {}): Visita => ({
  id: `v${data}`, familiaId: 'f', data, presentes: [], conversouComFamilia: true, desfecho: 'realizada', motivo: 'Outros', compartilhadaCom: '',
  sinais: {}, orientacoes: '', relato: '', lancadaNoFast: false, observacao, anotacoes,
});

describe('frases prontas', () => {
  it('aprende as frases que o ACS escreve 2 vezes ou mais, sem datas', () => {
    const visitas = [
      vd('2026-11-01', 'Família bem. Levei o convite da campanha.'),
      vd('2026-11-02', 'Levei o convite da campanha. Consulta dia 20/11.'),
      vd('2026-11-03', 'Família bem!', { a: 'Consulta dia 20/11.' }),
      vd('2026-11-04', 'Trazida do Sistema de Visitas.'),
    ];
    expect(frasesMaisUsadas(visitas)).toEqual(['Família bem!', 'Levei o convite da campanha.']);
  });
  it('junta as do ACS (ou as padrão) com as mais usadas, sem repetir', () => {
    const visitas = [vd('2026-11-01', 'Família bem.'), vd('2026-11-02', 'Família bem.')];
    expect(frasesParaVD(undefined, visitas).slice(0, 2)).toEqual(FRASES_PADRAO.slice(0, 2));
    expect(frasesParaVD(['Família bem.', 'Outra frase'], visitas)).toEqual(['Família bem.', 'Outra frase']);
  });
  it('escreve a frase no fim do texto com a pontuação certa', () => {
    expect(juntarFrase('', 'Todos bem.')).toBe('Todos bem.');
    expect(juntarFrase('Refere dor', 'Todos bem.')).toBe('Refere dor. Todos bem.');
    expect(juntarFrase('Refere dor. ', 'Todos bem.')).toBe('Refere dor. Todos bem.');
    expect(lerFrasesProprias(' Uma\n\nDuas \nx\n')).toEqual(['Uma', 'Duas']);
  });
});
