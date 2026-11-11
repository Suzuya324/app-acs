// O dia na rua: roteiro do dia (quem visitar hoje, e por quê, em ordem de rua), agenda das datas marcadas
// (consultas, cirurgias, exames citados nas VDs; revisitas) e quem está sumido. Funções "puras"; tudo no aparelho.
import { acompanhamentoDaPessoa, NOMES_PENDENCIA, type Contexto, type TipoPendencia } from './acompanhamento';
import { dataCurta } from './anotacoes';
import { diasParado, DIAS_PARADO } from './casos-auto';
import { contaParaMeta } from './desfecho';
import { diferencaDias, somarDias } from './datas';
import { nivelDaFamilia, proximaVisita, ultimaVisita } from './nivel';
import { agruparPorRua } from './roteiro';
import type { Caso, Familia, Morador, Revisita, Visita } from './tipos';

// ---------------------------------------------------------------- agenda

export interface Compromisso {
  /** aaaa-mm-dd */
  data: string;
  familia: Familia;
  morador?: Morador;
  /** "Consulta", "Cirurgia", "Revisita"… */
  tipo: string;
  texto: string;
  /** Onde foi escrito ("VD de 13/10"). */
  origem: string;
  /** Chave para esconder (pendência resolvida) — vazio na revisita. */
  chaves: string[];
}

/** Datas marcadas: o que as VDs dizem (consulta dia 24/11…) e as revisitas marcadas no app. */
export function agenda(familias: Familia[], revisitas: Revisita[], ctx: Contexto): Compromisso[] {
  const lista: Compromisso[] = [];
  for (const f of familias) {
    if (f.situacaoCasa !== 'habitada') continue;
    for (const m of f.moradores) {
      if (m.situacao !== 'mora') continue;
      const a = acompanhamentoDaPessoa(m, f, ctx);
      for (const p of a.pendencias) {
        if (!p.quando) continue;
        lista.push({ data: p.quando, familia: f, morador: m, tipo: NOMES_PENDENCIA[p.tipo as TipoPendencia], texto: p.frase, origem: `${p.origem}`, chaves: p.chaves });
      }
    }
  }
  const porId = new Map(familias.map((f) => [f.id, f]));
  for (const r of revisitas) {
    const f = porId.get(r.familiaId);
    if (!f || r.feitaEm || r.canceladaEm) continue;
    lista.push({ data: r.ate, familia: f, tipo: 'Revisita', texto: r.motivo, origem: 'Revisita marcada', chaves: [] });
  }
  return lista.sort((a, b) => a.data.localeCompare(b.data));
}

export type Quando = 'passou' | 'hoje' | 'amanha' | 'semana' | 'depois';
export function quandoE(data: string, hoje: string): Quando {
  if (data < hoje) return 'passou';
  if (data === hoje) return 'hoje';
  if (data === somarDias(hoje, 1)) return 'amanha';
  return diferencaDias(hoje, data) <= 7 ? 'semana' : 'depois';
}
export const NOMES_QUANDO: Record<Quando, string> = {
  passou: 'Já passou: perguntar como foi',
  hoje: 'Hoje',
  amanha: 'Amanhã',
  semana: 'Nos próximos 7 dias',
  depois: 'Mais para frente',
};

/** Lembretes para o Início: o que é amanhã/hoje e o que passou há até 3 dias (para perguntar como foi). */
export function lembretes(itens: Compromisso[], hoje: string): Compromisso[] {
  return itens.filter((c) => (c.data >= hoje && c.data <= somarDias(hoje, 1)) || (c.data < hoje && diferencaDias(c.data, hoje) <= 3));
}

// ---------------------------------------------------------------- sumidos

export interface Sumido {
  familia: Familia;
  /** Última VD (no app ou fora dele), ou vazio se nunca. */
  ultima: string;
  dias: number | null;
}

/** Casas habitadas sem VD que conta há X dias (ou nunca), a mais esquecida primeiro. */
export function sumidos(familias: Familia[], visitas: Visita[], hoje: string, dias = 60): Sumido[] {
  const lista: Sumido[] = [];
  for (const f of familias) {
    if (f.situacaoCasa !== 'habitada' || !f.moradores.some((m) => m.situacao === 'mora')) continue;
    const u = ultimaVisita(f, visitas, hoje);
    const d = u ? diferencaDias(u, hoje) : null;
    if (d === null || d >= dias) lista.push({ familia: f, ultima: u, dias: d });
  }
  return lista.sort((a, b) => (b.dias ?? 99999) - (a.dias ?? 99999));
}

// ---------------------------------------------------------------- roteiro do dia

export interface MotivoDia {
  texto: string;
  peso: number;
}

