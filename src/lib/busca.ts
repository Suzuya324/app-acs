import type { Familia, Grupo, Morador } from './tipos';

/** Tira acentos, deixa minúsculo e remove pontuação extra. */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9/.\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Palavras que não ajudam a achar a rua. */
const PALAVRAS_IGNORADAS = new Set([
  'r', 'r.', 'rua', 'av', 'av.', 'avenida', 'tv', 'travessa', 'trav', 'trav.',
  'de', 'da', 'do', 'das', 'dos', 'e', 'n', 'no', 'n.', 'nº', 'numero',
]);

/** "de", "da"… não ajudam a achar a pessoa ("Joana da Silva" = "Joana Silva"). */
const PARTICULAS_NOME = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'd']);

/** Abreviações comuns nos nomes de rua (vale nos dois lados: no que foi digitado e no cadastro). */
const ABREVIACOES: Record<string, string> = {
  pe: 'padre', pde: 'padre', dr: 'doutor', dra: 'doutora', sta: 'santa', sto: 'santo', sr: 'senhor', sra: 'senhora',
  nsa: 'nossa', ns: 'nossa', prof: 'professor', profa: 'professora', cel: 'coronel', gal: 'general', gen: 'general',
  cap: 'capitao', ten: 'tenente', sgt: 'sargento', mal: 'marechal', pres: 'presidente', gov: 'governador',
  dep: 'deputado', ver: 'vereador', eng: 'engenheiro', jd: 'jardim', jdm: 'jardim', vl: 'vila', pq: 'parque',
  res: 'residencial', cond: 'condominio', est: 'estrada', rod: 'rodovia', al: 'alameda', pc: 'praca', pca: 'praca',
  prc: 'praca', bc: 'beco', vla: 'viela', cj: 'conjunto', conj: 'conjunto',
};
const expandir = (p: string) => ABREVIACOES[p.replace(/\.$/, '')] ?? p.replace(/\.$/, '');

function palavras(texto: string): string[] {
  return normalizar(texto).split(' ').filter(Boolean);
}

function palavrasUteis(texto: string): string[] {
  return palavras(texto).filter((p) => !PALAVRAS_IGNORADAS.has(p)).map(expandir);
}

const palavrasDoNome = (nome: string) => palavras(nome).filter((p) => !PARTICULAS_NOME.has(p));

// ---------------------------------------------------------------- escrita parecida

/**
 * Como a palavra "soa" (português do Brasil, bem simples): escrita parecida fica igual.
 * "Souza" = "Sousa", "Luiz" = "Luis", "Acássias" = "Acácias", "Thiago" = "Tiago", "Helena" = "Elena", "Anna" = "Ana".
 */
export function fonetica(palavra: string): string {
  let s = normalizar(palavra).replace(/[^a-z]/g, '');
  s = s
    .replace(/ch|sh/g, 'x')
    .replace(/lh/g, 'li')
    .replace(/nh/g, 'ni')
    .replace(/ph/g, 'f')
    .replace(/th/g, 't')
    .replace(/qu(?=[ei])/g, 'k')
    .replace(/gu(?=[ei])/g, 'G')
    .replace(/g(?=[ei])/g, 'j')
    .replace(/G/g, 'g')
    .replace(/sc(?=[ei])/g, 's')
    .replace(/c(?=[ei])/g, 's')
    .replace(/[cq]/g, 'k')
    .replace(/z/g, 's')
    .replace(/y/g, 'i')
    .replace(/w/g, 'v')
    .replace(/^h/, '')
    .replace(/(.)\1+/g, '$1')
    .replace(/m$/, 'n');
  return s;
}

