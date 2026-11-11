// Estado do app: os dados ficam na memória SÓ enquanto o app está desbloqueado.
// Toda alteração é gravada criptografada no celular (ver cofre.ts).
import { armazenamentoIndexedDB } from './armazenamento';
import { criarDiaDeCampo } from './calendario';
import type { OpcoesPainel } from './meta';
import { lerBackup } from './backup';
import { Cofre, PinErrado, type Dados } from './cofre';
import { esperaAposErros } from './cripto';
import { gerarDadosFicticios } from './dados-ficticios';
import { diferencaDias, hojeISO } from './datas';
import { CONFIG_PADRAO } from './rotulos';
import { criarAlteracoes, mudancasFamilia, mudancasMorador, mudancasVisita } from './historico';
import { juntarDados, textoResumoJuncao, type ResumoJuncao } from './juntar';
import {
  excluirFamilia as lxExcluirFamilia,
  excluirMorador as lxExcluirMorador,
  excluirVisita as lxExcluirVisita,
  restaurar as lxRestaurar,
  type ItemLixeira,
} from './lixeira';
import { gerarRelato } from './relato';
import type { Previa } from './importar-sv';
import type { SugestaoDasVDs } from './anotacoes';
import type { Contexto } from './acompanhamento';
import type { Comparacao } from './atualizar-cadastro';
import { etiquetaDoGrupo, gruposDasEtiquetas, idPrioritario, infoEtiqueta, ligar, separarCoracao, type Prioritario, type PreviaPrioritarios } from './prioritarios';
import { abrirSinc, ChavesSinc, cifrarSinc, criarArquivoConexao, ErroGitHub, GitHub, lerArquivoConexao, limparRepo, mesmoConteudo, type ConfigSinc } from './sinc';
import { novoId } from './ids';
import type { Alteracao, Caso, Config, Familia, Grupo, Morador, RascunhoVD, Revisita, Visita } from './tipos';

export type Fase = 'carregando' | 'configurar' | 'trancado' | 'aberto' | 'erro';

export const cofre = new Cofre(armazenamentoIndexedDB());

export const app = $state({
  fase: 'carregando' as Fase,
  config: structuredClone(CONFIG_PADRAO) as Config,
  familias: [] as Familia[],
  visitas: [] as Visita[],
  historico: [] as Alteracao[],
  /** Visita pela metade (guardada criptografada). */
  rascunho: null as RascunhoVD | null,
  /** Revisitas marcadas (abertas, feitas e canceladas; nada é apagado). */
  revisitas: [] as Revisita[],
  /** Lixeira (excluídos por engano, podem ser restaurados). */
  lixeira: [] as ItemLixeira[],
  /** Casos para acompanhar. */
  casos: [] as Caso[],
  /** Pacientes prioritários. */
  prioritarios: [] as Prioritario[],
  /** Há uma ação que ainda pode ser desfeita (o aviso mostra o botão "Desfazer"). */
  desfazer: null as { descricao: string; ate: number } | null,
  aviso: '' as string,
  /** Texto da busca (fica guardado ao voltar para a tela). */
  busca: '',
  /** O navegador prometeu não apagar os dados sozinho? */
  armazenamentoPersistente: false,
  /** Há uma versão nova do app esperando para ser aplicada. */
  novaVersao: false,
  erro: '',
  /** Sincronização entre os aparelhos. */
  sinc: {
    estado: 'desligada' as EstadoSinc,
    /** Última sincronização que deu certo (ISO). */
    ultima: '',
    mensagem: '',
    repo: '',
    aparelho: '',
  },
});

export type EstadoSinc = 'desligada' | 'parada' | 'sincronizando' | 'ok' | 'offline' | 'erro';

/** Número de VDs já feitas: usado para variar o modelo do relato. */
export function contadorRelato(): number {
  return app.visitas.length;
}

let timerAviso: ReturnType<typeof setTimeout> | undefined;
export function mostrarAviso(texto: string, ms = 2600) {
  if (app.desfazer && app.desfazer.ate > Date.now()) ms = Math.max(ms, app.desfazer.ate - Date.now());
  app.aviso = texto;
  clearTimeout(timerAviso);
  timerAviso = setTimeout(() => (app.aviso = ''), ms);
}

// ---------------- Abrir, criar e trancar ----------------

export async function iniciar() {
  try {
    if (!('indexedDB' in window) || !crypto?.subtle) {
      throw new Error('Este navegador não tem os recursos de segurança necessários. Atualize o navegador.');
    }
    app.fase = (await cofre.existe()) ? 'trancado' : 'configurar';
    app.armazenamentoPersistente = (await navigator.storage?.persisted?.()) ?? false;
  } catch (e) {
    app.erro = e instanceof Error ? e.message : String(e);
    app.fase = 'erro';
  }
}

/** Completa campos que não existiam em versões antigas do app. */
function normalizarFamilia(f: Familia): Familia {
  const moradores = f.moradores.map((m) => {
    // a marca "sexo a conferir" (sugestão pelo nome) não existe mais
    const { sexoAConferir: _, ...resto } = m as Morador & { sexoAConferir?: boolean };
    void _;
    return { ...resto, situacaoDesde: m.situacaoDesde ?? '', obs: m.obs ?? '', grupos: m.grupos ?? [] };
  });
  const responsavelId = f.responsavelId ?? moradores.find((m) => m.situacao === 'mora')?.id ?? '';
  return { ...f, bairro: f.bairro ?? '', obs: f.obs ?? '', colmeia: f.colmeia ?? '', responsavelId, moradores };
}

function carregar(d: Dados) {
  app.config = { ...structuredClone(CONFIG_PADRAO), ...d.config };
  app.familias = (d.familias ?? []).map(normalizarFamilia);
  app.visitas = d.visitas ?? [];
  app.historico = d.historico ?? [];
  app.rascunho = d.rascunho ?? null;
  app.revisitas = d.revisitas ?? [];
  app.lixeira = d.lixeira ?? [];
  app.casos = d.casos ?? [];
  app.prioritarios = d.prioritarios ?? [];
  corrigirCoracao();
}

/**
 * Conserta quem ficou como "AVC/infarto" só porque a lista de prioritários usa uma etiqueta única para
 * "AVC/infarto/coração" (ex.: bebê com cirurgia no coração). Quem não tem AVC nem infarto no resumo passa
 * para "Coração", na lista e na ficha. Roda uma vez por pessoa: depois a etiqueta já está trocada.
 */
function corrigirCoracao() {
  for (const p of app.prioritarios) {
    const novas = separarCoracao(p.etiquetas, p.resumo);
    if (novas === p.etiquetas) continue;
    p.etiquetas = novas;
    const m = app.familias.find((f) => f.id === p.familiaId)?.moradores.find((x) => x.id === p.moradorId);
    if (m?.grupos.includes('avc')) m.grupos = [...new Set(m.grupos.map((g) => (g === 'avc' ? 'coracao' : g)))];
  }
}

function dadosAtuais(): Dados {
  return $state.snapshot({
    config: app.config,
    familias: app.familias,
    visitas: app.visitas,
    historico: app.historico,
    rascunho: app.rascunho,
    revisitas: app.revisitas,
    lixeira: app.lixeira,
    casos: app.casos,
    prioritarios: app.prioritarios,
  }) as Dados;
}

/** Pede ao navegador para não apagar os dados sozinho (importante no iPhone). */
export async function pedirPersistencia() {
  try {
    app.armazenamentoPersistente = (await navigator.storage?.persist?.()) ?? false;
  } catch {
    app.armazenamentoPersistente = false;
  }
}

/** Configuração inicial: cria o cofre com o PIN. */
export async function criarCofre(pin: string, config: Config, origem: 'exemplo' | 'vazio' | Dados) {
  let dados: Dados;
  if (origem === 'exemplo') {
    dados = { config: { ...config, usandoExemplo: true }, ...gerarDadosFicticios(hojeISO()), historico: [] };
  } else if (origem === 'vazio') {
    dados = { config: { ...config, usandoExemplo: false }, familias: [], visitas: [], historico: [] };
  } else {
    dados = origem;
  }
  await cofre.criar(pin, dados);
  carregar(dados);
  app.fase = 'aberto';
  await pedirPersistencia();
  void carregarSinc();
}

