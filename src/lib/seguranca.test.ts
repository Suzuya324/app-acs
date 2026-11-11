import { describe, expect, it } from 'vitest';
import { CSP } from '../../vite.config';

// Trava de segurança: o app não pode mandar nada para fora, a não ser a cópia criptografada para a API do GitHub.
// Se alguém (ou alguma mudança futura) afrouxar a regra, este teste falha e o app NÃO é publicado.
describe('segurança: o app não se conecta a outros endereços', () => {
  const regras = Object.fromEntries(CSP.split(';').map((r) => r.trim().split(/\s+/)).map(([nome, ...valores]) => [nome, valores]));

  it('só conversa com ele mesmo e com a API do GitHub', () => {
    expect(regras['connect-src']).toEqual(["'self'", 'https://api.github.com']);
    expect(regras['default-src']).toEqual(["'self'"]);
    expect(regras['script-src']).toEqual(["'self'"]);
    expect(regras['form-action']).toEqual(["'none'"]);
    expect(regras['object-src']).toEqual(["'none'"]);
  });

  it('nenhum endereço de fora escondido no código do app', () => {
    const permitidos = /^https:\/\/(api\.github\.com|github\.com|docs\.github\.com|www\.w3\.org)/;
    // Todos os arquivos do app, como texto (o próprio Vite lê; nada sai do computador).
    const arquivos = import.meta.glob(['/src/**/*.ts', '/src/**/*.svelte', '!/src/**/*.test.ts'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
    expect(Object.keys(arquivos).length).toBeGreaterThan(20);
    const proibidos: string[] = [];
    for (const [caminho, texto] of Object.entries(arquivos)) {
      for (const url of texto.match(/https?:\/\/[^\s'"`)<>]+/g) ?? []) {
        // "https://…" é só o texto de exemplo de um campo, não um endereço.
        if (!permitidos.test(url) && !url.includes('…')) proibidos.push(`${caminho}: ${url}`);
      }
    }
    expect(proibidos).toEqual([]);
  });
});
