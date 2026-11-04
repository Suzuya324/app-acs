// Importador de LISTA EM TEXTO (não é planilha). Exemplo do formato (dados inventados):
//
//   CASAS E MORADORES - ACS FULANO (MICRO 00)
//   TOTAL: 3 casas/famílias e 5 moradores cadastrados
//   ==========================================
//   RUA DAS ACÁCIAS - 2 casas/famílias, 4 moradores
//   ==========================================
//
//   Acácias 12 FUNDOS  (pront. 0000.00.001, 3 moradores)
//      - Fulana de Tal Teste (14/03/1958)
//      - Ciclano de Tal Teste (02/11/1955)
//      - Bebê Teste (recém-nascido, ainda não cadastrado)
//
//   Acácias S/Nº  (pront. -, 1 morador)
//      - Beltrana Exemplo (21/07/1990)
//
// Regras:
// - linha com "-" (ou •, *) no começo = morador;
// - linha logo acima dos moradores = casa/família (endereço + informações entre parênteses);
// - linha começando com Rua/Avenida/Travessa… sem moradores embaixo = título da rua;
// - "TOTAL: X casas … Y moradores" e as contagens de cada rua/casa são usados para CONFERIR.

import { normalizar } from './busca';
import { novoId } from './ids';
import { arrumarNome, lerData, lerSexo, type Aviso, type ResultadoImportacao } from './importar-csv';
import type { Familia, Morador, Sexo } from './tipos';

