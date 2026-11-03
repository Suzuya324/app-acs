// Liga o modo offline (service worker) e avisa quando há versão nova do app.
import { registerSW } from 'virtual:pwa-register';
import { app } from './estado.svelte';

let atualizar: ((recarregar?: boolean) => Promise<void>) | null = null;

export function ligarModoOffline() {
  if (!('serviceWorker' in navigator)) return;
  atualizar = registerSW({
    onNeedRefresh() {
      app.novaVersao = true;
    },
  });
}

/** Aplica a versão nova. Os dados não se perdem (estão gravados); o app pede o PIN de novo. */
export function atualizarApp() {
  app.novaVersao = false;
  atualizar?.(true);
}
