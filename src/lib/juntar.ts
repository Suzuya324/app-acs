// Juntar dois conjuntos de dados (ex.: celular + computador) sem apagar nada.
// - Famílias e VDs: entram as que só existem de um lado; se existem nos dois, fica a alteração
//   mais recente (atualizadoEm). Sem data nos dois: fica a deste aparelho (e conta como conflito).
// - Revisitas: feita ou cancelada num lado vale para os dois.
// - Histórico: junta tudo, sem repetir.
// - Ajustes: vale o mais recente (alteradaEm); sem data, ficam os deste aparelho.
// - VD pela metade: fica a deste aparelho.
import type { Dados } from './cofre';
import { aplicarLixeira, juntarLixeiras } from './lixeira';
import type { Prioritario } from './prioritarios';
import type { Alteracao, Caso, Config, Familia, Revisita, Visita } from './tipos';

export interface ResumoJuncao {
  familiasNovas: number;
  familiasAtualizadas: number;
  visitasNovas: number;
  visitasAtualizadas: number;
  revisitasNovas: number;
  revisitasAtualizadas: number;
  /** Itens iguais nos dois lados, mas sem data para saber qual é o mais novo (ficou o deste aparelho). */
  semData: number;
}

type ComData = { id: string; atualizadoEm?: string };

function juntarPorId<T extends ComData>(
  daqui: T[],
  dela: T[],
  semDataEscolhe: (aqui: T, la: T) => T = (aqui) => aqui,
): { lista: T[]; novos: number; atualizados: number; semData: number } {
  const porId = new Map(daqui.map((x) => [x.id, x]));
  let novos = 0;
  let atualizados = 0;
  let semData = 0;
  for (const la of dela) {
    const aqui = porId.get(la.id);
    if (!aqui) {
      porId.set(la.id, la);
      novos++;
      continue;
    }
    if (JSON.stringify(aqui) === JSON.stringify(la)) continue;
    if (aqui.atualizadoEm && la.atualizadoEm) {
      if (la.atualizadoEm > aqui.atualizadoEm) {
        porId.set(la.id, la);
        atualizados++;
      }
    } else if (la.atualizadoEm && !aqui.atualizadoEm) {
      porId.set(la.id, la);
      atualizados++;
    } else if (!la.atualizadoEm && !aqui.atualizadoEm) {
      const escolhido = semDataEscolhe(aqui, la);
      if (escolhido !== aqui) {
        porId.set(la.id, escolhido);
        atualizados++;
      } else semData++;
    }
  }
  return { lista: [...porId.values()], novos, atualizados, semData };
}

/** Sem data nos dois lados: a VD lançada no Fast vence a pendente. */
function escolherVisitaSemData(aqui: Visita, la: Visita): Visita {
  if (la.lancadaNoFast && !aqui.lancadaNoFast) return { ...aqui, lancadaNoFast: true };
  return aqui;
}

function juntarRevisitas(daqui: Revisita[], dela: Revisita[]) {
  const porId = new Map(daqui.map((r) => [r.id, r]));
  let novas = 0;
  let atualizadas = 0;
  for (const la of dela) {
    const aqui = porId.get(la.id);
    if (!aqui) {
      porId.set(la.id, la);
      novas++;
      continue;
    }
    const fechadaAqui = aqui.feitaEm || aqui.canceladaEm;
    const fechadaLa = la.feitaEm || la.canceladaEm;
    if (fechadaLa && !fechadaAqui) {
      porId.set(la.id, la);
      atualizadas++;
    }
  }
  return { lista: [...porId.values()], novas, atualizadas };
}

function juntarHistorico(daqui: Alteracao[], dela: Alteracao[]): Alteracao[] {
  const ids = new Set(daqui.map((h) => h.id));
  return [...daqui, ...dela.filter((h) => !ids.has(h.id))].sort((a, b) => a.quando.localeCompare(b.quando));
}

/** Ajustes: vale o mais recente; a data do último backup fica a mais nova dos dois. */
function juntarConfig(daqui: Config, dela: Config | undefined): Config {
  if (!dela) return daqui;
  const maisNova = (dela.alteradaEm ?? '') > (daqui.alteradaEm ?? '') ? dela : daqui;
  const ultimoBackup = [daqui.ultimoBackup ?? '', dela.ultimoBackup ?? ''].sort().at(-1) ?? '';
  // Última sincronização de cada aparelho: vale a mais recente de cada um, venha de qual lado vier.
  const aparelhos: Record<string, string> = { ...(daqui.aparelhos ?? {}) };
  for (const [nome, quando] of Object.entries(dela.aparelhos ?? {})) if (!aparelhos[nome] || quando > aparelhos[nome]) aparelhos[nome] = quando;
  return { ...maisNova, ultimoBackup, ...(Object.keys(aparelhos).length ? { aparelhos } : {}) };
}

export function juntarDados(daqui: Dados, dela: Dados): { dados: Dados; resumo: ResumoJuncao } {
  const f = juntarPorId<Familia>(daqui.familias, dela.familias);
  const v = juntarPorId<Visita>(daqui.visitas, dela.visitas, escolherVisitaSemData);
  const r = juntarRevisitas(daqui.revisitas ?? [], dela.revisitas ?? []);
  // VDs em ordem de data, mantendo a ordem de criação dentro do mesmo dia.
  const visitas = v.lista;
  const juntos: Dados = aplicarLixeira({
    config: juntarConfig(daqui.config, dela.config),
    familias: f.lista,
    visitas,
    historico: juntarHistorico(daqui.historico ?? [], dela.historico ?? []),
    rascunho: daqui.rascunho ?? null,
    revisitas: r.lista,
    lixeira: juntarLixeiras(daqui.lixeira ?? [], dela.lixeira ?? []),
    casos: juntarPorId<Caso>(daqui.casos ?? [], dela.casos ?? []).lista,
    prioritarios: juntarPorId<Prioritario & { atualizadoEm?: string }>(daqui.prioritarios ?? [], dela.prioritarios ?? []).lista,
  });
  return {
    dados: juntos,
    resumo: {
      familiasNovas: f.novos,
      familiasAtualizadas: f.atualizados,
      visitasNovas: v.novos,
      visitasAtualizadas: v.atualizados,
      revisitasNovas: r.novas,
      revisitasAtualizadas: r.atualizadas,
      semData: f.semData + v.semData,
    },
  };
}

/** "3 VDs novas, 1 VD atualizada, 2 famílias novas" (ou "Nada novo"). */
export function textoResumoJuncao(r: ResumoJuncao): string {
  const p = (n: number, um: string, varios: string) => (n ? `${n} ${n === 1 ? um : varios}` : '');
  const partes = [
    p(r.visitasNovas, 'VD nova', 'VDs novas'),
    p(r.visitasAtualizadas, 'VD atualizada', 'VDs atualizadas'),
    p(r.familiasNovas, 'família nova', 'famílias novas'),
    p(r.familiasAtualizadas, 'família atualizada', 'famílias atualizadas'),
    p(r.revisitasNovas, 'revisita nova', 'revisitas novas'),
    p(r.revisitasAtualizadas, 'revisita resolvida', 'revisitas resolvidas'),
  ].filter(Boolean);
  return partes.length ? partes.join(', ') : 'Nada novo: os dois já estavam iguais';
}
