// Trazer VDs e relatos de outro lugar (ex.: o "Sistema de Visitas") para o app.
// O arquivo diz a casa de cada registro (prontuário, endereço, nomes); o app acha a família
// sozinho, sem duplicar (cada registro tem um id fixo). Tudo no aparelho.
import { normalizar } from './busca';
import { partesProntuario } from './numeros';
import type { Caso, CategoriaCaso, Desfecho, Familia, Grupo, RelatoAnterior, Revisita, Visita } from './tipos';

export const FORMATO_IMPORTACAO = 'facilitador-importacao';

/** Como o arquivo descreve a casa. */
export interface CasaRef {
  /** Prontuário em qualquer formato ("04.1", "0000.04.001"). */
  pront?: string;
  /** Palavra da rua, ex.: "Acácias". */
  rua?: string;
  numero?: string;
  complemento?: string;
  /** Nomes dos moradores (ajuda a desempatar). */
  nomes?: string[];
  /** Quando o registro é de uma pessoa, e não de uma casa. */
  pessoa?: string;
  /** Texto para mostrar se não achar, ex.: "Acácias 12 casa 2". */
  rotulo: string;
}

export interface ItemVD {
  tipo: 'vd';
  id: string;
  casa: CasaRef;
  data: string;
  desfecho: Desfecho;
  relato: string;
  lancada: boolean;
  compartilhada?: boolean;
  observacao?: string;
}

export interface ItemRelato {
  tipo: 'relato';
  id: string;
  casa: CasaRef;
  titulo: string;
  texto: string;
  data?: string;
}

export interface ItemCaso {
  tipo: 'caso';
  id: string;
  casa: CasaRef;
  categoria: CategoriaCaso;
  titulo: string;
  texto: string;
  emulti?: string;
  npv?: string;
  /** Quando foi anotado (aaaa-mm-dd), se souber. */
  data?: string;
}

/** Condições (grupos) e nota de uma pessoa. */
export interface ItemCondicoes {
  tipo: 'condicoes';
  id: string;
  casa: CasaRef;
  pessoa: string;
  grupos: Grupo[];
  nota?: string;
}

/** Nível, recado de atenção e última VD (fora do app) de uma casa. */
export interface ItemNivel {
  tipo: 'nivel';
  id: string;
  casa: CasaRef;
  nivel?: 'A' | 'B';
  atencao?: string;
  ultimaVd?: string;
}

/** Casa para voltar (vira revisita marcada). */
export interface ItemVoltar {
  tipo: 'voltar';
  id: string;
  casa: CasaRef;
  motivo: string;
  /** Anotado em (aaaa-mm-dd). */
  data?: string;
}

export type ItemImportacao = ItemVD | ItemRelato | ItemCaso | ItemCondicoes | ItemNivel | ItemVoltar;

export interface ArquivoImportacao {
  formato: typeof FORMATO_IMPORTACAO;
  versao: 1;
  origem: string;
  itens: ItemImportacao[];
}

export class ArquivoImportacaoInvalido extends Error {
  constructor() {
    super('Este arquivo não é de importação do Facilitador de VDs.');
  }
}

export function lerArquivoImportacao(texto: string): ArquivoImportacao {
  let a: ArquivoImportacao;
  try {
    a = JSON.parse(texto);
  } catch {
    throw new ArquivoImportacaoInvalido();
  }
  if (a?.formato !== FORMATO_IMPORTACAO || a.versao !== 1 || !Array.isArray(a.itens)) throw new ArquivoImportacaoInvalido();
  return a;
}

// ---------------------------------------------------------------- achar a família

/** "CASA 02", "Casa 2", "cs2" → "2"; "FUNDOS" → "fundos". */
function chaveComplemento(c = ''): string {
  return normalizar(c)
    .replace(/\b(casa|cs|c|numero|n|no)\b\.?/g, ' ')
    .replace(/\b0+(\d)/g, '$1')
    .replace(/\s+/g, '');
}
const chaveNumero = (n = '') => normalizar(n).replace(/\s/g, '').replace(/^s\/?n.*$/, 's/n').replace(/^0+(\d)/, '$1');
const chaveNome = (n: string) => normalizar(n).split(' ').filter((p) => p && !['de', 'da', 'do', 'das', 'dos', 'e'].includes(p)).join(' ');

