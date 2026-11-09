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
    // O app instalado fica aberto em segundo plano e não recarrega: procura versão nova
    // ao voltar para ele e a cada hora (só baixa o aviso; os dados não mudam).
    onRegisteredSW(_url, registro) {
      if (!registro) return;
      const procurar = () => {
        if (navigator.onLine !== false) void registro.update().catch(() => {});
      };
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') procurar();
      });
      setInterval(procurar, 60 * 60 * 1000);
    },
  });
}

/** Aplica a versão nova. Os dados não se perdem (estão gravados); o app pede o PIN de novo. */
export function atualizarApp() {
  app.novaVersao = false;
  atualizar?.(true);
}
