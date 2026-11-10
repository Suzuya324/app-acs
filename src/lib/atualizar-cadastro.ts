// Atualizar o cadastro pelo arquivo do SBCD: compara o arquivo com o que está no app e lista só as
// diferenças (prontuário novo, pessoa nova, casa nova, data de nascimento, óbito, quem não veio).
// Nada é apagado: o ACS marca o que aceitar. Função "pura" (fácil de testar); tudo fica no aparelho.
import { normalizar } from './busca';
import { acharFamilia, chaveComplemento, chaveNome } from './importar-sv';
import { partesProntuario } from './numeros';
import type { Familia, Morador, Sexo } from './tipos';

export const TIPO_ARQUIVO_SBCD = 'facilitador-vds/importacao-sbcd';

export interface MoradorSbcd {
  codUsuarioSbcd?: string;
  nome: string;
  /** aaaa-mm-dd */
  nascimento?: string;
  nascimentoBr?: string;
  sexo?: string;
  situacao?: string;
}

export interface CasaSbcd {
  codDomicilioSbcd?: string;
  rua: string;
  ruaCurta?: string;
  numero: string;
  complemento?: string;
  prontuario?: string;
  prontuarioNovo?: string;
  situacao?: string;
  moradores: MoradorSbcd[];
}

export interface ArquivoSbcd {
  geradoEm: string;
  casas: CasaSbcd[];
  /** Casas que o arquivo deixou de fora de propósito (outra micro, travessa…): ajudam a explicar quem não veio. */
  foraDaMicro: { rua: string; casa: string; motivo: string }[];
  pendencias: { tipo: string; rua?: string; casa?: string; nome?: string; nascimento?: string }[];
}

export class ArquivoSbcdInvalido extends Error {
  constructor(msg = 'Este arquivo não é o cadastro do SBCD para o app (precisa ter as casas e os moradores).') {
    super(msg);
  }
}

const dataISO = (t = '') => {
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : '';
};

export function lerArquivoSbcd(texto: string): ArquivoSbcd {
  let d: Record<string, unknown>;
  try {
    d = JSON.parse(texto.replace(/^﻿/, '').trim());
  } catch {
    throw new ArquivoSbcdInvalido();
  }
  if (!d || typeof d !== 'object') throw new ArquivoSbcdInvalido();
  if (d.formato === 'facilitador-importacao') {
    throw new ArquivoSbcdInvalido('Este é o arquivo de VDs e relatos. Use Ajustes → Trazer do Sistema de Visitas.');
  }
  const casas = (Array.isArray(d.casas) ? d.casas : []) as CasaSbcd[];
  if (d.tipo !== TIPO_ARQUIVO_SBCD && !casas.some((c) => Array.isArray(c?.moradores))) throw new ArquivoSbcdInvalido();
  const validas = casas.filter((c) => c && (c.rua || c.ruaCurta) && Array.isArray(c.moradores));
  if (!validas.length) throw new ArquivoSbcdInvalido();
  const fora = [
    ...((d.casasNaRuaDeOutraMicro ?? []) as { rua: string; casa: string; motivo?: string; microArea?: string }[]).map((c) => ({
      rua: c.rua, casa: c.casa, motivo: c.motivo || `micro ${c.microArea ?? '?'}`,
    })),
    ...((d.casasExcluidas ?? []) as { rua: string; casa: string; motivo?: string }[]).map((c) => ({ rua: c.rua, casa: c.casa, motivo: c.motivo || 'fora da área' })),
  ];
  return {
    geradoEm: String(d.geradoEm ?? ''),
    casas: validas.map((c) => ({
      ...c,
      numero: String(c.numero ?? '').trim() || 'S/N',
      complemento: String(c.complemento ?? '').trim(),
      moradores: c.moradores
        .filter((m) => m?.nome?.trim())
        .map((m) => ({ ...m, nome: m.nome.trim(), nascimento: dataISO(m.nascimento) || dataISO(m.nascimentoBr) })),
    })),
    foraDaMicro: fora,
    pendencias: (Array.isArray(d.pendenciasCadastro) ? d.pendenciasCadastro : []) as ArquivoSbcd['pendencias'],
  };
}

// ---------------------------------------------------------------- comparar

/** Uma pessoa do app que vai mudar de casa (o SBCD a pôs em outra casa). */
export interface Mover {
  familiaId: string;
  moradorId: string;
  /** Casa de onde sai (no app). */
  de: string;
}

