// Pacientes prioritários: a lista do ACS (nível A/B/C, etiquetas de condição, resumo), ligada às
// famílias e moradores do app. Funções "puras" (fáceis de testar). Tudo no aparelho.
import { normalizar } from './busca';
import { idade } from './datas';
import { acharFamilia, chaveNome } from './importar-sv';
import type { Familia, Grupo } from './tipos';

export type NivelPrio = 'A' | 'B' | 'C';

export interface Prioritario {
  /** Fixo: nome + nascimento (é assim que uma lista nova reconhece quem já existe). */
  id: string;
  nome: string;
  /** aaaa-mm-dd */
  nascimento: string;
  nivel: NivelPrio;
  /** Como veio na lista (ex.: "Acácias"). */
  rua: string;
  /** Ex.: "333", "400 NUMERO 13A". */
  casa: string;
  prontuario: string;
  /** Etiquetas de condição (ex.: "HAS", "DM", "GESTANTE?"). */
  etiquetas: string[];
  resumo: string;
  /** Ex.: "12/08/2026 Agente" (data e quem informou). */
  ultimaInfo: string;
  /** Aviso "óbito a confirmar". */
  obito?: boolean;
  /** Ligação com o cadastro do app (se achou). */
  familiaId?: string;
  moradorId?: string;
  /** Última edição feita à mão no app (ISO). */
  editadoEm?: string;
  atualizadoEm: string;
  /** Não veio da lista importada: o app achou a pessoa pela ficha ou pelas VDs (nunca é gravado). */
  doApp?: boolean;
}

export type CorEtiqueta = 'vermelho' | 'laranja' | 'roxo' | 'azul' | 'cinza';

/** Etiquetas conhecidas: nome curto, cor e grupo do app correspondente. */
export const ETIQUETAS: { chave: string; nome: string; cor: CorEtiqueta; grupo?: Grupo }[] = [
  { chave: 'ACAMADO/DOMICILIADO', nome: 'Acamado/domiciliado', cor: 'vermelho', grupo: 'acamado' },
  { chave: 'O2', nome: 'O₂', cor: 'vermelho', grupo: 'oxigenio' },
  { chave: 'PALIATIVO', nome: 'Paliativo', cor: 'vermelho', grupo: 'alzheimer' },
  { chave: 'HAS', nome: 'HAS', cor: 'laranja', grupo: 'hipertenso' },
  { chave: 'DM', nome: 'DM', cor: 'laranja', grupo: 'diabetico' },
  { chave: 'AVC/INFARTO/CORACAO', nome: 'AVC/infarto', cor: 'laranja', grupo: 'avc' },
  { chave: 'CORACAO', nome: 'Coração', cor: 'laranja', grupo: 'coracao' },
  { chave: 'SAUDE MENTAL', nome: 'Saúde mental', cor: 'roxo', grupo: 'saude_mental' },
  { chave: 'ALZHEIMER/DEMENCIA', nome: 'Alzheimer/demência', cor: 'roxo', grupo: 'alzheimer' },
  { chave: 'IDOSO 80+', nome: '80+', cor: 'azul' },
  { chave: 'GESTANTE?', nome: 'Gestante? confirmar', cor: 'azul' },
  { chave: 'GESTANTE', nome: 'Gestante', cor: 'azul', grupo: 'gestante' },
  { chave: 'PRE-DIABETES', nome: 'Pré-diabetes', cor: 'cinza' },
  { chave: 'CANCER', nome: 'Câncer', cor: 'cinza', grupo: 'cancer' },
  { chave: 'CIRURGIA', nome: 'Cirurgia', cor: 'cinza', grupo: 'cirurgia' },
  { chave: 'DEFICIENCIA/CRIANCA ESPECIAL', nome: 'Deficiência/criança especial', cor: 'cinza', grupo: 'deficiencia' },
  { chave: 'PNEUMONIA', nome: 'Pneumonia', cor: 'cinza' },
  { chave: 'CUIDADORA SOBRECARREGADA', nome: 'Cuidadora sobrecarregada', cor: 'cinza' },
];

