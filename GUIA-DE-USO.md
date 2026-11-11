# Guia de uso: Facilitador de VDs

Link do app (o mesmo no celular e no PC): **https://suzuya324.github.io/app-acs/**

> Os dados ficam nos **seus aparelhos**, criptografados com o PIN. Com a **sincronização** ligada,
> celular, tablet e computador ficam iguais sozinhos (seção 1). Sem ela, use o **backup** e o **Juntar**.

---

## 1. Sincronizar celular, tablet e computador (fazer uma vez)

O app manda uma cópia **trancada** (só abre com a sua senha de sincronização) para um cofre
**privado** no seu GitHub. Os outros aparelhos pegam sozinhos. O GitHub não consegue ler nada.

**No GitHub** (pelo navegador, com "Site para computador" ligado no celular)
1. **Criar o cofre:** entre em **github.com/new** → "Repository name": `facilitador-dados` →
   marque **Private** → **Create repository**.
2. **Criar a chave:** entre em **github.com/settings/personal-access-tokens/new** →
   "Token name": `facilitador` → "Expiration": a maior possível (anote a data para renovar) →
   "Repository access": **Only select repositories** → escolha `facilitador-dados` →
   "Permissions" → "Repository permissions" → **Contents: Read and write** → **Generate token** →
   copie a chave (começa com `github_pat_`).

**No primeiro aparelho** (o que tem os seus dados)
1. App → **Ajustes** → quadro **Sincronizar aparelhos** → "Primeiro aparelho".
2. Cole o repositório (`seu-usuario/facilitador-dados`) e a chave.
3. Crie a **senha de sincronização** (mínimo 10 caracteres) e guarde num lugar seguro.
4. Nome do aparelho (ex.: Celular) → **Conectar**.
5. Toque em **"Copiar código para ligar outro aparelho"** e mande o código para você mesmo
   (ex.: WhatsApp). Ele vai trancado com a senha. (Ou use "Salvar arquivo para ligar outro aparelho".)

**Nos outros aparelhos** (tablet, computador)
1. App → **Ajustes** → **Sincronizar aparelhos** → **"Tenho o código ou o arquivo de conexão"**.
2. Copie o código da mensagem e **cole** no campo "Ou cole aqui o código de conexão" (ou escolha o arquivo).
3. Digite a mesma senha de sincronização, o nome do aparelho → **Conectar**.
4. Pronto: o aparelho fica com os seus dados. Apague a mensagem/arquivo de conexão depois.

**Como funciona no dia a dia:** sincroniza sozinho ao abrir o app, uns segundos depois de cada
alteração, a cada minuto (com o app aberto) e antes de trancar. Sem internet, guarda e manda quando voltar.
Nada é apagado: vale sempre a alteração mais recente. A tela inicial mostra
"✓ Sincronizado com os outros aparelhos".

**Se a chave vencer** (o GitHub avisa por e-mail; o app mostra "⚠️ A sincronização parou"):
1. No GitHub: **github.com/settings/personal-access-tokens** → **facilitador** → **Regenerate token**
   → copie a chave nova.
2. No celular: **Ajustes → Sincronizar aparelhos → "Trocar a chave do GitHub"** → cole → **Trocar a chave**.
3. Nos outros aparelhos: no celular, toque em **"Copiar código para ligar outro aparelho"**, mande para
   você mesmo e, no outro aparelho, cole o código no mesmo campo **"Trocar a chave"**.

> O arquivo/código de conexão **não é backup**: só liga a sincronização. O backup é o arquivo
> `backup-facilitador-AAAA-MM-DD`, criado em **Ajustes → Backup → Fazer backup agora**.

---

## 1b. Sem sincronização: passar as VDs do celular para o PC pelo backup

**No celular**
1. Abra o app → aba **Ajustes**.
2. No quadro **Backup**, escreva a **senha do backup** duas vezes (sempre a mesma senha).
3. Toque em **"Fazer backup agora (salvar no celular)"**.
4. O arquivo `backup-facilitador-AAAA-MM-DD.json` vai para a pasta **Downloads**.

