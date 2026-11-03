// Importador da área a partir de um arquivo CSV (planilha) montado pelo ACS.
//
// Formato combinado (CLAUDE.md):
//   Casa;Rua;Numero;Complemento;Bairro;Prontuario;Nome;Sexo;Data de nascimento
// Uma linha por morador. A coluna Casa (C001, C002…) junta os moradores da mesma família.
//
// O importador é "tolerante": aceita ; , ou TAB como separador, com ou sem BOM, em UTF-8 ou
// no formato antigo do Excel (Windows-1252), conserta acentos quebrados ("JosÃ©" → "José"),
// aceita colunas fora de ordem e nomes de coluna com ou sem acento.

import { novoId } from './ids';
import type { Familia, Morador, Sexo } from './tipos';

export interface Aviso {
  /** Número da linha no arquivo (1 = cabeçalho). 0 = aviso geral. */
  linha: number;
  texto: string;
}

export interface ResultadoImportacao {
  familias: Familia[];
  avisos: Aviso[];
  /** Problemas que impedem a importação (ex.: falta a coluna Nome). */
  erros: string[];
  resumo: { ruas: { rua: string; familias: number }[]; familias: number; moradores: number };
}

// ---------------------------------------------------------------- texto

/** Transforma os bytes do arquivo em texto, descobrindo a codificação. */
export function decodificar(bytes: Uint8Array): string {
  let texto: string;
  try {
    texto = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    // Não é UTF-8 válido: provavelmente salvo pelo Excel antigo (Windows-1252 / Latin-1).
    texto = new TextDecoder('windows-1252').decode(bytes);
  }
  return consertarAcentos(texto.replace(/^\uFEFF/, ''));
}

/** Conserta texto com acentos "quebrados" por dupla codificação (ex.: "JosÃ©" → "José"). */
export function consertarAcentos(texto: string): string {
  if (!/[\u00C3\u00C2][\u0080-\u00BF]/.test(texto)) return texto;
  if ([...texto].some((c) => c.charCodeAt(0) > 255)) return texto;
  try {
    const bytes = new Uint8Array([...texto].map((c) => c.charCodeAt(0)));
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return texto;
  }
}

/** Descobre o separador olhando a primeira linha (cabeçalho). */
export function descobrirSeparador(primeiraLinha: string): string {
  const conta = (c: string) => primeiraLinha.split(c).length - 1;
  const opcoes = [';', '\t', ','].map((c) => [c, conta(c)] as const);
  opcoes.sort((a, b) => b[1] - a[1]);
  return opcoes[0][1] > 0 ? opcoes[0][0] : ';';
}

/** Lê o CSV em linhas e colunas (aceita campos entre aspas, com ; ou quebra de linha dentro). */
export function lerLinhas(texto: string, sep: string): string[][] {
  const linhas: string[][] = [];
  let campo = '';
  let linha: string[] = [];
  let aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      if (c === '"') {
        if (texto[i + 1] === '"') {
          campo += '"';
          i++;
        } else aspas = false;
      } else campo += c;
    } else if (c === '"' && campo.trim() === '') {
      aspas = true;
      campo = '';
    } else if (c === sep) {
      linha.push(campo);
      campo = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      linha.push(campo);
      linhas.push(linha);
      linha = [];
      campo = '';
    } else campo += c;
  }
  if (campo !== '' || linha.length) {
    linha.push(campo);
    linhas.push(linha);
  }
  return linhas;
}

// ---------------------------------------------------------------- colunas

type Coluna = 'casa' | 'rua' | 'numero' | 'complemento' | 'bairro' | 'prontuario' | 'nome' | 'sexo' | 'nascimento';

const SINONIMOS: Record<Coluna, string[]> = {
  casa: ['casa', 'familia', 'domicilio', 'cod casa', 'codigo casa'],
  rua: ['rua', 'logradouro', 'endereco'],
  numero: ['numero', 'n', 'no', 'num', 'nº'],
  complemento: ['complemento', 'compl', 'comp'],
  bairro: ['bairro'],
  prontuario: ['prontuario', 'pront', 'prontuario familiar', 'n prontuario'],
  nome: ['nome', 'nome completo', 'morador', 'nome do morador'],
  sexo: ['sexo', 'genero'],
  nascimento: ['data de nascimento', 'nascimento', 'data nascimento', 'dt nascimento', 'dn', 'data de nasc', 'dt nasc'],
};