export type ResultadoDesbloqueio = { ok: true } | { ok: false; esperar: number; erros: number };

/** Segundos que ainda faltam para poder tentar o PIN de novo. */
export async function esperaRestante(): Promise<{ segundos: number; erros: number }> {
  const t = await cofre.tentativas();
  const espera = esperaAposErros(t.erros) * 1000;
  return { segundos: Math.max(0, Math.ceil((t.ultimoErro + espera - Date.now()) / 1000)), erros: t.erros };
}

export async function desbloquear(pin: string): Promise<ResultadoDesbloqueio> {
  const antes = await esperaRestante();
  if (antes.segundos > 0) return { ok: false, esperar: antes.segundos, erros: antes.erros };
  try {
    carregar(await cofre.abrir(pin));
    app.fase = 'aberto';
    marcarUso();
    void carregarSinc();
    return { ok: true };
  } catch (e) {
    if (e instanceof PinErrado) {
      const d = await esperaRestante();
      return { ok: false, esperar: d.segundos, erros: d.erros };
    }
    throw e;
  }
}

/** Função que grava na hora o rascunho da VD aberta (registrada pela tela da VD). */
let gravarRascunhoAgora: (() => Promise<void>) | null = null;
export function registrarGravacaoRascunho(f: (() => Promise<void>) | null) {
  gravarRascunhoAgora = f;
}

/** Tranca: grava a VD pela metade, esquece a chave e tira os dados da memória. */
export async function trancar() {
  if (app.fase !== 'aberto') return;
  try {
    await gravarRascunhoAgora?.();
  } catch {
    // segue trancando mesmo assim
  }
  if (app.fase !== 'aberto') return;
  // Manda o que mudou para os outros aparelhos antes de trancar (no máximo 8 s).
  if (sincSujo || sincRodando) await Promise.race([sincronizar(), new Promise((ok) => setTimeout(ok, 8000))]);
  if (app.fase !== 'aberto') return;
  esquecerSinc();
  cofre.trancar();
  app.familias = [];
  app.visitas = [];
  app.historico = [];
  app.rascunho = null;
  app.revisitas = [];
  app.lixeira = [];
  app.casos = [];
  app.prioritarios = [];
  ultimaAcao = null;
  app.desfazer = null;
  app.busca = '';
  app.fase = 'trancado';
}

export async function apagarTudo() {
  esquecerSinc();
  app.sinc.estado = 'desligada';
  await cofre.apagarTudo();
  app.familias = [];
  app.visitas = [];
  app.historico = [];
  app.rascunho = null;
  app.revisitas = [];
  app.lixeira = [];
  app.casos = [];
  app.prioritarios = [];
  ultimaAcao = null;
  app.desfazer = null;
  app.config = structuredClone(CONFIG_PADRAO);
  app.fase = 'configurar';
  location.hash = '#/';
}

// ---------------- Gravar ----------------

async function gravar(partes: Partial<Dados>) {
  try {
    await cofre.gravar($state.snapshot(partes) as Partial<Dados>);
    // Mudou algo além da VD pela metade: avisa a sincronização.
    if (!aplicandoRemoto && Object.keys(partes).some((k) => k !== 'rascunho')) marcarParaSincronizar();
  } catch (e) {
    console.error(e);
    mostrarAviso('⚠️ Não consegui salvar! Não feche o app e tente de novo.', 6000);
  }
}

/** Grava os ajustes mudados pelo ACS (a data vale para a junção entre aparelhos). */
export function salvarConfig() {
  app.config.alteradaEm = new Date().toISOString();
  return gravar({ config: app.config });
}

export async function trocarPin(novoPin: string) {
  await cofre.trocarPin(novoPin, dadosAtuais());
}

const agora = () => new Date().toISOString();

// ---------------- Desfazer ----------------

/** Tempo que o botão "Desfazer" fica no aviso. */
const TEMPO_DESFAZER = 8000;
let ultimaAcao: { descricao: string; antes: Dados } | null = null;
let profundidade = 0;
let timerDesfazer: ReturnType<typeof setTimeout> | undefined;

/** Executa uma ação guardando como os dados estavam antes, para poder desfazer. */
async function comDesfazer<T>(descricao: string, acao: () => T | Promise<T>): Promise<T> {
  if (profundidade > 0) return acao(); // ação dentro de outra: desfaz junto com a de fora
  const antes = dadosAtuais();
  profundidade++;
  try {
    const r = await acao();
    ultimaAcao = { descricao, antes };
    app.desfazer = { descricao, ate: Date.now() + TEMPO_DESFAZER };
    clearTimeout(timerDesfazer);
    timerDesfazer = setTimeout(() => (app.desfazer = null), TEMPO_DESFAZER);
    return r;
  } finally {
    profundidade--;
  }
}

/** Volta os dados para como estavam antes da última ação (ajustes e PIN não mudam). */
export async function desfazerUltima() {
  if (!ultimaAcao) return;
  const { descricao, antes } = ultimaAcao;
  ultimaAcao = null;
  app.desfazer = null;
  carregar({ ...antes, config: $state.snapshot(app.config) as Config, rascunho: app.rascunho });
  app.historico.push(...criarAlteracoes('', [`Desfeito: ${descricao}`]));
  await gravar({
    familias: app.familias,
    visitas: app.visitas,
    historico: app.historico,
    revisitas: app.revisitas,
    lixeira: app.lixeira,
    casos: app.casos,
    prioritarios: app.prioritarios,
  });
  mostrarAviso(`Desfeito: ${descricao}`);
}

// ---------------- Lixeira ----------------

function aplicar(d: Dados) {
  app.familias = d.familias;
  app.visitas = d.visitas;
  app.revisitas = d.revisitas ?? [];
  app.lixeira = d.lixeira ?? [];
  app.rascunho = d.rascunho ?? null;
  app.casos = d.casos ?? app.casos;
  app.prioritarios = d.prioritarios ?? app.prioritarios;
  corrigirCoracao();
}
async function gravarTudo() {
  await gravar({ familias: app.familias, visitas: app.visitas, historico: app.historico, revisitas: app.revisitas, lixeira: app.lixeira, casos: app.casos, prioritarios: app.prioritarios, rascunho: app.rascunho });
}

export const excluirVisitaParaLixeira = (visitaId: string) =>
  comDesfazer('Excluir VD', async () => {
    const v = app.visitas.find((x) => x.id === visitaId);
    if (!v) return;
    const f = familiaPorId(v.familiaId);
    const descricao = `${v.data.split('-').reverse().join('/')}${f ? ` – ${enderecoCurto(f)}` : ''}`;
    aplicar(lxExcluirVisita(dadosAtuais(), visitaId, descricao));
    app.historico.push(...criarAlteracoes(v.familiaId, [`VD excluída (foi para a lixeira): ${descricao}`]));
    await gravarTudo();
  });

export const excluirFamiliaParaLixeira = (familiaId: string) =>
  comDesfazer('Excluir família', async () => {
    const f = familiaPorId(familiaId);
    if (!f) return;
    const descricao = `${enderecoCurto(f)} (${responsavel(f)})`;
    aplicar(lxExcluirFamilia(dadosAtuais(), familiaId, descricao));
    app.historico.push(...criarAlteracoes(familiaId, [`Família excluída (foi para a lixeira): ${descricao}`]));
    await gravarTudo();
  });

export const excluirMoradorParaLixeira = (familiaId: string, moradorId: string) =>
  comDesfazer('Excluir morador', async () => {
    const f = familiaPorId(familiaId);
    const m = f?.moradores.find((x) => x.id === moradorId);
    if (!f || !m) return;
    const descricao = `${m.nome} – ${enderecoCurto(f)}`;
    aplicar(lxExcluirMorador(dadosAtuais(), familiaId, moradorId, descricao));
    app.historico.push(...criarAlteracoes(familiaId, [`Excluído (foi para a lixeira): ${m.nome}`], moradorId));
    await gravarTudo();
  });

