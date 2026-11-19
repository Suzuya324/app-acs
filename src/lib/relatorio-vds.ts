// Relatório das minhas VDs (com nomes): o que foi feito, dia a dia, para conferir e comprovar quando o sistema
// oficial perde registros. Funções "puras"; tudo no aparelho. O relatório tem dados de pacientes: só para o ACS.
import { contaParaMeta } from './desfecho';
import type { Desfecho, Familia, Morador, SinaisVitais, Visita } from './tipos';

export interface LinhaVD {
  visita: Visita;
  familia?: Familia;
  data: string;
  /** "14:32" (hora em que a VD foi registrada no app) ou vazio (VD trazida de fora). */
  hora: string;
  endereco: string;
  prontuario: string;
  responsavel: string;
  presentes: string[];
  ausentes: string[];
  desfecho: string;
  conta: boolean;
  motivo: string;
  compartilhada: string;
  sinais: string;
  relato: string;
  lancada: boolean;
  /** Quando foi marcada como lançada no Fast (aaaa-mm-dd hh:mm) ou vazio. */
  lancadaEm: string;
  origem: 'App' | 'Sistema de Visitas';
}

export interface ResumoVDs {
  total: number;
  /** Famílias diferentes com alguma VD. */
  familias: number;
  /** Famílias diferentes com VD que conta para a meta. */
  familiasQueContam: number;
  /** Pessoas diferentes marcadas como presentes. */
  pessoas: number;
  porDesfecho: Record<Desfecho, number>;
  lancadas: number;
  faltaLancar: number;
  dias: { data: string; vds: number; familias: number }[];
}

const pad = (n: number) => String(n).padStart(2, '0');
const horaLocal = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const dataHoraLocal = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Quando a VD foi registrada: o campo novo ou a data que vem no próprio código da VD (VDs antigas do app). */
export function registradaEm(v: Visita): string {
  if (v.criadaEm) return v.criadaEm;
  const m = v.id.match(/^v([0-9a-z]{8})/);
  if (!m) return '';
  const t = parseInt(m[1], 36);
  return t > Date.UTC(2024, 0, 1) && t < Date.UTC(2100, 0, 1) ? new Date(t).toISOString() : '';
}

function textoSinais(s: Record<string, SinaisVitais>, moradores: Morador[]): string {
  const partes: string[] = [];
  for (const [id, x] of Object.entries(s ?? {})) {
    const itens = [x.pa && `P.A. ${x.pa}`, x.glicemia && `glicemia ${x.glicemia}`, x.temperatura && `temp. ${x.temperatura}`, x.peso && `peso ${x.peso}`, x.altura && `altura ${x.altura}`].filter(Boolean);
    if (!itens.length) continue;
    const nome = moradores.find((m) => m.id === id)?.nome.split(' ')[0] ?? '';
    partes.push(`${nome ? `${nome}: ` : ''}${itens.join(', ')}`);
  }
  return partes.join('; ');
}

/** As VDs do período, em ordem (dia e hora). */
export function linhasDoRelatorio(visitas: Visita[], familias: Familia[], de: string, ate: string, nomeDesfecho: (d: Desfecho) => string): LinhaVD[] {
  const porId = new Map(familias.map((f) => [f.id, f]));
  return visitas
    .filter((v) => v.data >= de && v.data <= ate)
    .map((v) => ({ v, reg: registradaEm(v) }))
    .sort((a, b) => a.v.data.localeCompare(b.v.data) || (a.reg || '9').localeCompare(b.reg || '9'))
    .map(({ v, reg }) => {
      const f = porId.get(v.familiaId);
      const moradores = f?.moradores ?? [];
      const presentes = moradores.filter((m) => v.presentes.includes(m.id));
      const semNinguem = !presentes.length || v.desfecho === 'ausencia_completa' || v.desfecho === 'recusa';
      const ausentes = semNinguem ? [] : moradores.filter((m) => !v.presentes.includes(m.id) && (m.situacao === 'mora' || (m.situacaoDesde && m.situacaoDesde > v.data)));
      const sv = (v.observacao ?? '').includes('Sistema de Visitas');
      return {
        visita: v,
        familia: f,
        data: v.data,
        // Só mostra a hora se a VD foi registrada no mesmo dia dela (registro feito depois não é a hora da visita).
        hora: reg && reg.slice(0, 10) <= v.data && !sv ? horaLocal(reg) : '',
        endereco: f ? `${f.rua}, ${f.numero}${f.complemento ? ` – ${f.complemento}` : ''}` : '(casa apagada)',
        prontuario: f?.prontuario ?? '',
        responsavel: moradores.find((m) => m.id === f?.responsavelId)?.nome ?? '',
        presentes: presentes.map((m) => m.nome),
        ausentes: ausentes.map((m) => m.nome),
        desfecho: nomeDesfecho(v.desfecho),
        conta: contaParaMeta(v.desfecho),
        motivo: v.motivo,
        compartilhada: v.compartilhadaCom,
        sinais: textoSinais(v.sinais, moradores),
        relato: (v.relato || v.observacao || '').trim(),
        lancada: v.lancadaNoFast,
        lancadaEm: v.lancadaEm ? dataHoraLocal(v.lancadaEm) : '',
        origem: sv ? 'Sistema de Visitas' : 'App',
      } satisfies LinhaVD;
    });
}

