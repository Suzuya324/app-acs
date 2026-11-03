// Onde os dados ficam guardados no celular (IndexedDB, banco do próprio navegador).
// Aqui só passam dados JÁ criptografados, e as informações do cofre (que não são segredo).

export interface Armazenamento {
  ler<T>(chave: string): Promise<T | undefined>;
  /** Grava várias chaves de uma vez: ou grava todas, ou nenhuma. */
  gravar(itens: Record<string, unknown>): Promise<void>;
  apagarTudo(): Promise<void>;
}

const NOME_BANCO = 'app-acs';
const TABELA = 'itens';

function pedido<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((ok, erro) => {
    r.onsuccess = () => ok(r.result);
    r.onerror = () => erro(r.error);
  });
}

export function armazenamentoIndexedDB(): Armazenamento {
  let banco: Promise<IDBDatabase> | null = null;
  const abrir = () => {
    banco ??= new Promise((ok, erro) => {
      const r = indexedDB.open(NOME_BANCO, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(TABELA);
      r.onsuccess = () => ok(r.result);
      r.onerror = () => erro(r.error);
    });
    return banco;
  };

  return {
    async ler<T>(chave: string) {
      const db = await abrir();
      return pedido<T | undefined>(db.transaction(TABELA).objectStore(TABELA).get(chave));
    },
    async gravar(itens) {
      const db = await abrir();
      const tx = db.transaction(TABELA, 'readwrite');
      const t = tx.objectStore(TABELA);
      for (const [k, v] of Object.entries(itens)) t.put(v, k);
      await new Promise<void>((ok, erro) => {
        tx.oncomplete = () => ok();
        tx.onerror = () => erro(tx.error);
        tx.onabort = () => erro(tx.error);
      });
    },
    async apagarTudo() {
      const db = await abrir();
      const tx = db.transaction(TABELA, 'readwrite');
      tx.objectStore(TABELA).clear();
      await new Promise<void>((ok, erro) => {
        tx.oncomplete = () => ok();
        tx.onerror = () => erro(tx.error);
      });
    },
  };
}

/** Versão só na memória (usada nos testes). */
export function armazenamentoMemoria(): Armazenamento & { bruto: Map<string, unknown> } {
  const bruto = new Map<string, unknown>();
  return {
    bruto,
    async ler<T>(chave: string) {
      return structuredClone(bruto.get(chave)) as T | undefined;
    },
    async gravar(itens) {
      for (const [k, v] of Object.entries(itens)) bruto.set(k, structuredClone(v));
    },
    async apagarTudo() {
      bruto.clear();
    },
  };
}