const OBRIGATORIAS: Coluna[] = ['casa', 'rua', 'nome'];

function normalizarCabecalho(t: string): string {
  return t
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[._:/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function mapearColunas(cabecalho: string[]): { mapa: Partial<Record<Coluna, number>>; faltando: Coluna[] } {
  const mapa: Partial<Record<Coluna, number>> = {};
  cabecalho.forEach((titulo, i) => {
    const t = normalizarCabecalho(titulo);
    for (const [col, nomes] of Object.entries(SINONIMOS) as [Coluna, string[]][]) {
      if (mapa[col] === undefined && nomes.includes(t)) mapa[col] = i;
    }
  });
  return { mapa, faltando: OBRIGATORIAS.filter((c) => mapa[c] === undefined) };
}

const NOME_COLUNA: Record<Coluna, string> = {
  casa: 'Casa',
  rua: 'Rua',
  numero: 'Numero',
  complemento: 'Complemento',
  bairro: 'Bairro',
  prontuario: 'Prontuario',
  nome: 'Nome',
  sexo: 'Sexo',
  nascimento: 'Data de nascimento',
};

// ---------------------------------------------------------------- valores

/** "05/03/1980", "5/3/1980", "05-03-1980", "1980-03-05" → "1980-03-05". Retorna null se inválida. */
export function lerData(t: string, hoje: string): string | null {
  const s = t.trim();
  if (!s) return '';
  let d: number, m: number, a: number;
  let r = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (r) [d, m, a] = [Number(r[1]), Number(r[2]), Number(r[3])];
  else if ((r = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) [a, m, d] = [Number(r[1]), Number(r[2]), Number(r[3])];
  else return null;
  const data = new Date(a, m - 1, d);
  if (data.getFullYear() !== a || data.getMonth() !== m - 1 || data.getDate() !== d) return null;
  const iso = `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  if (iso > hoje || a < 1890) return null;
  return iso;
}

export function lerSexo(t: string): Sexo | null {
  const s = normalizarCabecalho(t);
  if (!s) return '';
  if (['m', 'masc', 'masculino', 'h', 'homem'].includes(s)) return 'M';
  if (['f', 'fem', 'feminino', 'mulher'].includes(s)) return 'F';
  return null;
}

export function lerNumero(t: string): string {
  const s = t.trim();
  if (!s || /^s\s*\/?\s*n\.?$/i.test(s) || /^sem\s*n[uú]mero$/i.test(s)) return 'S/N';
  return s;
}

/** Deixa "MARIA DA SILVA" como "Maria da Silva" (só se o nome veio todo em maiúsculas). */
export function arrumarNome(t: string): string {
  const s = t.trim().replace(/\s+/g, ' ');
  if (s !== s.toUpperCase()) return s;
  const minusculas = new Set(['da', 'de', 'do', 'das', 'dos', 'e']);
  return s
    .toLowerCase()
    .split(' ')
    .map((p, i) => (i > 0 && minusculas.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(' ');
}

// ---------------------------------------------------------------- importar

export function importarCSV(texto: string, hoje: string): ResultadoImportacao {
  const avisos: Aviso[] = [];
  const erros: string[] = [];
  const vazio: ResultadoImportacao = { familias: [], avisos, erros, resumo: { ruas: [], familias: 0, moradores: 0 } };

  const limpo = consertarAcentos(texto.replace(/^\uFEFF/, ''));
  const primeira = limpo.split(/\r?\n/).find((l) => l.trim()) ?? '';
  if (!primeira) {
    erros.push('O arquivo está vazio.');
    return vazio;
  }
  const sep = descobrirSeparador(primeira);
  const linhas = lerLinhas(limpo, sep);
  const iCab = linhas.findIndex((l) => l.some((c) => c.trim()));
  const { mapa, faltando } = mapearColunas(linhas[iCab]);
  if (faltando.length) {
    erros.push(
      `Faltam as colunas: ${faltando.map((c) => NOME_COLUNA[c]).join(', ')}. ` +
        `O cabeçalho precisa ser: Casa;Rua;Numero;Complemento;Bairro;Prontuario;Nome;Sexo;Data de nascimento`,
    );
    return vazio;
  }

  const pegar = (l: string[], c: Coluna) => (mapa[c] === undefined ? '' : (l[mapa[c]!] ?? '').trim());
  const porCasa = new Map<string, Familia>();
  const ordem: Familia[] = [];

  for (let i = iCab + 1; i < linhas.length; i++) {
    const l = linhas[i];
    const n = i + 1; // número da linha como aparece na planilha
    if (!l.some((c) => c.trim())) continue;

    const nome = arrumarNome(pegar(l, 'nome'));
    const casa = pegar(l, 'casa').toUpperCase();
    if (!nome) {
      avisos.push({ linha: n, texto: 'Linha sem nome: ignorada.' });
      continue;
    }
    if (!casa) {
      avisos.push({ linha: n, texto: `${nome}: sem código da Casa: ignorado.` });
      continue;
    }

    const rua = arrumarNome(pegar(l, 'rua'));
    const numero = lerNumero(pegar(l, 'numero'));
    const complemento = pegar(l, 'complemento');
    const prontuario = pegar(l, 'prontuario');

    let fam = porCasa.get(casa);
    if (!fam) {
      if (!rua) avisos.push({ linha: n, texto: `Casa ${casa}: sem rua.` });
      fam = {
        id: novoId('f'),
        rua,
        numero,
        complemento,
        bairro: arrumarNome(pegar(l, 'bairro')),
        colmeia: '',
        prontuario,
        situacaoCasa: 'habitada',
        obs: '',
        responsavelId: '',
        moradores: [],
      };
      porCasa.set(casa, fam);
      ordem.push(fam);
    } else {
      if ((rua && rua !== fam.rua) || numero !== fam.numero) {
        avisos.push({ linha: n, texto: `Casa ${casa}: endereço diferente das outras linhas da mesma casa (ficou ${fam.rua}, ${fam.numero}).` });
      }
      if (prontuario && !fam.prontuario) fam.prontuario = prontuario;
      else if (prontuario && prontuario !== fam.prontuario) {
        avisos.push({ linha: n, texto: `Casa ${casa}: prontuário diferente (${prontuario}); ficou ${fam.prontuario}.` });
      }
    }

    const sexoTxt = pegar(l, 'sexo');
    let sexo = lerSexo(sexoTxt);
    if (sexo === null) {
      avisos.push({ linha: n, texto: `${nome}: sexo "${sexoTxt}" não reconhecido (use M ou F). Ficou em branco.` });
      sexo = '';
    }

    const dataTxt = pegar(l, 'nascimento');
    let nascimento = lerData(dataTxt, hoje);
    if (nascimento === null) {
      avisos.push({ linha: n, texto: `${nome}: data de nascimento "${dataTxt}" inválida (use dd/mm/aaaa). Ficou em branco.` });
      nascimento = '';
    }

    if (fam.moradores.some((m) => m.nome === nome && m.nascimento === nascimento)) {
      avisos.push({ linha: n, texto: `${nome}: aparece repetido na casa ${casa}. A repetição foi ignorada.` });
      continue;
    }

    const morador: Morador = {
      id: novoId('m'),
      nome,
      sexo,
      nascimento,
      situacao: 'mora',
      situacaoDesde: '',
      grupos: [],
      obs: '',
    };
    fam.moradores.push(morador);
    // O primeiro morador de cada casa no arquivo vira o responsável (dá para trocar no app).
    if (!fam.responsavelId) fam.responsavelId = morador.id;
  }

  if (!ordem.length) erros.push('Nenhum morador encontrado no arquivo.');

  const contagemRuas = new Map<string, number>();
  for (const f of ordem) contagemRuas.set(f.rua, (contagemRuas.get(f.rua) ?? 0) + 1);

  return {
    familias: ordem,
    avisos,
    erros,
    resumo: {
      ruas: [...contagemRuas.entries()].map(([rua, familias]) => ({ rua, familias })),
      familias: ordem.length,
      moradores: ordem.reduce((s, f) => s + f.moradores.length, 0),
    },
  };
}

/** "2 ruas, 198 famílias, 542 moradores" */
export function textoResumo(r: ResultadoImportacao['resumo']): string {
  const p = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
  return `${p(r.ruas.length, 'rua', 'ruas')}, ${p(r.familias, 'família', 'famílias')}, ${p(r.moradores, 'morador', 'moradores')}`;
}
