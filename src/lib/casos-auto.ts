// Casos achados no que o ACS escreve: "precisa da assistente social", "caiu ontem", "pedir VD da enfermeira"…
// O app sugere abrir o caso já com a categoria (urgente, importante, social), a eMulti e o ponto para a reunião de
// equipe. Só procura palavras, no aparelho; o caso só é aberto quando o ACS confirma. Funções "puras".
import { codigo } from './acompanhamento';
import { dataCurta, frases, NEGACAO, semAcento, textosDaPessoa, trechosDaPessoa, type TextoDaFamilia } from './anotacoes';
import type { Prioritario } from './prioritarios';
import { diferencaDias, idade } from './datas';
import type { Caso, CategoriaCaso, Familia, Morador, Visita } from './tipos';

/**
 * Profissionais da eMulti e as palavras que levam a cada um. Aceita erros comuns de digitação e de ditado
 * ("acistente social", "assistente sócia", "psicologa"). O texto já chega sem acento e em minúsculas.
 */
export const EMULTI: [string, RegExp][] = [
  ['Serviço social', /\b(a[sc]+istentes? soci(al|ais|a)|servico social|social da ubs|cras|creas|bpc|loas|beneficio\w*|aposentadoria|pensao|auxilio\w*|bolsa familia|cesta\w* basica\w*|cadunico|cad unico|cadastro unico|vulnerab\w*|passando (necessidade|fome)|sem (dinheiro|renda|comida|alimento\w*|gas|luz|agua)|fome|desempregad\w*|despejo|moradia|sem casa|morando na rua|situacao de rua|conselho tutelar|guarda (do|da|dos|das) (filh|net|crianc)\w*|documento\w*|rg|cpf|certidao|cartao (do )?sus|cns|curatela|interdicao|cuidador\w*\s+sobrecarregad\w*|sobrecarga)\b/],
  ['Psicologia', /\b(psic[oó]log\w*|psicologia|acompanhamento psicologico|terapia|terapeuta(?! ocupacional)|luto|depress\w*|ansiedade|crise\w* de ansiedade|panico|chor(a|ando|ou) muito|muito triste|tristeza|desanimad\w*|isolad\w*|nao sai de casa|automutil\w*)\b/],
  ['Nutrição', /\b(nutricionista|nutricao|desnutri\w*|baixo peso|abaixo do peso|perdeu (muito )?peso|emagreceu|obesidade|dieta)\b/],
  ['Fisioterapia', /\b(fisioterap\w*|fisio|reabilitacao|nao (consegue|esta conseguindo) andar|dificuldade (para|de|pra) andar|andador|bengala|cadeira de rodas|sequela\w*|fortalecimento)\b/],
  ['Fonoaudiologia', /\b(fono\w*|nao fala|atraso (na|da|de) fala|engasg\w*|dificuldade (para|de|pra) engolir|disfagia)\b/],
  ['Farmácia', /\b(farmaceutic[oa]|farmacia|confund\w* (os )?remedios|nao sabe tomar|muitos remedios|toma errado|organizar (os )?remedios)\b/],
  ['Odontologia', /\b(dentista|odonto\w*|saude bucal|dor de dente|dente\w* (doendo|quebrad\w*|podre)|protese dentaria|dentadura)\b/],
  ['Terapia ocupacional', /\b(terapeuta ocupacional|terapia ocupacional)\b/],
  ['Educação física', /\b(educador fisico|educacao fisica|academia da saude|atividade fisica)\b/],
];
/** Na frase, alguém precisa de algo (senão "acompanha com a psicóloga" é só notícia). */
const PRECISA = /\b(precis\w*|necessit\w*|pede\w*|pediu|pedir|pedindo|quer|queria|gostaria|encaminh\w*|avaliar|avaliacao|ajuda|socorro|solicit\w*|levar|falar com|passar com|passar n[ao]|agendar|marcar|orientar|sem|nao tem|nao conseguiu|nao consegue|nao esta conseguindo|aguard\w*|esperando|falta (marcar|agendar|fazer|pedir|levar|conseguir)|urgente|vaga|interesse|aceit\w*|indicad\w*|sugerid\w*|sugiro|seria bom|importante)\b/;
/** Palavras que já são o problema (não precisam de "precisa"): passar fome, depressão, desnutrição… */
const SEM_PRECISA = /\b(passando (necessidade|fome)|fome|sem (dinheiro|renda|comida|alimento\w*|gas|luz|agua)|despejo|morando na rua|situacao de rua|desnutri\w*|depress\w*|crise\w* de ansiedade|panico|chor(a|ando|ou) muito|automutil\w*|sobrecarga|cuidador\w*\s+sobrecarregad\w*|engasg\w*|desempregad\w*)\b/;