export type Mudanca =
  | { id: string; tipo: 'prontuario'; familiaId: string; rotulo: string; de: string; para: string }
  | { id: string; tipo: 'endereco'; familiaId: string; rotulo: string; de: string; numero: string; complemento: string }
  | { id: string; tipo: 'pessoa'; familiaId: string; rotulo: string; morador: Morador; parecido?: string; mover?: Mover }
  | { id: string; tipo: 'nascimento'; familiaId: string; moradorId: string; rotulo: string; nome: string; de: string; para: string }
  | { id: string; tipo: 'sexo'; familiaId: string; moradorId: string; rotulo: string; nome: string; para: 'M' | 'F' }
  | { id: string; tipo: 'casa'; rotulo: string; familia: Familia; mover: Mover[] }
  | { id: string; tipo: 'obito'; familiaId: string; moradorId: string; rotulo: string; nome: string }
  | { id: string; tipo: 'tirar'; familiaId: string; rotulo: string; motivo: string };

export interface Comparacao {
  geradoEm: string;
  casasNoArquivo: number;
  pessoasNoArquivo: number;
  /** Casas do arquivo que já estão iguais no app. */
  iguais: number;
  mudancas: Mudanca[];
  /** Ids das mudanças que já vêm marcadas (as seguras). */
  marcadasDeInicio: string[];
  /** Códigos do SBCD para guardar nas casas e pessoas achadas (ajuda na próxima atualização). */
  ligacoes: { familiaId: string; codSbcd?: string; moradores: { moradorId: string; codSbcd: string }[] }[];
  /** Só para conferir (nada muda sozinho). */
  conferir: {
    pessoasQueNaoVieram: { familiaId: string; rotulo: string; nome: string }[];
    situacaoDiferente: { familiaId: string; rotulo: string; nome: string; noApp: string }[];
    casasEmDuplicidade: string[];
  };
  pendencias: ArquivoSbcd['pendencias'];
}

const cod = (x: { codSbcd?: string }) => x.codSbcd;
const prontuarioDe = (c: CasaSbcd) => (c.prontuarioNovo?.trim() || c.prontuario?.trim() || '');
const mesmoProntuario = (a: string, b: string) => {
  const p = partesProntuario(a);
  const q = partesProntuario(b);
  return p && q ? p.micro === q.micro && p.numero === q.numero : normalizar(a) === normalizar(b);
};
const sexoDe = (s?: string): Sexo => (/^f/i.test(s ?? '') ? 'F' : /^m/i.test(s ?? '') ? 'M' : '');
const partes = (n: string) => chaveNome(n).split(' ').filter(Boolean);
const primeiro = (n: string) => partes(n)[0] ?? '';
const numeroCasa = (n = '') => {
  const t = normalizar(n).replace(/\s/g, '').replace(/^0+(\d)/, '$1');
  return /^s\/?n/.test(t) || t === '0' ? 's/n' : t; // o SBCD escreve casa sem número como "0"
};

/** Quantas letras mudam de um texto para o outro (para não chamar de "endereço novo" um erro de digitação). */
function distancia(a: string, b: string): number {
  const linha = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let anterior = linha[0];
    linha[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const guardado = linha[j];
      linha[j] = Math.min(linha[j] + 1, linha[j - 1] + 1, anterior + (a[i - 1] === b[j - 1] ? 0 : 1));
      anterior = guardado;
    }
  }
  return linha[b.length];
}
const complementoParecido = (a = '', b = '') => {
  const x = chaveComplemento(a);
  const y = chaveComplemento(b);
  return x === y || (Math.min(x.length, y.length) >= 4 && (x.startsWith(y) || y.startsWith(x))) || distancia(x, y) <= 2;
};

/** É a mesma pessoa? Nome igual, ou um nome contém o outro ("Luna Reis" e "Luna Reis Silva Arruda"), sem conflito de nascimento. */
function mesmaPessoa(m: Morador, p: MoradorSbcd): boolean {
  if (m.nascimento && p.nascimento && m.nascimento !== p.nascimento) return false;
  const a = partes(m.nome);
  const b = partes(p.nome);
  if (!a.length || !b.length || a[0] !== b[0]) return false;
  if (a.join(' ') === b.join(' ')) return true;
  const [curto, longo] = a.length <= b.length ? [a, b] : [b, a];
  return curto.length >= 2 && curto.every((x) => longo.includes(x));
}

