// Listas para a equipe: o que a enfermeira, a médica e o APA (Agente de Promoção Ambiental) precisam ver na área.
// Lidas do que já está no app (condições, medidas das VDs, o que foi escrito, casos). Tudo no aparelho.
// A técnica de enfermagem tem a lista própria em tecnica.ts.
import { acompanhamentoDaPessoa, type Contexto } from './acompanhamento';
import { dataCurta, frases, NEGACAO, semAcento, textosDaFamilia, type TextoDaFamilia } from './anotacoes';
import { diferencaDias } from './datas';
import type { Prioritario } from './prioritarios';
import { pedidosDaPessoa } from './tecnica';
import type { Caso, Familia, Morador, Visita } from './tipos';

export type Quem = 'enfermeira' | 'medica' | 'apa';

/** Origem da anotação "o APA foi na casa", guardada nos relatos da família. */
export const ORIGEM_APA = 'APA';

export const NOMES_QUEM: Record<Quem, string> = {
  enfermeira: 'Enfermeira',
  medica: 'Dra. (médica)',
  apa: 'APA (Promoção Ambiental)',
};
/** Como aparece no texto para mandar ("Para a enfermeira…"). */
export const PARA_QUEM: Record<Quem, string> = {
  enfermeira: 'a enfermeira',
  medica: 'a Dra.',
  apa: 'o APA (Agente de Promoção Ambiental)',
};

export interface MotivoEquipe {
  texto: string;
  /** Mais alto = mais urgente. */
  peso: number;
}

export interface ItemEquipe {
  /** Id do morador (lista de pessoas) ou da casa (caso e APA), para marcar no dia dela. */
  chave: string;
  familia: Familia;
  /** Vazio quando o pedido é da casa toda. */
  morador?: Morador;
  motivos: MotivoEquipe[];
  peso: number;
}

const cortar = (t: string, max = 110) => (t.length > max ? `${t.slice(0, max).trimEnd()}…` : t);
const MEDICA_RE = /\b(medic[oa]s?|dra\.?|doutora?|avaliacao medica|consulta medica|vd medica)\b/;
const ENFERMEIRA_RE = /\benfermeir[oa]s?\b/;