export const restaurarDaLixeira = (entradaId: string) =>
  comDesfazer('Restaurar da lixeira', async () => {
    const item = app.lixeira.find((i) => i.id === entradaId);
    aplicar(lxRestaurar(dadosAtuais(), entradaId));
    if (item) app.historico.push(...criarAlteracoes(item.familiaId, [`Restaurado da lixeira: ${item.descricao}`]));
    await gravarTudo();
  });

// ---------------- Prioritários ----------------

/** Inclui nos moradores ligados os grupos que as etiquetas indicam (nunca tira o que já estava). */
function aplicarGruposDosPrioritarios(lista: Prioritario[], tirar: Map<string, string[]> = new Map()) {
  const quando = agora();
  for (const p of lista) {
    if (!p.familiaId || !p.moradorId) continue;
    const f = app.familias.find((x) => x.id === p.familiaId);
    const m = f?.moradores.find((x) => x.id === p.moradorId);
    if (!f || !m) continue;
    const antes = $state.snapshot(m) as Morador;
    const sair = new Set(gruposDasEtiquetas(tirar.get(p.id) ?? []));
    const ficam = gruposDasEtiquetas(p.etiquetas);
    for (const g of ficam) sair.delete(g);
    const grupos = [...new Set([...m.grupos.filter((g) => !sair.has(g)), ...ficam])];
    if (grupos.join() === m.grupos.join()) continue;
    m.grupos = grupos;
    f.atualizadoEm = quando;
    app.historico.push(...criarAlteracoes(f.id, mudancasMorador(antes, $state.snapshot(m) as Morador), m.id));
  }
}

/**
 * Mantém as etiquetas do prioritário iguais às condições do morador ligado
 * (condição incluída → etiqueta incluída; condição tirada → etiqueta tirada).
 */
function sincronizarEtiquetas(moradorId: string, antes: Grupo[], depois: Grupo[]): boolean {
  const p = app.prioritarios.find((x) => x.moradorId === moradorId);
  if (!p) return false;
  const entrou = depois.filter((g) => !antes.includes(g));
  const saiu = antes.filter((g) => !depois.includes(g));
  if (!entrou.length && !saiu.length) return false;
  let etq = p.etiquetas.filter((e) => {
    const g = infoEtiqueta(e).grupo;
    return !(g && saiu.includes(g));
  });
  for (const g of entrou) {
    const e = etiquetaDoGrupo(g);
    if (e && !etq.includes(e)) etq = [...etq, e];
    if (g === 'gestante') etq = etq.filter((x) => x !== 'GESTANTE?'); // gestação confirmada
  }
  if (etq.join('|') === p.etiquetas.join('|')) return false;
  p.etiquetas = etq;
  p.atualizadoEm = agora();
  return true;
}

export interface AtualizacaoFicha {
  moradorId: string;
  grupos: Grupo[];
  situacao?: 'faleceu' | 'mudou';
}

/** Aplica na ficha o que o ACS confirmou a partir das anotações da VD (condições e situação). */
function aplicarAtualizacoesFicha(familiaId: string, data: string, itens: AtualizacaoFicha[], deOnde = 'pela anotação da VD') {
  const f = app.familias.find((x) => x.id === familiaId);
  if (!f || !itens.length) return;
  const quando = agora();
  for (const it of itens) {
    const m = f.moradores.find((x) => x.id === it.moradorId);
    if (!m) continue;
    const antes = $state.snapshot(m) as Morador;
    if (it.grupos.length) m.grupos = [...new Set([...m.grupos, ...it.grupos])];
    if (it.situacao) {
      m.situacao = it.situacao;
      m.situacaoDesde = data;
    }
    const textos = mudancasMorador(antes, $state.snapshot(m) as Morador);
    if (!textos.length) continue;
    f.atualizadoEm = quando;
    app.historico.push(...criarAlteracoes(f.id, textos.map((t) => `${t} (${deOnde})`), m.id));
    sincronizarEtiquetas(m.id, antes.grupos, m.grupos);
  }
}

/**
 * Revisão das VDs já feitas: aplica nas fichas o que o ACS confirmou e esconde o que ele disse que não é
 * (para não perguntar de novo).
 */
export const aplicarSugestoesDasVDs = (confirmadas: SugestaoDasVDs[], naoE: string[]) =>
  comDesfazer('Atualizar fichas pelas VDs', async () => {
    const porPessoa = new Map<string, { familiaId: string; data: string; item: AtualizacaoFicha }>();
    for (const s of confirmadas) {
      const p = porPessoa.get(s.morador.id) ?? { familiaId: s.familia.id, data: '', item: { moradorId: s.morador.id, grupos: [] } };
      if (s.sugestao.tipo === 'grupo') p.item.grupos.push(s.sugestao.grupo);
      else if (p.item.situacao !== 'faleceu') {
        p.item.situacao = s.sugestao.situacao;
        p.data = s.provas[0]?.data ?? '';
      }
      porPessoa.set(s.morador.id, p);
    }
    for (const p of porPessoa.values()) aplicarAtualizacoesFicha(p.familiaId, p.data || hojeISO(), [p.item], 'pelas VDs já feitas');
    if (naoE.length) {
      app.config.sugestoesEscondidas = [...new Set([...(app.config.sugestoesEscondidas ?? []), ...naoE])];
      app.config.alteradaEm = agora();
    }
    await gravar({ familias: app.familias, historico: app.historico, prioritarios: app.prioritarios, ...(naoE.length ? { config: app.config } : {}) });
  });

/** Volta a mostrar as sugestões que o ACS tinha escondido (as pendências resolvidas e os remédios tirados continuam fora). */
export function mostrarSugestoesEscondidas() {
  app.config.sugestoesEscondidas = (app.config.sugestoesEscondidas ?? []).filter((k) => /\|[prc]-/.test(k));
  return salvarConfig();
}

// ---------------- Acompanhamento de cada paciente ----------------

/** O que o acompanhamento precisa ler (tudo já está no aparelho). */
export const contextoAcompanhamento = (): Contexto => ({
  visitas: app.visitas,
  casos: app.casos,
  prioritarios: app.prioritarios,
  escondidas: app.config.sugestoesEscondidas ?? [],
  remediosExtras: app.config.remediosExtras ?? '',
  hoje: hojeISO(),
});

/** Tira do acompanhamento o que o ACS resolveu ou disse que está errado (pendência, remédio ou sugestão). */
export const esconderDoAcompanhamento = (chaves: string[], descricao: string) =>
  comDesfazer(descricao, async () => {
    app.config.sugestoesEscondidas = [...new Set([...(app.config.sugestoesEscondidas ?? []), ...chaves])];
    app.config.alteradaEm = agora();
    await gravar({ config: app.config });
  });

/** Ensina ao app nomes de remédios que ele não reconheceu (só os nomes; separados por vírgula). */
export const ensinarRemedios = (nomes: string) =>
  comDesfazer('Ensinar remédio', async () => {
    const limpar = (t: string) => t.split(/[,;\n]+/).map((x) => x.trim().replace(/\s+/g, ' ')).filter((x) => x.length >= 3 && x.length <= 40);
    const juntos = new Map<string, string>();
    for (const n of [...limpar(app.config.remediosExtras ?? ''), ...limpar(nomes)]) juntos.set(n.toLowerCase(), n);
    app.config.remediosExtras = [...juntos.values()].join(', ');
    app.config.alteradaEm = agora();
    await gravar({ config: app.config });
  });

/** Põe na lista de prioritários (gravada) uma pessoa que o app achou pela ficha ou pelas VDs. */
export const porNaListaDePrioritarios = (p: Prioritario) =>
  comDesfazer('Pôr na lista de prioritários', async () => {
    const quando = agora();
    const id = idPrioritario(p.nome, p.nascimento);
    const novo: Prioritario = { ...p, id, doApp: undefined, editadoEm: quando, atualizadoEm: quando };
    const i = app.prioritarios.findIndex((x) => x.id === id);
    if (i >= 0) app.prioritarios[i] = { ...app.prioritarios[i], familiaId: p.familiaId, moradorId: p.moradorId, atualizadoEm: quando };
    else app.prioritarios.push(novo);
    if (p.familiaId) app.historico.push(...criarAlteracoes(p.familiaId, [`Incluído na lista de prioritários: ${p.nome} (nível ${p.nivel})`], p.moradorId));
    await gravar({ prioritarios: app.prioritarios, historico: app.historico });
    return id;
  });

