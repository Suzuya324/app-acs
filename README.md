# Facilitador de VDs

App para Agentes Comunitários de Saúde: achar a família pelo endereço, registrar a visita
domiciliar (VD) na rua, gerar o relato pronto para o Fast e acompanhar a meta do mês.

> **Situação atual: Etapa 3 (Território).** Importar a área por CSV, cadastro de famílias e
> moradores com situação e data, histórico de alterações e lista "o que falta completar".
> Já prontos: PIN, dados criptografados, bloqueio automático, backup e funcionamento sem internet.

## Formato do CSV da área
Separador `;` (também aceita `,` e TAB), UTF-8 com BOM (também aceita o formato antigo do Excel):

```
Casa;Rua;Numero;Complemento;Bairro;Prontuario;Nome;Sexo;Data de nascimento
```

Uma linha por morador; a coluna `Casa` (C001, C002…) junta os moradores da mesma família.
Exemplo **fictício**: [`exemplos/area-exemplo.csv`](exemplos/area-exemplo.csv).

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

## Guia de uso
Passo a passo de backup, celular ↔ PC, lançar no Fast e verificação em duas etapas: [GUIA-DE-USO.md](GUIA-DE-USO.md).

## Créditos
Ícone do app: “community-healthworker”, da coleção [Health Icons](https://healthicons.org),
em domínio público (CC0 1.0).
