// Marcar grupos (hipertenso, diabético, acamado…) colando uma lista copiada do Fast.
// O app acha cada nome na área e diz o que vai marcar antes de salvar. Tudo no aparelho.
import { normalizar } from './busca';
import { descobrirSeparador, lerLinhas } from './importar-csv';
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
  [/\bidos[oa]s?\b/, 'idoso'],
  [/\b(crianca\w*|puericultura|menores? de (2|dois) anos)\b/, 'crianca'],
];

function gruposDoTexto(texto: string): Grupo[] {
  const norm = normalizar(texto);
  return SINAIS_GRUPO.filter(([re]) => re.test(norm)).map(([, g]) => g);
}

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
  const iso = linha.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  const m = linha.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/) ?? (iso ? [iso[0], iso[3], iso[2], iso[1]] : null);
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

/** Uma pessoa lida de um arquivo com colunas (JSON ou CSV com cabeçalho). */
export interface Registro {
  nome: string;
  nascimento: string;
  /** Tudo o que pode dizer a condição (ex.: "HAS, DM", "acamado: sim"). */
  texto: string;
}

export interface LeituraGrupos {
  linhas: LinhaGrupo[];
  /** Pessoas lidas, mas sem condição reconhecida (e sem grupo escolhido para a lista). */
  semCondicao: number;
}

function deRegistros(registros: Registro[], grupoDaLista: Grupo | null): LeituraGrupos {
  const linhas: LinhaGrupo[] = [];
  let semCondicao = 0;
  for (const r of registros) {
    const nome = palavrasDeNome(r.nome);
    if (nome.filter((p) => !PARTICULAS.has(p)).length < 2) continue;
    const grupos = new Set<Grupo>(gruposDoTexto(r.texto));
    if (grupoDaLista) grupos.add(grupoDaLista);
    if (!grupos.size) {
      semCondicao++;
      continue;
    }
    linhas.push({ nome: nome.join(' '), nascimento: r.nascimento, grupos: [...grupos] });
  }
  return { linhas, semCondicao };
}

/**
 * Lê a lista colada: uma pessoa por linha, em qualquer formato (com colunas, tabulação ou só espaços).
 * `grupoDaLista` = o grupo da lista toda; null = cada linha diz (HAS, DM, acamado…).
 */
export function lerListaGrupos(texto: string, grupoDaLista: Grupo | null): LinhaGrupo[] {
  return lerTextoLivre(texto, grupoDaLista).linhas;
}

function lerTextoLivre(texto: string, grupoDaLista: Grupo | null): LeituraGrupos {
  const registros: Registro[] = [];
  for (const bruta of texto.split(/\r?\n/)) {
    if (!bruta.trim()) continue;
    // O nome é a "coluna" com mais palavras.
    const partes = bruta.split(/\t|;|\||\s{2,}| - /);
    const melhor = partes.map(palavrasDeNome).sort((a, b) => b.length - a.length)[0] ?? [];
    if (melhor.filter((p) => !PARTICULAS.has(p)).length < 2) continue; // cabeçalho, linha vazia ou um nome só
    registros.push({ nome: melhor.join(' '), nascimento: dataDaLinha(bruta), texto: bruta });
  }
  return deRegistros(registros, grupoDaLista);
}

// ---------------------------------------------------------------- arquivos com colunas

