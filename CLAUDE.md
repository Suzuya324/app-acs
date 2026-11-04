# Facilitador de VDs — Guia do projeto para o Claude Code

## O que é
App web instalável (PWA) para Agentes Comunitários de Saúde (ACS). Funciona em **Android e iPhone**
pelo navegador, vira um ícone na tela do celular e funciona **sem internet**.

Ele resolve o que o sistema oficial da unidade (o "Fast", sistema web usado pela unidade) faz mal:
- achar a família pelo endereço ("Acácias 90") em segundos;
- registrar a visita domiciliar (VD) na rua, offline;
- gerar o texto do relato pronto para copiar e colar no Fast;
- saber a qualquer momento quantas famílias já foram visitadas no mês e quanto falta para a meta;
- nunca perder informação: quem mudou, quem chegou, quem faleceu, com histórico.

**O app NÃO se conecta ao Fast.** O lançamento oficial das VDs continua sendo feito à mão no Fast.

**Uso pessoal:** o app é de um único ACS, só para uso próprio (celular e computador pessoal).
Não é distribuído para outros usuários. Não registrar no repositório nada que identifique o usuário,
a unidade, a micro ou as ruas da área (o repositório pode ser público).

## Como trabalhar com o usuário
- Responder sempre em **português brasileiro**, com linguagem simples.
- O usuário é **leigo em programação**. Explicar o que cada mudança faz, sem jargão (ou explicando o
  jargão). Quando ele precisar fazer algo fora daqui (GitHub, celular, navegador), dizer **exatamente
  onde clicar**.
- Trabalhar **uma etapa por vez** (ver "Etapas"). Só avançar quando a etapa atual funcionar e ele aprovar.
- Antes de qualquer decisão técnica importante, mostrar **pontos bons e pontos ruins** de cada opção,
  mesmo depois de ele ter decidido.
- Mostrar o resultado cedo (link do app de teste, prints) para ele opinar.
- Rodar os testes e o build ao fim de cada etapa e corrigir os erros antes de seguir.
- Commits pequenos, com mensagem em português.

## Privacidade e segurança (obrigatório, nunca negociável)
O app guarda nomes, endereços e informações de saúde de pacientes (dados protegidos pela LGPD).
- **Os dados ficam só no celular de cada ACS.** Nada de servidor, nuvem, Firebase, analytics, login
  online ou qualquer envio de dados. A hospedagem só entrega os arquivos do app.
- **Nunca colocar dados reais de pacientes no repositório**: nem no código, nem em testes, nem em
  exemplos, commits, issues ou prints. O repositório pode ser público (GitHub Pages gratuito exige isso).
  Usar sempre nomes e endereços **fictícios**. Colocar `*.csv` no `.gitignore` (exceto a pasta de
  exemplos fictícios).
- Sem bibliotecas, fontes ou scripts carregados de CDN em tempo de uso: tudo empacotado no próprio app.
  Definir uma Content Security Policy que bloqueie conexões externas (`connect-src 'self'`).
- Dados salvos **criptografados** no aparelho, com chave derivada do PIN/senha do ACS
  (Web Crypto: PBKDF2 ou equivalente + AES-GCM). Explicar ao usuário que PIN curto é mais fácil de
  quebrar e recomendar no mínimo 6 dígitos.
- Bloqueio automático após alguns minutos sem uso e ao trocar de app.
- Backup só manual, em arquivo **criptografado**, salvo/compartilhado pelo próprio usuário.

## Tecnologia (padrão; propor mudança só com prós e contras)
- **Vite + TypeScript + Svelte** (telas), testes com **Vitest**.
- **IndexedDB** (via Dexie ou equivalente) para guardar os dados, criptografando o conteúdo sensível.
- **PWA**: manifest + service worker (vite-plugin-pwa/Workbox) para instalar e funcionar offline.
- Pedir armazenamento persistente (`navigator.storage.persist()`).
- **iPhone:** o Safari pode apagar dados de sites não usados por dias; app **instalado na Tela de
  Início** fica protegido. O app deve orientar a instalação e insistir no backup.
- Publicação: **GitHub Pages** com GitHub Actions (build automático a cada push na branch principal).
- Layout pensado para celular, uma mão, letra legível no sol, botões grandes. Modo escuro.

## Regras de negócio (vêm do uso real do Fast — seguir à risca)

### Território
- Estrutura: **Rua → Família (domicílio cadastrado) → Moradores.**
  - Família: rua, número (ou "S/N"), complemento, número na colmeia (opcional), prontuário (pode
    estar vazio ou incompleto, ex. "04."), observações, situação da casa (habitada, fechada, vazia,
    comércio, demolida, em construção).
  - Vários domicílios podem ter o mesmo número e complemento (ex.: três famílias no mesmo número).
  - A numeração da colmeia **não segue a ordem da rua**. Casa sem número = **S/N**.
  - Morador: nome, sexo, data de nascimento, situação com data (mora aqui, mudou-se, não pertence à
    área, faleceu, recusa), condições/grupos (gestante, puérpera, criança pequena, idoso, acamado,
    hipertenso, diabético, pessoa com deficiência, saúde mental, outros), observações.
