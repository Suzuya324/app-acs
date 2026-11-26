// Trazer VDs a partir de TEXTO colado (ou arquivo .txt), ex.: a lista de visitas copiada da administração do SBCD.
// Não depende de um formato fixo: em cada linha procura a data, a casa (prontuário, nome de alguém da casa ou
// rua + número), o desfecho e o motivo. Uma linha só com a data vale para as linhas de baixo (lista por dia).
// Nada é salvo aqui: a tela mostra o resumo e o ACS confirma. Funções "puras".
import { normalizar } from './busca';
import { familiaDaLinha, lerListaFast } from './conferir-fast';
import type { Desfecho, Familia, Visita } from './tipos';

export interface VdDoTexto {
  familia: Familia;
  data: string;
  desfecho: Desfecho;
  motivo: string;
  /** Quem da casa aparece escrito na linha (fica marcado como presente). */
  presentes: string[];
  linha: string;
}

export interface LeituraVds {
  /** VDs que ainda não estão no app (vão ser criadas). */
  novas: VdDoTexto[];
  /** Já havia VD dessa casa nesse dia no app. */
  jaEstavam: { vd: VdDoTexto; visita: Visita }[];
  /** Linhas de VD (com data, ou embaixo de uma data) sem casa reconhecida. */
  naoReconhecidas: string[];
  /** A mesma casa e dia apareceu mais de uma vez no texto (fica uma só). */
  repetidasNoTexto: number;
  /** Linhas com alguma VD (reconhecida ou não). */
  linhasComVd: number;
}

const DATAS = /\b(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})\b/g;

/**
 * Data da VD na linha. Se tiver mais de uma (ex.: a data de nascimento junto), vale a mais recente, que é a da
 * visita.
 */
function dataDaLinha(t: string): string | undefined {
  let melhor: string | undefined;
  for (const d of t.matchAll(DATAS)) {
    const ano = d[3].length === 2 ? `20${d[3]}` : d[3];
    const mes = Number(d[2]);
    const dia = Number(d[1]);
    if (mes < 1 || mes > 12 || dia < 1 || dia > 31) continue;
    const iso = `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    if (!melhor || iso > melhor) melhor = iso;
  }
  return melhor;
}

/** Desfecho escrito na linha ("ausente realizada", "ausência", "recusa"…); sem nada escrito: visita realizada. */
export function desfechoDaLinha(t: string): Desfecho {
  const n = normalizar(t);
  if (/\brecus/.test(n)) return 'recusa';
  if (/\bausente realizad/.test(n)) return 'ausente_realizada';
  if (/\bausencia\b|\bausente\b|ninguem em casa|familia ausente|nao realizad/.test(n)) return 'ausencia_completa';
  return 'realizada';
}

/** Motivo escrito na linha, se for um dos motivos do Fast da unidade. */
function motivoDaLinha(t: string, motivos: string[], padrao: string): string {
  const n = normalizar(t);
  return motivos.find((m) => n.includes(normalizar(m))) ?? padrao;
}

/** A casa pela rua e número escritos na linha (ex.: "RUA DAS ACACIAS, 90"), se só uma casa bater. */
function familiaPeloEndereco(t: string, familias: Familia[]): Familia | null {
  const n = ` ${normalizar(t).replace(/[,;]/g, ' ')} `;
  const achadas = familias.filter((f) => {
    const rua = normalizar(f.rua).replace(/^(rua|r|avenida|av|travessa|tv|alameda|estrada|viela|praca|beco)\s+/, '');
    const num = normalizar(f.numero);
    if (!rua || rua.length < 4 || !num) return false;
    return n.includes(` ${rua} `) && new RegExp(`\\s${num.replace(/[/.]/g, '\\$&')}\\s`).test(n);
  });
  if (achadas.length === 1) return achadas[0];
  // Várias casas no mesmo número: desempata pelo complemento escrito.
  const comComp = achadas.filter((f) => f.complemento && n.includes(` ${normalizar(f.complemento)} `));
  return comComp.length === 1 ? comComp[0] : null;
}

export function lerVdsDoTexto(texto: string, familias: Familia[], visitas: Visita[], motivos: string[], motivoPadrao: string): LeituraVds {
  const r: LeituraVds = { novas: [], jaEstavam: [], naoReconhecidas: [], repetidasNoTexto: 0, linhasComVd: 0 };
  const vistas = new Set<string>();
  let dataAtual: string | undefined;
  for (const bruta of texto.split(/\r?\n/)) {
    const t = bruta.replace(/\s+/g, ' ').trim();
    if (t.length < 4) continue;
    const data = dataDaLinha(t);
    const [linhaFast] = lerListaFast(t);
    const familia = (linhaFast ? familiaDaLinha(linhaFast, familias) : null) ?? familiaPeloEndereco(t, familias);
    // Linha só com a data (cabeçalho do dia): vale para as linhas de baixo.
    if (data && !familia && t.replace(DATAS, '').replace(/[^a-zA-ZÀ-ú]/g, '').length < 12) {
      dataAtual = data;
      continue;
    }
    const dia = data ?? dataAtual;
    if (!dia) continue;
    if (!familia) {
      // Linha com data e texto, sem casa conhecida: mostra para o ACS conferir (cabeçalhos curtos ficam de fora).
      if (/[a-zA-ZÀ-ú]{3,}/.test(t.replace(DATAS, ''))) {
        r.linhasComVd++;
        r.naoReconhecidas.push(t);
      }
      continue;
    }
    r.linhasComVd++;
    const chave = `${familia.id}|${dia}`;
    if (vistas.has(chave)) {
      r.repetidasNoTexto++;
      continue;
    }
    vistas.add(chave);
    const n = ` ${normalizar(t)} `;
    const presentes = familia.moradores
      .filter((m) => {
        const partes = normalizar(m.nome).split(' ').filter((p) => p.length > 2);
        return partes.length >= 2 && partes.every((p) => n.includes(` ${p} `));
      })
      .map((m) => m.id);
    const desfecho = desfechoDaLinha(t);
    // Ninguém em casa ou recusa: ninguém fica como presente (o nome na linha é só de quem é a casa).
    const vd: VdDoTexto = { familia, data: dia, desfecho, motivo: motivoDaLinha(t, motivos, motivoPadrao), presentes: desfecho === 'ausencia_completa' || desfecho === 'recusa' ? [] : presentes, linha: t };
    const ja = visitas.find((v) => v.familiaId === familia.id && v.data === dia);
    if (ja) r.jaEstavam.push({ vd, visita: ja });
    else r.novas.push(vd);
  }
  r.novas.sort((a, b) => a.data.localeCompare(b.data));
  return r;
}