/** Traz a lista de prioritários (nova ou atualizada). Nada é apagado; o que foi editado à mão só muda se o ACS escolheu. */
export const importarPrioritarios = (previa: PreviaPrioritarios, usarDaListaNova: Set<string>) =>
  comDesfazer('Importar prioritários', async () => {
    const quando = agora();
    const porId = new Map(app.prioritarios.map((p) => [p.id, p] as const));
    const entram = [
      ...previa.novos,
      ...previa.atualizados,
      ...previa.conflitos.filter((c) => usarDaListaNova.has(c.atual.id)).map((c) => ({ ...c.novo, editadoEm: undefined })),
    ].map((p) => ({ ...p, atualizadoEm: quando }));
    for (const p of entram) porId.set(p.id, p);
    app.prioritarios = [...porId.values()];
    aplicarGruposDosPrioritarios(entram);
    app.historico.push(...criarAlteracoes('', [`Lista de prioritários: ${previa.novos.length} novos, ${entram.length - previa.novos.length} atualizados`]));
    await gravar({ prioritarios: app.prioritarios, familias: app.familias, historico: app.historico });
  });

/** Salva a edição feita à mão (nível, etiquetas, resumo, óbito). */
export const salvarPrioritario = (p: Prioritario) =>
  comDesfazer('Editar prioritário', async () => {
    const i = app.prioritarios.findIndex((x) => x.id === p.id);
    if (i < 0) return;
    const antes = $state.snapshot(app.prioritarios[i]) as Prioritario;
    const quando = agora();
    app.prioritarios[i] = { ...p, editadoEm: quando, atualizadoEm: quando };
    const tiradas = antes.etiquetas.filter((e) => !p.etiquetas.includes(e));
    aplicarGruposDosPrioritarios([app.prioritarios[i]], new Map([[p.id, tiradas]]));
    if (p.familiaId) app.historico.push(...criarAlteracoes(p.familiaId, [`Prioritário editado: ${p.nome} (nível ${p.nivel})`], p.moradorId));
    await gravar({ prioritarios: app.prioritarios, familias: app.familias, historico: app.historico });
  });

// ---------------- Casos ----------------

/** Cria ou atualiza um caso. */
export const salvarCaso = (c: Omit<Caso, 'id' | 'criadoEm' | 'atualizadoEm'> & { id?: string }) =>
  comDesfazer(c.id ? 'Salvar caso' : 'Novo caso', async () => {
    const quando = agora();
    const i = c.id ? app.casos.findIndex((x) => x.id === c.id) : -1;
    if (i >= 0) app.casos[i] = { ...app.casos[i], ...c, id: app.casos[i].id, atualizadoEm: quando };
    else app.casos.push({ ...c, id: novoId('c'), criadoEm: quando, atualizadoEm: quando });
    app.historico.push(...criarAlteracoes(c.familiaId, [`Caso ${i >= 0 ? 'atualizado' : 'aberto'}: ${c.titulo}`]));
    await gravar({ casos: app.casos, historico: app.historico });
  });

/** Marca o caso como resolvido (ou reabre). Nada é apagado. */
export const resolverCaso = (id: string, resolvido: boolean) =>
  comDesfazer(resolvido ? 'Resolver caso' : 'Reabrir caso', async () => {
    const c = app.casos.find((x) => x.id === id);
    if (!c) return;
    c.resolvidoEm = resolvido ? agora() : undefined;
    c.atualizadoEm = agora();
    app.historico.push(...criarAlteracoes(c.familiaId, [`Caso ${resolvido ? 'resolvido' : 'reaberto'}: ${c.titulo}`]));
    await gravar({ casos: app.casos, historico: app.historico });
  });

/** Casos abertos de famílias que estão na área (a família pode estar na lixeira). */
export function casosAbertos(): Caso[] {
  const ids = new Set(app.familias.map((f) => f.id));
  return app.casos.filter((c) => !c.resolvidoEm && ids.has(c.familiaId));
}

/** Traz VDs e relatos de outro lugar (ex.: Sistema de Visitas), já conferidos na prévia. */
export const trazerImportacao = (previa: Previa, origem: string) =>
  comDesfazer(`Trazer do ${origem}`, async () => {
    const quando = agora();
    app.visitas.push(...previa.visitas);
    for (const [familiaId, relatos] of previa.relatos) {
      const f = app.familias.find((x) => x.id === familiaId);
      if (!f) continue;
      f.relatosAnteriores = [...(f.relatosAnteriores ?? []), ...relatos];
      f.atualizadoEm = quando;
    }
    for (const c of previa.condicoes) {
      const f = app.familias.find((x) => x.id === c.familiaId);
      const m = f?.moradores.find((x) => x.id === c.moradorId);
      if (!f || !m) continue;
      const antes = $state.snapshot(m) as Morador;
      m.grupos = [...new Set([...m.grupos, ...c.grupos])];
      if (c.nota) m.obs = m.obs.trim() ? `${m.obs.trim()}\n${c.nota}` : c.nota;
      f.atualizadoEm = quando;
      app.historico.push(...criarAlteracoes(f.id, mudancasMorador(antes, $state.snapshot(m) as Morador), m.id));
    }
    for (const n of previa.niveis) {
      const f = app.familias.find((x) => x.id === n.familiaId);
      if (!f) continue;
      if (n.nivel) f.nivel = n.nivel;
      if (n.atencao) f.atencao = f.atencao?.trim() ? `${f.atencao.trim()}\n${n.atencao}` : n.atencao;
      if (n.ultimaVdFora) f.ultimaVdFora = n.ultimaVdFora;
      f.atualizadoEm = quando;
    }
    app.casos.push(...previa.casos);
    app.revisitas.push(...previa.revisitas);
    const nRelatos = [...previa.relatos.values()].reduce((n, l) => n + l.length, 0);
    app.historico.push(
      ...criarAlteracoes('', [
        `Trazido do ${origem}: ${previa.visitas.length} VDs, ${nRelatos} relatos, ${previa.casos.length} casos, ${previa.condicoes.length} pessoas com condições, ${previa.niveis.length} casas com nível/atenção e ${previa.revisitas.length} revisitas`,
      ]),
    );
    await gravar({ familias: app.familias, visitas: app.visitas, historico: app.historico, casos: app.casos, revisitas: app.revisitas });
  });

/** Restaura vários itens da lixeira de uma vez (ex.: as famílias tiradas da área por engano). */
export const restaurarVariosDaLixeira = (entradaIds: string[]) =>
  comDesfazer(`Restaurar ${entradaIds.length} itens`, async () => {
    let d = dadosAtuais();
    let n = 0;
    for (const id of entradaIds) {
      const item = d.lixeira?.find((i) => i.id === id);
      if (!item || item.restauradoEm) continue;
      try {
        d = lxRestaurar(d, id);
        n++;
        app.historico.push(...criarAlteracoes(item.familiaId, [`Restaurado da lixeira: ${item.descricao}`]));
      } catch {
        /* família do item ainda na lixeira: fica para depois */
      }
    }
    aplicar(d);
    await gravarTudo();
    return n;
  });

/** Tira da área, de uma vez, as famílias que não são do ACS (vão para a lixeira; dá para restaurar). */
export const tirarFamiliasDaArea = (familiaIds: string[], motivo: string) =>
  comDesfazer(`Tirar ${familiaIds.length} famílias da área`, async () => {
    let d = dadosAtuais();
    for (const id of familiaIds) {
      const f = d.familias.find((x) => x.id === id);
      if (!f) continue;
      const descricao = `${enderecoCurto(f)} (${responsavel(f)}) – ${motivo}`;
      d = lxExcluirFamilia(d, id, descricao);
      app.historico.push(...criarAlteracoes(id, [`Família tirada da área (foi para a lixeira): ${descricao}`]));
    }
    aplicar(d);
    await gravarTudo();
  });

/**
 * Atualiza o cadastro com o que o ACS marcou na comparação com o arquivo do SBCD. Nada é apagado:
 * casas que não vieram só saem da área se marcadas (vão para a lixeira); quem muda de casa leva a ficha junto.
 */