/** Acha a família de um registro: pelo prontuário, depois pelo endereço, depois pelo nome. */
export function acharFamilia(casa: CasaRef, familias: Familia[]): Familia | null {
  const nomes = new Set([...(casa.nomes ?? []), ...(casa.pessoa ? [casa.pessoa] : [])].map(chaveNome));
  const temNome = (f: Familia) => f.moradores.some((m) => nomes.has(chaveNome(m.nome)));
  const desempatar = (fs: Familia[]): Familia | null => {
    if (fs.length <= 1) return fs[0] ?? null;
    const comNome = fs.filter(temNome);
    return comNome.length === 1 ? comNome[0] : null;
  };
  const numero = casa.numero ? chaveNumero(casa.numero) : null;
  const comp = chaveComplemento(casa.complemento);

  // 1) Prontuário (micro + número).
  const p = casa.pront ? partesProntuario(casa.pront) : null;
  if (p) {
    const mesmos = familias.filter((f) => {
      const q = partesProntuario(f.prontuario);
      return q && q.micro === p.micro && q.numero === p.numero;
    });
    const achada = desempatar(mesmos.length > 1 && numero ? mesmos.filter((f) => chaveNumero(f.numero) === numero) : mesmos);
    if (achada) return achada;
  }
  // 2) Endereço (rua + número + complemento).
  if (casa.rua && numero) {
    const rua = normalizar(casa.rua);
    const naRua = familias.filter((f) => normalizar(f.rua).includes(rua) && chaveNumero(f.numero) === numero);
    const mesmoComp = naRua.filter((f) => chaveComplemento(f.complemento) === comp);
    const achada = desempatar(mesmoComp.length ? mesmoComp : naRua);
    if (achada) return achada;
  }
  // 3) Nome de um morador (só se for único).
  if (nomes.size) {
    const comNome = familias.filter(temNome);
    if (comNome.length === 1) return comNome[0];
  }
  return null;
}

// ---------------------------------------------------------------- preparar

export interface Previa {
  visitas: Visita[];
  casos: Caso[];
  revisitas: Revisita[];
  /** Grupos a incluir e nota, por morador. */
  condicoes: { familiaId: string; moradorId: string; nome: string; grupos: Grupo[]; nota?: string }[];
  /** Nível, atenção e última VD fora do app, por família (só o que muda). */
  niveis: { familiaId: string; nivel?: 'A' | 'B'; atencao?: string; ultimaVdFora?: string }[];
  /** Relatos anteriores por família. */
  relatos: Map<string, RelatoAnterior[]>;
  /** Já estavam no app (mesmo id, ou VD da mesma família no mesmo dia). */
  jaExistiam: number;
  /** Registros do arquivo da mesma casa no mesmo dia: viraram uma VD só (relatos juntos). */
  juntadas: number;
  naoAchados: { rotulo: string; tipo: ItemImportacao['tipo'] }[];
}