/** O nome da rua como o app já escreve (ex.: arquivo "Acácias", app "Rua das Acácias"). */
function ruaDoApp(c: CasaSbcd, familias: Familia[]): string {
  const alvo = normalizar(c.ruaCurta || c.rua);
  return familias.find((f) => normalizar(f.rua).includes(alvo))?.rua ?? c.rua;
}

export function rotuloCasa(c: { rua: string; ruaCurta?: string; numero: string; complemento?: string }): string {
  return [c.ruaCurta || c.rua, c.numero, c.complemento].filter(Boolean).join(' ');
}
const rotuloApp = (f: Familia) => rotuloCasa({ rua: f.rua, numero: f.numero, complemento: f.complemento });

/**
 * Quem do app é cada pessoa do arquivo. Primeiro o certo (código do SBCD, nome igual) para todos; só depois o
 * aproximado (nome mais curto ou mais completo, primeiro nome + nascimento), para um nome parecido não "roubar" o certo.
 */
function acharMoradores(c: CasaSbcd, f: Familia): Map<MoradorSbcd, Morador> {
  const achou = new Map<MoradorSbcd, Morador>();
  const usados = new Set<string>();
  const passo = (igual: (m: Morador, p: MoradorSbcd) => boolean) => {
    for (const p of c.moradores) {
      if (achou.has(p)) continue;
      const m = f.moradores.find((x) => !usados.has(x.id) && igual(x, p));
      if (m) {
        achou.set(p, m);
        usados.add(m.id);
      }
    }
  };
  passo((m, p) => !!p.codUsuarioSbcd && cod(m) === p.codUsuarioSbcd);
  passo((m, p) => chaveNome(m.nome) === chaveNome(p.nome));
  passo(mesmaPessoa);
  passo((m, p) => !!p.nascimento && m.nascimento === p.nascimento && primeiro(m.nome) === primeiro(p.nome) && distancia(chaveNome(m.nome), chaveNome(p.nome)) <= 3);
  return achou;
}

const temAlguem = (f: Familia, c: CasaSbcd) => c.moradores.some((p) => f.moradores.some((m) => mesmaPessoa(m, p)));

