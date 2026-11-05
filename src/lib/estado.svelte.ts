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
import { novoId } from './ids';
import type { Alteracao, Config, Familia, Grupo, Morador, RascunhoVD, Revisita, Visita } from './tipos';

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
});

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
  cofre.trancar();
  app.familias = [];
  app.visitas = [];
  app.historico = [];
  app.rascunho = null;
  app.revisitas = [];
  app.lixeira = [];
  ultimaAcao = null;
  app.desfazer = null;
  app.busca = '';
  app.fase = 'trancado';
}

export async function apagarTudo() {
  await cofre.apagarTudo();
  app.familias = [];
  app.visitas = [];
  app.historico = [];
  app.rascunho = null;
  app.revisitas = [];
  app.lixeira = [];
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
  } catch (e) {
    console.error(e);
    mostrarAviso('⚠️ Não consegui salvar! Não feche o app e tente de novo.', 6000);
  }
}

export function salvarConfig() {
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
}
async function gravarTudo() {
  await gravar({ familias: app.familias, visitas: app.visitas, historico: app.historico, revisitas: app.revisitas, lixeira: app.lixeira, rascunho: app.rascunho });
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

function _salvarVisita(v: Omit<Visita, 'id'>) {
  const id = novoId('v');
  app.visitas.push({ ...v, id, atualizadoEm: agora() });
  app.rascunho = null;
  aplicarRevisitas(id, v.familiaId, v.data, v.revisitasFeitas ?? [], []);
  return gravar({ visitas: app.visitas, rascunho: null, revisitas: app.revisitas, historico: app.historico });
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
async function _corrigirVisita(id: string, nova: Omit<Visita, 'id'>, voltarParaFila: boolean) {
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
  await gravar({ visitas: app.visitas, historico: app.historico, rascunho: null, revisitas: app.revisitas });
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
  if (!textos.length) return;
  final.atualizadoEm = agora();
  if (i >= 0) app.familias[i] = final;
  else app.familias.push(final);
  app.historico.push(...criarAlteracoes(final.id, textos));
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
  await gravar({ familias: app.familias, historico: app.historico });
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
  await gravar({ familias: app.familias, visitas: app.visitas, historico: app.historico, revisitas: app.revisitas, lixeira: app.lixeira });
  return resumo;
}

/** Substitui TODOS os dados atuais pelos do backup (mantém o PIN atual). */
export async function restaurarSobre(texto: string, senha: string) {
  const d = await lerBackup(texto, senha);
  carregar(d);
  await gravar({ config: app.config, familias: app.familias, visitas: app.visitas, historico: app.historico, revisitas: app.revisitas, lixeira: app.lixeira });
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

export const salvarVisita = (v: Omit<Visita, 'id'>) => comDesfazer('Salvar VD', () => _salvarVisita(v));

export const corrigirVisita = (id: string, nova: Omit<Visita, 'id'>, voltarParaFila: boolean) => comDesfazer('Corrigir VD', () => _corrigirVisita(id, nova, voltarParaFila));

export const marcarLancada = (id: string, lancada: boolean) => comDesfazer('Marcar como lançada', () => _marcarLancada(id, lancada));

export const registrarAusencia = (familiaId: string, data: string) => comDesfazer('Ninguém em casa', () => _registrarAusencia(familiaId, data));

export const salvarFamilia = (nova: Familia) => comDesfazer('Salvar família', () => _salvarFamilia(nova));

export const salvarMorador = (familiaId: string, novo: Morador, tornarResponsavel = false) => comDesfazer('Salvar morador', () => _salvarMorador(familiaId, novo, tornarResponsavel));

export const marcarRevisita = (familiaId: string, motivo: string, ate: string) => comDesfazer('Marcar revisita', () => _marcarRevisita(familiaId, motivo, ate));

export const cancelarRevisita = (id: string) => comDesfazer('Cancelar revisita', () => _cancelarRevisita(id));

export const juntarBackup = (texto: string, senha: string) => comDesfazer('Juntar backup', () => _juntarBackup(texto, senha));

export const importarArea = (familias: Familia[]) => comDesfazer('Importar área', () => _importarArea(familias));

export const confirmarSexo = (familiaId: string, moradorId: string, sexo: 'M' | 'F') => comDesfazer('Marcar sexo', () => _confirmarSexo(familiaId, moradorId, sexo));
