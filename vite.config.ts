/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// Regra de segurança (CSP): o app só pode carregar coisas dele mesmo e
// NÃO pode se conectar a nenhum outro endereço da internet.
// Só é aplicada no build final (o modo de desenvolvimento precisa de conexões locais).
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
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
  // Caminhos relativos: funciona em qualquer endereço (ex.: usuario.github.io/app-acs/)
  base: './',
  plugins: [svelte(), cspPlugin()],
  test: {
    include: ['src/**/*.test.ts'],
  },
});
