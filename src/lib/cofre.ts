// O "cofre": cria, abre (com o PIN) e grava os dados criptografados.
import type { Armazenamento } from './armazenamento';
import { bytesAleatorios, cifrar, decifrar, derivarChave, ITERACOES_PADRAO, type Cifrado } from './cripto';
import type { Alteracao, Config, Familia, Visita } from './tipos';

export interface Dados {
  config: Config;
  familias: Familia[];
  visitas: Visita[];
  /** Histórico de alterações do cadastro (nada é apagado). */
  historico: Alteracao[];
}
export type Parte = keyof Dados;
const PARTES: Parte[] = ['config', 'familias', 'visitas', 'historico'];

interface InfoCofre {
  versao: 1;
  sal: Uint8Array;
  iteracoes: number;
  /** Um texto conhecido, cifrado: serve para saber se o PIN está certo. */
  verificador: Cifrado;
}

export interface Tentativas {
  erros: number;
  /** Momento (ms) do último erro. */
  ultimoErro: number;
}

const VERIFICADOR = 'app-acs-ok';
const chaveParte = (p: Parte) => `dados:${p}`;

export class PinErrado extends Error {
  constructor() {
    super('PIN errado');
  }
}

export class Cofre {
  private chave: CryptoKey | null = null;

  constructor(
    private armaz: Armazenamento,
    private iteracoes = ITERACOES_PADRAO,
  ) {}

  async existe(): Promise<boolean> {
    return (await this.armaz.ler<InfoCofre>('cofre')) !== undefined;
  }

  get aberto(): boolean {
    return this.chave !== null;
  }

  /** Cria o cofre com um PIN novo e grava os dados iniciais. */
  async criar(pin: string, dados: Dados): Promise<void> {
    const sal = bytesAleatorios(16);
    const chave = await derivarChave(pin, sal, this.iteracoes);
    const info: InfoCofre = { versao: 1, sal, iteracoes: this.iteracoes, verificador: await cifrar(chave, VERIFICADOR) };
    const itens: Record<string, unknown> = { cofre: info, tentativas: { erros: 0, ultimoErro: 0 } };
    for (const p of PARTES) itens[chaveParte(p)] = await cifrar(chave, dados[p]);
    await this.armaz.gravar(itens);
    this.chave = chave;
  }

  async tentativas(): Promise<Tentativas> {
    return (await this.armaz.ler<Tentativas>('tentativas')) ?? { erros: 0, ultimoErro: 0 };
  }

  /** Abre o cofre com o PIN. Lança PinErrado se o PIN não confere. */
  async abrir(pin: string): Promise<Dados> {
    const info = await this.armaz.ler<InfoCofre>('cofre');
    if (!info) throw new Error('Cofre não existe');
    const chave = await derivarChave(pin, info.sal, info.iteracoes);
    try {
      const v = await decifrar<string>(chave, info.verificador);
      if (v !== VERIFICADOR) throw new Error();
    } catch {
      const t = await this.tentativas();
      await this.armaz.gravar({ tentativas: { erros: t.erros + 1, ultimoErro: Date.now() } });
      throw new PinErrado();
    }
    this.chave = chave;
    await this.armaz.gravar({ tentativas: { erros: 0, ultimoErro: 0 } });
    const dados = {} as Dados;
    for (const p of PARTES) {
      const c = await this.armaz.ler<Cifrado>(chaveParte(p));
      (dados as unknown as Record<string, unknown>)[p] = c ? await decifrar(chave, c) : p === 'config' ? null : [];
    }
    return dados;
  }

  /** Grava uma ou mais partes dos dados (criptografadas). */
  async gravar(partes: Partial<Dados>): Promise<void> {
    if (!this.chave) throw new Error('Cofre trancado');
    const itens: Record<string, unknown> = {};
    for (const [p, v] of Object.entries(partes)) itens[chaveParte(p as Parte)] = await cifrar(this.chave, v);
    await this.armaz.gravar(itens);
  }

  /** Confere o PIN atual sem mexer em nada (usado antes de trocar o PIN). */
  async conferirPin(pin: string): Promise<boolean> {
    const info = await this.armaz.ler<InfoCofre>('cofre');
    if (!info) return false;
    try {
      const chave = await derivarChave(pin, info.sal, info.iteracoes);
      return (await decifrar<string>(chave, info.verificador)) === VERIFICADOR;
    } catch {
      return false;
    }
  }

  /** Troca o PIN: recriptografa tudo com a nova chave. */
  async trocarPin(novoPin: string, dados: Dados): Promise<void> {
    if (!this.chave) throw new Error('Cofre trancado');
    await this.criar(novoPin, dados);
  }

  /** Esquece a chave (tranca). Os dados continuam gravados, criptografados. */
  trancar(): void {
    this.chave = null;
  }

  async apagarTudo(): Promise<void> {
    this.chave = null;
    await this.armaz.apagarTudo();
  }
}