export const atualizarCadastroSbcd = (cmp: Comparacao, escolhidas: Set<string>) =>
  comDesfazer('Atualizar cadastro pelo SBCD', async () => {
    const quando = agora();
    const hoje = hojeISO();
    const deOnde = `cadastro do SBCD${cmp.geradoEm ? ` de ${cmp.geradoEm.split('-').reverse().join('/')}` : ''}`;
    const fam = (id: string) => app.familias.find((f) => f.id === id);
    const anotar = (f: Familia, textos: string[], moradorId?: string) => {
      if (!textos.length) return;
      f.atualizadoEm = quando;
      app.historico.push(...criarAlteracoes(f.id, textos.map((t) => `${t} (${deOnde})`), moradorId));
    };
    /** Tira a pessoa da casa antiga (a ficha vai junto para a casa nova) e corrige quem é o responsável. */
    const tirarDaCasa = (familiaId: string, moradorId: string, para: string) => {
      const f = fam(familiaId);
      const m = f?.moradores.find((x) => x.id === moradorId);
      if (!f || !m) return null;
      f.moradores = f.moradores.filter((x) => x.id !== moradorId);
      if (f.responsavelId === moradorId) f.responsavelId = f.moradores.find((x) => x.situacao === 'mora')?.id ?? '';
      anotar(f, [`${m.nome} mudou para ${para}`], moradorId);
      return $state.snapshot(m) as Morador;
    };
    const escolhida = cmp.mudancas.filter((m) => escolhidas.has(m.id));
    // Códigos do SBCD nas casas e pessoas achadas (a próxima atualização acha mais fácil).
    for (const l of cmp.ligacoes) {
      const f = fam(l.familiaId);
      if (!f) continue;
      if (l.codSbcd) f.codSbcd = l.codSbcd;
      for (const x of l.moradores) {
        const m = f.moradores.find((y) => y.id === x.moradorId);
        if (m) m.codSbcd = x.codSbcd;
      }
    }
    for (const mu of escolhida) {
      if (mu.tipo === 'casa') {
        for (const mv of mu.mover) tirarDaCasa(mv.familiaId, mv.moradorId, mu.rotulo);
        const nova = structuredClone(mu.familia);
        app.familias.push({ ...nova, atualizadoEm: quando });
        app.historico.push(...criarAlteracoes(nova.id, [`Casa nova: ${mu.rotulo} (${nova.moradores.length} ${nova.moradores.length === 1 ? 'pessoa' : 'pessoas'}) (${deOnde})`]));
        for (const p of app.prioritarios) if (mu.mover.some((mv) => mv.moradorId === p.moradorId)) p.familiaId = nova.id;
        continue;
      }
      if (mu.tipo === 'tirar') continue; // por último, de uma vez
      const f = fam(mu.familiaId);
      if (!f) continue;
      if (mu.tipo === 'prontuario') {
        anotar(f, [`Prontuário ${mu.de || '(vazio)'} → ${mu.para}`]);
        f.prontuario = mu.para;
      } else if (mu.tipo === 'endereco') {
        anotar(f, [`Endereço ${mu.de} → ${mu.rotulo}`]);
        f.numero = mu.numero;
        f.complemento = mu.complemento;
      } else if (mu.tipo === 'pessoa') {
        const veio = mu.mover ? tirarDaCasa(mu.mover.familiaId, mu.mover.moradorId, enderecoCurto(f)) : null;
        const m = veio ? { ...veio, codSbcd: mu.morador.codSbcd ?? veio.codSbcd, nascimento: veio.nascimento || mu.morador.nascimento, sexo: veio.sexo || mu.morador.sexo } : structuredClone(mu.morador);
        f.moradores.push(m);
        if (!f.responsavelId) f.responsavelId = m.id;
        anotar(f, [veio ? `${m.nome} veio de ${mu.mover!.de}` : `Pessoa nova: ${m.nome}`], m.id);
        if (veio) for (const p of app.prioritarios) if (p.moradorId === m.id) p.familiaId = f.id;
      } else {
        const m = f.moradores.find((x) => x.id === mu.moradorId);
        if (!m) continue;
        const antes = $state.snapshot(m) as Morador;
        if (mu.tipo === 'nascimento') m.nascimento = mu.para;
        else if (mu.tipo === 'sexo') m.sexo = mu.para;
        else if (mu.tipo === 'obito') {
          m.situacao = 'faleceu';
          m.situacaoDesde = hoje;
        }
        anotar(f, mudancasMorador(antes, $state.snapshot(m) as Morador), m.id);
      }
    }
    // Prioritários que ainda não estavam ligados a uma pessoa: tenta de novo com o cadastro novo.
    for (const p of app.prioritarios) {
      if (p.moradorId) continue;
      const l = ligar(p, app.familias);
      if (l.moradorId) Object.assign(p, l);
    }
    const ruas = [...new Set([...app.config.ruas, ...app.familias.map((f) => f.rua).filter(Boolean)])];
    if (ruas.length !== app.config.ruas.length) app.config.ruas = ruas;
    app.historico.push(...criarAlteracoes('', [`Cadastro atualizado pelo SBCD: ${escolhida.length} ${escolhida.length === 1 ? 'mudança' : 'mudanças'}`]));
    await gravar({ familias: app.familias, prioritarios: app.prioritarios, historico: app.historico, config: app.config });
    const tirar = escolhida.filter((m) => m.tipo === 'tirar').map((m) => (m as { familiaId: string }).familiaId);
    if (tirar.length) await tirarFamiliasDaArea(tirar, 'não veio do SBCD');
  });

/** Marca grupos em vários moradores de uma vez (ex.: lista de hipertensos colada do Fast). */
export const marcarGruposEmLote = (itens: { familiaId: string; moradorId: string; grupos: Grupo[] }[]) =>
  comDesfazer('Marcar grupos', async () => {
    const quando = agora();
    for (const it of itens) {
      const f = app.familias.find((x) => x.id === it.familiaId);
      const m = f?.moradores.find((x) => x.id === it.moradorId);
      if (!f || !m) continue;
      const novos = it.grupos.filter((g) => !m.grupos.includes(g));
      if (!novos.length) continue;
      const antes = $state.snapshot(m) as Morador;
      m.grupos = [...m.grupos, ...novos];
      f.atualizadoEm = quando;
      app.historico.push(...criarAlteracoes(f.id, mudancasMorador(antes, $state.snapshot(m) as Morador), m.id));
    }
    await gravar({ familias: app.familias, historico: app.historico });
  });

export function familiaPorId(id: string): Familia | undefined {
  return app.familias.find((f) => f.id === id);
}

function _salvarVisita(v: Omit<Visita, 'id'>, atualizacoes: AtualizacaoFicha[] = []) {
  const id = novoId('v');
  app.visitas.push({ ...v, id, atualizadoEm: agora() });
  app.rascunho = null;
  aplicarRevisitas(id, v.familiaId, v.data, v.revisitasFeitas ?? [], []);
  aplicarAtualizacoesFicha(v.familiaId, v.data, atualizacoes);
  return gravar({
    visitas: app.visitas, rascunho: null, revisitas: app.revisitas, historico: app.historico,
    ...(atualizacoes.length ? { familias: app.familias, prioritarios: app.prioritarios } : {}),
  });
}

/** Marca como feitas as revisitas resolvidas na VD (e reabre as que foram desmarcadas numa correção). */
function aplicarRevisitas(visitaId: string, familiaId: string, data: string, feitas: string[], antes: string[]) {
  const textos: string[] = [];
  for (const r of app.revisitas) {
    if (feitas.includes(r.id) && !antes.includes(r.id)) {
      r.feitaEm = data;
      r.visitaId = visitaId;
      textos.push(`Revisita feita: ${r.motivo}`);
    } else if (!feitas.includes(r.id) && antes.includes(r.id)) {
      r.feitaEm = undefined;
      r.visitaId = undefined;
      textos.push(`Revisita reaberta: ${r.motivo}`);
    }
  }
  if (textos.length) app.historico.push(...criarAlteracoes(familiaId, textos));
}