export interface CasaDoDia {
  familia: Familia;
  motivos: MotivoDia[];
  peso: number;
}

/** Por que cada casa entra no roteiro de hoje (e quanto pesa). Casas já visitadas hoje ficam de fora. */
export function roteiroDoDia(
  familias: Familia[],
  revisitas: Revisita[],
  ctx: Contexto & { casos: Caso[] },
  metaFaltando: Set<string> = new Set(),
  /** A agenda já calculada (para não ler tudo de novo). */
  compromissos?: Compromisso[],
): CasaDoDia[] {
  const { hoje, visitas, casos, prioritarios } = ctx;
  const visitadaHoje = new Set(visitas.filter((v) => v.data === hoje && contaParaMeta(v.desfecho)).map((v) => v.familiaId));
  const motivos = new Map<string, MotivoDia[]>();
  const add = (id: string, texto: string, peso: number) => {
    if (visitadaHoje.has(id)) return;
    const l = motivos.get(id) ?? [];
    if (!l.some((x) => x.texto === texto)) l.push({ texto, peso });
    motivos.set(id, l);
  };
  const casosAbertos = casos.filter((c) => !c.resolvidoEm);
  for (const f of familias) {
    if (f.situacaoCasa !== 'habitada' || !f.moradores.some((m) => m.situacao === 'mora')) continue;
    // Nível A/B vencido.
    const { nivel, motivo } = nivelDaFamilia(f, hoje, prioritarios, casosAbertos);
    if (nivel !== 'C') {
      const ate = proximaVisita(f, visitas, hoje, prioritarios, casosAbertos);
      if (ate && ate <= hoje) {
        const u = ultimaVisita(f, visitas, hoje);
        add(f.id, `Nível ${nivel} vencido${u ? ` (última VD ${dataCurta(u)})` : ' (sem VD)'}${motivo ? ` – ${motivo}` : ''}`, nivel === 'A' ? 80 : 50);
      }
    }
    // Sumido há 90 dias ou mais.
    const u = ultimaVisita(f, visitas, hoje);
    if (!u || diferencaDias(u, hoje) >= 90) add(f.id, u ? `Sem VD há ${diferencaDias(u, hoje)} dias` : 'Nunca visitada no app', 30);
    if (metaFaltando.has(f.id)) add(f.id, 'Falta para a meta do mês', 10);
  }
  for (const c of casosAbertos) {
    if (c.categoria === 'urgente') add(c.familiaId, `Caso urgente: ${c.titulo.split(',')[0]}`, 90);
    else if (diasParado(c, hoje) >= DIAS_PARADO) add(c.familiaId, `Caso parado: ${c.titulo.split(',')[0]}`, 40);
  }
  for (const r of revisitas) {
    if (r.feitaEm || r.canceladaEm || r.ate > hoje) continue;
    add(r.familiaId, `Revisita: ${r.motivo}`, 60);
  }
  // Datas marcadas que acabaram de passar (perguntar como foi) ou são amanhã (lembrar).
  for (const c of lembretes((compromissos ?? agenda(familias, [], ctx)).filter((x) => x.tipo !== 'Revisita'), hoje)) {
    const quem = c.morador?.nome.split(' ')[0] ?? '';
    add(c.familia.id, c.data < hoje ? `${quem}: ${c.tipo.toLowerCase()} dia ${dataCurta(c.data)} – perguntar como foi` : `${quem}: ${c.tipo.toLowerCase()} ${c.data === hoje ? 'hoje' : 'amanhã'} – lembrar`, 55);
  }
  const porId = new Map(familias.map((f) => [f.id, f]));
  const casas: CasaDoDia[] = [];
  for (const [id, l] of motivos) {
    const f = porId.get(id);
    if (!f) continue;
    l.sort((a, b) => b.peso - a.peso);
    casas.push({ familia: f, motivos: l, peso: l[0].peso });
  }
  return casas;
}

/** As N casas mais importantes do roteiro (o resto fica para os próximos dias). 0 = todas. */
export function maisImportantes(casas: CasaDoDia[], n: number): CasaDoDia[] {
  const ordem = [...casas].sort((a, b) => b.peso - a.peso || b.motivos.length - a.motivos.length);
  return n > 0 ? ordem.slice(0, n) : ordem;
}

/** O roteiro em ordem de rua (e de número), para andar menos. */
export function emOrdemDeRua(casas: CasaDoDia[], ordemRuas: string[]): { rua: string; casas: CasaDoDia[] }[] {
  const porId = new Map(casas.map((c) => [c.familia.id, c]));
  return agruparPorRua(casas.map((c) => c.familia), ordemRuas).map((g) => ({ rua: g.rua, casas: g.familias.map((f) => porId.get(f.id)!) }));
}
