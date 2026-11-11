// Casos achados no que o ACS escreve: "precisa da assistente social", "caiu ontem", "pedir VD da enfermeira"…
// O app sugere abrir o caso já com a categoria (urgente, importante, social), a eMulti e o ponto para a reunião de
// equipe. Só procura palavras, no aparelho; o caso só é aberto quando o ACS confirma. Funções "puras".
import { codigo } from './acompanhamento';
import { dataCurta, frases, NEGACAO, semAcento, textosDaPessoa, type TextoDaFamilia } from './anotacoes';
import { diferencaDias, idade } from './datas';
import type { Caso, CategoriaCaso, Familia, Morador, Visita } from './tipos';

/** Profissionais da eMulti e as palavras que levam a cada um. */
export const EMULTI: [string, RegExp][] = [
  ['Serviço social', /\b(assistentes? socia(l|is)|servico social|cras|creas|bpc|loas|beneficio|bolsa familia|cesta basica|auxilio|cadunico|cad unico|documentos?|vulnerab\w*)\b/],
  ['Psicologia', /\b(psicolog\w*|acompanhamento psicologico|terapia)\b/],
  ['Nutrição', /\b(nutricionista|nutricao)\b/],
  ['Fisioterapia', /\b(fisioterap\w*|fisio|reabilitacao)\b/],
  ['Fonoaudiologia', /\b(fono\w*)\b/],
  ['Farmácia', /\b(farmaceutic[oa]|farmacia)\b/],
  ['Odontologia', /\b(dentista|odonto\w*|saude bucal)\b/],
  ['Terapia ocupacional', /\b(terapeuta ocupacional)\b/],
  ['Educação física', /\b(educador fisico|educacao fisica)\b/],
];
/** Na frase, alguém precisa de algo (senão "acompanha com a psicóloga" é só notícia). */
const PRECISA = /\b(precis\w*|necessit\w*|pede\w*|pediu|pedir|quer|queria|gostaria|encaminh\w*|avaliar|avaliacao|ajuda|solicit\w*|levar|falar com|passar com|passar n[ao]|agendar|marcar|orientar|sem|nao tem|nao conseguiu|nao consegue|aguard\w*|esperando|falta (marcar|agendar|fazer|pedir|levar|conseguir)|urgente|vaga)\b/;

/** Situações urgentes (sem precisar de "precisa"). */
const URGENTE: [RegExp, string][] = [
  [/\b(caiu|queda|cai[ud]a)\b/, 'queda'],
  [/\b(falta de ar|cansaco forte|dor no peito|aperto no peito|dor forte no peito)\b/, 'falta de ar ou dor no peito'],
  [/\b(sangramento|sangrando|vomit\w* sangue|desmai\w*|convuls\w*|febre alta|inconscien\w*|confus[ao] mental)\b/, 'sinal de alerta'],
  [/\b(escara\w*|ferida (infeccionad|infectad|aberta|piorou|com pus)\w*|lesao por pressao)\b/, 'ferida ou escara'],
  [/\b(ideacao|suicid\w*|se matar|tirar a propria vida|automutil\w*)\b/, 'risco à vida'],
  [/\b(violencia|agress\w*|maus[- ]tratos|abandon\w*|negligenc\w*|abuso)\b/, 'violência ou abandono'],
  [/\b(sem (remedio|remedios|medicacao|medicamento|insulina|comida|alimento)|acabou (o|a) (remedio|insulina|medicacao)|nao (esta comendo|come mais|consegue comer|consegue andar|levanta mais))\b/, 'sem remédio ou sem comer'],
  [/\b(urgente|urgencia|com urgencia|o quanto antes|avaliacao rapida|o mais rapido)\b/, 'pedido urgente'],
];
/** Para levar na reunião de equipe (médico, enfermagem, discutir o caso). */
const REUNIAO = /\b(levar (para|pra|na) (a )?reuniao|reuniao de equipe|discutir (com a equipe|o caso|na reuniao)|passar (para|pra) a equipe|npv|(vd|visita|avaliacao) (medica|de enfermagem|da enfermagem|do medico|da medica|da enfermeira|do enfermeiro)|(pedir|solicitar) (vd|visita|avaliacao)|(medic[oa]|enfermeir[oa]|doutor[a]?|dra?) (precisa|tem que|deve) (ir|ver|visitar|avaliar)|(precisa|precisando) (de )?(vd|visita|avaliacao) (medica|da enfermagem|do medico)|(chamar|avisar) (o|a) (medic[oa]|enfermeir[oa]))\b/;

const PA_ALTA = /\b(?:p\.?\s?a\.?|pressao)[^0-9.;]{0,25}?(\d{2,3})\s*[x/]\s*(\d{2,3})/;
const GLIC = /\b(?:dextro|destro|glicemia|hgt)\b[^0-9.;]{0,20}?(\d{2,3})(?![\dx/])/;

/** Até quantos dias um texto ainda vira caso sugerido; urgente só se for recente. */
export const DIAS_CASO = 60;
export const DIAS_URGENTE = 15;