/** Revisitas ainda por fazer, das mais urgentes para as mais tranquilas. */
export function revisitasAbertas(familiaId?: string): Revisita[] {
  return app.revisitas
    .filter((r) => !r.feitaEm && !r.canceladaEm && (!familiaId || r.familiaId === familiaId))
    .sort((a, b) => a.ate.localeCompare(b.ate));
}

async function _marcarRevisita(familiaId: string, motivo: string, ate: string) {
  const r: Revisita = { id: novoId('r'), familiaId, motivo: motivo.trim(), ate, criadaEm: new Date().toISOString() };
  app.revisitas.push(r);
  app.historico.push(...criarAlteracoes(familiaId, [`Revisita marcada: ${r.motivo} (até ${ate.split('-').reverse().join('/')})`]));
  await gravar({ revisitas: app.revisitas, historico: app.historico });
}

async function _cancelarRevisita(id: string) {
  const r = app.revisitas.find((x) => x.id === id);
  if (!r) return;
  r.canceladaEm = new Date().toISOString();
  app.historico.push(...criarAlteracoes(r.familiaId, [`Revisita cancelada: ${r.motivo}`]));
  await gravar({ revisitas: app.revisitas, historico: app.historico });
}

/** Corrige uma VD já salva e registra no histórico da família o que mudou. */
async function _corrigirVisita(id: string, nova: Omit<Visita, 'id'>, voltarParaFila: boolean, atualizacoes: AtualizacaoFicha[] = []) {
  const i = app.visitas.findIndex((v) => v.id === id);
  if (i < 0) return;
  const antes = $state.snapshot(app.visitas[i]) as Visita;
  const depois: Visita = { ...nova, id, lancadaNoFast: voltarParaFila ? false : antes.lancadaNoFast, atualizadoEm: agora() };
  const f = familiaPorId(antes.familiaId);
  const nome = (mid: string) => f?.moradores.find((m) => m.id === mid)?.nome.split(' ')[0] ?? '?';
  const textos = mudancasVisita(antes, depois, nome, (d) => app.config.nomesDesfecho[d]);
  app.visitas[i] = depois;
  app.rascunho = null;
  app.historico.push(...criarAlteracoes(antes.familiaId, textos));
  aplicarRevisitas(id, antes.familiaId, depois.data, depois.revisitasFeitas ?? [], antes.revisitasFeitas ?? []);
  aplicarAtualizacoesFicha(antes.familiaId, depois.data, atualizacoes);
  await gravar({
    visitas: app.visitas, historico: app.historico, rascunho: null, revisitas: app.revisitas,
    ...(atualizacoes.length ? { familias: app.familias, prioritarios: app.prioritarios } : {}),
  });
}

/** Posição da visita na ordem em que foram feitas (para manter o mesmo modelo de relato ao corrigir). */
export function ordemDaVisita(id: string): number {
  const i = app.visitas.findIndex((v) => v.id === id);
  return i < 0 ? app.visitas.length : i;
}

/** "Ninguém em casa" com 1 toque: registra a ausência completa na data escolhida. */
function _registrarAusencia(familiaId: string, data: string) {
  const anterior = app.visitas
    .filter((v) => v.familiaId === familiaId && v.data < data && diferencaDias(v.data, data) <= 30)
    .sort((a, b) => b.data.localeCompare(a.data))[0];
  const relato = gerarRelato({
    anterior: anterior ? { data: anterior.data, desfecho: anterior.desfecho } : undefined,
    desfecho: 'ausencia_completa',
    presentes: [],
    ausentes: [],
    conversouComFamilia: false,
    sinais: {},
    orientacoes: '',
    compartilhadaCom: '',
    contador: app.visitas.length,
  });
  return salvarVisita({
    familiaId,
    data,
    presentes: [],
    conversouComFamilia: false,
    desfecho: 'ausencia_completa',
    motivo: app.config.motivoPadrao,
    compartilhadaCom: '',
    sinais: {},
    orientacoes: '',
    relato,
    lancadaNoFast: false,
  });
}

/** Profissionais das últimas visitas compartilhadas (mais recente primeiro), para não digitar de novo. */
export function compartilhadosRecentes(): string[] {
  const vistos = new Set<string>();
  const lista: string[] = [];
  for (const v of [...app.visitas].sort((a, b) => b.data.localeCompare(a.data))) {
    const q = v.compartilhadaCom.trim();
    if (q && !vistos.has(q.toLowerCase())) {
      vistos.add(q.toLowerCase());
      lista.push(q);
    }
    if (lista.length >= 6) break;
  }
  return lista;
}

// ---------------- Rascunho da VD ----------------

export async function guardarRascunho(r: RascunhoVD) {
  if (app.fase !== 'aberto' || !cofre.aberto) return;
  app.rascunho = r;
  try {
    await cofre.gravar({ rascunho: $state.snapshot(r) as RascunhoVD });
  } catch (e) {
    console.error(e);
  }
}

export async function descartarRascunho() {
  app.rascunho = null;
  if (cofre.aberto) await gravar({ rascunho: null });
}

function _marcarLancada(id: string, lancada: boolean) {
  const v = app.visitas.find((x) => x.id === id);
  if (v) {
    v.lancadaNoFast = lancada;
    v.atualizadoEm = agora();
  }
  return gravar({ visitas: app.visitas });
}

// ---------------- Território (famílias e moradores) ----------------

/** Cria ou atualiza uma família (sem mexer nos moradores) e registra no histórico o que mudou. */
async function _salvarFamilia(nova: Familia): Promise<void> {
  const i = app.familias.findIndex((f) => f.id === nova.id);
  const antiga = i >= 0 ? ($state.snapshot(app.familias[i]) as Familia) : null;
  const final: Familia = antiga ? { ...nova, moradores: antiga.moradores } : nova;
  const textos = mudancasFamilia(antiga, final);
  if (!textos.length && JSON.stringify(antiga) === JSON.stringify(final)) return;
  final.atualizadoEm = agora();
  if (i >= 0) app.familias[i] = final;
  else app.familias.push(final);
  if (textos.length) app.historico.push(...criarAlteracoes(final.id, textos));
  await gravar({ familias: app.familias, historico: app.historico });
}

/** Cria ou atualiza um morador da família e registra no histórico o que mudou. */
async function _salvarMorador(familiaId: string, novo: Morador, tornarResponsavel = false): Promise<void> {
  const f = app.familias.find((x) => x.id === familiaId);
  if (!f) return;
  const i = f.moradores.findIndex((m) => m.id === novo.id);
  const antigo = i >= 0 ? ($state.snapshot(f.moradores[i]) as Morador) : null;
  const textos = mudancasMorador(antigo, novo);
  if (i >= 0) f.moradores[i] = novo;
  else f.moradores.push(novo);
  const antesResp = f.responsavelId;
  if (tornarResponsavel && novo.situacao === 'mora') f.responsavelId = novo.id;
  else if (!f.responsavelId && novo.situacao === 'mora') f.responsavelId = novo.id;
  if (f.responsavelId !== antesResp) {
    const nome = (id: string) => f.moradores.find((m) => m.id === id)?.nome ?? '(ninguém)';
    textos.push(`Responsável: ${nome(antesResp)} → ${nome(f.responsavelId)}`);
  }
  // Grava também quando só mudou algo que não vai para o histórico (ex.: tirar a marca "a conferir").
  const mudou = JSON.stringify(antigo) !== JSON.stringify(novo);
  if (!textos.length && !mudou) return;
  f.atualizadoEm = agora();
  if (textos.length) app.historico.push(...criarAlteracoes(familiaId, textos, novo.id));
  const etiquetasMudaram = sincronizarEtiquetas(novo.id, antigo?.grupos ?? [], novo.grupos);
  await gravar({ familias: app.familias, historico: app.historico, ...(etiquetasMudaram ? { prioritarios: app.prioritarios } : {}) });
}

/** Troca os dados de exemplo (ou a área vazia) pela área importada do CSV. */
async function _importarArea(familias: Familia[]): Promise<void> {
  const ruas = [...new Set([...app.config.ruas, ...familias.map((f) => f.rua).filter(Boolean)])];
  const quando = agora();
  app.familias = familias.map((f) => ({ ...f, atualizadoEm: quando }));
  app.visitas = []; // as visitas de exemplo eram inventadas
  app.revisitas = [];
  app.historico = criarAlteracoes('', [`Área importada do CSV: ${familias.length} famílias`]);
  app.config.usandoExemplo = false;
  app.config.ruas = ruas;
  await gravar({ config: app.config, familias: app.familias, visitas: app.visitas, historico: app.historico, revisitas: [] });
}

