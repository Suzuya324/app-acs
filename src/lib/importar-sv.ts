// Trazer VDs e relatos de outro lugar (ex.: o "Sistema de Visitas") para o app.
// O arquivo diz a casa de cada registro (prontuário, endereço, nomes); o app acha a família
// sozinho, sem duplicar (cada registro tem um id fixo). Tudo no aparelho.
import { normalizar } from './busca';
import { partesProntuario } from './numeros';
import type { Desfecho, Familia, RelatoAnterior, Visita } from './tipos';

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

export interface ArquivoImportacao {
  formato: typeof FORMATO_IMPORTACAO;
  versao: 1;
  origem: string;
  itens: (ItemVD | ItemRelato)[];
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
  /** Relatos anteriores por família. */
  relatos: Map<string, RelatoAnterior[]>;
  /** Já estavam no app (mesmo id, ou VD da mesma família no mesmo dia). */
  jaExistiam: number;
  /** Registros do arquivo da mesma casa no mesmo dia: viraram uma VD só (relatos juntos). */
  juntadas: number;
  naoAchados: { rotulo: string; tipo: 'vd' | 'relato' }[];
}

export function prepararImportacao(
  arq: ArquivoImportacao,
  familias: Familia[],
  visitasAtuais: Visita[],
  opcoes: { motivoPadrao: string; quando: string },
): Previa {
  const idsVd = new Set(visitasAtuais.map((v) => v.id));
  const mesmoDia = new Set(visitasAtuais.map((v) => `${v.familiaId}|${v.data}`));
  const idsRelato = new Set(familias.flatMap((f) => (f.relatosAnteriores ?? []).map((r) => r.id)));
  /** Relatos que aparecem duas vezes no próprio arquivo (ex.: o mesmo paciente em dois casos). */
  const idsRelatoArquivo = new Set<string>();
  const previa: Previa = { visitas: [], relatos: new Map(), jaExistiam: 0, juntadas: 0, naoAchados: [] };
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
