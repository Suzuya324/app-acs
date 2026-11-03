// Estado do app: os dados ficam na memória SÓ enquanto o app está desbloqueado.
// Toda alteração é gravada criptografada no celular (ver cofre.ts).
import { armazenamentoIndexedDB } from './armazenamento';
import { lerBackup } from './backup';
import { Cofre, PinErrado, type Dados } from './cofre';
import { esperaAposErros } from './cripto';
import { gerarDadosFicticios } from './dados-ficticios';
import { hojeISO } from './datas';
import { CONFIG_PADRAO } from './rotulos';
import type { Config, Familia, Visita } from './tipos';

export type Fase = 'carregando' | 'configurar' | 'trancado' | 'aberto' | 'erro';

export const cofre = new Cofre(armazenamentoIndexedDB());

export const app = $state({
  fase: 'carregando' as Fase,
  config: structuredClone(CONFIG_PADRAO) as Config,
  familias: [] as Familia[],
  visitas: [] as Visita[],
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

function carregar(d: Dados) {
  app.config = { ...structuredClone(CONFIG_PADRAO), ...d.config };
  app.familias = d.familias;
  app.visitas = d.visitas;
}

function dadosAtuais(): Dados {
  return $state.snapshot({ config: app.config, familias: app.familias, visitas: app.visitas }) as Dados;
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
    dados = { config: { ...config, usandoExemplo: true }, ...gerarDadosFicticios(hojeISO()) };
  } else if (origem === 'vazio') {
    dados = { config: { ...config, usandoExemplo: false }, familias: [], visitas: [] };
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
  app.busca = '';
  app.fase = 'trancado';
}

export async function apagarTudo() {
  await cofre.apagarTudo();
  app.familias = [];
  app.visitas = [];
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
  app.visitas.push({ ...v, id: `v${Date.now()}${Math.floor(Math.random() * 1000)}` });
  return gravar({ visitas: app.visitas });
}

export function marcarLancada(id: string, lancada: boolean) {
  const v = app.visitas.find((x) => x.id === id);
  if (v) v.lancadaNoFast = lancada;
  return gravar({ visitas: app.visitas });
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
  await gravar({ config: app.config, familias: app.familias, visitas: app.visitas });
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
  return f.moradores.find((m) => m.situacao === 'mora')?.nome ?? '(sem morador)';
}
