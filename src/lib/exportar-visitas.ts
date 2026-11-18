// Exportar as VDs feitas (e quem foi ou não visitado) em planilha CSV, para o próprio ACS conferir
// ou pedir ajuda a um assistente. O arquivo sai sem criptografia: quem o tiver lê tudo.
import { contaParaMeta } from './desfecho';
import { diferencaDias } from './datas';
import { ultimaVisita } from './nivel';
import { NOMES_SITUACAO_CASA } from './rotulos';
import type { Desfecho, Familia, Morador, Visita } from './tipos';

export interface OpcoesExportar {
  /** aaaa-mm-dd; vazio = desde o começo. */
  de: string;
  /** aaaa-mm-dd; vazio = até hoje. */
  ate: string;
  /** Com os nomes completos (senão, só as iniciais). */
  nomes: boolean;
  /** Com o texto do relato / o que foi escrito. */
  relato: boolean;
  nomeDesfecho: (d: Desfecho) => string;
}

const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

/** "Maria da Silva Souza" → "M. S. S." (sem "da", "de"…). */
export function iniciais(nome: string): string {
  return nome
    .split(/\s+/)
    .filter((p) => p && !/^(d[aeo]s?|e)$/i.test(p))
    .map((p) => `${p[0].toUpperCase()}.`)
    .join(' ');
}

/** Um campo de CSV com ";" (entre aspas quando precisa). */
export function campo(v: string | number): string {
  const s = String(v ?? '').replace(/\r?\n/g, ' ').trim();
  return /[;"]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const linha = (vs: (string | number)[]) => vs.map(campo).join(';');
const br = (iso: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '');
const dentro = (d: string, o: Pick<OpcoesExportar, 'de' | 'ate'>) => (!o.de || d >= o.de) && (!o.ate || d <= o.ate);
const BOM = '﻿';

function ordemCasa(a: Familia, b: Familia): number {
  const num = (n: string) => Number(n.match(/^\d+/)?.[0] ?? 99999);
  return a.rua.localeCompare(b.rua, 'pt-BR') || num(a.numero) - num(b.numero) || a.complemento.localeCompare(b.complemento, 'pt-BR', { numeric: true });
}

/** As VDs do período: uma linha por VD, da mais antiga para a mais nova. */
export function csvVisitas(visitas: Visita[], familias: Familia[], o: OpcoesExportar): string {
  const porId = new Map(familias.map((f) => [f.id, f]));
  const nome = (m: Morador) => (o.nomes ? m.nome : iniciais(m.nome));
  const cab = ['Data', 'Dia', 'Rua', 'Numero', 'Complemento', 'Prontuario', 'Responsavel', 'Presentes', 'Ausentes', 'Desfecho', 'Conta para a meta', 'Motivo', 'Compartilhada com', 'Lancada no Fast', 'Origem'];
  if (o.relato) cab.push('Relato');
  const linhas = [linha(cab)];
  const lista = visitas.filter((v) => dentro(v.data, o)).sort((a, b) => a.data.localeCompare(b.data) || a.familiaId.localeCompare(b.familiaId));
  for (const v of lista) {
    const f = porId.get(v.familiaId);
    const moradores = f?.moradores ?? [];
    const resp = moradores.find((m) => m.id === f?.responsavelId);
    const presentes = moradores.filter((m) => v.presentes.includes(m.id));
    // Ausentes: quem morava na casa e não estava (quem já saiu antes da VD não conta).
    const ausentes = moradores.filter((m) => !v.presentes.includes(m.id) && (m.situacao === 'mora' || (m.situacaoDesde && m.situacaoDesde > v.data)));
    const sv = (v.observacao ?? '').includes('Sistema de Visitas');
    const cols: (string | number)[] = [
      br(v.data),
      SEMANA[new Date(`${v.data}T12:00:00`).getDay()],
      f?.rua ?? '(casa apagada)',
      f?.numero ?? '',
      f?.complemento ?? '',
      f?.prontuario ?? '',
      resp ? nome(resp) : '',
      presentes.map(nome).join(', '),
      // Sem ninguém marcado (VD trazida de fora ou "conversou com a família"): não dá para saber quem faltou.
      !presentes.length || v.desfecho === 'ausencia_completa' || v.desfecho === 'recusa' ? '' : ausentes.map(nome).join(', '),
      o.nomeDesfecho(v.desfecho),
      contaParaMeta(v.desfecho) ? 'Sim' : 'Não',
      v.motivo,
      v.compartilhadaCom,
      v.lancadaNoFast ? 'Sim' : 'Não',
      sv ? 'Sistema de Visitas' : 'App',
    ];
    if (o.relato) cols.push(v.relato || v.observacao || '');
    linhas.push(linha(cols));
  }
  return BOM + linhas.join('\r\n') + '\r\n';
}

/** Todas as casas da área: visitada ou não no período, quantas VDs, última VD e dias sem VD. */
export function csvFamilias(familias: Familia[], visitas: Visita[], o: OpcoesExportar, hoje: string): string {
  const nome = (m: Morador) => (o.nomes ? m.nome : iniciais(m.nome));
  const cab = ['Rua', 'Numero', 'Complemento', 'Prontuario', 'Situacao da casa', 'Responsavel', 'Moradores', 'Visitada no periodo', 'VDs que contam no periodo', 'Tentativas sem sucesso no periodo', 'Ultima VD', 'Dias sem VD'];
  const linhas = [linha(cab)];
  const porCasa = new Map<string, Visita[]>();
  for (const v of visitas) if (dentro(v.data, o)) porCasa.set(v.familiaId, [...(porCasa.get(v.familiaId) ?? []), v]);
  for (const f of [...familias].sort(ordemCasa)) {
    const moram = f.moradores.filter((m) => m.situacao === 'mora');
    const resp = f.moradores.find((m) => m.id === f.responsavelId);
    const vs = porCasa.get(f.id) ?? [];
    const contam = vs.filter((v) => contaParaMeta(v.desfecho)).length;
    const u = ultimaVisita(f, visitas, hoje);
    linhas.push(
      linha([
        f.rua,
        f.numero,
        f.complemento,
        f.prontuario,
        NOMES_SITUACAO_CASA[f.situacaoCasa] ?? f.situacaoCasa,
        resp ? nome(resp) : '',
        moram.map(nome).join(', '),
        contam ? 'Sim' : 'Não',
        contam,
        vs.length - contam,
        br(u),
        u ? diferencaDias(u, hoje) : '',
      ]),
    );
  }
  return BOM + linhas.join('\r\n') + '\r\n';
}