/** Quantas letras é preciso trocar, pôr ou tirar para uma palavra virar a outra. */
export function distancia(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let ant = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const at = [i];
    for (let j = 1; j <= b.length; j++) at[j] = Math.min(ant[j] + 1, at[j - 1] + 1, ant[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    ant = at;
  }
  return ant[b.length];
}

/** 0 = começa igual; 1 = soa igual; 2 = uma letra de diferença (palavras de 5 letras ou mais); -1 = não bate. */
function nivelPalavra(q: string, alvo: string, tolerante: boolean): number {
  if (alvo.startsWith(q)) return 0;
  if (!tolerante || q.length < 3 || /\d/.test(q)) return -1;
  const fq = fonetica(q);
  const fa = fonetica(alvo);
  if (fq.length >= 3 && fa.startsWith(fq)) return 1;
  if (q.length >= 5) {
    // Compara com o começo do alvo (do mesmo tamanho, ou uma letra a mais ou a menos).
    for (const n of [q.length, q.length - 1, q.length + 1]) {
      if (n <= alvo.length && n >= 4 && distancia(q, alvo.slice(0, n)) <= 1) return 2;
    }
  }
  return -1;
}

/** Cada palavra da busca precisa bater com alguma palavra do alvo. Devolve o pior nível (ou -1). */
function todasBatem(busca: string[], alvo: string[], tolerante: boolean): number {
  let pior = 0;
  for (const b of busca) {
    let melhor = -1;
    for (const a of alvo) {
      const n = nivelPalavra(b, a, tolerante);
      if (n >= 0 && (melhor < 0 || n < melhor)) melhor = n;
      if (melhor === 0) break;
    }
    if (melhor < 0) return -1;
    pior = Math.max(pior, melhor);
  }
  return pior;
}

/**
 * Procurar num texto qualquer (nome, endereço, prontuário…): cada palavra digitada precisa bater com o começo de
 * alguma palavra do texto, aceitando escrita parecida e uma letra errada. Usado nas buscas das outras telas.
 */
export function combina(texto: string, consulta: string): boolean {
  const q = palavras(consulta).filter((p) => !PARTICULAS_NOME.has(p)).map(expandir);
  if (!q.length) return true;
  const alvo = palavras(texto).map(expandir);
  if (todasBatem(q, alvo, false) >= 0) return true;
  // Números (casa, prontuário) não podem estar "errados": só as palavras ganham tolerância.
  return todasBatem(q, alvo, true) >= 0;
}

// ---------------------------------------------------------------- busca única

export type MotivoBusca = 'endereco' | 'nome' | 'prontuario' | 'grupo' | 'telefone' | 'referencia' | 'nascimento';

export interface ResultadoBusca {
  familia: Familia;
  /** Por que esta família apareceu. */
  motivo: MotivoBusca;
  /** Moradores cujo nome (ou nascimento) bateu com a busca, ou que estão no grupo. */
  moradores: Morador[];
  /** Achado por escrita parecida (ex.: "Acássias" → "Acácias"): mostrar "parecido". */
  parecido?: boolean;
}

/** Palavras que buscam um grupo (o começo já basta: "hipert", "diab", "acam"). */
const PALAVRAS_GRUPO: [string, Grupo][] = [
  ['gestantes', 'gestante'], ['gravidas', 'gestante'],
  ['puerperas', 'puerpera'],
  ['criancas', 'crianca'], ['bebes', 'crianca'],
  ['idosos', 'idoso'], ['idosas', 'idoso'],
  ['acamados', 'acamado'], ['acamadas', 'acamado'],
  ['hipertensos', 'hipertenso'], ['hipertensas', 'hipertenso'], ['pressao alta', 'hipertenso'],
  ['diabeticos', 'diabetico'], ['diabeticas', 'diabetico'],
  ['deficiencia', 'deficiencia'], ['deficientes', 'deficiencia'], ['pcd', 'deficiencia'],
  ['saude mental', 'saude_mental'], ['mental', 'saude_mental'],
  ['oxigenio', 'oxigenio'],
  ['avc', 'avc'], ['infarto', 'avc'],
  ['coracao', 'coracao'], ['cardiaco', 'coracao'], ['cardiopatia', 'coracao'], ['arritmia', 'coracao'],
  ['cancer', 'cancer'], ['oncologia', 'cancer'],
  ['cirurgia', 'cirurgia'], ['operado', 'cirurgia'],
  ['alzheimer', 'alzheimer'], ['demencia', 'alzheimer'], ['paliativo', 'alzheimer'],
];

/** Grupo buscado, ex.: "gestante", "hipertensos", "acam" (pelo menos 4 letras, ou "pcd"). */
export function grupoDaBusca(consulta: string): Grupo | null {
  const q = normalizar(consulta);
  if (q.length < 3 || (q.length < 4 && q !== 'pcd' && q !== 'avc')) return null;
  for (const [palavra, grupo] of PALAVRAS_GRUPO) {
    if (palavra.startsWith(q) || (q.startsWith(palavra.slice(0, -1)) && q.length <= palavra.length + 1)) return grupo;
  }
  return null;
}

/** "10/03", "10/03/1950", "10/3/50" → partes da data (ou null). */
function dataDaBusca(q: string): { d: string; m: string; a?: string } | null {
  const x = q.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/);
  if (!x) return null;
  return { d: x[1].padStart(2, '0'), m: x[2].padStart(2, '0'), a: x[3] };
}

