# App do ACS

App para Agentes Comunitários de Saúde: achar a família pelo endereço, registrar a visita
domiciliar (VD) na rua, gerar o relato pronto para o Fast e acompanhar a meta do mês.

> **Situação atual: protótipo (Etapa 1).** Telas com **dados fictícios**. Nada é salvo.

## Privacidade
- Os dados ficam **só no celular** de cada ACS. Não há servidor, nuvem, login nem estatísticas.
- O app é proibido (por uma regra de segurança, a CSP) de se conectar a outros endereços.
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
