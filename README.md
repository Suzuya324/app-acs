# App do ACS

App para Agentes Comunitários de Saúde: achar a família pelo endereço, registrar a visita
domiciliar (VD) na rua, gerar o relato pronto para o Fast e acompanhar a meta do mês.

> **Situação atual: Etapa 2 (Base).** PIN, dados criptografados no celular, bloqueio automático,
> backup criptografado e funcionamento sem internet. O importador da área (CSV) vem na Etapa 3;
> até lá dá para usar **dados de exemplo inventados**.

## Privacidade
- Os dados ficam **só no celular** de cada ACS. Não há servidor, nuvem, login nem estatísticas.
- O app é proibido (por uma regra de segurança, a CSP) de se conectar a outros endereços.
- Tudo é gravado **criptografado** (AES-GCM 256, chave derivada do PIN com PBKDF2-SHA256, 600 mil
  repetições). A chave só existe na memória enquanto o app está desbloqueado.
- O backup é um arquivo criptografado com uma senha escolhida pelo usuário.
- **Nunca** coloque dados reais de pacientes neste repositório (nem CSV, nem prints, nem issues).

## Para quem programa
```bash
npm install      # instala as ferramentas
npm run dev      # abre o app para testar no computador
npm test         # roda os testes automáticos
npm run check    # procura erros no código
npm run build    # gera a versão final na pasta dist/
```

Ferramentas: Vite + TypeScript + Svelte 5, testes com Vitest. Ver `CLAUDE.md` para as regras do projeto.
A publicação no GitHub Pages é automática a cada envio para a branch `main`.