/** Define o sexo de um morador (botões F/M em "o que falta completar"). */
async function _confirmarSexo(familiaId: string, moradorId: string, sexo: 'M' | 'F') {
  const m = familiaPorId(familiaId)?.moradores.find((x) => x.id === moradorId);
  if (!m) return;
  await salvarMorador(familiaId, { ...($state.snapshot(m) as Morador), sexo });
}

export function historicoDaFamilia(familiaId: string): Alteracao[] {
  return app.historico.filter((h) => h.familiaId === familiaId).sort((a, b) => b.quando.localeCompare(a.quando));
}

// ---------------- Backup ----------------

export function dadosParaBackup(): Dados {
  return dadosAtuais();
}

export async function registrarBackupFeito() {
  app.config.ultimoBackup = hojeISO();
  await salvarConfig();
}

/** Junta os dados de um backup com os deste aparelho, sem apagar nada. */
async function _juntarBackup(texto: string, senha: string): Promise<ResumoJuncao> {
  const outro = await lerBackup(texto, senha);
  const { dados, resumo } = juntarDados(dadosAtuais(), outro);
  carregar(dados);
  app.historico.push(...criarAlteracoes('', [`Backup juntado: ${textoResumoJuncao(resumo)}`]));
  await gravar({ familias: app.familias, visitas: app.visitas, historico: app.historico, revisitas: app.revisitas, lixeira: app.lixeira, casos: app.casos, prioritarios: app.prioritarios });
  return resumo;
}

/** Substitui TODOS os dados atuais pelos do backup (mantém o PIN atual). */
export async function restaurarSobre(texto: string, senha: string) {
  const d = await lerBackup(texto, senha);
  carregar(d);
  await gravar({ config: app.config, familias: app.familias, visitas: app.visitas, historico: app.historico, revisitas: app.revisitas, lixeira: app.lixeira, casos: app.casos, prioritarios: app.prioritarios });
}

// ---------------- Bloqueio automático ----------------

let ultimoUso = Date.now();
let saiuEm: number | null = null;

export function marcarUso() {
  ultimoUso = Date.now();
}

export function instalarBloqueioAutomatico() {
  for (const ev of ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const) {
    window.addEventListener(ev, marcarUso, { passive: true, capture: true });
  }
  setInterval(() => {
    if (app.fase === 'aberto' && Date.now() - ultimoUso > app.config.minutosParado * 60_000) trancar();
  }, 10_000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      saiuEm = Date.now();
      void gravarRascunhoAgora?.(); // saiu do app: guarda a VD pela metade na hora
    } else if (saiuEm !== null) {
      const fora = Date.now() - saiuEm;
      saiuEm = null;
      if (fora > app.config.minutosFora * 60_000) trancar();
      else marcarUso();
    }
  });
}

// ---------------- Textos ----------------

/** Opções do painel conforme os ajustes (período da meta e dias de campo). */
export function opcoesPainel(referencia?: string): OpcoesPainel {
  return {
    referencia,
    diaInicioPeriodo: app.config.diaInicioPeriodo,
    ehDiaDeCampo: criarDiaDeCampo({
      feriadosIgnorados: app.config.feriadosIgnorados,
      diasSemCampo: app.config.diasSemCampo,
    }),
  };
}

export function enderecoCurto(f: Familia): string {
  const comp = f.complemento ? ` – ${f.complemento}` : '';
  return `${f.rua}, ${f.numero}${comp}`;
}

/** Nomes completos de quem estava presente na VD (para achar a família no Fast). */
export function presentesDaVisita(v: Visita): string[] {
  const f = familiaPorId(v.familiaId);
  return v.presentes.map((id) => f?.moradores.find((m) => m.id === id)?.nome).filter((n): n is string => !!n);
}

export function responsavel(f: Familia): string {
  const atuais = f.moradores.filter((m) => m.situacao === 'mora');
  return (atuais.find((m) => m.id === f.responsavelId) ?? atuais[0])?.nome ?? '(sem morador)';
}

export const salvarVisita = (v: Omit<Visita, 'id'>, atualizacoes: AtualizacaoFicha[] = []) => comDesfazer('Salvar VD', () => _salvarVisita(v, atualizacoes));

export const corrigirVisita = (id: string, nova: Omit<Visita, 'id'>, voltarParaFila: boolean, atualizacoes: AtualizacaoFicha[] = []) =>
  comDesfazer('Corrigir VD', () => _corrigirVisita(id, nova, voltarParaFila, atualizacoes));

export const marcarLancada = (id: string, lancada: boolean) => comDesfazer('Marcar como lançada', () => _marcarLancada(id, lancada));

export const registrarAusencia = (familiaId: string, data: string) => comDesfazer('Ninguém em casa', () => _registrarAusencia(familiaId, data));

export const salvarFamilia = (nova: Familia) => comDesfazer('Salvar família', () => _salvarFamilia(nova));

export const salvarMorador = (familiaId: string, novo: Morador, tornarResponsavel = false) => comDesfazer('Salvar morador', () => _salvarMorador(familiaId, novo, tornarResponsavel));

export const marcarRevisita = (familiaId: string, motivo: string, ate: string) => comDesfazer('Marcar revisita', () => _marcarRevisita(familiaId, motivo, ate));

export const cancelarRevisita = (id: string) => comDesfazer('Cancelar revisita', () => _cancelarRevisita(id));

export const juntarBackup = (texto: string, senha: string) => comDesfazer('Juntar backup', () => _juntarBackup(texto, senha));

export const importarArea = (familias: Familia[]) => comDesfazer('Importar área', () => _importarArea(familias));

export const confirmarSexo = (familiaId: string, moradorId: string, sexo: 'M' | 'F') => comDesfazer('Marcar sexo', () => _confirmarSexo(familiaId, moradorId, sexo));

// ---------------- Sincronização entre aparelhos ----------------
// Celular, tablet e computador do próprio ACS. Vai para a nuvem só uma cópia criptografada com a
// senha de sincronização, num repositório PRIVADO do GitHub do ACS (ver lib/sinc.ts).

let sincCfg: ConfigSinc | null = null;
let sincGh: GitHub | null = null;
let sincChaves: ChavesSinc | null = null;
/** Sal do arquivo na nuvem (reaproveitado: a chave fica na memória). */
let sincSal: string | null = null;
/** Versão da nuvem que já está juntada neste aparelho. */
let sincUltimaVersao: string | null = null;
/** Mudou algo aqui que ainda não foi para a nuvem. */
let sincSujo = false;
let sincRodando = false;
let sincDeNovo = false;
/** A sincronização em andamento (para esperar por ela antes de trancar). */
let sincPromessa: Promise<void> = Promise.resolve();
let sincTimer: ReturnType<typeof setTimeout> | undefined;
/** Gravando dados que vieram da nuvem (não conta como mudança daqui). */
let aplicandoRemoto = false;

function ligarSinc(cfg: ConfigSinc) {
  sincCfg = cfg;
  sincGh = new GitHub(cfg.repo, cfg.token);
  sincChaves = new ChavesSinc(cfg.senha);
  sincSal = null;
  sincUltimaVersao = null;
  app.sinc.repo = cfg.repo;
  app.sinc.aparelho = cfg.aparelho;
  app.sinc.estado = 'parada';
  app.sinc.mensagem = '';
}

/** Tira a chave e a senha da memória (ao trancar). */
function esquecerSinc() {
  clearTimeout(sincTimer);
  sincCfg = sincGh = sincChaves = null;
  sincSal = sincUltimaVersao = null;
}

/** Depois de abrir o app: liga a sincronização, se este aparelho estiver conectado. */
async function carregarSinc() {
  const cfg = await cofre.lerExtra<ConfigSinc>('sinc');
  if (!cfg) {
    app.sinc.estado = 'desligada';
    return;
  }
  ligarSinc(cfg);
  await sincronizar();
}