/** Situações urgentes (sem precisar de "precisa"). */
const URGENTE: [RegExp, string][] = [
  [/\b(caiu|queda|cai[ud]a|tombo|levou um tombo|escorregou)\b/, 'queda'],
  [/\b(falta de ar|cansaco forte|dor no peito|aperto no peito|dor forte no peito|dor do lado do coracao|chiado no peito|roxo|labios roxos)\b/, 'falta de ar ou dor no peito'],
  [/\b(sangramento|sangrando|sangue (na|no|nas|nos) (urina|fezes|vomito|tosse)|vomit\w* sangue|desmai\w*|convuls\w*|febre alta|inconscien\w*|confus[ao] mental|desorientad\w*|boca torta|perdeu a (forca|fala)|nao mexe (o|a) (braco|perna))\b/, 'sinal de alerta'],
  [/\b(escara\w*|ferida (infeccionad|infectad|aberta|piorou|com pus|cheirando)\w*|lesao por pressao|pe diabetico|ferida no pe)\b/, 'ferida ou escara'],
  [/\b(ideacao|suicid\w*|se matar|tirar a propria vida|nao quer mais viver|vontade de morrer|automutil\w*|se cortando)\b/, 'risco à vida'],
  [/\b(violencia|agress\w*|apanh\w*|bat(e|eu|endo) n[ao]|maus[- ]tratos|abandon\w*|negligenc\w*|abuso|ameaca\w*)\b/, 'violência ou abandono'],
  [/\b(sem (remedio|remedios|medicacao|medicamento|comida|alimento|oxigenio)|(esta|ficou|estao|ficaram) sem (a )?insulina|acabou (o|a) (remedio|insulina|medicacao|oxigenio)|parou (de tomar )?(todos )?(os )?remedios por conta|nao (esta comendo|come mais|consegue comer|consegue andar|levanta mais|esta bebendo agua)|sem cuidador|sozinh\w* (e|e esta) acamad\w*|acamad\w* (e )?sozinh\w*)\b/, 'sem remédio, sem comer ou sem cuidador'],
  [/\b(alcool|bebida|bebendo muito|alcoolism\w*|embriagad\w*|droga\w*|crack|cocaina|maconha|dependencia quimica)\b/, 'álcool ou drogas'],
  [/\b(gestante|gravida)\b[^.;]*\b(sem pre[- ]natal|nao (fez|faz|comecou) (o )?pre[- ]natal|sangramento|perdendo liquido|sem consulta)\b|\b(sem pre[- ]natal)\b/, 'gestante sem pré-natal'],
  [/\b(vacina\w* (atrasad\w*|em atraso|vencid\w*)|nao (vacinou|esta vacinad\w*)|fora da escola|parou de (ir|frequentar) (a )?escola)\b/, 'criança: vacina ou escola'],
  [/\b(urgente|urgencia|com urgencia|o quanto antes|avaliacao rapida|o mais rapido|piorou muito|esta pior|muito mal)\b/, 'pedido urgente'],
];
/** O que é "urgente" só quando recente; os outros acima (álcool, vacina, escola…) são importantes, não urgentes. */
const SO_IMPORTANTE = new Set(['álcool ou drogas', 'criança: vacina ou escola']);

