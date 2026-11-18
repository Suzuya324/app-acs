// Plano para fechar a meta: as famílias que faltam, divididas pelos dias de campo que sobram,
// juntando as casas da mesma rua no mesmo dia (para andar menos).
import { diferencaDias, somarDias } from './datas';
import { ultimaVisita } from './nivel';
import { agruparPorRua } from './roteiro';
import type { Familia, Visita } from './tipos';

export interface DiaDoPlano {
  data: string;
  /** Por rua, na ordem das ruas e dos números. */
  ruas: { rua: string; familias: Familia[] }[];
  total: number;
}

/** Dias de campo de `de` até `ate` (inclusive). */
export function diasDeCampoEntre(de: string, ate: string, ehDiaDeCampo: (iso: string) => boolean): string[] {
  const dias: string[] = [];
  for (let d = de; d <= ate; d = somarDias(d, 1)) if (ehDiaDeCampo(d)) dias.push(d);
  return dias;
}

/**
 * Escolhe as `faltam` famílias há mais tempo sem VD (nunca visitadas primeiro), põe em ordem de rua
 * e divide pelos dias. Cada dia fica com uma fatia seguida da rua (vizinhas juntas).
 */
export function planoDaMeta(naoVisitadas: Familia[], visitas: Visita[], faltam: number, dias: string[], hoje: string, ordemRuas: string[] = []): DiaDoPlano[] {
  if (faltam <= 0 || !dias.length || !naoVisitadas.length) return [];
  const sem = (f: Familia) => {
    const u = ultimaVisita(f, visitas, hoje);
    return u ? diferencaDias(u, hoje) : Number.POSITIVE_INFINITY;
  };
  const escolhidas = [...naoVisitadas].sort((a, b) => sem(b) - sem(a)).slice(0, faltam);
  const emOrdem = agruparPorRua(escolhidas, ordemRuas).flatMap((g) => g.familias);
  const porDia = Math.ceil(emOrdem.length / dias.length);
  const plano: DiaDoPlano[] = [];
  for (let i = 0; i < dias.length && i * porDia < emOrdem.length; i++) {
    const fatia = emOrdem.slice(i * porDia, (i + 1) * porDia);
    plano.push({ data: dias[i], ruas: agruparPorRua(fatia, ordemRuas), total: fatia.length });
  }
  return plano;
}

/** Texto do plano (para copiar). */
export function textoDoPlano(plano: DiaDoPlano[], dataCurta: (iso: string) => string): string {
  return plano
    .map((d) => [`${dataCurta(d.data)} (${d.total} ${d.total === 1 ? 'casa' : 'casas'})`, ...d.ruas.map((r) => `  ${r.rua}: ${r.familias.map((f) => `${f.numero}${f.complemento ? ` ${f.complemento}` : ''}`).join(', ')}`)].join('\n'))
    .join('\n\n');
}