function marcarParaSincronizar() {
  if (!sincCfg) return;
  sincSujo = true;
  agendarSinc(5_000);
}

function agendarSinc(ms: number) {
  clearTimeout(sincTimer);
  sincTimer = setTimeout(() => void sincronizar(), ms);
}

/** Troca os dados deste aparelho pelos juntados com a nuvem (mantém a VD pela metade daqui). */
async function aplicarDaNuvem(novo: Dados) {
  aplicandoRemoto = true;
  try {
    carregar({ ...novo, rascunho: app.rascunho ? ($state.snapshot(app.rascunho) as RascunhoVD) : null });
    // O "Desfazer" antigo não vale mais (desfaria também o que veio dos outros aparelhos).
    ultimaAcao = null;
    app.desfazer = null;
    await gravar({ config: app.config, familias: app.familias, visitas: app.visitas, historico: app.historico, revisitas: app.revisitas, lixeira: app.lixeira, casos: app.casos, prioritarios: app.prioritarios });
  } finally {
    aplicandoRemoto = false;
  }
}

/**
 * Sincroniza agora: busca a cópia da nuvem, junta com a deste aparelho (nada é apagado; vale a
 * alteração mais recente) e manda de volta o resultado.
 */
export function sincronizar(): Promise<void> {
  if (!sincCfg || !sincGh || !sincChaves || app.fase !== 'aberto') return Promise.resolve();
  if (sincRodando) {
    sincDeNovo = true;
    return sincPromessa;
  }
  sincPromessa = rodarSinc();
  return sincPromessa;
}

async function rodarSinc(): Promise<void> {
  if (!sincCfg || !sincGh || !sincChaves) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    app.sinc.estado = 'offline';
    app.sinc.mensagem = 'Sem internet agora. Sincroniza quando a conexão voltar.';
    return;
  }
  sincRodando = true;
  app.sinc.estado = 'sincronizando';
  const [gh, chaves, cfg] = [sincGh, sincChaves, sincCfg];
  /** Ainda conectado e destrancado? (o app pode trancar no meio de uma sincronização) */
  const vivo = () => sincGh === gh && app.fase === 'aberto';
  try {
    for (let tentativa = 0; tentativa < 3; tentativa++) {
      // Primeiro só a versão (rápido): se nada mudou de nenhum lado, termina aqui.
      const versao = await gh.versao();
      if (!vivo()) return;
      if (versao && versao === sincUltimaVersao && !sincSujo) break;
      const remoto = versao ? await gh.lerVersao(versao) : null;
      if (!vivo()) return;
      if (remoto && remoto.commit !== sincUltimaVersao) {
        const aberto = await abrirSinc(remoto.texto, chaves);
        if (!vivo()) return;
        sincSal = aberto.sal;
        const aqui = dadosAtuais();
        // Aparelho novo (dados de exemplo ou vazio): fica com os dados da nuvem, sem misturar.
        const novo = app.config.usandoExemplo || app.familias.length === 0 ? aberto.dados : juntarDados(aqui, aberto.dados).dados;
        if (!mesmoConteudo(novo, aqui)) {
          await aplicarDaNuvem(novo);
          mostrarAviso(`Dados atualizados com o ${aberto.aparelho || 'outro aparelho'} ✓`);
        }
        sincUltimaVersao = remoto.commit;
        if (mesmoConteudo(dadosAtuais(), aberto.dados)) {
          sincSujo = false;
          break; // a nuvem já tem tudo
        }
      } else if (remoto && !sincSujo) {
        break; // nada mudou de nenhum lado
      }
      if (app.config.usandoExemplo) {
        throw new Error('Este aparelho está com dados de exemplo e a nuvem ainda está vazia. Conecte primeiro o aparelho que tem os seus dados.');
      }
      const { texto, sal } = await cifrarSinc(dadosAtuais(), chaves, cfg.aparelho, sincSal);
      sincSal = sal;
      // Outro aparelho gravou enquanto isso? Então junta de novo antes de gravar.
      if ((await gh.versao()) !== (remoto?.commit ?? null)) continue;
      const gravada = await gh.gravar(texto, cfg.aparelho);
      if (sincGh === gh) sincUltimaVersao = gravada;
      sincSujo = false;
      break;
    }
    if (!vivo()) return;
    app.sinc.estado = 'ok';
    app.sinc.mensagem = '';
    app.sinc.ultima = new Date().toISOString();
  } catch (e) {
    if (e instanceof ErroGitHub && e.status === 0) {
      app.sinc.estado = 'offline';
    } else {
      app.sinc.estado = 'erro';
      console.error(e);
    }
    app.sinc.mensagem = e instanceof Error ? e.message : String(e);
  } finally {
    sincRodando = false;
    if (sincDeNovo) {
      sincDeNovo = false;
      agendarSinc(1000);
    }
  }
}

/**
 * Conecta este aparelho à nuvem. Confere se o repositório é privado, se a chave pode gravar e se a
 * senha bate com a dos outros aparelhos. Só então guarda a configuração (criptografada com o PIN).
 */
export async function conectarSinc(cfg: ConfigSinc): Promise<void> {
  const gh = new GitHub(cfg.repo, cfg.token);
  const info = await gh.info();
  if (!info.privado) throw new Error('O repositório precisa ser PRIVADO. No GitHub: Settings do repositório → Change visibility → Private.');
  if (!info.podeGravar) throw new Error('A chave não pode gravar neste repositório. Confira a permissão "Contents: Read and write".');
  const remoto = await gh.ler();
  if (remoto) await abrirSinc(remoto.texto, new ChavesSinc(cfg.senha)); // confere a senha (lança se estiver errada)
  else if (app.config.usandoExemplo) {
    throw new Error('A nuvem ainda está vazia e este aparelho está com dados de exemplo. Conecte primeiro o aparelho que tem os seus dados.');
  }
  await cofre.gravarExtra('sinc', cfg);
  ligarSinc(cfg);
  sincSujo = true;
  await sincronizar();
  if (app.sinc.estado === 'erro') throw new Error(app.sinc.mensagem);
}

/**
 * Troca a chave do GitHub (ex.: quando venceu), sem desligar nada. Aceita a chave nova
 * ("github_pat_…") ou o código de conexão copiado de outro aparelho já com a chave nova.
 */
export async function trocarChaveSinc(entrada: string): Promise<void> {
  if (!sincCfg) throw new Error('A sincronização não está ligada neste aparelho.');
  let token = entrada.trim();
  let repo = sincCfg.repo;
  if (token.startsWith('{')) {
    const c = await lerArquivoConexao(token, sincCfg.senha);
    token = c.token;
    repo = limparRepo(c.repo);
  }
  if (!token) throw new Error('Cole a chave nova.');
  const info = await new GitHub(repo, token).info();
  if (!info.privado) throw new Error('O repositório precisa ser PRIVADO.');
  if (!info.podeGravar) throw new Error('A chave não pode gravar neste repositório. Confira a permissão "Contents: Read and write".');
  const cfg: ConfigSinc = { ...sincCfg, repo, token };
  await cofre.gravarExtra('sinc', cfg);
  ligarSinc(cfg);
  sincSujo = true;
  await sincronizar();
  if (app.sinc.estado === 'erro') throw new Error(app.sinc.mensagem);
}

/** Desliga a sincronização neste aparelho (os dados daqui e da nuvem continuam). */
export async function desligarSinc() {
  await cofre.gravarExtra('sinc', null);
  esquecerSinc();
  app.sinc.estado = 'desligada';
  app.sinc.ultima = '';
  app.sinc.mensagem = '';
}

/** Arquivo para ligar outro aparelho sem digitar a chave do GitHub (trancado com a senha de sincronização). */
export async function arquivoDeConexao(): Promise<string | null> {
  return sincCfg ? criarArquivoConexao(sincCfg) : null;
}

/** Sincroniza ao voltar a internet, ao voltar para o app, ao sair dele e a cada minuto (com o app na tela). */
export function instalarSincronizacao() {
  window.addEventListener('online', () => void sincronizar());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void sincronizar();
    else if (sincSujo) void sincronizar();
  });
  setInterval(() => {
    if (document.visibilityState === 'visible') void sincronizar();
  }, 60_000);
}