/** Para levar na reunião de equipe (médico, enfermagem, discutir o caso). */
const REUNIAO = /\b(levar (para|pra|na) (a )?reuniao|reuniao de equipe|discutir (com a equipe|o caso|na reuniao)|passar (para|pra) a equipe|npv|(vd|visita|avaliacao) (medica|de enfermagem|da enfermagem|do medico|da medica|da enfermeira|do enfermeiro)|(pedir|solicitar) (vd|visita|avaliacao)|(medic[oa]|enfermeir[oa]|doutor[a]?|dra?) (precisa|tem que|deve) (ir|ver|visitar|avaliar)|(precisa|precisando) (de )?(vd|visita|avaliacao) (medica|da enfermagem|do medico)|(chamar|avisar) (o|a) (medic[oa]|enfermeir[oa])|precisa (de )?(medico|enfermeir[oa]) em casa|nao (consegue|pode|tem como) (ir|chegar) (ate )?(a|na) (ubs|unidade|posto)|sem acompanhante|sem transporte|receita vencid\w*|renovar (a )?receita|(cama|colchao) hospitalar|fralda\w*|curativo\w*|sonda|oxigenio (acabando|com problema)|caso (social|grave|complexo))\b/;

const PA_ALTA = /\b(?:p\.?\s?a\.?|pressao)[^0-9.;]{0,25}?(\d{2,3})\s*[x/]\s*(\d{2,3})(?![\d/])/;
const GLIC = /\b(?:dextro|destro|glicemia|hgt)\b[^0-9.;]{0,20}?(\d{2,3})(?![\dx/])/;

/** Urgente só vale para texto recente; mais antigo vira "importante" (o texto todo é lido, de qualquer data). */
export const DIAS_URGENTE = 15;

export interface MotivoCaso {
  categoria: CategoriaCaso;
  emulti?: string;
  /** Vai para a reunião de equipe. */
  reuniao: boolean;
  /** Por que o app achou (ex.: "queda", "Serviço social"). */
  porque: string;
}

/** O pedaço antes da palavra (na mesma parte da frase) nega o que vem depois? ("nega dor no peito", "sem queda", "risco de queda") */
function negado(baixo: string, i: number): boolean {
  const antes = baixo.slice(0, i);
  const perto = antes.slice(antes.lastIndexOf(',') + 1);
  if (/\b(risco|prevencao|prevenir|evitar|historico|antecedente)s? (de|da|do|para)?\s*$/.test(perto)) return true;
  return NEGACAO.test(perto) && !/\bsem (remedio|medicacao|medicamento|insulina|comida|alimento)/.test(baixo.slice(i - 4));
}
/** Já melhorou ("falta de ar melhorando", "a dor passou"): não é urgente. */
const MELHOROU = /\b(melhor\w*|controlad\w*|estavel|passou|cicatriz\w*|resolvid\w*|normal)\b/;

/**
 * O que a frase pede: caso urgente, eMulti, reunião… (null = nada). `historico` = resumo de lista ou observação
 * antiga: lá "depressão" ou "caiu em 2024" é história, então só conta pedido explícito ("precisa de…") ou reunião.
 */