**Levar o arquivo para o PC** (escolha um)
- **Cabo USB** (melhor): ligue o celular no PC → no celular, toque na notificação "USB" e escolha
  **"Transferir arquivos"** → no PC, abra o celular no Explorador de Arquivos → pasta **Download**
  → copie o arquivo para a Área de Trabalho.
- **Google Drive**: no celular, Drive → **+** → **Upload** → escolha o arquivo. No PC, abra o
  Drive e baixe.

**No PC**
1. Abra o app → **Ajustes** → **Backup** → abra **"Juntar com um backup (celular ↔ computador)"**.
2. Escolha o arquivo e digite a senha do backup → **Juntar**.
3. Aparece o resumo, por exemplo: "✓ 5 VDs novas". Pronto: o PC tem tudo do celular.

> **Juntar** nunca apaga nada. **Não** use "Restaurar" para isso: restaurar **substitui tudo**.

---

## 2. Lançar no Fast pelo PC

1. No app do PC: **Fila** (do Fast) → **"Lançar em sequência"**.
2. Para cada VD: **1** Copiar prontuário → cole no Fast; **2** Copiar relato → cole no Fast;
   **3** confira a data e toque em **"Lancei no Fast, próxima"**.
3. Dica: em **Ajustes → Fast**, coloque o endereço do Fast para ter o botão **"Abrir o Fast"**.

---

## 3. Sem sincronização: devolver para o celular o que foi lançado no PC

1. **No PC**: Ajustes → **Fazer backup agora** (o arquivo vai para a pasta Downloads do PC).
2. Leve o arquivo para o celular (cabo USB ou Drive).
3. **No celular**: Ajustes → **"Juntar com um backup"** → escolha o arquivo → senha → **Juntar**.
4. As VDs lançadas no PC ficam marcadas como lançadas no celular também.

**Resumo do ciclo:** celular faz backup → PC junta → lança no Fast → PC faz backup → celular junta.

---

## 4. Errei! Desfazer e lixeira

- **Desfazer:** depois de salvar, corrigir, excluir, marcar como lançada ou juntar, o aviso de baixo
  mostra o botão **"Desfazer"** por alguns segundos. Ele volta tudo como estava antes.
- **Excluir** é só para o que foi cadastrado **por engano** (VD, família ou morador): o botão fica no
  fim da tela de corrigir VD, editar família e editar morador. Quem **mudou-se** ou **faleceu** não se
  exclui: mude a **situação**.
- O excluído vai para **Ajustes → Lixeira**, onde dá para **Restaurar**. Nada é apagado de verdade.

---

## 5. Atenção, mapa e lista de prontuários

- **Atenção** (no Início): gestantes, puérperas, crianças e acamados sem VD há 30 dias; hipertensos
  sem P.A. e diabéticos sem glicemia há 60 dias; aniversários da semana; quem fez 60 anos ou já
  passou de 2 anos (um toque ajusta o grupo).
- **Marcar grupos de uma vez:** Ajustes → **"Marcar grupos colando uma lista"** → toque em
  **"Escolher arquivo"** (JSON, CSV ou TXT de pacientes prioritários) ou cole a lista copiada do Fast.
  Se o arquivo já diz a condição de cada pessoa, deixe **"Cada linha diz"**. Confira os nomes parecidos e toque em **Marcar**. Com a data de nascimento na lista,
  o app acerta mais.
- **Busca por grupo:** na Busca, digite "gestante", "acamado", "hipertenso", "diabético" ou "idoso".
- **Mapa da área** (no Início): cada casa é um quadrado colorido. Verde: contou no mês; laranja:
  ninguém em casa; azul: revisita marcada; branco: falta. Toque numa cor da legenda para destacar.
- **Lista de prontuários** (Painel): em ordem numérica, para imprimir ou salvar em PDF (folha deitada).
  Tem nomes: não mande para ninguém.