export function resumoDoRelatorio(linhas: LinhaVD[]): ResumoVDs {
  const porDesfecho: Record<Desfecho, number> = { realizada: 0, ausente_realizada: 0, ausencia_completa: 0, recusa: 0 };
  const familias = new Set<string>();
  const contam = new Set<string>();
  const pessoas = new Set<string>();
  const dias = new Map<string, { vds: number; familias: Set<string> }>();
  for (const l of linhas) {
    const v = l.visita;
    porDesfecho[v.desfecho]++;
    familias.add(v.familiaId);
    if (l.conta) contam.add(v.familiaId);
    for (const id of v.presentes) pessoas.add(id);
    const d = dias.get(l.data) ?? { vds: 0, familias: new Set<string>() };
    d.vds++;
    d.familias.add(v.familiaId);
    dias.set(l.data, d);
  }
  return {
    total: linhas.length,
    familias: familias.size,
    familiasQueContam: contam.size,
    pessoas: pessoas.size,
    porDesfecho,
    lancadas: linhas.filter((l) => l.lancada).length,
    faltaLancar: linhas.filter((l) => !l.lancada).length,
    dias: [...dias.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([data, d]) => ({ data, vds: d.vds, familias: d.familias.size })),
  };
}

const br = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
export const diaDaSemana = (iso: string) => SEMANA[new Date(`${iso}T12:00:00`).getDay()];

/** O relatório em texto (para copiar, guardar ou mandar para si mesmo). */
export function textoDoRelatorio(linhas: LinhaVD[], rotulo: string, comRelato = true): string {
  const r = resumoDoRelatorio(linhas);
  const out = [
    `MINHAS VDs – ${rotulo}`,
    `${r.total} VDs · ${r.familias} famílias · ${r.familiasQueContam} famílias que contam para a meta · ${r.pessoas} pessoas atendidas`,
    `Visita realizada: ${r.porDesfecho.realizada} · Ausente realizada: ${r.porDesfecho.ausente_realizada} · Ausência completa: ${r.porDesfecho.ausencia_completa} · Recusa: ${r.porDesfecho.recusa}`,
    `Lançadas no Fast: ${r.lancadas} · Falta lançar: ${r.faltaLancar}`,
  ];
  let dia = '';
  let n = 0;
  for (const l of linhas) {
    if (l.data !== dia) {
      dia = l.data;
      n = 0;
      const d = r.dias.find((x) => x.data === dia)!;
      out.push('', `=== ${br(dia)} (${diaDaSemana(dia)}) – ${d.vds} ${d.vds === 1 ? 'VD' : 'VDs'} ===`);
    }
    n++;
    out.push(`${n}. ${l.hora ? `${l.hora} · ` : ''}${l.endereco}${l.prontuario ? ` · pront. ${l.prontuario}` : ''}`);
    out.push(`   ${l.desfecho}${l.conta ? '' : ' (não conta)'} · motivo: ${l.motivo}${l.compartilhada ? ` · com ${l.compartilhada}` : ''}`);
    if (l.presentes.length) out.push(`   Presentes: ${l.presentes.join(', ')}`);
    else if (l.responsavel) out.push(`   Responsável: ${l.responsavel}`);
    if (l.ausentes.length) out.push(`   Ausentes: ${l.ausentes.join(', ')}`);
    if (l.sinais) out.push(`   Sinais: ${l.sinais}`);
    if (comRelato && l.relato) out.push(`   Relato: ${l.relato.replace(/\s+/g, ' ')}`);
    out.push(`   Fast: ${l.lancada ? `lançada${l.lancadaEm ? ` em ${l.lancadaEm}` : ''}` : 'FALTA LANÇAR'}${l.origem !== 'App' ? ` · veio do ${l.origem}` : ''}`);
  }
  return out.join('\n');
}
