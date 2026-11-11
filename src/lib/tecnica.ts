// Lista para a técnica de enfermagem: quem precisa de P.A., glicemia, curativo ou outro cuidado dela.
// Lida do que já está no app (condições, medidas das VDs, o que foi escrito, casos). Tudo no aparelho.
import { medidasDaPessoa } from './acompanhamento';
import { dataCurta, frases, NEGACAO, semAcento, textosDaPessoa } from './anotacoes';
import { diferencaDias, idade } from './datas';
import type { Prioritario } from './prioritarios';
import type { Caso, Familia, Morador, Visita } from './tipos';

export type TipoTecnica = 'pa' | 'glicemia' | 'curativo' | 'outro';

export interface PedidoTecnica {
  tipo: TipoTecnica;
  /** Ex.: "P.A. (última 180x100 em 13/10)". */
  texto: string;
  /** Mais alto = mais urgente. */
  peso: number;
}

export interface ItemTecnica {
  familia: Familia;
  morador: Morador;
  pedidos: PedidoTecnica[];
  peso: number;
}

/** Sem P.A. ou glicemia há quantos dias entra na lista. */
export const DIAS_MEDIDA = 60;
/** Medida alta: repetir se foi nos últimos X dias. */
const DIAS_REPETIR = 30;
/** Curativo/ferida: só o que foi escrito nos últimos X dias. */
const DIAS_CUIDADO = 60;

const CUIDADO: [RegExp, string][] = [
  [/\b(curativo\w*|ferida\w*|escara\w*|lesao por pressao|ulcera\w*|pe diabetico|retirar (os )?pontos|tirar (os )?pontos)\b/, 'Curativo / ver ferida'],
  [/\b(aplicar|aplicacao de) (injecao|insulina|medicacao|vacina|benzetacil)\b|\b(injecao|vacina) em casa\b/, 'Aplicação (injeção / vacina)'],
  [/\b(sonda\w*|trocar a sonda|troca de sonda)\b/, 'Sonda'],
  [/\b(coleta|coletar) (de )?(sangue|exame|urina)\b|\bcoleta em casa\b/, 'Coleta em casa'],
  [/\b(tecnica de enfermagem|tecnico de enfermagem|da tecnica|pela tecnica)\b[^.;]*\b(precisa|pedir|passar|ir|visitar|vir)\b|\b(precisa|pedir|passar|ir|visitar)\b[^.;]*\b(tecnica|tecnico) de enfermagem\b/, 'Pedido para a técnica'],
];
/** Já resolvido: a ferida fechou, o curativo terminou. */
const FECHOU = /\b(cicatriz\w*|fechou|fechada|curad[oa]|sarou|terminou o curativo|nao precisa mais|alta do curativo)\b/;

const pa = (v: string) => {
  const m = v.match(/(\d{2,3})\s*[x/]\s*(\d{2,3})/);
  if (!m) return null;
  let [s, d] = [Number(m[1]), Number(m[2])];
  if (s < 30) [s, d] = [s * 10, d * 10]; // "14x9" → 140x90
  return { s, d };
};