const semAcento = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** "GESTANTE? (registro antigo - confirmar)" → "GESTANTE?"; "Saúde mental" → "SAUDE MENTAL"; "PNEUMONIA (27/10)" fica com a data. */
export function normalizarEtiqueta(e: string): string {
  const t = semAcento(e).toUpperCase().replace(/\s+/g, ' ').trim();
  if (t.startsWith('GESTANTE')) return /\?|CONFIRMAR/.test(t) ? 'GESTANTE?' : 'GESTANTE';
  if (t.startsWith('PNEUMONIA')) return t;
  return t;
}

/** Informações de uma etiqueta (as desconhecidas ficam cinza com o próprio texto). */
export function infoEtiqueta(e: string): { nome: string; cor: CorEtiqueta; grupo?: Grupo } {
  const base = ETIQUETAS.find((x) => x.chave === e) ?? (e.startsWith('PNEUMONIA') ? ETIQUETAS.find((x) => x.chave === 'PNEUMONIA') : undefined);
  if (!base) return { nome: e.charAt(0) + e.slice(1).toLowerCase(), cor: 'cinza' };
  const data = e.match(/\(([^)]*)\)/)?.[1];
  return { nome: data ? `${base.nome} (${data})` : base.nome, cor: base.cor, grupo: base.grupo };
}

/** Etiqueta da lista que corresponde a um grupo do app (ex.: hipertenso → "HAS"). */
export function etiquetaDoGrupo(g: Grupo): string | undefined {
  return ETIQUETAS.find((e) => e.grupo === g && e.chave !== 'PALIATIVO')?.chave;
}

/** Grupos do app que as etiquetas indicam. */
export function gruposDasEtiquetas(etiquetas: string[]): Grupo[] {
  return [...new Set(etiquetas.map((e) => infoEtiqueta(e).grupo).filter((g): g is Grupo => !!g))];
}

export const idPrioritario = (nome: string, nascimento: string) => `p-${chaveNome(nome).replace(/\s/g, '-')}-${nascimento}`;

