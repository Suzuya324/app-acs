// Lista "o que falta completar" no cadastro da área.
import type { Familia, Morador } from './tipos';

export type TipoPendencia =
  | 'sem_prontuario'
  | 'prontuario_incompleto'
  | 'sem_responsavel'
  | 'sem_moradores'
  | 'sem_nascimento'
  | 'sem_sexo'
  | 'sexo_a_conferir';

export const NOMES_PENDENCIA: Record<TipoPendencia, string> = {
  sem_prontuario: 'Família sem prontuário',
  prontuario_incompleto: 'Prontuário incompleto',
  sem_responsavel: 'Casa sem responsável',
  sem_moradores: 'Casa habitada sem moradores',
  sem_nascimento: 'Morador sem data de nascimento',
  sem_sexo: 'Morador sem sexo informado',
  sexo_a_conferir: 'Sexo sugerido pelo nome (conferir)',
};

export interface Pendencia {
  tipo: TipoPendencia;
  familia: Familia;
  morador?: Morador;
}

/** Prontuário preenchido, mas pela metade (ex.: "04.", "04-", "04/"). */
export function prontuarioIncompleto(p: string): boolean {
  const t = p.trim();
  if (!t) return false;
  return /[.\-/]$/.test(t) || !/\d/.test(t);
}

export function moradoresAtuais(f: Familia): Morador[] {
  return f.moradores.filter((m) => m.situacao === 'mora');
}

export function responsavelAtual(f: Familia): Morador | undefined {
  return moradoresAtuais(f).find((m) => m.id === f.responsavelId);
}

export function listarPendencias(familias: Familia[]): Pendencia[] {
  const lista: Pendencia[] = [];
  for (const f of familias) {
    if (f.situacaoCasa !== 'habitada') continue;
    if (!f.prontuario.trim()) lista.push({ tipo: 'sem_prontuario', familia: f });
    else if (prontuarioIncompleto(f.prontuario)) lista.push({ tipo: 'prontuario_incompleto', familia: f });

    const atuais = moradoresAtuais(f);
    if (!atuais.length) lista.push({ tipo: 'sem_moradores', familia: f });
    else if (!responsavelAtual(f)) lista.push({ tipo: 'sem_responsavel', familia: f });

    for (const m of atuais) {
      if (!m.nascimento) lista.push({ tipo: 'sem_nascimento', familia: f, morador: m });
      if (!m.sexo) lista.push({ tipo: 'sem_sexo', familia: f, morador: m });
      else if (m.sexoAConferir) lista.push({ tipo: 'sexo_a_conferir', familia: f, morador: m });
    }
  }
  return lista;
}