export function prepararImportacao(
  arq: ArquivoImportacao,
  familias: Familia[],
  visitasAtuais: Visita[],
  opcoes: { motivoPadrao: string; quando: string; hoje?: string },
  existentes: { casos?: Caso[]; revisitas?: Revisita[] } = {},
): Previa {
  const idsCaso = new Set((existentes.casos ?? []).map((c) => c.id));
  const idsRevisita = new Set((existentes.revisitas ?? []).map((r) => r.id));
  const hoje = opcoes.hoje ?? opcoes.quando.slice(0, 10);
  const idsVd = new Set(visitasAtuais.map((v) => v.id));
  const mesmoDia = new Set(visitasAtuais.map((v) => `${v.familiaId}|${v.data}`));
  const idsRelato = new Set(familias.flatMap((f) => (f.relatosAnteriores ?? []).map((r) => r.id)));
  /** Relatos que aparecem duas vezes no próprio arquivo (ex.: o mesmo paciente em dois casos). */
  const idsRelatoArquivo = new Set<string>();
  const previa: Previa = { visitas: [], casos: [], revisitas: [], condicoes: [], niveis: [], relatos: new Map(), jaExistiam: 0, juntadas: 0, naoAchados: [] };
  /** VDs deste arquivo por família e dia (para juntar registros repetidos). */
  const doArquivo = new Map<string, Visita>();
  for (const it of arq.itens) {
    const f = acharFamilia(it.casa, familias);
    if (!f) {
      previa.naoAchados.push({ rotulo: it.casa.rotulo, tipo: it.tipo });
      continue;
    }
    if (it.tipo === 'vd') {
      const chave = `${f.id}|${it.data}`;
      const irma = doArquivo.get(chave);
      if (irma) {
        // Mesma casa, mesmo dia, outro registro (ex.: como "caso" e como "casa"): junta os relatos.
        const r = it.relato.trim();
        if (r && !irma.relato.includes(r)) irma.relato = irma.relato ? `${irma.relato}\n\n${r}` : r;
        if (it.desfecho === 'realizada') {
          irma.desfecho = 'realizada';
          irma.conversouComFamilia = true;
        }
        if (it.compartilhada) irma.compartilhadaCom = 'outro profissional';
        if (irma.relato) irma.observacao = 'Trazida do Sistema de Visitas.';
        previa.juntadas++;
        continue;
      }
      if (idsVd.has(it.id) || mesmoDia.has(chave)) {
        previa.jaExistiam++;
        continue;
      }
      mesmoDia.add(chave);
      const v: Visita = {
        id: it.id,
        familiaId: f.id,
        data: it.data,
        presentes: [],
        conversouComFamilia: it.desfecho === 'realizada',
        desfecho: it.desfecho,
        motivo: opcoes.motivoPadrao,
        compartilhadaCom: it.compartilhada ? 'outro profissional' : '',
        sinais: {},
        orientacoes: '',
        relato: it.relato,
        lancadaNoFast: it.lancada,
        observacao: it.observacao,
        atualizadoEm: opcoes.quando,
      };
      previa.visitas.push(v);
      doArquivo.set(chave, v);
    } else if (it.tipo === 'caso') {
      if (idsCaso.has(it.id)) {
        previa.jaExistiam++;
        continue;
      }
      idsCaso.add(it.id);
      const criado = it.data ? `${it.data}T12:00:00.000Z` : opcoes.quando;
      previa.casos.push({
        id: it.id, familiaId: f.id, categoria: it.categoria, titulo: it.titulo, texto: it.texto,
        emulti: it.emulti || undefined, npv: it.npv || undefined, criadoEm: criado, atualizadoEm: opcoes.quando,
      });
    } else if (it.tipo === 'condicoes') {
      const alvo = chaveNome(it.pessoa);
      const m = f.moradores.find((x) => chaveNome(x.nome) === alvo);
      if (!m) {
        previa.naoAchados.push({ rotulo: `${it.pessoa} (${it.casa.rotulo})`, tipo: it.tipo });
        continue;
      }
      const novos = it.grupos.filter((g) => !m.grupos.includes(g));
      const nota = it.nota?.trim() && !m.obs.includes(it.nota.trim()) ? it.nota.trim() : undefined;
      if (!novos.length && !nota) {
        previa.jaExistiam++;
        continue;
      }
      previa.condicoes.push({ familiaId: f.id, moradorId: m.id, nome: m.nome, grupos: novos, nota });
    } else if (it.tipo === 'nivel') {
      const mudar: Previa['niveis'][number] = { familiaId: f.id };
      if (it.nivel && it.nivel !== f.nivel) mudar.nivel = it.nivel;
      if (it.atencao?.trim() && !(f.atencao ?? '').includes(it.atencao.trim())) mudar.atencao = it.atencao.trim();
      if (it.ultimaVd && it.ultimaVd > (f.ultimaVdFora ?? '')) mudar.ultimaVdFora = it.ultimaVd;
      if (Object.keys(mudar).length === 1) {
        previa.jaExistiam++;
        continue;
      }
      previa.niveis.push(mudar);
    } else if (it.tipo === 'voltar') {
      if (idsRevisita.has(it.id)) {
        previa.jaExistiam++;
        continue;
      }
      idsRevisita.add(it.id);
      previa.revisitas.push({ id: it.id, familiaId: f.id, motivo: it.motivo, ate: hoje, criadaEm: it.data ? `${it.data}T12:00:00.000Z` : opcoes.quando });
    } else {
      if (idsRelatoArquivo.has(it.id)) continue;
      if (idsRelato.has(it.id)) {
        previa.jaExistiam++;
        continue;
      }
      idsRelatoArquivo.add(it.id);
      const lista = previa.relatos.get(f.id) ?? [];
      lista.push({ id: it.id, titulo: it.titulo, texto: it.texto, data: it.data, origem: arq.origem });
      previa.relatos.set(f.id, lista);
    }
  }
  return previa;
}