export function compararComSbcd(arq: ArquivoSbcd, familias: Familia[], hoje: string, novoId: (p: string) => string): Comparacao {
  const r: Comparacao = {
    geradoEm: arq.geradoEm, casasNoArquivo: arq.casas.length, pessoasNoArquivo: arq.casas.reduce((n, c) => n + c.moradores.length, 0),
    iguais: 0, mudancas: [], marcadasDeInicio: [], ligacoes: [],
    conferir: { pessoasQueNaoVieram: [], situacaoDiferente: [], casasEmDuplicidade: [] }, pendencias: arq.pendencias,
  };
  const add = (m: Mudanca, marcada: boolean) => {
    r.mudancas.push(m);
    if (marcada) r.marcadasDeInicio.push(m.id);
  };

  // 1) Quem é quem: primeiro pelo código do SBCD e pelo prontuário (com alguém da casa em comum);
  //    depois, para o resto, pelo endereço e pelos nomes.
  const par = new Map<number, Familia>();
  const usadas = new Set<string>();
  const livres = () => familias.filter((f) => !usadas.has(f.id));
  const ligar = (i: number, f: Familia | null | undefined) => {
    if (!f || usadas.has(f.id)) return;
    par.set(i, f);
    usadas.add(f.id);
  };
  arq.casas.forEach((c, i) => {
    if (c.codDomicilioSbcd) ligar(i, livres().find((f) => cod(f) === c.codDomicilioSbcd));
  });
  arq.casas.forEach((c, i) => {
    if (par.has(i)) return;
    for (const pront of [c.prontuario, c.prontuarioNovo]) {
      if (!pront?.trim() || par.has(i)) continue;
      const mesmos = livres().filter((f) => mesmoProntuario(pront, f.prontuario) && (temAlguem(f, c) || !f.moradores.length));
      if (mesmos.length === 1) ligar(i, mesmos[0]);
    }
  });
  arq.casas.forEach((c, i) => {
    if (par.has(i)) return;
    const f = acharFamilia({ rua: c.ruaCurta || c.rua, numero: c.numero, complemento: c.complemento, nomes: c.moradores.map((m) => m.nome), rotulo: rotuloCasa(c) }, livres());
    // Pelo endereço só vale se a casa do app estiver vazia ou tiver alguém do arquivo (senão é outra família).
    if (f && (temAlguem(f, c) || !f.moradores.some((m) => m.situacao === 'mora'))) ligar(i, f);
  });

  // 2) Diferenças nas casas achadas.
  const sobrando: { familia: Familia; morador: Morador; rotulo: string }[] = [];
  const vistas: Familia[] = [];
  arq.casas.forEach((c, i) => {
    const f = par.get(i);
    if (!f) return;
    vistas.push(f);
    const rotulo = rotuloCasa(c);
    const antes = r.mudancas.length;
    const lig: Comparacao['ligacoes'][number] = { familiaId: f.id, codSbcd: c.codDomicilioSbcd, moradores: [] };
    r.ligacoes.push(lig);
    const pront = prontuarioDe(c);
    if (pront && !mesmoProntuario(pront, f.prontuario)) add({ id: `pront-${f.id}`, tipo: 'prontuario', familiaId: f.id, rotulo, de: f.prontuario, para: pront }, true);
    if (numeroCasa(c.numero) !== numeroCasa(f.numero) || !complementoParecido(c.complemento, f.complemento)) {
      // Número diferente: marcado. Só o complemento diferente (muitas vezes erro de digitação): o ACS decide.
      add({ id: `end-${f.id}`, tipo: 'endereco', familiaId: f.id, rotulo, de: rotuloApp(f), numero: c.numero, complemento: c.complemento ?? '' }, numeroCasa(c.numero) !== numeroCasa(f.numero));
    }
    const achados = acharMoradores(c, f);
    const usados = new Set([...achados.values()].map((m) => m.id));
    for (const p of c.moradores) {
      const m = achados.get(p);
      if (!m) {
        // Nome quase igual a alguém da casa: pode ser o mesmo nome escrito diferente (o ACS confere).
        const parecido = f.moradores.find((x) => primeiro(x.nome) === primeiro(p.nome) && distancia(chaveNome(x.nome), chaveNome(p.nome)) <= 3)
          ?? f.moradores.find((x) => !usados.has(x.id) && primeiro(x.nome) === primeiro(p.nome));
        const novo: Morador = {
          id: novoId('m'), nome: p.nome, sexo: sexoDe(p.sexo), nascimento: p.nascimento ?? '', situacao: 'mora', situacaoDesde: hoje, grupos: [], obs: '',
          ...(p.codUsuarioSbcd ? { codSbcd: p.codUsuarioSbcd } : {}),
        };
        add({ id: `pessoa-${f.id}-${p.codUsuarioSbcd || chaveNome(p.nome)}`, tipo: 'pessoa', familiaId: f.id, rotulo, morador: novo, parecido: parecido?.nome }, !parecido);
        continue;
      }
      if (p.codUsuarioSbcd) lig.moradores.push({ moradorId: m.id, codSbcd: p.codUsuarioSbcd });
      if (p.nascimento && p.nascimento !== m.nascimento) {
        // Vazio no app: completa (marcado). Diferente: pode ter sido corrigido à mão; o ACS decide.
        add({ id: `nasc-${m.id}`, tipo: 'nascimento', familiaId: f.id, moradorId: m.id, rotulo, nome: m.nome, de: m.nascimento, para: p.nascimento }, !m.nascimento);
      }
      const sx = sexoDe(p.sexo);
      if (sx && !m.sexo) add({ id: `sexo-${m.id}`, tipo: 'sexo', familiaId: f.id, moradorId: m.id, rotulo, nome: m.nome, para: sx }, true);
      if (m.situacao !== 'mora') {
        const noApp = { mudou: 'mudou-se', faleceu: 'faleceu', nao_pertence: 'não pertence à área', recusa: 'recusa' }[m.situacao];
        r.conferir.situacaoDiferente.push({ familiaId: f.id, rotulo, nome: m.nome, noApp });
      }
    }
    for (const m of f.moradores) if (m.situacao === 'mora' && !usados.has(m.id)) sobrando.push({ familia: f, morador: m, rotulo });
    if (r.mudancas.length === antes) r.iguais++;
  });

  /** Alguém do app que não veio na casa dele e que o SBCD pôs em outra casa: muda de casa (mesma ficha). */
  const tirarDeSobrando = (p: MoradorSbcd): Mover | undefined => {
    const i = sobrando.findIndex((x) => mesmaPessoa(x.morador, p));
    if (i < 0) return undefined;
    const [x] = sobrando.splice(i, 1);
    return { familiaId: x.familia.id, moradorId: x.morador.id, de: rotuloApp(x.familia) };
  };
  // Pessoa "nova" que na verdade estava em outra casa do app.
  for (const m of r.mudancas) {
    if (m.tipo !== 'pessoa' || m.parecido) continue;
    const mover = tirarDeSobrando({ nome: m.morador.nome, nascimento: m.morador.nascimento });
    if (mover) m.mover = mover;
  }

  // 3) Casas do arquivo que não estão no app: casas novas (quem já estava em outra casa do app muda junto).
  const familiaDe = new Map(familias.map((f) => [f.id, f]));
  arq.casas.forEach((c, i) => {
    if (par.has(i)) return;
    const mover: Mover[] = [];
    const moradores: Morador[] = c.moradores.map((p) => {
      const mv = tirarDeSobrando(p);
      const existente = mv ? familiaDe.get(mv.familiaId)?.moradores.find((x) => x.id === mv.moradorId) : undefined;
      if (mv && existente) {
        mover.push(mv);
        return { ...existente, nascimento: existente.nascimento || p.nascimento || '', sexo: existente.sexo || sexoDe(p.sexo), ...(p.codUsuarioSbcd ? { codSbcd: p.codUsuarioSbcd } : {}) };
      }
      return {
        id: novoId('m'), nome: p.nome, sexo: sexoDe(p.sexo), nascimento: p.nascimento ?? '', situacao: 'mora', situacaoDesde: hoje, grupos: [], obs: '',
        ...(p.codUsuarioSbcd ? { codSbcd: p.codUsuarioSbcd } : {}),
      };
    });
    const nova: Familia = {
      id: novoId('f'), rua: ruaDoApp(c, familias), numero: c.numero, complemento: c.complemento ?? '', bairro: familias[0]?.bairro ?? '', colmeia: '',
      prontuario: prontuarioDe(c), situacaoCasa: 'habitada', obs: '', responsavelId: moradores[0]?.id ?? '', moradores,
      ...(c.codDomicilioSbcd ? { codSbcd: c.codDomicilioSbcd } : {}),
    };
    add({ id: `casa-${c.codDomicilioSbcd || i}`, tipo: 'casa', rotulo: rotuloCasa(c), familia: nova, mover }, true);
  });
  for (const x of sobrando) r.conferir.pessoasQueNaoVieram.push({ familiaId: x.familia.id, rotulo: x.rotulo, nome: x.morador.nome });

  // 4) Óbitos que o arquivo pede para dar baixa.
  for (const p of arq.pendencias) {
    if (!/obito|faleceu|falecid/.test(normalizar(p.tipo ?? '')) || !p.nome) continue;
    const alvo: MoradorSbcd = { nome: p.nome, nascimento: dataISO(p.nascimento) };
    for (const f of vistas) {
      const m = f.moradores.find((x) => x.situacao === 'mora' && mesmaPessoa(x, alvo));
      if (m) add({ id: `obito-${m.id}`, tipo: 'obito', familiaId: f.id, moradorId: m.id, rotulo: rotuloApp(f), nome: m.nome }, false);
    }
  }

  // 5) Casas do app que não vieram no arquivo: só para conferir; pode tirar da área (vai para a lixeira).
  for (const f of familias) {
    if (usadas.has(f.id) || f.situacaoCasa !== 'habitada') continue;
    const comp = chaveComplemento(f.complemento);
    const motivo = arq.foraDaMicro.find((x) => {
      const [num, ...resto] = x.casa.split(/\s+/);
      return normalizar(f.rua).includes(normalizar(x.rua).split(' ')[0]) && numeroCasa(num) === numeroCasa(f.numero) && chaveComplemento(resto.join(' ')) === comp;
    })?.motivo;
    add({ id: `tirar-${f.id}`, tipo: 'tirar', familiaId: f.id, rotulo: rotuloApp(f), motivo: motivo ? `no SBCD: ${motivo}` : 'não veio no arquivo do SBCD' }, false);
  }
  return r;
}

export const NOMES_MUDANCA: Record<Mudanca['tipo'], string> = {
  prontuario: 'Prontuário novo',
  endereco: 'Endereço mudou',
  pessoa: 'Pessoas novas',
  casa: 'Casas novas',
  nascimento: 'Data de nascimento',
  sexo: 'Sexo a completar',
  obito: 'Óbito (dar baixa)',
  tirar: 'Casas do app que não vieram do SBCD',
};
export const ORDEM_MUDANCA: Mudanca['tipo'][] = ['prontuario', 'endereco', 'pessoa', 'casa', 'nascimento', 'sexo', 'obito', 'tirar'];
