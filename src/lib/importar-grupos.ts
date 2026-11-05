// Marcar grupos (hipertenso, diabético, acamado…) colando uma lista copiada do Fast.
// O app acha cada nome na área e diz o que vai marcar antes de salvar. Tudo no aparelho.
import { normalizar } from './busca';
import type { Familia, Grupo, Morador } from './tipos';

export interface LinhaGrupo {
  /** Nome como veio na lista. */
  nome: string;
  /** Data de nascimento (aaaa-mm-dd) se veio na linha. */
  nascimento: string;
  grupos: Grupo[];
}

/** Palavras que indicam o grupo dentro da linha. */
const SINAIS_GRUPO: [RegExp, Grupo][] = [
  [/\b(has|hipertens\w*|pressao alta)\b/, 'hipertenso'],
  [/\b(dm\d?|diabet\w*)\b/, 'diabetico'],
  [/\b(acamad\w*|domiciliad\w*)\b/, 'acamado'],
  [/\bgestant\w*\b/, 'gestante'],
  [/\bpuerper\w*\b/, 'puerpera'],
  [/\b(deficien\w*|pcd)\b/, 'deficiencia'],
  [/\bsaude mental\b/, 'saude_mental'],
];

/** Palavras que não fazem parte do nome. */
const NAO_E_NOME = new Set([
  'has', 'dm', 'dm1', 'dm2', 'hipertenso', 'hipertensa', 'hipertensao', 'diabetico', 'diabetica', 'diabetes',
  'acamado', 'acamada', 'domiciliado', 'domiciliada', 'gestante', 'puerpera', 'idoso', 'idosa', 'pcd', 'deficiencia',
  'saude', 'mental', 'pressao', 'alta', 'feminino', 'masculino', 'sim', 'nao', 'cpf', 'cns', 'sus', 'nome', 'data',
  'nascimento', 'sexo', 'idade', 'anos', 'ano', 'meses', 'rua', 'av', 'avenida', 'travessa', 'n', 'no', 'numero',
  'prontuario', 'pront', 'micro', 'familia', 'endereco', 'condicao', 'condicoes', 'tipo', 'f', 'm',
]);
const PARTICULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);

function dataDaLinha(linha: string): string {
  const m = linha.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (!m) return '';
  const [, d, mes, a] = m;
  const ano = Number(a);
  if (ano < 1900 || ano > 2100 || Number(mes) > 12 || Number(d) > 31) return '';
  return `${a}-${mes.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

/** Palavras do nome numa parte da linha (sem números, datas e palavras de condição). */
function palavrasDeNome(parte: string): string[] {
  return normalizar(parte.replace(/\d+[/.\-]\d+([/.\-]\d+)?/g, ' '))
    .split(' ')
    .filter((p) => /^[a-z]+$/.test(p) && !NAO_E_NOME.has(p));
}

/**
 * Lê a lista colada: uma pessoa por linha, em qualquer formato (com colunas, tabulação ou só espaços).
 * `grupoDaLista` = o grupo da lista toda; null = cada linha diz (HAS, DM, acamado…).
 */
export function lerListaGrupos(texto: string, grupoDaLista: Grupo | null): LinhaGrupo[] {
  const linhas: LinhaGrupo[] = [];
  for (const bruta of texto.split(/\r?\n/)) {
    if (!bruta.trim()) continue;
    const norm = normalizar(bruta);
    const grupos = new Set<Grupo>();
    if (grupoDaLista) grupos.add(grupoDaLista);
    for (const [re, g] of SINAIS_GRUPO) if (re.test(norm)) grupos.add(g);
    // O nome é a "coluna" com mais palavras.
    const partes = bruta.split(/\t|;|\||\s{2,}| - /);
    const melhor = partes.map(palavrasDeNome).sort((a, b) => b.length - a.length)[0] ?? [];
    const semParticula = melhor.filter((p) => !PARTICULAS.has(p));
    if (semParticula.length < 2) continue; // cabeçalho, linha em branco ou só um nome
    if (!grupos.size) continue;
    linhas.push({ nome: melhor.join(' '), nascimento: dataDaLinha(bruta), grupos: [...grupos] });
  }
  return linhas;
}

export interface Candidato {
  familia: Familia;
  morador: Morador;
}

export type SituacaoCasamento = 'achado' | 'parecido' | 'varios' | 'nao_achado';

export interface Casamento {
  linha: LinhaGrupo;
  situacao: SituacaoCasamento;
  candidatos: Candidato[];
}

const chaveNome = (nome: string) => normalizar(nome).split(' ').filter((p) => p && !PARTICULAS.has(p));

/**
 * Procura cada pessoa da lista entre os moradores (que moram na área):
 * - achado: mesmo nome completo (e a data bate, se as duas existirem);
 * - parecido: mesmo primeiro e último nome, ou nome igual com data diferente (conferir);
 * - varios: mais de uma pessoa possível (escolher);
 * - nao_achado.
 */
export function casarComMoradores(linhas: LinhaGrupo[], familias: Familia[]): Casamento[] {
  const todos: (Candidato & { chave: string[] })[] = familias.flatMap((familia) =>
    familia.moradores.filter((m) => m.situacao === 'mora').map((morador) => ({ familia, morador, chave: chaveNome(morador.nome) })),
  );
  const dataBate = (c: Candidato, l: LinhaGrupo) => !l.nascimento || !c.morador.nascimento || c.morador.nascimento === l.nascimento;
  const limpar = (cs: typeof todos): Candidato[] => cs.map(({ familia, morador }) => ({ familia, morador }));

  return linhas.map((linha) => {
    const k = chaveNome(linha.nome);
    const iguais = todos.filter((c) => c.chave.join(' ') === k.join(' '));
    const iguaisComData = iguais.filter((c) => dataBate(c, linha));
    if (iguaisComData.length === 1) return { linha, situacao: 'achado', candidatos: limpar(iguaisComData) };
    if (iguaisComData.length > 1) {
      // Mesmo nome: a data desempata, se houver.
      const exatos = linha.nascimento ? iguaisComData.filter((c) => c.morador.nascimento === linha.nascimento) : [];
      if (exatos.length === 1) return { linha, situacao: 'achado', candidatos: limpar(exatos) };
      return { linha, situacao: 'varios', candidatos: limpar(iguaisComData) };
    }
    if (iguais.length) return { linha, situacao: 'parecido', candidatos: limpar(iguais) };
    const pontas = todos.filter((c) => c.chave[0] === k[0] && c.chave.at(-1) === k.at(-1) && dataBate(c, linha));
    if (pontas.length === 1) return { linha, situacao: 'parecido', candidatos: limpar(pontas) };
    if (pontas.length > 1) return { linha, situacao: 'varios', candidatos: limpar(pontas) };
    return { linha, situacao: 'nao_achado', candidatos: [] };
  });
}

/** Grupos que ainda faltam marcar nesse morador. */
export function gruposQueFaltam(m: Morador, grupos: Grupo[]): Grupo[] {
  return grupos.filter((g) => !m.grupos.includes(g));
}