const tokens = (k: string) => normalizar(k.replace(/([a-z])([A-Z])/g, '$1 $2')).replace(/[^a-z0-9]+/g, ' ').trim().split(' ').map((t) => t.replace(/\d+$/, ''));
const NOME = new Set(['nome', 'paciente', 'cidadao', 'name', 'usuario']);
const NAO_NOME = new Set(['mae', 'pai', 'social', 'responsavel', 'unidade', 'equipe', 'profissional', 'acs', 'agente', 'rua', 'logradouro', 'bairro']);
const ehChaveNome = (k: string) => tokens(k).some((t) => NOME.has(t)) && !tokens(k).some((t) => NAO_NOME.has(t));
const ehChaveData = (k: string) => tokens(k).some((t) => t.startsWith('nasc') || t === 'dn' || t === 'birth' || t === 'birthdate');
/** Colunas que nunca dizem a condição (endereço, documentos, parentes…). */
const IGNORAR = new Set([
  'mae', 'pai', 'responsavel', 'rua', 'logradouro', 'endereco', 'bairro', 'numero', 'num', 'complemento', 'cep', 'cpf', 'cns',
  'cartao', 'telefone', 'celular', 'fone', 'email', 'prontuario', 'familia', 'microarea', 'micro', 'equipe', 'unidade', 'ine',
  'cnes', 'idade', 'sexo', 'genero', 'raca', 'cor', 'id', 'codigo', 'cod',
]);
const ehChaveIgnorada = (k: string) => tokens(k).some((t) => IGNORAR.has(t));
const SIM = /^(sim|s|x|1|true|verdadeiro|yes)$/;

function registroDeObjeto(obj: Record<string, unknown>): Registro | null {
  const chaves = Object.keys(obj);
  const kNome = chaves.find((k) => ehChaveNome(k) && typeof obj[k] === 'string' && (obj[k] as string).trim());
  if (!kNome) return null;
  const kData = chaves.find((k) => ehChaveData(k));
  const partesTexto: string[] = [];
  for (const k of chaves) {
    if (k === kNome || k === kData || ehChaveIgnorada(k)) continue;
    const v = obj[k];
    if (v === true || v === 1 || (typeof v === 'string' && SIM.test(normalizar(v)))) partesTexto.push(k);
    else if (typeof v === 'string') partesTexto.push(v);
    else if (Array.isArray(v)) partesTexto.push(v.filter((x) => typeof x === 'string').join(', '));
  }
  return { nome: String(obj[kNome]), nascimento: kData ? dataDaLinha(String(obj[kData] ?? '')) : '', texto: partesTexto.join('; ') };
}

/** Acha, dentro do JSON, os objetos que parecem pessoas (com um campo de nome). */
function objetosDoJson(v: unknown, saida: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (Array.isArray(v)) v.forEach((x) => objetosDoJson(x, saida));
  else if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (Object.keys(o).some((k) => ehChaveNome(k) && typeof o[k] === 'string')) saida.push(o);
    else Object.values(o).forEach((x) => objetosDoJson(x, saida));
  }
  return saida;
}

/**
 * Lê um arquivo (JSON, CSV/planilha com cabeçalho ou texto) e devolve as pessoas com os grupos.
 * Tudo no aparelho.
 */
export function lerArquivoGrupos(conteudo: string, grupoDaLista: Grupo | null): LeituraGrupos & { formato: 'json' | 'colunas' | 'texto' } {
  const t = conteudo.trim();
  if (t.startsWith('{') || t.startsWith('[')) {
    try {
      const regs = objetosDoJson(JSON.parse(t)).map(registroDeObjeto).filter((r): r is Registro => !!r);
      if (regs.length) return { ...deRegistros(regs, grupoDaLista), formato: 'json' };
    } catch {
      /* não é JSON válido: tenta como texto */
    }
  }
  const primeira = t.split(/\r?\n/)[0] ?? '';
  const cab = primeira.split(descobrirSeparador(primeira));
  if (cab.length > 1 && cab.some(ehChaveNome)) {
    const [titulos, ...linhas] = lerLinhas(t, descobrirSeparador(primeira));
    const regs = linhas
      .filter((l) => l.some((c) => c.trim()))
      .map((l) => registroDeObjeto(Object.fromEntries(titulos.map((k, i) => [k, (l[i] ?? '').trim()]))))
      .filter((r): r is Registro => !!r);
    return { ...deRegistros(regs, grupoDaLista), formato: 'colunas' };
  }
  return { ...lerTextoLivre(t, grupoDaLista), formato: 'texto' };
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

/** Grupos que ainda faltam marcar nesse morador (gestante e puérpera nunca em homem). */
export function gruposQueFaltam(m: Morador, grupos: Grupo[]): Grupo[] {
  return grupos.filter((g) => !m.grupos.includes(g) && !(m.sexo === 'M' && (g === 'gestante' || g === 'puerpera')));
}