const dataISO = (t: string) => {
  const m = (t || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : '';
};

/** O resumo fala mesmo de AVC ou infarto? (a etiqueta da lista junta "AVC/infarto/coração" numa só) */
export const temAvcOuInfarto = (resumo: string) => /\b(avcs?|ave|derrame|infart\w*|isquemi\w*)\b/.test(semAcento(resumo).toLowerCase());

/**
 * A etiqueta "AVC/INFARTO/CORACAO" da lista serve também para arritmia, marca-passo, cirurgia do coração…
 * Só fica como AVC/infarto quem tem AVC ou infarto escrito no resumo; os outros viram "Coração".
 */
export function separarCoracao(etiquetas: string[], resumo: string): string[] {
  if (!etiquetas.includes('AVC/INFARTO/CORACAO') || temAvcOuInfarto(resumo)) return etiquetas;
  return [...new Set(etiquetas.map((e) => (e === 'AVC/INFARTO/CORACAO' ? 'CORACAO' : e)))];
}

/** O resumo diz que o paciente pode ter falecido (e falta confirmar)? */
export function pareceObitoAConfirmar(resumo: string): boolean {
  const t = semAcento(resumo).toLowerCase();
  return /obito[^.;]{0,25}confirmar|confirmar[^.;]{0,25}obito|pode ter falecido/.test(t);
}

export class ListaPrioritariosInvalida extends Error {
  constructor() {
    super('Este arquivo não é uma lista de pacientes prioritários (precisa ter nome, nascimento, nível e condições).');
  }
}

/** Lê a lista (JSON: uma lista de pacientes, ou um objeto com a lista dentro). */
export function lerListaPrioritarios(texto: string, quando: string): Prioritario[] {
  let d: unknown;
  try {
    d = JSON.parse(texto.trim());
  } catch {
    throw new ListaPrioritariosInvalida();
  }
  const lista = Array.isArray(d) ? d : Object.values(d as object).find(Array.isArray);
  if (!Array.isArray(lista) || !lista.length) throw new ListaPrioritariosInvalida();
  const saida: Prioritario[] = [];
  for (const it of lista as Record<string, unknown>[]) {
    const nome = String(it?.nome ?? '').trim();
    const nascimento = dataISO(String(it?.nascimento ?? ''));
    if (!nome) continue;
    const nivel = String(it.nivel ?? 'C').toUpperCase();
    const resumo = String(it.resumo ?? '').trim();
    saida.push({
      id: idPrioritario(nome, nascimento),
      nome,
      nascimento,
      nivel: nivel === 'A' || nivel === 'B' ? nivel : 'C',
      rua: String(it.rua ?? '').trim(),
      casa: String(it.casa ?? '').trim(),
      prontuario: String(it.prontuario ?? '').trim(),
      etiquetas: separarCoracao([...new Set(((it.condicoes ?? it.etiquetas ?? []) as unknown[]).map((e) => normalizarEtiqueta(String(e))).filter(Boolean))], resumo),
      resumo,
      ultimaInfo: String(it.ultimaInfo ?? '').trim(),
      obito: pareceObitoAConfirmar(resumo) || undefined,
      atualizadoEm: quando,
    });
  }
  if (!saida.length) throw new ListaPrioritariosInvalida();
  return saida;
}

/** Liga o prioritário à família (pelo prontuário, endereço ou nome) e ao morador (nome ou nascimento). */
export function ligar(p: Prioritario, familias: Familia[]): { familiaId?: string; moradorId?: string } {
  const [numero, ...resto] = p.casa.split(/\s+/);
  const f = acharFamilia({ pront: p.prontuario || undefined, rua: p.rua, numero, complemento: resto.join(' '), nomes: [p.nome], rotulo: p.nome }, familias);
  const alvo = chaveNome(p.nome);
  const procurar = (fs: Familia[]) => {
    for (const fam of fs) {
      const m =
        fam.moradores.find((x) => chaveNome(x.nome) === alvo) ??
        (p.nascimento ? fam.moradores.find((x) => x.nascimento === p.nascimento && chaveNome(x.nome).split(' ')[0] === alvo.split(' ')[0]) : undefined);
      if (m) return { familiaId: fam.id, moradorId: m.id };
    }
    return null;
  };
  if (f) return procurar([f]) ?? { familiaId: f.id };
  // Endereço não bateu: pelo nome + nascimento em toda a área (só se for um só).
  const achados = familias.filter((fam) => fam.moradores.some((x) => chaveNome(x.nome) === alvo && (!p.nascimento || !x.nascimento || x.nascimento === p.nascimento)));
  return achados.length === 1 ? (procurar(achados) ?? {}) : {};
}

// ---------------------------------------------------------------- mesma pessoa (sem repetir)

const partes = (nome: string) => chaveNome(nome).split(' ').filter(Boolean);

/**
 * É a mesma pessoa? Reconhece mesmo com o nome escrito diferente (acento, maiúscula, "de/da", nome do meio
 * faltando) ou sem a data de nascimento numa das listas. Nunca junta duas pessoas ligadas a moradores
 * diferentes do cadastro, nem com datas de nascimento diferentes.
 */
export function mesmaPessoa(a: Prioritario, b: Prioritario): boolean {
  if (a.id === b.id) return true;
  if (a.moradorId && b.moradorId) return a.moradorId === b.moradorId;
  if (a.nascimento && b.nascimento && a.nascimento !== b.nascimento) return false;
  const [pa, pb] = [partes(a.nome), partes(b.nome)];
  if (!pa.length || !pb.length) return false;
  if (pa.join(' ') === pb.join(' ')) return true;
  // Nome mais curto contido no mais longo, com o mesmo primeiro e o mesmo último nome ("Ana Silva" = "Ana Maria da Silva").
  const [curto, longo] = pa.length <= pb.length ? [pa, pb] : [pb, pa];
  const contido = curto.length >= 2 && curto[0] === longo[0] && curto[curto.length - 1] === longo[longo.length - 1] && curto.every((x) => longo.includes(x));
  if (!contido) return false;
  if (a.nascimento && b.nascimento) return true; // mesma data (já conferida acima)
  // Sem data numa das duas: só se a casa também bate (para não juntar xarás).
  const mesmaCasa =
    (!!a.familiaId && a.familiaId === b.familiaId) ||
    (!!a.prontuario && a.prontuario === b.prontuario) ||
    (!!a.casa && a.casa === b.casa && semAcento(a.rua).toLowerCase() === semAcento(b.rua).toLowerCase());
  return mesmaCasa;
}

/** Junta dois registros da mesma pessoa: fica o editado à mão (ou o mais novo), sem perder etiquetas nem ligação. */
export function juntarDuas(a: Prioritario, b: Prioritario): Prioritario {
  const [base, outra] = (a.editadoEm ?? '') !== (b.editadoEm ?? '')
    ? ((a.editadoEm ?? '') > (b.editadoEm ?? '') ? [a, b] : [b, a])
    : (a.atualizadoEm ?? '') >= (b.atualizadoEm ?? '') ? [a, b] : [b, a];
  const nivel = ([base.nivel, outra.nivel] as NivelPrio[]).sort((x, y) => ORDEM_NIVEL[x] - ORDEM_NIVEL[y])[0];
  return {
    ...outra,
    ...base,
    nome: partes(base.nome).length >= partes(outra.nome).length ? base.nome : outra.nome,
    nascimento: base.nascimento || outra.nascimento,
    prontuario: base.prontuario || outra.prontuario,
    rua: base.rua || outra.rua,
    casa: base.casa || outra.casa,
    resumo: base.resumo || outra.resumo,
    ultimaInfo: base.ultimaInfo || outra.ultimaInfo,
    etiquetas: [...new Set([...base.etiquetas, ...outra.etiquetas])],
    nivel,
    obito: base.obito || outra.obito || undefined,
    familiaId: base.familiaId ?? outra.familiaId,
    moradorId: base.moradorId ?? outra.moradorId,
  };
}

/** Acha, na lista, o registro da mesma pessoa (pelo id, pelo morador ligado ou pelo nome). */
export function acharMesmaPessoa(p: Prioritario, lista: Prioritario[]): Prioritario | undefined {
  return lista.find((x) => x.id === p.id) ?? (p.moradorId ? lista.find((x) => x.moradorId === p.moradorId) : undefined) ?? lista.find((x) => mesmaPessoa(p, x));
}

/** Tira as repetições da lista (juntando as informações). Devolve a lista limpa e quantos foram juntados. */
export function juntarRepetidos(lista: Prioritario[]): { lista: Prioritario[]; juntados: number } {
  const saida: Prioritario[] = [];
  let juntados = 0;
  for (const p of lista) {
    const i = saida.findIndex((x) => mesmaPessoa(x, p));
    if (i < 0) saida.push(p);
    else {
      saida[i] = juntarDuas(saida[i], p);
      juntados++;
    }
  }
  return { lista: juntados ? saida : lista, juntados };
}

const camposIguais = (a: Prioritario, b: Prioritario) =>
  a.nivel === b.nivel && a.rua === b.rua && a.casa === b.casa && a.prontuario === b.prontuario && a.resumo === b.resumo &&
  a.ultimaInfo === b.ultimaInfo && [...a.etiquetas].sort().join('|') === [...b.etiquetas].sort().join('|');

export interface PreviaPrioritarios {
  novos: Prioritario[];
  atualizados: Prioritario[];
  /** Editados à mão no app e diferentes na lista nova: o ACS escolhe. */
  conflitos: { atual: Prioritario; novo: Prioritario }[];
  iguais: number;
  /** Já estavam no app e não vieram na lista nova (continuam; nada é apagado). */
  ficam: number;
  /** Não achados no cadastro (entram na aba, sem ligação com uma casa). */
  semCasa: Prioritario[];
  /** A mesma pessoa veio mais de uma vez na lista nova (foi juntada). */
  repetidosNaLista: number;
}

export function prepararPrioritarios(nova: Prioritario[], atuais: Prioritario[], familias: Familia[]): PreviaPrioritarios {
  const previa: PreviaPrioritarios = { novos: [], atualizados: [], conflitos: [], iguais: 0, ficam: 0, semCasa: [], repetidosNaLista: 0 };
  // Primeiro liga cada um ao cadastro (o morador ligado é o jeito mais seguro de reconhecer a pessoa).
  const ligados = nova.map((n0) => {
    const lig = ligar(n0, familias);
    return { ...n0, familiaId: lig.familiaId, moradorId: lig.moradorId } as Prioritario;
  });
  // A própria lista nova pode trazer a mesma pessoa duas vezes.
  const { lista: semRepetir, juntados } = juntarRepetidos(ligados);
  previa.repetidosNaLista = juntados;
  const usados = new Set<string>();
  for (const n1 of semRepetir) {
    const atual = acharMesmaPessoa(n1, atuais.filter((x) => !usados.has(x.id)));
    if (atual) usados.add(atual.id);
    // Já existia: fica com o id de antes (para não virar outra pessoa).
    const n: Prioritario = { ...n1, id: atual?.id ?? n1.id, familiaId: n1.familiaId ?? atual?.familiaId, moradorId: n1.moradorId ?? atual?.moradorId };
    if (!n.familiaId) previa.semCasa.push(n);
    if (!atual) previa.novos.push(n);
    else if (camposIguais(atual, n)) previa.iguais++;
    else if (atual.editadoEm) previa.conflitos.push({ atual, novo: { ...n, obito: atual.obito } });
    else previa.atualizados.push({ ...n, etiquetas: [...new Set([...n.etiquetas])], obito: atual.obito ?? n.obito });
  }
  previa.ficam = atuais.filter((p) => !usados.has(p.id)).length;
  return previa;
}

// ---------------------------------------------------------------- tela

export const ORDEM_NIVEL: Record<NivelPrio, number> = { A: 0, B: 1, C: 2 };

/** Idade de hoje (pela data de nascimento). */
export const idadeHoje = (p: Prioritario, hoje: string) => (p.nascimento ? idade(p.nascimento, hoje) : null);

/** Etiquetas para mostrar: "80+" vem da idade de hoje (não da lista). */
export function etiquetasParaMostrar(p: Prioritario, hoje: string): string[] {
  const anos = idadeHoje(p, hoje);
  const sem80 = p.etiquetas.filter((e) => e !== 'IDOSO 80+');
  const tem80 = anos !== null ? anos >= 80 : p.etiquetas.includes('IDOSO 80+');
  return tem80 ? [...sem80, 'IDOSO 80+'] : sem80;
}

/** Ordem da lista: nível A, B, C; depois a rua (na ordem dada) e o número da casa. */
export function ordenarPrioritarios(lista: Prioritario[], ordemRuas: string[] = []): Prioritario[] {
  const posRua = (r: string) => {
    const i = ordemRuas.findIndex((x) => normalizar(x).includes(normalizar(r)) || normalizar(r).includes(normalizar(x)));
    return i < 0 ? 99 : i;
  };
  const num = (c: string) => Number(c.match(/^\d+/)?.[0] ?? 99999);
  return [...lista].sort(
    (a, b) =>
      ORDEM_NIVEL[a.nivel] - ORDEM_NIVEL[b.nivel] ||
      posRua(a.rua) - posRua(b.rua) ||
      a.rua.localeCompare(b.rua) ||
      num(a.casa) - num(b.casa) ||
      a.casa.localeCompare(b.casa, 'pt-BR', { numeric: true }) ||
      a.nome.localeCompare(b.nome),
  );
}

/** "Nome (idade) - Acácias 12 - Pront. X - condições - resumo" (para mandar no WhatsApp da equipe). */
export function textoParaCopiar(p: Prioritario, hoje: string): string {
  const anos = idadeHoje(p, hoje);
  const cond = etiquetasParaMostrar(p, hoje).map((e) => infoEtiqueta(e).nome).join(', ');
  return [
    `${p.nome}${anos !== null ? ` (${anos} anos)` : ''}`,
    `${p.rua} ${p.casa}`.trim(),
    p.prontuario ? `Pront. ${p.prontuario}` : 'Sem prontuário',
    cond,
    p.resumo,
  ]
    .filter(Boolean)
    .join(' - ');
}