export function motivoDaFrase(frase: string, historico = false): MotivoCaso | null {
  const baixo = semAcento(frase).replace(/[-–]/g, ' ');
  if (/\b(orientad\w*|orientei|orientacao) sobre\b/.test(baixo) && !PRECISA.test(baixo.replace(/\borient\w*/g, ''))) return null;
  let urgente = '';
  for (const [re, nome] of URGENTE) {
    if (historico && nome !== 'pedido urgente') continue;
    const x = baixo.match(re);
    if (x && !negado(baixo, x.index ?? 0) && !MELHOROU.test(baixo.slice(x.index ?? 0))) {
      urgente = nome;
      break;
    }
  }
  const pa = historico ? null : baixo.match(PA_ALTA);
  if (!urgente && pa && Number(pa[1]) >= 70 && Number(pa[1]) > Number(pa[2]) && (Number(pa[1]) >= 180 || Number(pa[2]) >= 110)) urgente = `P.A. ${pa[1]}x${pa[2]}`;
  const gl = historico ? null : baixo.match(GLIC);
  if (!urgente && gl && (Number(gl[1]) >= 300 || (Number(gl[1]) <= 60 && Number(gl[1]) >= 20))) urgente = `glicemia ${gl[1]}`;
  let emulti: string | undefined;
  if (PRECISA.test(baixo) || (!historico && SEM_PRECISA.test(baixo))) {
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
  const categoria: CategoriaCaso = urgente && !SO_IMPORTANTE.has(urgente) ? 'urgente' : emulti === 'Serviço social' ? 'social' : 'importante';
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
 * Casos que o app acha em tudo o que já foi escrito sobre cada pessoa, de qualquer data: anotações e observações
 * das VDs, relatos trazidos, resumo da lista de prioritários, observações do morador e da casa, recado de atenção.
 * Só os que ainda não viraram caso. Urgente só se o texto for recente; senão vira "importante".
 */
export function casosAchados(
  familias: Familia[],
  visitas: Visita[],
  casos: Caso[],
  hoje: string,
  escondidas: Iterable<string> = [],
  prioritarios: Prioritario[] = [],
): CasoAchado[] {
  const fora = new Set(escondidas);
  const porChave = new Map<string, CasoAchado>();
  for (const f of familias) {
    if (f.situacaoCasa !== 'habitada') continue;
    const daCasa = [f.obs, f.atencao].map((t) => t?.trim()).filter((t): t is string => !!t);
    for (const m of f.moradores) {
      if (m.situacao !== 'mora') continue;
      const prio = prioritarios.find((p) => p.moradorId === m.id);
      const textos: TextoDaFamilia[] = [
        ...textosDaPessoa(m, f, visitas, [], prio),
        ...(m.obs?.trim() ? [{ data: '', origem: 'Observação do morador', texto: m.obs.trim() }] : []),
        // Recado e observação da casa: valem para o responsável (ou para quem o texto citar pelo nome).
        ...daCasa.flatMap((t) => {
          const meus = trechosDaPessoa(t, m, f);
          return (meus.length ? meus : f.responsavelId === m.id ? [t] : []).map((texto) => ({ data: '', origem: 'Observação da casa', texto }));
        }),
      ].filter((t) => !t.data || t.data <= hoje);
      for (const t of textos) {
        for (const frase of frases(t.texto)) {
          // Resumo da lista e observações são história: só pedido explícito vira caso.
          const mot = motivoDaFrase(frase, !!t.lista || !t.data);
          if (!mot) continue;
          if (mot.categoria === 'urgente' && (!t.data || t.lista || diferencaDias(t.data, hoje) > DIAS_URGENTE)) mot.categoria = mot.emulti === 'Serviço social' ? 'social' : 'importante';
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
  const linhas = a.provas.map((p) => (p.data ? `${dataCurta(p.data)}: ${p.frase}` : `${p.origem}: ${p.frase}`));
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

/** A partir de quantos dias sem novidade o caso conta como parado (e entra sozinho na pauta). */
export const DIAS_PARADO = 14;

/** Dia da última novidade do caso: a resposta mais nova, a última edição ou quando foi aberto. */
export function ultimaNovidade(c: Caso): string {
  const datas = [(c.novidadeEm ?? c.criadoEm ?? '').slice(0, 10), ...(c.respostas ?? []).map((r) => r.data)];
  return datas.filter(Boolean).sort().pop() ?? '';
}

/** Há quantos dias o caso está sem novidade (0 se não souber). */
export function diasParado(c: Caso, hoje: string): number {
  const u = ultimaNovidade(c);
  return u && u <= hoje ? diferencaDias(u, hoje) : 0;
}

/** "há 3 semanas", "há 10 dias". */
export function textoParado(dias: number): string {
  if (dias >= 60) return `há ${Math.floor(dias / 30)} meses`;
  if (dias >= 14) return `há ${Math.floor(dias / 7)} semanas`;
  return dias === 1 ? 'há 1 dia' : `há ${dias} dias`;
}

/**
 * Ordem dos casos abertos: urgente primeiro; depois os parados (o mais esquecido sobe); depois os que vão para
 * a reunião ou eMulti; por fim os mais antigos.
 */
export function ordenarCasos(casos: Caso[], hoje = ''): Caso[] {
  const parado = (c: Caso) => (hoje ? diasParado(c, hoje) : 0);
  const reuniao = (c: Caso) => (c.npv?.trim() || c.emulti?.trim() ? 0 : 1);
  return [...casos].sort(
    (a, b) =>
      Number(!!a.resolvidoEm) - Number(!!b.resolvidoEm) ||
      Number(a.categoria !== 'urgente') - Number(b.categoria !== 'urgente') ||
      Number(parado(b) >= DIAS_PARADO) - Number(parado(a) >= DIAS_PARADO) ||
      (parado(a) >= DIAS_PARADO && parado(b) >= DIAS_PARADO ? parado(b) - parado(a) : 0) ||
      reuniao(a) - reuniao(b) ||
      PESO[a.categoria] - PESO[b.categoria] ||
      ultimaNovidade(a).localeCompare(ultimaNovidade(b)),
  );
}

/** Quantos casos parados (fora os da reunião) entram por semana na pauta: os mais esquecidos primeiro. */
export const PARADOS_NA_PAUTA = 5;

/**
 * Casos da pauta da reunião: abertos e urgentes, com ponto de reunião/eMulti, e os PARADOS_NA_PAUTA mais esquecidos
 * (parados há DIAS_PARADO dias ou mais). Respondendo, eles saem e os próximos sobem na semana seguinte.
 */
export function casosDaPauta(casos: Caso[], hoje = ''): Caso[] {
  const abertos = casos.filter((c) => !c.resolvidoEm);
  const fixos = abertos.filter((c) => c.categoria === 'urgente' || c.categoria === 'npv' || !!c.npv?.trim() || !!c.emulti?.trim());
  const parados = hoje
    ? abertos
        .filter((c) => !fixos.includes(c) && diasParado(c, hoje) >= DIAS_PARADO)
        .sort((a, b) => diasParado(b, hoje) - diasParado(a, hoje))
        .slice(0, PARADOS_NA_PAUTA)
    : [];
  return ordenarCasos([...fixos, ...parados], hoje);
}

/** Texto da pauta para copiar (WhatsApp da equipe, caderno da reunião). */
export function textoDaPauta(casos: Caso[], endereco: (familiaId: string) => string, dia: string, hoje = ''): string {
  const pauta = casosDaPauta(casos, hoje);
  const linhas = [`Pauta da reunião de equipe${dia ? ` ${dia}` : ''} (${pauta.length} ${pauta.length === 1 ? 'caso' : 'casos'})`];
  pauta.forEach((c, i) => {
    const cat = { urgente: 'URGENTE', importante: 'Importante', social: 'Social', npv: 'NPV' }[c.categoria];
    const parado = hoje ? diasParado(c, hoje) : 0;
    linhas.push(`${i + 1}. [${cat}] ${c.titulo} – ${endereco(c.familiaId)}${c.emulti ? ` – eMulti: ${c.emulti}` : ''}${parado >= DIAS_PARADO ? ` – SEM RESPOSTA ${textoParado(parado).toUpperCase()}` : ''}`);
    const texto = (c.texto.split('\n').find((l) => l.trim()) || c.npv || '').trim();
    if (texto) linhas.push(`   ${texto.length > 180 ? `${texto.slice(0, 180)}…` : texto}`);
    const ultima = c.respostas?.[c.respostas.length - 1];
    if (ultima) linhas.push(`   Última resposta (${dataCurta(ultima.data)}): ${ultima.texto}`);
  });
  return linhas.join('\n');
}
