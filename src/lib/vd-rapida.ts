// "VD sem novidade": monta a visita inteira (desfecho, relato, orientações) com poucos toques.
// Função "pura" (fácil de testar); quem salva é a tela. Tudo no aparelho.
import { diferencaDias } from './datas';
import { sugerirDesfecho } from './desfecho';
import { gerarRelato, juntarNomes, separarNomes } from './relato';
import { TEMAS_ORIENTACAO } from './rotulos';
import type { Caso, Desfecho, Familia, Revisita, Visita } from './tipos';

/** O que entra no relato quando o ACS não escreve nada (ele vê e pode mudar antes de salvar). */
export const OBSERVACAO_PADRAO = 'Sem queixas, família bem.';

/** Quantas coisas em aberto a casa tem (revisitas marcadas e casos abertos): se tem, a VD completa é melhor. */
export function emAbertoNaCasa(familiaId: string, revisitas: Revisita[], casos: Caso[]): { revisitas: number; casos: number } {
  return {
    revisitas: revisitas.filter((r) => r.familiaId === familiaId && !r.feitaEm && !r.canceladaEm).length,
    casos: casos.filter((c) => c.familiaId === familiaId && !c.resolvidoEm).length,
  };
}

/** Orientações da última VD da casa (só os temas conhecidos), para já vir marcado. */
export function temasDaUltimaVD(familiaId: string, visitas: Visita[], ate: string): string[] {
  const u = visitas.filter((v) => v.familiaId === familiaId && v.data <= ate).sort((a, b) => b.data.localeCompare(a.data))[0];
  return u ? separarNomes(u.orientacoes).filter((t) => TEMAS_ORIENTACAO.includes(t)) : [];
}

export interface EntradaSemNovidade {
  familia: Familia;
  /** Ids dos moradores que estavam. */
  presentes: string[];
  /** Conversou com a família (quem atendeu respondeu por todos). */
  conversou: boolean;
  data: string;
  motivo: string;
  motivoPadrao: string;
  compartilhadaCom: string;
  temas: string[];
  observacao: string;
  visitas: Visita[];
  nomeCompleto: boolean;
}

export interface VisitaSemNovidade {
  visita: Omit<Visita, 'id'>;
  desfecho: Desfecho;
  relato: string;
}

/** A VD pronta para salvar, ou null se ninguém atendeu (aí é "ninguém em casa", outro botão). */
export function montarVisitaSemNovidade(e: EntradaSemNovidade): VisitaSemNovidade | null {
  const ativos = e.familia.moradores.filter((m) => m.situacao === 'mora');
  const ids = e.presentes.filter((id) => ativos.some((m) => m.id === id));
  const desfecho = sugerirDesfecho({ totalMoradores: ativos.length, presentes: ids.length, conversouComFamilia: e.conversou, recusou: false });
  if (desfecho !== 'realizada' && desfecho !== 'ausente_realizada') return null;
  const orientacoes = juntarNomes(e.temas);
  const anterior = e.visitas
    .filter((v) => v.familiaId === e.familia.id && v.data < e.data && diferencaDias(v.data, e.data) <= 30)
    .sort((a, b) => b.data.localeCompare(a.data))[0];
  const relato = gerarRelato({
    desfecho,
    presentes: ativos.filter((m) => ids.includes(m.id)),
    ausentes: ativos.filter((m) => !ids.includes(m.id)),
    conversouComFamilia: e.conversou,
    sinais: {},
    orientacoes,
    compartilhadaCom: e.compartilhadaCom.trim(),
    motivo: e.motivo === e.motivoPadrao ? '' : e.motivo,
    observacao: e.observacao.trim(),
    anterior: anterior ? { data: anterior.data, desfecho: anterior.desfecho } : undefined,
    nomeCompleto: e.nomeCompleto,
    contador: e.visitas.length,
  });
  return {
    desfecho,
    relato,
    visita: {
      familiaId: e.familia.id,
      data: e.data,
      presentes: ids,
      conversouComFamilia: e.conversou,
      desfecho,
      motivo: e.motivo,
      compartilhadaCom: e.compartilhadaCom.trim(),
      sinais: {},
      orientacoes,
      relato,
      lancadaNoFast: false,
      revisitasFeitas: [],
      observacao: e.observacao.trim(),
    },
  };
}