/** O que a técnica precisa fazer para a pessoa (vazio = nada). */
export function pedidosDaPessoa(m: Morador, f: Familia, visitas: Visita[], casos: Caso[], hoje: string, prio?: Prioritario): PedidoTecnica[] {
  const textos = textosDaPessoa(m, f, visitas, [], prio);
  const med = medidasDaPessoa(m, f, visitas, textos);
  const pedidos: PedidoTecnica[] = [];
  const has = m.grupos.includes('hipertenso');
  const dm = m.grupos.includes('diabetico');

  const ultPA = med.pa[0];
  const vPA = ultPA ? pa(ultPA.valor) : null;
  if (ultPA && vPA && diferencaDias(ultPA.data, hoje) <= DIAS_REPETIR && (vPA.s >= 160 || vPA.d >= 100)) {
    pedidos.push({ tipo: 'pa', texto: `Repetir P.A. (última ${ultPA.valor} em ${dataCurta(ultPA.data)})`, peso: vPA.s >= 180 || vPA.d >= 110 ? 90 : 70 });
  } else if (has && (!ultPA || diferencaDias(ultPA.data, hoje) > DIAS_MEDIDA)) {
    pedidos.push({ tipo: 'pa', texto: ultPA ? `P.A. (última ${ultPA.valor} em ${dataCurta(ultPA.data)})` : 'P.A. (sem registro no app)', peso: 40 });
  }
  const ultGl = med.glicemia[0];
  const vGl = ultGl ? Number(ultGl.valor) : NaN;
  if (ultGl && diferencaDias(ultGl.data, hoje) <= DIAS_REPETIR && (vGl >= 250 || (vGl > 0 && vGl <= 70))) {
    pedidos.push({ tipo: 'glicemia', texto: `Repetir glicemia (última ${ultGl.valor} em ${dataCurta(ultGl.data)})`, peso: vGl >= 300 || vGl <= 60 ? 90 : 70 });
  } else if (dm && (!ultGl || diferencaDias(ultGl.data, hoje) > DIAS_MEDIDA)) {
    pedidos.push({ tipo: 'glicemia', texto: ultGl ? `Glicemia (última ${ultGl.valor} em ${dataCurta(ultGl.data)})` : 'Glicemia (sem registro no app)', peso: 40 });
  }

  // Cuidados escritos nas VDs e nos casos abertos (o mais novo vale; "cicatrizou" depois tira da lista).
  const recentes = textos.filter((t) => t.data && !t.lista && t.data <= hoje && diferencaDias(t.data, hoje) <= DIAS_CUIDADO);
  const deCasos = casos
    .filter((c) => c.familiaId === f.id && !c.resolvidoEm && semAcento(`${c.titulo} ${c.texto}`).includes(semAcento(m.nome.split(' ')[0])))
    .map((c) => ({ data: (c.novidadeEm ?? c.criadoEm).slice(0, 10), texto: c.texto }));
  for (const [re, nome] of CUIDADO) {
    let achou: { data: string; frase: string } | null = null;
    for (const t of [...recentes, ...deCasos].sort((a, b) => b.data.localeCompare(a.data))) {
      for (const fr of frases(t.texto)) {
        const baixo = semAcento(fr);
        const x = baixo.match(re);
        if (!x) continue;
        const antes = baixo.slice(0, x.index);
        if (NEGACAO.test(antes.slice(antes.lastIndexOf(',') + 1)) || /\b(ja fez|fazia|fez|antes|historico|ja teve)\b[^.;]*$/.test(antes)) continue;
        achou = FECHOU.test(baixo) ? { data: t.data, frase: '' } : { data: t.data, frase: fr };
        break;
      }
      if (achou) break;
    }
    if (achou?.frase) {
      const curto = achou.frase.length > 90 ? `${achou.frase.slice(0, 90)}…` : achou.frase;
      pedidos.push({ tipo: nome.startsWith('Curativo') ? 'curativo' : 'outro', texto: `${nome}: “${curto}” (${dataCurta(achou.data)})`, peso: nome.startsWith('Curativo') ? 60 : 50 });
    }
  }
  return pedidos.sort((a, b) => b.peso - a.peso);
}

/** A lista para a técnica, casa por casa, na ordem das ruas e dos números. */
export function listaParaTecnica(familias: Familia[], visitas: Visita[], casos: Caso[], prioritarios: Prioritario[], hoje: string, ordemRuas: string[] = []): ItemTecnica[] {
  const itens: ItemTecnica[] = [];
  for (const f of familias) {
    if (f.situacaoCasa !== 'habitada') continue;
    for (const m of f.moradores) {
      if (m.situacao !== 'mora') continue;
      const prio = prioritarios.find((p) => p.moradorId === m.id);
      const pedidos = pedidosDaPessoa(m, f, visitas, casos, hoje, prio);
      if (pedidos.length) itens.push({ familia: f, morador: m, pedidos, peso: pedidos[0].peso });
    }
  }
  const posRua = (r: string) => {
    const i = ordemRuas.findIndex((x) => semAcento(x) === semAcento(r));
    return i < 0 ? 99 : i;
  };
  const num = (n: string) => Number(n.match(/^\d+/)?.[0] ?? 99999);
  return itens.sort(
    (a, b) =>
      posRua(a.familia.rua) - posRua(b.familia.rua) || a.familia.rua.localeCompare(b.familia.rua) ||
      num(a.familia.numero) - num(b.familia.numero) || a.familia.complemento.localeCompare(b.familia.complemento, 'pt-BR', { numeric: true }),
  );
}

/** Texto para mandar para a técnica (WhatsApp da equipe). */
export function textoParaTecnica(itens: ItemTecnica[], hoje: string, endereco: (f: Familia) => string): string {
  const linhas = [`Para a técnica de enfermagem (${dataCurta(hoje)}): ${itens.length} ${itens.length === 1 ? 'pessoa' : 'pessoas'}`];
  let casa = '';
  for (const it of itens) {
    const end = endereco(it.familia);
    if (end !== casa) {
      linhas.push('', `${end}${it.familia.prontuario ? ` (pront. ${it.familia.prontuario})` : ''}`);
      casa = end;
    }
    const anos = idade(it.morador.nascimento, hoje);
    linhas.push(`- ${it.morador.nome}${anos !== null ? `, ${anos} anos` : ''}: ${it.pedidos.map((p) => p.texto).join('; ')}`);
  }
  return linhas.join('\n');
}