/** Número da casa bate? "90" acha "90" e "90A"; "90a" só acha "90A". */
function numeroBate(numCasa: string, numero: string): boolean {
  if (numCasa === numero) return true;
  return /^\d+$/.test(numero) && numCasa.startsWith(numero) && /^[a-z]$/.test(numCasa.slice(numero.length));
}

/** Ordem dos resultados: grupo, endereço e prontuário primeiro; o que foi achado por escrita parecida por último. */
const ORDEM_MOTIVO: Record<MotivoBusca, number> = { grupo: -1, endereco: 0, prontuario: 1, nome: 2, nascimento: 3, telefone: 4, referencia: 5 };

function buscarUmaVez(familias: Familia[], q: string, tolerante: boolean): ResultadoBusca[] {
  const termos = palavrasUteis(q);
  const numeros = termos.filter((t) => /^\d+[a-z]?$/.test(t) || t === 's/n' || t === 'sn');
  const textos = termos.filter((t) => !numeros.includes(t));
  const numero = numeros[0]?.replace(/^sn$/, 's/n');
  const qCompacto = q.replace(/\s/g, '');
  const digitos = q.replace(/\D/g, '');
  const soNumero = textos.length === 0 && numeros.length === 1;
  const data = dataDaBusca(q);
  const nomeBusca = palavras(q).filter((p) => !PARTICULAS_NOME.has(p));
  const nomeTextos = nomeBusca.filter((p) => !/^\d+[a-z]?$/.test(p));
  const resultados: ResultadoBusca[] = [];

  for (const f of familias) {
    const parecido = tolerante || undefined;
    // 1) Endereço: as palavras batem com a rua (ou com o complemento) e o número com o da casa.
    const palRua = palavrasUteis(f.rua);
    const palComp = palavras(f.complemento);
    const numCasa = normalizar(f.numero);
    if (textos.length > 0) {
      const naRua = textos.filter((t) => todasBatem([t], palRua, tolerante) >= 0);
      const noComp = textos.filter((t) => !naRua.includes(t));
      const ruaOk = naRua.length > 0 && (noComp.length === 0 || todasBatem(noComp, palComp, tolerante) >= 0);
      const numOk = numero === undefined || numeroBate(numCasa, numero);
      const outrosNumOk = numeros.slice(1).every((n) => palComp.includes(n));
      if (ruaOk && numOk && outrosNumOk) {
        resultados.push({ familia: f, motivo: 'endereco', moradores: [], parecido });
        continue;
      }
      // Rua + nome ("acácias joana"): as palavras que não são da rua batem com alguém da casa.
      if (naRua.length > 0 && noComp.length > 0 && numOk) {
        const achados = f.moradores.filter((m) => todasBatem(noComp, palavrasDoNome(m.nome), tolerante) >= 0);
        if (achados.length) {
          resultados.push({ familia: f, motivo: 'nome', moradores: achados, parecido });
          continue;
        }
      }
    } else if (soNumero && numeroBate(numCasa, numero!)) {
      resultados.push({ familia: f, motivo: 'endereco', moradores: [] });
      continue;
    }

    // 2) Prontuário: só números (3 ou mais dígitos) ou com ponto, ex.: "04.0123".
    const pront = normalizar(f.prontuario).replace(/\s/g, '');
    const prontDigitos = pront.replace(/\D/g, '');
    const porDigitos = soNumero && qCompacto.length >= 3 && /^\d+$/.test(qCompacto) && prontDigitos.includes(qCompacto);
    const comPonto = /\d/.test(qCompacto) && qCompacto.includes('.') && pront.includes(qCompacto);
    if (pront && (porDigitos || comPonto) && !tolerante) {
      resultados.push({ familia: f, motivo: 'prontuario', moradores: [] });
      continue;
    }

    // 3) Data de nascimento de alguém da casa.
    if (data && !tolerante) {
      const achados = f.moradores.filter((m) => {
        if (!m.nascimento) return false;
        const [a, mes, d] = m.nascimento.split('-');
        return d === data.d && mes === data.m && (!data.a || a === data.a || a.endsWith(data.a));
      });
      if (achados.length) resultados.push({ familia: f, motivo: 'nascimento', moradores: achados });
      continue;
    }

    // 4) Nome de morador (pode vir com o número da casa: "joana 90").
    if (nomeTextos.length > 0 && (numeros.length === 0 || (numeros.length === 1 && numeroBate(numCasa, numero!)))) {
      const achados = f.moradores.filter((m) => todasBatem(nomeTextos, palavrasDoNome(m.nome), tolerante) >= 0);
      if (achados.length) {
        resultados.push({ familia: f, motivo: 'nome', moradores: achados, parecido });
        continue;
      }
    }

    // 5) Telefone (4 dígitos ou mais).
    if (!tolerante && f.telefone && digitos.length >= 4 && /^[\d\s().-]+$/.test(q) && f.telefone.replace(/\D/g, '').includes(digitos)) {
      resultados.push({ familia: f, motivo: 'telefone', moradores: [] });
      continue;
    }

    // 6) Ponto de referência ("portão azul", "perto da padaria").
    if (!tolerante && f.referencia && textos.length > 0 && numeros.length === 0 && textos.join('').length >= 4) {
      if (todasBatem(textos, palavras(f.referencia), false) >= 0) resultados.push({ familia: f, motivo: 'referencia', moradores: [] });
    }
  }
  return resultados;
}