const MARCADOR = /^\s*[-•*–—]\s+(.+)$/;
const SEPARADOR = /^\s*[=_~#*-]{3,}\s*$/;
const PALAVRA_DE_RUA =
  /^(rua|r\.|avenida|av\.?|travessa|tv\.?|trav\.?|alameda|al\.|estrada|estr\.|viela|pra[cç]a|beco|largo|rodovia|passagem|vila)\s+/i;
const DATA = /\b\d{1,2}[/.-]\d{1,2}[/.-]\d{4}\b/;
const IGNORAR_PALAVRAS = new Set(['rua', 'r', 'av', 'avenida', 'travessa', 'tv', 'trav', 'de', 'da', 'do', 'das', 'dos', 'e']);

/** O texto parece uma lista com marcadores "- " (e não uma planilha)? */
export function pareceListaEmTexto(texto: string): boolean {
  const linhas = texto.split(/\r?\n/).filter((l) => l.trim());
  const marcadas = linhas.filter((l) => MARCADOR.test(l)).length;
  return marcadas >= 1 && marcadas >= linhas.length * 0.2;
}

function palavrasUteis(t: string): string[] {
  return normalizar(t)
    .split(' ')
    .map((p) => p.replace(/\.$/, ''))
    .filter((p) => p && !IGNORAR_PALAVRAS.has(p));
}

/** "S/N", "S/Nº", "SN", "s/n°" */
function ehSemNumero(t: string): boolean {
  return /^s\s*\/?\s*n[º°o]?\.?$/i.test(t);
}

/** Lê o título de rua: "RUA DAS ACÁCIAS - 2 casas/famílias, 4 moradores". */
function lerTituloRua(linha: string): { rua: string; familias?: number; moradores?: number } | null {
  const t = linha.trim();
  if (!PALAVRA_DE_RUA.test(t)) return null;
  const [nome, ...resto] = t.split(/\s+[-–—:]\s+/);
  const contagem = resto.join(' ').match(/(\d+)\s*casas?[^\d]*?(\d+)\s*moradores?/i);
  return {
    rua: arrumarNome(nome),
    familias: contagem ? Number(contagem[1]) : undefined,
    moradores: contagem ? Number(contagem[2]) : undefined,
  };
}

/** Separa o texto entre parênteses do fim da linha: "Acácias 12 (pront. 1, 3 moradores)". */
function separarInfo(linha: string): { texto: string; info: string } {
  const m = linha.trim().match(/^(.*?)\s*\(([^()]*)\)\s*$/);
  return m ? { texto: m[1].trim(), info: m[2] } : { texto: linha.trim(), info: '' };
}

export function importarListaTexto(texto: string, hoje: string): ResultadoImportacao {
  const avisos: Aviso[] = [];
  const erros: string[] = [];
  const linhas = texto.replace(/^\uFEFF/, '').split(/\r?\n/);
  const familias: Familia[] = [];
  const ruasConhecidas: string[] = [];
  const esperadoPorRua = new Map<string, { familias?: number; moradores?: number }>();
  const referenciasAvisadas = new Set<string>();
  let totalInformado: ResultadoImportacao['totalInformado'];
  let ruaAtual = '';
  let familiaAtual: (Familia & { _esperados?: number; _linha: number }) | null = null;

  const proximaNaoVazia = (i: number) => {
    for (let j = i + 1; j < linhas.length; j++) if (linhas[j].trim()) return linhas[j];
    return '';
  };

  /** Descobre a rua de "Acácias 12 FUNDOS" usando os títulos de rua já lidos. */
  const resolverRua = (referencia: string, n: number): string => {
    if (!referencia) return ruaAtual;
    if (PALAVRA_DE_RUA.test(referencia)) {
      const rua = arrumarNome(referencia);
      if (!ruasConhecidas.includes(rua)) ruasConhecidas.push(rua);
      return rua;
    }
    const busca = palavrasUteis(referencia);
    const candidatas = ruaAtual ? [ruaAtual, ...ruasConhecidas.filter((r) => r !== ruaAtual)] : ruasConhecidas;
    const achou = candidatas.find((r) => {
      const alvo = palavrasUteis(r);
      return busca.length > 0 && busca.every((b) => alvo.some((a) => a.startsWith(b)));
    });
    if (achou) return achou;
    const rua = arrumarNome(referencia);
    if (!referenciasAvisadas.has(rua)) {
      referenciasAvisadas.add(rua);
      avisos.push({ linha: n, texto: `"${referencia}" não bate com nenhum título de rua; ficou como rua "${rua}". Dá para corrigir depois.` });
    }
    return rua;
  };

  for (let i = 0; i < linhas.length; i++) {
    const bruta = linhas[i];
    const n = i + 1;
    const linha = bruta.trim();
    if (!linha || SEPARADOR.test(linha)) continue;

    // TOTAL: 120 casas/famílias e 350 moradores
    const total = linha.match(/^total\b[^\d]*(\d+)\s*casas?[^\d]*?(\d+)\s*moradores?/i);
    if (total) {
      totalInformado = { familias: Number(total[1]), moradores: Number(total[2]) };
      continue;
    }

    const marcado = bruta.match(MARCADOR);
    if (marcado) {
      if (!familiaAtual) {
        avisos.push({ linha: n, texto: `Morador sem casa acima dele: ignorado.` });
        continue;
      }
      const morador = lerMorador(marcado[1], hoje, n, avisos);
      if (!morador) continue;
      familiaAtual.moradores.push(morador);
      if (!familiaAtual.responsavelId) familiaAtual.responsavelId = morador.id;
      continue;
    }

    const { texto: endereco, info } = separarInfo(linha);
    const ehFamilia = MARCADOR.test(proximaNaoVazia(i)) || /pront/i.test(info);

    if (!ehFamilia) {
      const titulo = lerTituloRua(linha);
      if (titulo) {
        ruaAtual = titulo.rua;
        if (!ruasConhecidas.includes(ruaAtual)) ruasConhecidas.push(ruaAtual);
        esperadoPorRua.set(ruaAtual, { familias: titulo.familias, moradores: titulo.moradores });
      }
      // Outras linhas (título do relatório, fonte, data…) são ignoradas.
      continue;
    }

    // ---- Linha de casa/família ----
    const tokens = endereco.replace(/,/g, ' ').split(/\s+/).filter(Boolean);
    const iNum = tokens.findIndex((t) => /^\d+[A-Za-z]?$/.test(t) || ehSemNumero(t));
    let numero = 'S/N';
    let antes: string[];
    let complemento = '';
    if (iNum >= 0) {
      numero = ehSemNumero(tokens[iNum]) ? 'S/N' : tokens[iNum].toUpperCase();
      antes = tokens.slice(0, iNum).filter((t) => !/^n[º°o]?\.?$/i.test(t));
      complemento = tokens
        .slice(iNum + 1)
        .join(' ')
        .replace(/^[-–—]\s*/, '')
        .trim();
    } else {
      antes = tokens;
      avisos.push({ linha: n, texto: `"${endereco}": não achei o número da casa; ficou S/N.` });
    }
    // "Rua X - 90" deixa um "-" sobrando no fim do nome da rua
    while (antes.length && /^[-–—]$/.test(antes[antes.length - 1])) antes.pop();

    const rua = resolverRua(antes.join(' '), n);
    if (!rua) avisos.push({ linha: n, texto: `"${endereco}": sem rua.` });

    const pront = info.match(/pront[a-zçãáº.]*\s*:?\s*([^,;]+)/i)?.[1].trim() ?? '';
    const esperados = info.match(/(\d+)\s*morador/i);

    fecharFamilia(familiaAtual, avisos);
    familiaAtual = {
      id: novoId('f'),
      rua,
      numero,
      complemento,
      bairro: '',
      colmeia: '',
      prontuario: /^[-–—\s]*$/.test(pront) ? '' : pront,
      situacaoCasa: 'habitada',
      obs: '',
      responsavelId: '',
      moradores: [],
      _esperados: esperados ? Number(esperados[1]) : undefined,
      _linha: n,
    };
    familias.push(familiaAtual);
  }
  fecharFamilia(familiaAtual, avisos);

  // Limpa os campos internos de conferência.
  const finais: Familia[] = familias.map((f) => {
    const { _esperados, _linha, ...resto } = f as Familia & { _esperados?: number; _linha?: number };
    void _esperados;
    void _linha;
    return resto;
  });

  if (!finais.length) erros.push('Não encontrei nenhuma casa com moradores no texto.');

  // Confere as contagens de cada rua com o título.
  for (const [rua, esperado] of esperadoPorRua) {
    const daRua = finais.filter((f) => f.rua === rua);
    const mor = daRua.reduce((s, f) => s + f.moradores.length, 0);
    if (esperado.familias !== undefined && esperado.familias !== daRua.length) {
      avisos.push({ linha: 0, texto: `${rua}: o título diz ${esperado.familias} casas, encontrei ${daRua.length}.` });
    }
    if (esperado.moradores !== undefined && esperado.moradores !== mor) {
      avisos.push({ linha: 0, texto: `${rua}: o título diz ${esperado.moradores} moradores, encontrei ${mor}.` });
    }
  }

  const contagemRuas = new Map<string, number>();
  for (const f of finais) contagemRuas.set(f.rua, (contagemRuas.get(f.rua) ?? 0) + 1);

  return {
    familias: finais,
    avisos,
    erros,
    agrupamento: 'lista',
    totalInformado,
    resumo: {
      ruas: [...contagemRuas.entries()].map(([rua, n]) => ({ rua, familias: n })),
      familias: finais.length,
      moradores: finais.reduce((s, f) => s + f.moradores.length, 0),
    },
  };
}

function fecharFamilia(f: (Familia & { _esperados?: number; _linha: number }) | null, avisos: Aviso[]) {
  if (!f) return;
  if (f._esperados !== undefined && f._esperados !== f.moradores.length) {
    avisos.push({
      linha: f._linha,
      texto: `${f.rua}, ${f.numero}${f.complemento ? ` ${f.complemento}` : ''}: o texto diz ${f._esperados} morador(es), encontrei ${f.moradores.length}.`,
    });
  }
}

/** "Fulana de Tal (14/03/1958)", "Fulano - 01/02/1990 - M", "Bebê (recém-nascido, ainda não cadastrado)" */
function lerMorador(texto: string, hoje: string, n: number, avisos: Aviso[]): Morador | null {
  let nascimento = '';
  let sexo: Sexo = '';
  const obs: string[] = [];

  const partes: string[] = [];
  let nome = texto.replace(/\(([^)]*)\)/g, (_m, dentro: string) => {
    partes.push(...dentro.split(/[,;]/));
    return ' ';
  });
  // Data solta fora dos parênteses
  const solta = nome.match(DATA);
  if (solta) {
    partes.push(solta[0]);
    nome = nome.replace(solta[0], ' ');
  }
  // Sexo solto no fim: "Fulano - M"
  const sexoSolto = nome.match(/\s[-–—,]\s*(m|f|masculino|feminino)\s*$/i);
  if (sexoSolto) {
    partes.push(sexoSolto[1]);
    nome = nome.slice(0, sexoSolto.index);
  }

  for (const bruta of partes) {
    const p = bruta.trim();
    if (!p) continue;
    if (DATA.test(p) && p.match(DATA)![0] === p) {
      const d = lerData(p, hoje);
      if (d) nascimento = d;
      else avisos.push({ linha: n, texto: `Data "${p}" inválida: ficou em branco.` });
      continue;
    }
    const s = p.length <= 9 ? lerSexo(p) : null;
    if (s) {
      sexo = s;
      continue;
    }
    obs.push(p);
  }

  nome = arrumarNome(nome.replace(/\s[-–—,]\s*$/, '').replace(/[-–—,]\s*$/, ''));
  if (!nome) {
    avisos.push({ linha: n, texto: 'Morador sem nome: ignorado.' });
    return null;
  }
  if (obs.length) avisos.push({ linha: n, texto: `${nome}: anotação “${obs.join(', ')}” guardada nas observações.` });

  return {
    id: novoId('m'),
    nome,
    sexo,
    nascimento,
    situacao: 'mora',
    situacaoDesde: '',
    grupos: [],
    obs: obs.join(', '),
  };
}
