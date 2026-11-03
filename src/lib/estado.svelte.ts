// Estado do app: os dados ficam na memória SÓ enquanto o app está desbloqueado.
// Toda alteração é gravada criptografada no celular (ver cofre.ts).
import { armazenamentoIndexedDB } from './armazenamento';
import { lerBackup } from './backup';
import { Cofre, PinErrado, type Dados } from './cofre';
import { esperaAposErros } from './cripto';
import { gerarDadosFicticios } from './dados-ficticios';
import { hojeISO } from './datas';
import { CONFIG_PADRAO } from './rotulos';
import { criarAlteracoes, mudancasFamilia, mudancasMorador } from './historico';
import { novoId } from './ids';
import type { Alteracao, Config, Familia, Morador, Visita } from './tipos';

export type Fase = 'carregando' | 'configurar' | 'trancado' | 'aberto' | 'erro';

export const cofre = new Cofre(armazenamentoIndexedDB());

export const app = $state({
  fase: 'carregando' as Fase,
  config: structuredClone(CONFIG_PADRAO) as Config,
  familias: [] as Familia[],
  visitas: [] as Visita[],
  historico: [] as Alteracao[],
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
  const moradores = f.moradores.map((m) => ({ ...m, situacaoDesde: m.situacaoDesde ?? '', obs: m.obs ?? '', grupos: m.grupos ?? [] }));
  const responsavelId = f.responsavelId ?? moradores.find((m) => m.situacao === 'mora')?.id ?? '';
  return { ...f, bairro: f.bairro ?? '', obs: f.obs ?? '', colmeia: f.colmeia ?? '', responsavelId, moradores };
}

function carregar(d: Dados) {
  app.config = { ...structuredClone(CONFIG_PADRAO), ...d.config };
  app.familias = (d.familias ?? []).map(normalizarFamilia);
  app.visitas = d.visitas ?? [];
  app.historico = d.historico ?? [];
}

function dadosAtuais(): Dados {
  return $state.snapshot({
    config: app.config,
    familias: app.familias,
    visitas: app.visitas,
    historico: app.historico,
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

/** Tranca: esquece a chave e tira os dados da memória. */
export function trancar() {
  if (app.fase !== 'aberto') return;
  cofre.trancar();
  app.familias = [];
  app.visitas = [];
  app.historico = [];
  app.busca = '';
  app.fase = 'trancado';
}

export async function apagarTudo() {
  await cofre.apagarTudo();
  app.familias = [];
  app.visitas = [];
  app.historico = [];
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

export function familiaPorId(id: string): Familia | undefined {
  return app.familias.find((f) => f.id === id);
}

export function salvarVisita(v: Omit<Visita, 'id'>) {
  app.visitas.push({ ...v, id: novoId('v') });
  return gravar({ visitas: app.visitas });
}

export function marcarLancada(id: string, lancada: boolean) {
  const v = app.visitas.find((x) => x.id === id);
  if (v) v.lancadaNoFast = lancada;
  return gravar({ visitas: app.visitas });
}

// ---------------- Território (famílias e moradores) ----------------

/** Cria ou atualiza uma família (sem mexer nos moradores) e registra no histórico o que mudou. */
export async function salvarFamilia(nova: Familia): Promise<void> {
  const i = app.familias.findIndex((f) => f.id === nova.id);
  const antiga = i >= 0 ? ($state.snapshot(app.familias[i]) as Familia) : null;
  const final: Familia = antiga ? { ...nova, moradores: antiga.moradores } : nova;
  const textos = mudancasFamilia(antiga, final);
  if (!textos.length) return;
  if (i >= 0) app.familias[i] = final;
  else app.familias.push(final);
  app.historico.push(...criarAlteracoes(final.id, textos));
  await gravar({ familias: app.familias, historico: app.historico });
}

/** Cria ou atualiza um morador da família e registra no histórico o que mudou. */
export async function salvarMorador(familiaId: string, novo: Morador, tornarResponsavel = false): Promise<void> {
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
  if (!textos.length) return;
  app.historico.push(...criarAlteracoes(familiaId, textos, novo.id));
  await gravar({ familias: app.familias, historico: app.historico });
}

/** Troca os dados de exemplo (ou a área vazia) pela área importada do CSV. */
export async function importarArea(familias: Familia[]): Promise<void> {
  const ruas = [...new Set([...app.config.ruas, ...familias.map((f) => f.rua).filter(Boolean)])];
  app.familias = familias;
  app.visitas = []; // as visitas de exemplo eram inventadas
  app.historico = criarAlteracoes('', [`Área importada do CSV: ${familias.length} famílias`]);
  app.config.usandoExemplo = false;
  app.config.ruas = ruas;
  await gravar({ config: app.config, familias: app.familias, visitas: app.visitas, historico: app.historico });
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

/** Substitui TODOS os dados atuais pelos do backup (mantém o PIN atual). */
export async function restaurarSobre(texto: string, senha: string) {
  const d = await lerBackup(texto, senha);
  carregar(d);
  await gravar({ config: app.config, familias: app.familias, visitas: app.visitas, historico: app.historico });
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
    } else if (saiuEm !== null) {
      const fora = Date.now() - saiuEm;
      saiuEm = null;
      if (fora > app.config.minutosFora * 60_000) trancar();
      else marcarUso();
    }
  });
}

// ---------------- Textos ----------------

export function enderecoCurto(f: Familia): string {
  const comp = f.complemento ? ` – ${f.complemento}` : '';
  return `${f.rua}, ${f.numero}${comp}`;
}

export function responsavel(f: Familia): string {
  const atuais = f.moradores.filter((m) => m.situacao === 'mora');
  return (atuais.find((m) => m.id === f.responsavelId) ?? atuais[0])?.nome ?? '(sem morador)';
}
