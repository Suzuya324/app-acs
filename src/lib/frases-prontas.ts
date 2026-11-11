// Frases prontas para a VD: as do ACS (Ajustes) ou as padrão, mais as que ele mais escreve (aprendidas das VDs).
// Um toque escreve a frase no campo. Tudo no aparelho.
import { frases, OBS_SISTEMA_DE_VISITAS, semAcento } from './anotacoes';
import type { Visita } from './tipos';

export const FRASES_PADRAO = [
  'Todos bem, sem queixas.',
  'Sem novidades desde a última VD.',
  'Tomando os remédios corretamente.',
  'Renovar a receita.',
  'Aguarda resultado de exame.',
  'Tem consulta marcada.',
  'Precisa marcar consulta.',
  'Refere dor',
  'Entreguei recado da UBS.',
  'Convidado(a) para o grupo da UBS.',
];

const chave = (t: string) => semAcento(t).replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

/** As frases que o ACS mais escreve nas VDs (pelo menos 2 vezes), a mais usada primeiro. */
export function frasesMaisUsadas(visitas: Visita[], n = 8): string[] {
  const conta = new Map<string, { texto: string; vezes: number; data: string }>();
  for (const v of visitas) {
    const textos = [v.observacao?.startsWith(OBS_SISTEMA_DE_VISITAS.slice(0, 10)) ? '' : (v.observacao ?? ''), ...Object.values(v.anotacoes ?? {})];
    for (const t of textos) {
      for (const fr of frases(t)) {
        const k = chave(fr);
        if (k.length < 6 || k.length > 80 || /\d{2}\/\d{2}/.test(fr)) continue; // datas e números mudam a cada VD
        const atual = conta.get(k);
        if (!atual) conta.set(k, { texto: fr, vezes: 1, data: v.data });
        else {
          atual.vezes++;
          if (v.data > atual.data) Object.assign(atual, { texto: fr, data: v.data });
        }
      }
    }
  }
  return [...conta.values()]
    .filter((x) => x.vezes >= 2)
    .sort((a, b) => b.vezes - a.vezes || b.data.localeCompare(a.data))
    .slice(0, n)
    .map((x) => x.texto);
}

/** As frases para mostrar na VD: as do ACS (ou as padrão) e as mais usadas, sem repetir. */
export function frasesParaVD(proprias: string[] | undefined, visitas: Visita[], max = 14): string[] {
  const base = proprias?.length ? proprias : FRASES_PADRAO;
  const vistas = new Set<string>();
  const lista: string[] = [];
  for (const f of [...base, ...frasesMaisUsadas(visitas)]) {
    const k = chave(f);
    if (!k || vistas.has(k)) continue;
    vistas.add(k);
    lista.push(f.trim());
  }
  return lista.slice(0, max);
}

/** Põe a frase no fim do texto, com a pontuação certa. */
export function juntarFrase(texto: string, frase: string): string {
  const t = texto.trimEnd();
  if (!t) return frase;
  return /[.!?;:]$/.test(t) ? `${t} ${frase}` : `${t}. ${frase}`;
}

/** Lê as frases digitadas pelo ACS (uma por linha). */
export const lerFrasesProprias = (texto: string) =>
  texto.split('\n').map((x) => x.trim()).filter((x) => x.length >= 3).slice(0, 30);
