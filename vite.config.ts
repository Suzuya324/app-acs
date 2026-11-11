/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

// Regra de segurança (CSP): o app só pode carregar coisas dele mesmo e
// NÃO pode se conectar a nenhum outro endereço da internet, exceto a API do GitHub
// (sincronização entre os aparelhos do ACS, só com dados criptografados).
// Só é aplicada no build final (o modo de desenvolvimento precisa de conexões locais).
export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  // Única exceção: a API do GitHub, para a sincronização (só vai uma cópia CRIPTOGRAFADA).
  "connect-src 'self' https://api.github.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

function cspPlugin(): Plugin {
  return {
    name: 'csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
      );
    },
  };
}

export default defineConfig({
  // Versão do app (data e hora da montagem), para conferir em Ajustes se o celular já atualizou.
  define: { __VERSAO__: JSON.stringify(new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })) },
  // Caminhos relativos: funciona em qualquer endereço (ex.: usuario.github.io/app-acs/)
  base: './',
  plugins: [
    svelte(),
    cspPlugin(),
    // PWA: deixa o app instalável e funcionando SEM internet.
    // O "service worker" guarda os arquivos do app no celular. Ele NÃO guarda nem envia dados de pacientes.
    VitePWA({
      registerType: 'prompt', // avisa "nova versão" em vez de trocar sozinho no meio do uso
      injectRegister: false,
      includeAssets: ['icone.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Facilitador de VDs',
        short_name: 'Facilitador',
        description: 'Visitas domiciliares, relatos e meta do mês. Dados só no celular.',
        lang: 'pt-BR',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0b6b5b',
        theme_color: '#0b6b5b',
        icons: [
          { src: 'icone-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icone-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icone-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts'],
  },
});