function ordenarPorRua(itens: ItemEquipe[], ordemRuas: string[]): ItemEquipe[] {
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

function juntar(mapa: Map<string, ItemEquipe>, chave: string, familia: Familia, morador: Morador | undefined, texto: string, peso: number) {
  const it = mapa.get(chave) ?? { chave, familia, morador, motivos: [], peso: 0 };
  if (!it.motivos.some((m) => m.texto === texto)) it.motivos.push({ texto, peso });
  it.motivos.sort((a, b) => b.peso - a.peso);
  it.peso = it.motivos[0].peso;
  mapa.set(chave, it);
}

/** Casos abertos (urgente ou importante) que citam a enfermeira ou a médica no texto. */
function casosCitando(re: RegExp, familias: Familia[], casos: Caso[], mapa: Map<string, ItemEquipe>, pesoBase: number) {
  const porId = new Map(familias.map((f) => [f.id, f]));
  for (const c of casos) {
    if (c.resolvidoEm || (c.categoria !== 'urgente' && c.categoria !== 'importante')) continue;
    const f = porId.get(c.familiaId);
    if (!f || f.situacaoCasa !== 'habitada') continue;
    if (!re.test(semAcento(`${c.titulo} ${c.texto}`))) continue;
    juntar(mapa, `caso-${c.id}`, f, undefined, `Caso${c.categoria === 'urgente' ? ' urgente' : ''}: ${cortar(c.titulo.split(',')[0], 60)} – ${cortar(c.texto, 90)}`, pesoBase + (c.categoria === 'urgente' ? 15 : 0));
  }
}

// ---------------------------------------------------------------- enfermeira

/** Pessoas e casos para a enfermeira: VD de enfermagem em casa, pós-alta, bebê e puérpera, valores muito altos, casos que pedem a enfermeira. */
export function listaParaEnfermeira(familias: Familia[], visitas: Visita[], casos: Caso[], prioritarios: Prioritario[], hoje: string, ordemRuas: string[] = []): ItemEquipe[] {
  const mapa = new Map<string, ItemEquipe>();
  for (const f of familias) {
    if (f.situacaoCasa !== 'habitada') continue;
    for (const m of f.moradores) {
      if (m.situacao !== 'mora') continue;
      const prio = prioritarios.find((p) => p.moradorId === m.id);
      for (const p of pedidosDaPessoa(m, f, visitas, casos, hoje, prio)) {
        // Só o que pede enfermagem de verdade (a rotina de P.A. e glicemia fica com a técnica).
        if (p.peso >= 55) juntar(mapa, m.id, f, m, p.texto, p.peso);
      }
    }
  }
  casosCitando(ENFERMEIRA_RE, familias, casos, mapa, 60);
  return ordenarPorRua([...mapa.values()], ordemRuas);
}

// ---------------------------------------------------------------- médica

/** Pessoas e casos para a Dra.: caso urgente, valores muito altos, receita para renovar, pós-alta, acamado sem VD médica. */
export function listaParaMedica(familias: Familia[], visitas: Visita[], casos: Caso[], prioritarios: Contexto['prioritarios'], hoje: string, ordemRuas: string[] = []): ItemEquipe[] {
  const mapa = new Map<string, ItemEquipe>();
  const ctx: Contexto = { visitas, casos, prioritarios, hoje };
  const porId = new Map(familias.map((f) => [f.id, f]));
  for (const c of casos) {
    const f = porId.get(c.familiaId);
    if (c.resolvidoEm || c.categoria !== 'urgente' || !f || f.situacaoCasa !== 'habitada') continue;
    juntar(mapa, `caso-${c.id}`, f, undefined, `Caso urgente: ${cortar(c.titulo.split(',')[0], 60)} – ${cortar(c.texto, 90)}`, 90);
  }
  casosCitando(MEDICA_RE, familias, casos, mapa, 65);
  for (const f of familias) {
    if (f.situacaoCasa !== 'habitada') continue;
    for (const m of f.moradores) {
      if (m.situacao !== 'mora') continue;
      const prio = prioritarios.find((p) => p.moradorId === m.id);
      // P.A. e glicemia muito altas (as de peso 90 da lista da técnica).
      for (const p of pedidosDaPessoa(m, f, visitas, casos, hoje, prio)) {
        if ((p.tipo === 'pa' || p.tipo === 'glicemia') && p.peso >= 90) juntar(mapa, m.id, f, m, `${p.texto.replace(/^Repetir /, 'Valor muito alto: ')}`, 80);
      }
      const a = acompanhamentoDaPessoa(m, f, ctx);
      if (a.receita && diferencaDias(hoje, a.receita.vence) <= 15) {
        const venceu = a.receita.vence < hoje;
        juntar(mapa, m.id, f, m, `Receita ${venceu ? 'venceu' : 'vence'} em ${dataCurta(a.receita.vence)}: renovar`, venceu ? 60 : 50);
      }
      if (a.hospital?.tipo === 'alta' && diferencaDias(a.hospital.data, hoje) <= 15) juntar(mapa, m.id, f, m, `Alta do hospital em ${dataCurta(a.hospital.data)}: consulta pós-alta`, 75);
      if (m.grupos.includes('acamado') || m.grupos.includes('oxigenio')) {
        const ultima = visitas
          .filter((v) => v.familiaId === f.id && MEDICA_RE.test(semAcento(v.compartilhadaCom ?? '')) && v.data <= hoje)
          .map((v) => v.data)
          .sort()
          .pop();
        if (!ultima || diferencaDias(ultima, hoje) > 90) {
          juntar(mapa, m.id, f, m, `${m.grupos.includes('acamado') ? 'Acamado' : 'Oxigênio'}: VD médica em casa (${ultima ? `última ${dataCurta(ultima)}` : 'nenhuma registrada'})`, 45);
        }
      }
    }
  }
  return ordenarPorRua([...mapa.values()], ordemRuas);
}

// ---------------------------------------------------------------- APA

/** Dias para trás em que o que foi escrito ainda vale para o APA. */
export const DIAS_AMBIENTAL = 90;

const AMBIENTAL: { re: RegExp; nome: string; peso: number; exige?: RegExp }[] = [
  { re: /\b(dengue|chikungunya|zika)\b/, nome: 'Suspeita de dengue / arbovirose', peso: 85, exige: /\b(suspeit\w*|confirmad\w*|caso|teve|com|febre|exame)\b/ },
  { re: /\b(foco|focos|criadouro\w*|agua parada|pneu\w*|caixa d.?agua|piscina|calha\w*|vaso\w* com agua|tampa\w* de lata)\b/, nome: 'Possível criadouro', peso: 70 },
  { re: /\b(rato|ratos|escorpi\w*|barata\w*|caramujo\w*|morcego\w*|cobra\w*|aranha\w*|pombo\w*|infestacao)\b/, nome: 'Praga / animal peçonhento', peso: 60 },
  { re: /\b(lixo|entulho|esgoto|mato alto|terreno baldio|mau cheiro|vazamento|enchente|alagamento|acumulo de)\b/, nome: 'Lixo / esgoto / terreno', peso: 55 },
  { re: /\b(muitos|varios|criacao de|abandonad\w+|maus tratos|raiva)\b[^.;]*\b(animais|cachorr\w+|gat\w+|caes|galinh\w+|porc\w+|cavalo\w*)\b/, nome: 'Animais', peso: 45 },
];
/** Já resolvido: o APA foi, limparam, tiraram. */
const RESOLVIDO = /\b(resolvid\w+|resolveu|removeu|removido|retirou|retirado|limpou|limpo|recolheu|recolhido|tratad[oa]|ja foi o apa|apa foi)\b/;

/** Casas para o APA: o que foi escrito sobre dengue, criadouro, lixo, praga e animais, e casas fechadas ou vazias para conferir. */
export function listaParaApa(familias: Familia[], visitas: Visita[], casos: Caso[], hoje: string, ordemRuas: string[] = []): ItemEquipe[] {
  const mapa = new Map<string, ItemEquipe>();
  for (const f of familias) {
    if (f.situacaoCasa === 'demolida') continue;
    // Depois que o APA foi, só vale o que foi escrito depois (e a casa fechada/vazia só volta passados 30 dias).
    const foi = (f.relatosAnteriores ?? []).filter((r) => r.origem === ORIGEM_APA && r.data && r.data <= hoje).map((r) => r.data).sort().pop() ?? '';
    const recente = !!foi && diferencaDias(foi, hoje) <= 30;
    if (f.situacaoCasa === 'fechada' && !recente) juntar(mapa, f.id, f, undefined, 'Casa fechada: ver se tem criadouro ou se alguém voltou', 40);
    else if (f.situacaoCasa === 'vazia' && !recente) juntar(mapa, f.id, f, undefined, 'Casa vazia: conferir quintal e caixa d’água', 40);
    else if (f.situacaoCasa === 'construcao' && !recente) juntar(mapa, f.id, f, undefined, 'Em construção: conferir entulho e água parada', 35);
    // Também o que foi anotado sobre cada morador na VD (o texto da família sozinho deixa isso de fora).
    const dasPessoas = visitas
      .filter((v) => v.familiaId === f.id)
      .flatMap((v) => Object.values(v.anotacoes ?? {}).filter(Boolean).map((texto): TextoDaFamilia => ({ data: v.data, origem: `VD de ${dataCurta(v.data)}`, texto })));
    const textos: TextoDaFamilia[] = [...textosDaFamilia(f, visitas, casos), ...dasPessoas].filter((t) => t.data && t.data <= hoje && t.data > foi && diferencaDias(t.data, hoje) <= DIAS_AMBIENTAL && !t.encerrado && !t.lista && t.origem !== ORIGEM_APA);
    for (const t of textos.sort((a, b) => b.data.localeCompare(a.data))) {
      for (const fr of frases(t.texto)) {
        const baixo = semAcento(fr);
        if (RESOLVIDO.test(baixo)) continue;
        for (const r of AMBIENTAL) {
          const x = baixo.match(r.re);
          if (!x) continue;
          const antes = baixo.slice(0, x.index);
          if (NEGACAO.test(antes.slice(antes.lastIndexOf(',') + 1))) continue;
          if (r.exige && !r.exige.test(baixo)) continue;
          juntar(mapa, f.id, f, undefined, `${r.nome}: “${cortar(fr, 90)}” (${dataCurta(t.data)})`, r.peso);
          break;
        }
      }
    }
  }
  return ordenarPorRua([...mapa.values()], ordemRuas);
}

// ---------------------------------------------------------------- texto para mandar

/** Texto para mandar (WhatsApp da equipe). */
export function textoParaEquipe(quem: Quem, itens: ItemEquipe[], hoje: string, endereco: (f: Familia) => string, titulo?: string): string {
  const linhas = [titulo ?? `Para ${PARA_QUEM[quem]} (${dataCurta(hoje)}): ${itens.length} ${itens.length === 1 ? 'item' : 'itens'}`];
  let casa = '';
  for (const it of itens) {
    const end = endereco(it.familia);
    if (end !== casa) {
      linhas.push('', `${end}${it.familia.prontuario ? ` (pront. ${it.familia.prontuario})` : ''}`);
      casa = end;
    }
    linhas.push(`- ${it.morador ? `${it.morador.nome}: ` : ''}${it.motivos.map((m) => m.texto).join('; ')}`);
  }
  return linhas.join('\n');
}