export interface MotivoCaso {
  categoria: CategoriaCaso;
  emulti?: string;
  /** Vai para a reunião de equipe. */
  reuniao: boolean;
  /** Por que o app achou (ex.: "queda", "Serviço social"). */
  porque: string;
}

/** O pedaço antes da palavra (na mesma parte da frase) nega o que vem depois? ("nega dor no peito", "sem queda") */
function negado(baixo: string, i: number): boolean {
  const antes = baixo.slice(0, i);
  return NEGACAO.test(antes.slice(antes.lastIndexOf(',') + 1)) && !/\bsem (remedio|medicacao|medicamento|insulina|comida|alimento)/.test(baixo.slice(i - 4));
}

/** O que a frase pede: caso urgente, eMulti, reunião… (null = nada). */
export function motivoDaFrase(frase: string): MotivoCaso | null {
  const baixo = semAcento(frase).replace(/[-–]/g, ' ');
  if (/\b(orientad\w*|orientei|orientacao) sobre\b/.test(baixo) && !PRECISA.test(baixo.replace(/\borient\w*/g, ''))) return null;
  let urgente = '';
  for (const [re, nome] of URGENTE) {
    const x = baixo.match(re);
    if (x && !negado(baixo, x.index ?? 0)) {
      urgente = nome;
      break;
    }
  }
  const pa = baixo.match(PA_ALTA);
  if (!urgente && pa && (Number(pa[1]) >= 180 || Number(pa[2]) >= 110)) urgente = `P.A. ${pa[1]}x${pa[2]}`;
  const gl = baixo.match(GLIC);
  if (!urgente && gl && (Number(gl[1]) >= 300 || Number(gl[1]) <= 60)) urgente = `glicemia ${gl[1]}`;
  let emulti: string | undefined;
  if (PRECISA.test(baixo)) {
    for (const [nome, re] of EMULTI) {
      const x = baixo.match(re);
      if (x && !negado(baixo, x.index ?? 0)) {
        emulti = nome;
        break;
      }
    }
  }
  const reuniao = REUNIAO.test(baixo);
  if (!urgente && !emulti && !reuniao) return null;
  const categoria: CategoriaCaso = urgente ? 'urgente' : emulti === 'Serviço social' ? 'social' : 'importante';
  return { categoria, emulti, reuniao: reuniao || !!emulti || !!urgente, porque: [urgente, emulti, reuniao && !emulti ? 'reunião de equipe' : ''].filter(Boolean).join(' · ') };
}

export interface CasoAchado {
  /** familiaId|c-código (para "Não é" e para não sugerir de novo). */
  chave: string;
  familiaId: string;
  moradorId?: string;
  titulo: string;
  categoria: CategoriaCaso;
  emulti?: string;
  reuniao: boolean;
  porque: string;
  /** As frases que fizeram a sugestão (a mais nova primeiro). */
  provas: { data: string; origem: string; frase: string }[];
}

/** "Ana Teste, 76 anos" (como o Sistema de Visitas escreve o título do caso). */
export function tituloDoCaso(m: Morador | undefined, f: Familia, hoje: string): string {
  if (!m) return `${f.rua}, ${f.numero}${f.complemento ? ` ${f.complemento}` : ''}`;
  const anos = m.nascimento ? idade(m.nascimento, hoje) : null;
  return `${m.nome}${anos !== null ? `, ${anos} ${anos === 1 ? 'ano' : 'anos'}` : ''}`;
}

/** Um texto já virou caso? (o texto do caso contém a frase, ou é o mesmo assunto aberto) */
function jaTemCaso(casos: Caso[], familiaId: string, frase: string, m: MotivoCaso): boolean {
  const alvo = semAcento(frase).replace(/[^a-z0-9]/g, '');
  return casos.some((c) => {
    if (c.familiaId !== familiaId) return false;
    if (semAcento(`${c.texto} ${c.npv ?? ''}`).replace(/[^a-z0-9]/g, '').includes(alvo.slice(0, 80))) return true;
    // Mesmo assunto ainda aberto (mesma eMulti, ou urgente aberto): não abre outro.
    return !c.resolvidoEm && ((!!m.emulti && semAcento(c.emulti ?? '') === semAcento(m.emulti)) || (m.categoria === 'urgente' && c.categoria === 'urgente'));
  });
}

/**
 * Casos que o app acha no que já foi escrito (anotações, observações, relatos trazidos), dos últimos DIAS_CASO dias,
 * que ainda não viraram caso. Urgente só vale se for recente; senão vira "importante".
 */