- **Nada é apagado de verdade**: mudança de situação guarda data e histórico; exclusão vai para lixeira.
- **Busca única**: um campo que acha por nome, por "rua + número" (ex. "Acácias 90", "Ipês 310") ou
  por prontuário. Aceitar abreviações das ruas.
- Lista **"o que falta completar"**: família sem prontuário ou com prontuário incompleto, morador sem
  data de nascimento, casa sem responsável.

### Importar a área (CSV)
O ACS carrega a própria área a partir de um arquivo CSV (gerado por ele a partir do Fast):
- Separador `;`, UTF-8 com BOM, cabeçalho:
  `Casa;Rua;Numero;Complemento;Bairro;Prontuario;Nome;Sexo;Data de nascimento`
- Uma linha por morador. A coluna `Casa` (C001, C002…) agrupa os moradores da mesma família.
  `Sexo` = M/F. Datas em dd/mm/aaaa. Prontuário pode vir vazio.
- Antes de salvar, mostrar o resumo ("2 ruas, 190 famílias, 530 moradores") e pedir confirmação.
- Criar um CSV de exemplo **fictício** no mesmo formato para testes.

### Visitas domiciliares (VD)
- **Data**: sempre visível e editável. Nunca assumir "hoje" sem mostrar.
- Na VD o ACS toca nos moradores presentes. O app define o **desfecho** sozinho (podendo trocar):
  - todos presentes ou conversou com a família → **Visita realizada**;
  - alguém atendeu, mas o restante da família não estava → **Ausente realizada**;
  - ninguém em casa → **Ausência da família completa** (vai para a lista de revisitar);
  - família não quis receber → **Recusa**.
- **Motivo**: padrão **"Outros"** para famílias já acompanhadas (não "Visita Periódica" nem
  "Cadastramento"). Permitir trocar.
- **Visita compartilhada**: opção para marcar quando feita com outro profissional (ex.: técnica de
  enfermagem), com o nome/função.
- **Sinais vitais** (P.A., temperatura, peso, altura, glicemia): opcionais e entram **só no texto do
  relato** (no Fast eles não vão nos campos de Dados Vitais).
- **Relato gerado**: cita quem estava presente e quem estava ausente, inclui sinais vitais e
  orientações dadas, e **varia a redação** (trocar o modelo de frase a cada ~5 visitas, sem repetir).
  Botão **copiar relato**.
- **Fila "pra lançar no Fast"**: VDs pendentes, botões **copiar** e **marcar como lançada**.
- Nomes de desfecho e motivo devem ser **configuráveis**, para bater com o Fast de cada unidade.

### Meta e produção
- Meta padrão: **200 famílias por mês** (configurável).
- **Contam para a meta:** famílias com VD de desfecho **Visita realizada** ou **Ausente realizada**
  no mês. **Não contam:** ausência da família completa e recusa.
- Cada família conta **uma vez por mês**; o total de visitas aparece à parte.
- Mês = mês do calendário da data da VD (configurável depois se a unidade usar outro período).
- Painel: famílias visitadas X de 200 com barra, contagem por desfecho, visitas de hoje e da semana,
  quantas famílias por dia útil faltam até o fim do mês, famílias ainda não visitadas no mês, lista de
  ausência completa para revisitar, sugestão do dia (há mais tempo sem visita primeiro).
- Escrever **testes automatizados** para: desfecho automático, contagem da meta, gerador de relato
  (variação e sinais vitais) e importador CSV.

## Etapas (uma por vez)
1. **Protótipo**: telas principais com dados fictícios, sem salvar (início com a meta, busca, ficha da
   família, nova VD, fila do Fast). Publicar um link de teste para o usuário opinar no celular.
2. **Base**: configuração inicial (nome, micro, ruas, meta), PIN, bloqueio automático, banco
   criptografado. Pronto quando fecha, abre, digita o PIN e os dados continuam lá.
3. **Território**: famílias, moradores, situações com data, histórico, busca única, "o que falta
   completar" e **importador CSV**.
4. **Visitas e relatos**: VD com presentes, desfecho automático, sinais vitais, relato variado,
   copiar e fila do Fast. Meta: uma VD completa em menos de 1 minuto.
5. **Meta e painel** (regras acima).
6. **Proteção contra perda**: lixeira, desfazer, histórico de alterações, backup e restauração
   criptografados, lembrete semanal de backup.
7. **Publicar e instalar**: GitHub Pages; instalação no celular do próprio ACS e no computador pessoal.
8. **Uso real**: corrigir o que aparecer e tutorial de primeiro uso.

Depois da versão 1, novas funções em pacotes pequenos (colmeia com cores, calendário de dias úteis,
lembretes, roteiros de orientação por grupo, relatório do mês em PDF paisagem, lista de prontuários
em ordem numérica em PDF paisagem, ditado por voz etc.).

## Fora do escopo
- Qualquer integração, login automático, raspagem (scraping) ou envio de dados para o Fast, e-SUS ou
  qualquer outro sistema.
- Compartilhar dados entre ACS. Cada um tem só a própria área, no próprio celular.
- Reaproveitar código do Fast ou do e-SUS Território (as fichas públicas do e-SUS podem servir de
  referência para campos).
