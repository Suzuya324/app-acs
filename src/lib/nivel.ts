// Nível de prioridade da casa (como no Sistema de Visitas):
// A = voltar a cada 10 dias, B = a cada 30 dias, C = sem prazo especial.
// - A: alguém com 80 anos ou mais, ou com condição grave (oxigênio, acamado, AVC/infarto, câncer,
//   saúde mental, Alzheimer/paliativo).
// - B: alguém com 60 anos ou mais, ou com condição crônica (diabetes, hipertensão, cirurgia).
// - O ACS pode marcar A ou B à mão (vale o mais alto).
import { contaParaMeta } from './desfecho';
import { idade, somarDias } from './datas';
import type { Prioritario } from './prioritarios';
import { NOMES_GRUPO } from './rotulos';
import type { Familia, Grupo, Visita } from './tipos';

export type Nivel = 'A' | 'B' | 'C';

export const DIAS_NIVEL: Record<'A' | 'B', number> = { A: 10, B: 30 };
const GRAVES: Grupo[] = ['oxigenio', 'acamado', 'avc', 'cancer', 'saude_mental', 'alzheimer'];
const CRONICOS: Grupo[] = ['diabetico', 'hipertenso', 'cirurgia', 'coracao'];

/** O que perguntar na VD, por condição. */
export const PERGUNTAS: Partial<Record<Grupo, string>> = {
  diabetico: 'glicemia, remédios, alimentação, pés',
  hipertenso: 'pressão, remédio, dor de cabeça/tontura',
  oxigenio: 'aparelho e cilindro de oxigênio, falta de ar',
  acamado: 'pele/escaras, posição, higiene, cuidador',
  avc: 'fala, força, remédios, dor no peito',
  coracao: 'falta de ar, cansaço, inchaço, remédios, consultas do coração',
  cancer: 'dor, alimentação, consultas e tratamento',
  cirurgia: 'ferida, curativo, retorno',
  saude_mental: 'humor, sono, remédios, rede de apoio',
  alzheimer: 'memória, quedas, cuidador',
  gestante: 'pré-natal, exames, vacinas, sinais de alerta',
  puerpera: 'consulta pós-parto, amamentação, vacinas do bebê',
  crianca: 'vacinas, peso, consultas de puericultura',
};

const moram = (f: Familia) => f.moradores.filter((m) => m.situacao === 'mora');
const maisAlto = (a: Nivel, b: Nivel): Nivel => (a === 'A' || b === 'A' ? 'A' : a === 'B' || b === 'B' ? 'B' : 'C');

export function nivelDaFamilia(f: Familia, hoje: string, prios: Prioritario[] = []): { nivel: Nivel; motivo: string } {
  let nivel: Nivel = 'C';
  let motivo = '';
  const subir = (n: Nivel, porque: string) => {
    if (maisAlto(nivel, n) !== nivel) {
      nivel = n;
      motivo = porque;
    }
  };
  for (const m of moram(f)) {
    const anos = idade(m.nascimento, hoje);
    const nome = m.nome.split(' ')[0];
    const grave = m.grupos.find((g) => GRAVES.includes(g));
    const cronico = m.grupos.find((g) => CRONICOS.includes(g));
    if (anos !== null && anos >= 80) subir('A', `${nome}: ${anos} anos`);
    if (grave) subir('A', `${nome}: ${NOMES_GRUPO[grave].toLowerCase()}`);
    if (anos !== null && anos >= 60) subir('B', `${nome}: ${anos} anos`);
    if (cronico) subir('B', `${nome}: ${NOMES_GRUPO[cronico].toLowerCase()}`);
  }
  for (const p of prios) if (p.familiaId === f.id && p.nivel !== 'C') subir(p.nivel, `${p.nome.split(' ')[0]}: prioritário ${p.nivel}`);
  if (f.nivel) subir(f.nivel, 'marcado por você');
  return { nivel, motivo };
}

/** Última VD que conta (no app) ou a última feita fora dele, a mais recente. */
export function ultimaVisita(f: Familia, visitas: Visita[], hoje: string): string {
  let u = f.ultimaVdFora ?? '';
  for (const v of visitas) if (v.familiaId === f.id && contaParaMeta(v.desfecho) && v.data <= hoje && v.data > u) u = v.data;
  return u;
}

/** Até quando voltar (nível A: 10 dias; B: 30 dias). Null no nível C. Sem VD: hoje. */
export function proximaVisita(f: Familia, visitas: Visita[], hoje: string, prios: Prioritario[] = []): string | null {
  const { nivel } = nivelDaFamilia(f, hoje, prios);
  if (nivel === 'C') return null;
  const u = ultimaVisita(f, visitas, hoje);
  return u ? somarDias(u, DIAS_NIVEL[nivel]) : hoje;
}

/** Linhas do "o que perguntar" para a casa. */
export function perguntasDaFamilia(f: Familia, hoje: string): string[] {
  const linhas: string[] = [];
  for (const m of moram(f)) {
    const p = m.grupos.map((g) => PERGUNTAS[g]).filter(Boolean);
    if (p.length) linhas.push(`${m.nome.split(' ')[0]}: ${p.join('; ')}`);
  }
  const maisVelho = Math.max(-1, ...moram(f).map((m) => idade(m.nascimento, hoje) ?? -1));
  if (maisVelho >= 80) linhas.push('80+: quedas, remédios, hidratação, quem ajuda em casa');
  if (f.atencao?.trim()) linhas.push(`Atenção: ${f.atencao.trim()}`);
  return linhas.length ? linhas : ['Sem condição marcada: pergunte pressão, remédios, quedas e como estão.'];
}

/** Casas de nível A ou B com a próxima VD vencida (ou para hoje), A primeiro e a mais atrasada antes. */
export function casasParaRevisitar(familias: Familia[], visitas: Visita[], hoje: string, prios: Prioritario[] = []) {
  const lista: { familia: Familia; nivel: 'A' | 'B'; ate: string; motivo: string; ultima: string }[] = [];
  for (const f of familias) {
    if (f.situacaoCasa !== 'habitada' || !moram(f).length) continue;
    const { nivel, motivo } = nivelDaFamilia(f, hoje, prios);
    if (nivel === 'C') continue;
    const ate = proximaVisita(f, visitas, hoje, prios)!;
    if (ate <= hoje) lista.push({ familia: f, nivel, ate, motivo, ultima: ultimaVisita(f, visitas, hoje) });
  }
  return lista.sort((a, b) => a.nivel.localeCompare(b.nivel) || a.ate.localeCompare(b.ate));
}