/**
 * Busca única: acha a família por "rua + número" ("Acácias 90", "Ipe 310", "ac 90", "acácias 30 casa 2"),
 * pelo nome de um morador (também "joana 90"), pelo prontuário, pela data de nascimento ("10/03/1950"),
 * pelo telefone, pelo ponto de referência ou pelo grupo ("gestante"). Aceita escrita parecida e uma letra
 * errada ("Acássias", "Souza"/"Sousa"); esses resultados vêm marcados como "parecido".
 */
export function buscar(familias: Familia[], consulta: string): ResultadoBusca[] {
  const q = normalizar(consulta);
  if (!q) return [];

  const resultados: ResultadoBusca[] = [];
  // 0) Grupo ("gestante", "acamados", "hipertens"…): famílias com moradores desse grupo.
  const grupo = grupoDaBusca(q);
  const jaNoGrupo = new Set<string>();
  if (grupo) {
    for (const f of familias) {
      const doGrupo = f.moradores.filter((m) => m.situacao === 'mora' && m.grupos.includes(grupo));
      if (doGrupo.length) {
        resultados.push({ familia: f, motivo: 'grupo', moradores: doGrupo });
        jaNoGrupo.add(f.id);
      }
    }
  }
  const resto = familias.filter((f) => !jaNoGrupo.has(f.id));
  const exatos = buscarUmaVez(resto, q, false);
  resultados.push(...exatos);
  // Poucos achados: completa com os de escrita parecida (marcados). Busca por grupo não precisa.
  if (!grupo && resultados.length < 5) {
    const ja = new Set(resultados.map((r) => r.familia.id));
    resultados.push(...buscarUmaVez(resto, q, true).filter((r) => !ja.has(r.familia.id)));
  }
  return resultados
    .map((r, i) => ({ r, i }))
    .sort((a, b) => Number(!!a.r.parecido) - Number(!!b.r.parecido) || ORDEM_MOTIVO[a.r.motivo] - ORDEM_MOTIVO[b.r.motivo] || a.i - b.i)
    .map((x) => x.r);
}
