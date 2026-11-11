// Não perder ninguém: lista "a confirmar", gestantes (DPP) e crianças (caderneta), mudanças do cadastro
// para passar ao SBCD. Funções "puras"; tudo no aparelho.
import { acompanhamentoDaPessoa, type Contexto, type Pendencia } from './acompanhamento';
import { frases, semAcento, textosDaPessoa } from './anotacoes';
import { diferencaDias, idade, somarDias } from './datas';
import type { Prioritario } from './prioritarios';
import type { Alteracao, Familia, Morador, Visita } from './tipos';

// ---------------------------------------------------------------- a confirmar

export interface AConfirmar {
  obitos: { p: Prioritario; familia?: Familia; morador?: Morador }[];
  gestantes: { p: Prioritario; familia?: Familia; morador?: Morador }[];
  anotacoes: { familia: Familia; morador: Morador; pendencia: Pendencia }[];
}

export function aConfirmar(familias: Familia[], ctx: Contexto): AConfirmar {
  const fam = new Map(familias.map((f) => [f.id, f]));
  const quem = (p: Prioritario) => {
    const familia = p.familiaId ? fam.get(p.familiaId) : undefined;
    return { p, familia, morador: familia?.moradores.find((m) => m.id === p.moradorId) };
  };
  const vivos = (x: { morador?: Morador }) => !x.morador || x.morador.situacao === 'mora';
  const r: AConfirmar = {
    obitos: ctx.prioritarios.filter((p) => p.obito).map(quem).filter(vivos),
    gestantes: ctx.prioritarios.filter((p) => p.etiquetas.includes('GESTANTE?')).map(quem).filter(vivos),
    anotacoes: [],
  };
  for (const f of familias) {
    if (f.situacaoCasa !== 'habitada') continue;
    for (const m of f.moradores) {
      if (m.situacao !== 'mora') continue;
      for (const p of acompanhamentoDaPessoa(m, f, ctx).pendencias) if (p.tipo === 'confirmar') r.anotacoes.push({ familia: f, morador: m, pendencia: p });
    }
  }
  return r;
}

// ---------------------------------------------------------------- gestantes

export interface Gestante {
  familia: Familia;
  morador: Morador;
  /** DPP (anotada ou estimada pelo que foi escrito), ou vazio. */
  dpp: string;
  /** De onde veio a DPP. */
  deOnde: 'anotada' | 'estimada' | '';
  /** Semanas de gestação hoje (pela DPP). */
  semanas: number | null;
  alerta: string;
}