- **Números livres para prontuário novo** (Painel): o app mostra o próximo número livre da sua micro
  e os números sem uso. Em "Conferir a colmeia", digite só os **números** das pastas (ex.: "1-50, 52,
  60 a 75"): aparecem as pastas que não são de família sua (para separar) e as famílias sem pasta.
  Ao cadastrar família nova, o botão **"Usar o próximo número livre"** preenche o prontuário.
  Sempre confira no sistema antes de criar a pasta.
- **Números em uso no Fast:** na mesma tela, escolha o arquivo (ou cole a lista) com os prontuários em uso.
  O app guarda só os números da sua micro e eles deixam de aparecer como livres.
- **Famílias de outro ACS** (prontuário de outra micro): na mesma tela, marque a micro e toque em
  **"Tirar da minha área"**. Elas vão para a Lixeira (dá para restaurar) e saem da meta e do mapa.
- **Casos achados nas VDs:** ao escrever na VD ("precisa da assistente social", "caiu ontem", "pedir VD da
  enfermeira", "sem insulina"), aparece **"Abrir caso"** já marcado, com a categoria (urgente, importante,
  social), a eMulti e o ponto para a reunião. Desmarque se não for caso. A aba **Casos** também mostra
  **"Achei nas VDs"** (tudo o que já foi escrito, de qualquer data, que ainda não virou caso) e **"Copiar a pauta"**
  da reunião de equipe. Caso aberto sobe a prioridade da casa: urgente = nível A; os outros = B.
- **Casos:** a aba **Casos** lista o que acompanhar de perto (urgente, importante,
  social/cadastro, NPV), com filtro de eMulti e a data da próxima reunião de equipe (toda quarta; dá para mudar em Ajustes). Para abrir um
  caso: na família → **"Abrir caso"**. Para fechar: **"Resolvido"** (nada é apagado).
- **Nível A/B/C:** cada casa tem um nível. **A** = voltar a cada 10 dias (alguém com 80 anos ou mais,
  ou com oxigênio, acamado, AVC/infarto, câncer, saúde mental, Alzheimer/paliativo); **B** = a cada
  30 dias (60 anos ou mais, diabetes, hipertensão, cirurgia). Dá para marcar à mão em **Editar
  família**, junto com o recado de **Atenção**. O Início mostra **"Revisitar por prioridade"**.
- **O que perguntar:** a ficha da família e a tela da VD mostram o que perguntar conforme as
  condições de cada pessoa.
- **Atualizar cadastro pelo SBCD (sem apagar nada):** Ajustes → **"Atualizar cadastro pelo SBCD"** →
  escolha o arquivo do cadastro que o Claude montou. O app mostra só as diferenças: prontuário novo,
  endereço que mudou, pessoa nova, casa nova (quem já estava em outra casa muda junto, com a ficha),
  data de nascimento, óbito e casas que não vieram. As seguras já vêm marcadas; confira as outras e
  toque em **Salvar**. As VDs e as fichas ficam. Não use "Importar minha área (CSV)" para isso: ele apaga tudo.
- **Trazer do Sistema de Visitas:** Ajustes → **"Trazer VDs e relatos do Sistema de Visitas"** →
  escolha o arquivo que o Claude montou (VDs, relatos, casos, condições, níveis e "voltar") →
  confira o resumo → **Trazer para o app**. Nada se repete
  (pode abrir o mesmo arquivo de novo). Depois, apague o arquivo do celular.
- **Prioritários:** na aba da estrela, toque em **"Importar lista"** e escolha o arquivo dos pacientes
  prioritários (faça isso num aparelho só: a sincronização leva para os outros).
- **Ficha da pessoa:** na família, toque no morador. Aparecem as condições, a prioridade e a linha do
  tempo (anotações das VDs, P.A., glicemia, relatos antigos e o que foi escrito nas VDs trazidas).
- **Anotar na VD:** em **"Sobre cada pessoa"**, escreva ou dite. O app sugere o que atualizar na ficha;
  só muda o que você tocar.
- **Acompanhamento de cada pessoa:** o app lê o que você escreve (VDs, anotações, casos) e monta sozinho:
  remédios (em uso, parou, alergia), últimas P.A. e glicemia, pendências (exame, consulta, resultado,
  cirurgia, receita) e **o que perguntar na próxima VD**. Aparece na ficha da pessoa, no cartão de
  prioritário e na tela da VD ("Acompanhar nesta casa"). Ele só procura palavras: confira. Toque em
  **Confirmar** / **Não é** nas condições achadas, em **Resolvida** nas pendências e no **✕** do remédio errado.
  Frases curtas ajudam: "parou o captopril", "começou losartana", "pegou o resultado".
- **Achados pelo app:** quem está fora da lista importada, mas tem condição marcada, condição achada nas
  VDs ou remédio, entra sozinho na aba Prioritários. Filtre por **Todos / Lista / Achados**.
- **Atualizar fichas pelas VDs já feitas:** Ajustes → **"Atualizar fichas pelas VDs já feitas"** (ou o
  aviso na aba Prioritários). O app lê o que você já escreveu (relatos trazidos do Sistema de Visitas,
  observações das VDs e casos) e mostra o que daria para atualizar, com a frase de onde tirou. Toque em
  **Atualizar** no que estiver certo e em **Não é** no que estiver errado (não aparece mais) → **Salvar**.
- **Como usar:** Ajustes → "Como usar o app" tem o passo a passo dentro do próprio app.

---

## 6. Ditar por voz (sem o áudio sair do celular)

Em qualquer campo de texto do app, toque no **microfone do teclado** e fale. Como você fala de
pacientes, deixe o ditado **offline**, para o áudio não ir para servidores:
- **Android (Gboard):** abra um campo de texto → **engrenagem** do teclado → **Digitação por voz** →
  ative **Reconhecimento de fala offline** (ou "Digitação por voz mais rápida") → baixe
  **Português (Brasil)**.
- **iPhone:** Ajustes → Geral → Teclado → use o ditado **no dispositivo** (modelos mais novos).
- **Para conferir:** ligue o **modo avião** e tente ditar. Se funcionar, está offline.

---

## 7. Rotina de segurança

- **Backup:** com a sincronização ligada, um backup por mês basta (garantia extra). Sem ela, toda
  semana. O app avisa na tela inicial.
- Guarde **duas cópias** do backup: uma no celular e outra fora (Drive ou PC).
- A **senha do backup** fica num lugar seguro, **separada do arquivo**. Sem ela, o backup não abre.
- **Esqueceu o PIN?** Não tem como recuperar: apague tudo (tela do PIN → "Esqueci o PIN") e use
  **"Já tenho um backup"**.
- **Celular novo ou dados do navegador apagados?** Abra o link, instale o app de novo e toque em
  **"Já tenho um backup"**.
- **Não** use o app em computador da unidade ou compartilhado.
- **Não** mande dados de pacientes (nomes, listas, prints) para ninguém, nem para o Claude, nem
  para o GitHub.

---

## 8. Verificação em duas etapas (fazer uma vez)

### GitHub (protege o código do app)
1. Entre em **github.com** pelo navegador, com **"Site para computador"** ligado no celular.
2. Toque na **sua foto** (canto de cima, à direita) → **Settings**.
3. No menu da esquerda: **Password and authentication**.
4. Em "Two-factor authentication", toque em **Enable two-factor authentication**.
5. Escolha **Authenticator app** e use um app autenticador (ex.: **Google Authenticator** ou
   **Microsoft Authenticator**, gratuitos na loja do celular): abra o app autenticador → **+** →
   **Ler código QR** → aponte para o QR da tela → digite o código de 6 números que aparecer.
6. **Baixe os "recovery codes"** (códigos de recuperação) e guarde num lugar seguro. Sem eles,
   se perder o celular, você perde o acesso à conta.

### GitHub: esconder o seu e-mail
1. Foto → **Settings** → **Emails** (menu da esquerda).
2. Marque **"Keep my email addresses private"**.
3. Marque **"Block command line pushes that expose my email"**.

### Google (protege o Drive, onde pode estar o backup)
1. Abra **myaccount.google.com** → **Segurança**.
2. Em "Como você faz login no Google", toque em **Verificação em duas etapas** → **Ativar**.
3. Siga os passos (confirmar pelo celular / SMS) e, se quiser, adicione o app autenticador.
4. Guarde os **códigos alternativos** (backup codes) num lugar seguro.

### Celular
- Bloqueio de tela com **senha ou digital**.
- O **PIN do app** deve ser diferente da senha do celular e de qualquer outra senha.