export function casosAchados(familias: Familia[], visitas: Visita[], casos: Caso[], hoje: string, escondidas: Iterable<string> = []): CasoAchado[] {
  const fora = new Set(escondidas);
  const comTexto = new Set(visitas.filter((v) => diferencaDias(v.data, hoje) <= DIAS_CASO).map((v) => v.familiaId));
  const porChave = new Map<string, CasoAchado>();
  for (const f of familias) {
    if (f.situacaoCasa !== 'habitada' || (!comTexto.has(f.id) && !f.relatosAnteriores?.length)) continue;
    for (const m of f.moradores) {
      if (m.situacao !== 'mora') continue;
      const textos: TextoDaFamilia[] = textosDaPessoa(m, f, visitas, []).filter((t) => t.data && t.data <= hoje && diferencaDias(t.data, hoje) <= DIAS_CASO);
      for (const t of textos) {
        for (const frase of frases(t.texto)) {
          const mot = motivoDaFrase(frase);
          if (!mot) continue;
          if (mot.categoria === 'urgente' && diferencaDias(t.data, hoje) > DIAS_URGENTE) mot.categoria = mot.emulti === 'Serviço social' ? 'social' : 'importante';
          if (jaTemCaso(casos, f.id, frase, mot)) continue;
          const grupo = `${f.id}|${m.id}|${mot.categoria}|${mot.emulti ?? ''}`;
          let it = porChave.get(grupo);
          if (!it) {
            const chave = `${f.id}|c-${codigo(`${m.id}${mot.categoria}${mot.emulti ?? ''}${frase}`)}`;
            if (fora.has(chave)) continue;
            it = { chave, familiaId: f.id, moradorId: m.id, titulo: tituloDoCaso(m, f, hoje), categoria: mot.categoria, emulti: mot.emulti, reuniao: mot.reuniao, porque: mot.porque, provas: [] };
            porChave.set(grupo, it);
          }
          if (!it.provas.some((p) => p.frase === frase)) it.provas.push({ data: t.data, origem: t.origem, frase });
        }
      }
    }
  }
  const ordem: Record<CategoriaCaso, number> = { urgente: 0, importante: 1, social: 2, npv: 3 };
  const lista = [...porChave.values()];
  for (const it of lista) it.provas.sort((a, b) => b.data.localeCompare(a.data));
  return lista.sort((a, b) => ordem[a.categoria] - ordem[b.categoria] || (b.provas[0]?.data ?? '').localeCompare(a.provas[0]?.data ?? ''));
}

/** O ponto para a reunião de equipe (vai no campo NPV do caso). */
export const npvDoMotivo = (m: { reuniao: boolean; emulti?: string }) =>
  m.reuniao ? `Levar na reunião de equipe${m.emulti ? ` – encaminhar para a eMulti (${m.emulti})` : ''}` : undefined;

/** O caso pronto para abrir a partir do que foi achado. */
export function casoDoAchado(a: CasoAchado): Omit<Caso, 'id' | 'criadoEm' | 'atualizadoEm'> {
  const linhas = a.provas.map((p) => `${dataCurta(p.data)}: ${p.frase}`);
  return {
    familiaId: a.familiaId,
    categoria: a.categoria,
    titulo: a.titulo,
    texto: linhas.join('\n'),
    emulti: a.emulti,
    npv: npvDoMotivo(a),
  };
}

// ---------------------------------------------------------------- prioridade e pauta

const PESO: Record<CategoriaCaso, number> = { urgente: 0, importante: 1, social: 2, npv: 3 };

/** Ordem dos casos abertos: urgente; depois os que vão para a reunião ou eMulti; depois o mais antigo sem novidade. */
export function ordenarCasos(casos: Caso[]): Caso[] {
  const reuniao = (c: Caso) => (c.npv?.trim() || c.emulti?.trim() ? 0 : 1);
  return [...casos].sort((a, b) => PESO[a.categoria] - PESO[b.categoria] || reuniao(a) - reuniao(b) || a.atualizadoEm.localeCompare(b.atualizadoEm));
}

/** Casos da pauta da reunião de equipe: abertos, urgentes ou com ponto de reunião/eMulti. */
export const casosDaPauta = (casos: Caso[]) =>
  ordenarCasos(casos.filter((c) => !c.resolvidoEm && (c.categoria === 'urgente' || c.categoria === 'npv' || !!c.npv?.trim() || !!c.emulti?.trim())));

/** Texto da pauta para copiar (WhatsApp da equipe, caderno da reunião). */
export function textoDaPauta(casos: Caso[], endereco: (familiaId: string) => string, dia: string): string {
  const pauta = casosDaPauta(casos);
  const linhas = [`Pauta da reunião de equipe${dia ? ` ${dia}` : ''} (${pauta.length} ${pauta.length === 1 ? 'caso' : 'casos'})`];
  pauta.forEach((c, i) => {
    const cat = { urgente: 'URGENTE', importante: 'Importante', social: 'Social', npv: 'NPV' }[c.categoria];
    linhas.push(`${i + 1}. [${cat}] ${c.titulo} – ${endereco(c.familiaId)}${c.emulti ? ` – eMulti: ${c.emulti}` : ''}`);
    const texto = (c.texto.split('\n').find((l) => l.trim()) || c.npv || '').trim();
    if (texto) linhas.push(`   ${texto.length > 180 ? `${texto.slice(0, 180)}…` : texto}`);
  });
  return linhas.join('\n');
}