/** DPP pelo que foi escrito: "DPP 20/03", "DPP 20/03/2027", "28 semanas" (na data do texto). */
export function dppDoTexto(textos: { data: string; texto: string }[]): string {
  for (const t of [...textos].filter((x) => x.data).sort((a, b) => b.data.localeCompare(a.data))) {
    for (const fr of frases(t.texto)) {
      const b = semAcento(fr);
      const d = b.match(/\b(?:dpp|data provavel do parto|previsao (?:do )?parto|ganhar (?:o bebe )?(?:em|dia))\D{0,10}(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
      if (d) {
        const ano = d[3] ? Number(d[3].length === 2 ? `20${d[3]}` : d[3]) : Number(t.data.slice(0, 4));
        let iso = `${ano}-${d[2].padStart(2, '0')}-${d[1].padStart(2, '0')}`;
        if (!d[3] && iso < t.data) iso = `${ano + 1}${iso.slice(4)}`;
        return iso;
      }
      const s = b.match(/\b(\d{1,2})\s*(semanas|sem)\b/);
      if (s && /\b(gestac\w*|gravid\w*|gestante|semanas de|ig)\b/.test(b) && Number(s[1]) <= 42) return somarDias(t.data, (40 - Number(s[1])) * 7);
      const mes = b.match(/\b(\d)\s*(meses|mes)\b/);
      if (mes && /\b(gravid\w*|gestante|gestac\w*)\b/.test(b) && Number(mes[1]) <= 9) return somarDias(t.data, Math.round((9 - Number(mes[1])) * 30.4));
    }
  }
  return '';
}

export function gestantes(familias: Familia[], visitas: Visita[], hoje: string): Gestante[] {
  const lista: Gestante[] = [];
  for (const f of familias) {
    if (f.situacaoCasa !== 'habitada') continue;
    for (const m of f.moradores) {
      if (m.situacao !== 'mora' || !m.grupos.includes('gestante')) continue;
      const est = m.dpp ? '' : dppDoTexto(textosDaPessoa(m, f, visitas));
      const dpp = m.dpp || est;
      const semanas = dpp ? 40 - Math.ceil(diferencaDias(hoje, dpp) / 7) : null;
      let alerta = '';
      if (!dpp) alerta = 'Sem DPP: anotar a data provável do parto';
      else if (dpp < hoje) alerta = `Passou da DPP (${diferencaDias(dpp, hoje)} dias): já ganhou? Marcar puérpera`;
      else if (diferencaDias(hoje, dpp) <= 21) alerta = `Perto de ganhar: faltam ${diferencaDias(hoje, dpp)} dias`;
      lista.push({ familia: f, morador: m, dpp, deOnde: m.dpp ? 'anotada' : est ? 'estimada' : '', semanas, alerta });
    }
  }
  return lista.sort((a, b) => (a.dpp || '9').localeCompare(b.dpp || '9'));
}

// ---------------------------------------------------------------- crianças

/** Idades (em meses) com vacina ou consulta de puericultura no calendário. */
export const MARCOS: { meses: number; texto: string }[] = [
  { meses: 0, texto: 'ao nascer: BCG, hepatite B e teste do pezinho' },
  { meses: 2, texto: '2 meses: penta, VIP, pneumo e rotavírus' },
  { meses: 3, texto: '3 meses: meningo C' },
  { meses: 4, texto: '4 meses: penta, VIP, pneumo e rotavírus' },
  { meses: 5, texto: '5 meses: meningo C' },
  { meses: 6, texto: '6 meses: penta e VIP' },
  { meses: 9, texto: '9 meses: febre amarela' },
  { meses: 12, texto: '12 meses: tríplice viral, pneumo e meningo (reforços)' },
  { meses: 15, texto: '15 meses: DTP, VOP, hepatite A e tetra viral' },
  { meses: 48, texto: '4 anos: DTP, VOP, varicela e febre amarela' },
];

/** Dia em que a criança completa X meses. */
export function diaDosMeses(nascimento: string, meses: number): string {
  const [a, m, d] = nascimento.split('-').map(Number);
  const total = m - 1 + meses;
  const ano = a + Math.floor(total / 12);
  const mes = (total % 12) + 1;
  const ultimo = new Date(ano, mes, 0).getDate();
  return `${ano}-${String(mes).padStart(2, '0')}-${String(Math.min(d, ultimo)).padStart(2, '0')}`;
}

export interface Crianca {
  familia: Familia;
  morador: Morador;
  /** Marco que já chegou e ainda não foi conferido (perguntar a caderneta). */
  conferir?: { texto: string; dia: string };
  /** Próximo marco. */
  proximo?: { texto: string; dia: string };
}

/** Crianças até 5 anos: o que conferir na caderneta e o próximo marco. */
export function criancas(familias: Familia[], hoje: string): Crianca[] {
  const lista: Crianca[] = [];
  for (const f of familias) {
    if (f.situacaoCasa !== 'habitada') continue;
    for (const m of f.moradores) {
      if (m.situacao !== 'mora' || !m.nascimento) continue;
      const anos = idade(m.nascimento, hoje);
      if (anos === null || anos >= 5) continue;
      const marcos = MARCOS.map((x) => ({ texto: x.texto, dia: diaDosMeses(m.nascimento, x.meses) }));
      const passados = marcos.filter((x) => x.dia <= hoje && x.dia > (m.cadernetaEm ?? '') && diferencaDias(x.dia, hoje) <= 120);
      lista.push({ familia: f, morador: m, conferir: passados[passados.length - 1], proximo: marcos.find((x) => x.dia > hoje) });
    }
  }
  return lista.sort((a, b) => Number(!a.conferir) - Number(!b.conferir) || (a.proximo?.dia ?? '9').localeCompare(b.proximo?.dia ?? '9'));
}

// ---------------------------------------------------------------- mudanças para o SBCD

/** O que no histórico é mudança de cadastro (o que precisa ser passado para o SBCD). */
const CADASTRO = /^(Família cadastrada|Rua:|Número:|Complemento:|Prontuário|Situação da casa|Responsável|Nome:|Casa nova|Pessoa nova|Família excluída|Família tirada|Excluído \(foi para a lixeira\)|Endereço )|: (morador incluído|sexo |nascimento |Mora aqui →|Mudou-se →|Não pertence à área →|Faleceu →|Recusa →)|mudou para |veio de /;

export interface MudancaSbcd {
  familia?: Familia;
  quando: string;
  texto: string;
}

export function mudancasParaSbcd(historico: Alteracao[], familias: Familia[], desde: string): MudancaSbcd[] {
  const fam = new Map(familias.map((f) => [f.id, f]));
  return historico
    .filter((h) => h.familiaId && h.quando > desde && CADASTRO.test(h.texto) && !h.texto.includes('(cadastro do SBCD'))
    .map((h) => ({ familia: fam.get(h.familiaId), quando: h.quando, texto: h.texto.replace(/ \(pela anotação da VD\)| \(pelas VDs já feitas\)/, '') }))
    .sort((a, b) => a.quando.localeCompare(b.quando));
}

/** Texto para conferir no SBCD (uma linha por casa). */
export function textoMudancas(lista: MudancaSbcd[], endereco: (f: Familia) => string): string {
  const porCasa = new Map<string, { f?: Familia; linhas: string[] }>();
  for (const m of lista) {
    const k = m.familia?.id ?? '?';
    const g = porCasa.get(k) ?? { f: m.familia, linhas: [] };
    g.linhas.push(`- ${m.quando.slice(8, 10)}/${m.quando.slice(5, 7)}: ${m.texto}`);
    porCasa.set(k, g);
  }
  const out = [`Mudanças para atualizar no SBCD (${lista.length})`];
  for (const g of porCasa.values()) out.push('', `${g.f ? endereco(g.f) : '(casa excluída)'}${g.f?.prontuario ? ` (pront. ${g.f.prontuario})` : ''}`, ...g.linhas);
  return out.join('\n');
}
