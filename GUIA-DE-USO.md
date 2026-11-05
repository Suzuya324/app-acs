# Guia de uso: Facilitador de VDs

Link do app (o mesmo no celular e no PC): **https://suzuya324.github.io/app-acs/**

> Os dados ficam **só no aparelho**, criptografados com o PIN. Celular e PC têm cópias
> separadas: para passar de um para o outro, use o **backup** e o **Juntar**.

---

## 1. Passar as VDs do celular para o PC

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

1. No app do PC: **Fila do Fast** → **"Lançar em sequência"**.
2. Para cada VD: **1** Copiar prontuário → cole no Fast; **2** Copiar relato → cole no Fast;
   **3** confira a data e toque em **"Lancei no Fast, próxima"**.
3. Dica: em **Ajustes → Fast**, coloque o endereço do Fast para ter o botão **"Abrir o Fast"**.

---

## 3. Devolver para o celular o que foi lançado no PC

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

## 5. Ditar por voz (sem o áudio sair do celular)

Em qualquer campo de texto do app, toque no **microfone do teclado** e fale. Como você fala de
pacientes, deixe o ditado **offline**, para o áudio não ir para servidores:
- **Android (Gboard):** abra um campo de texto → **engrenagem** do teclado → **Digitação por voz** →
  ative **Reconhecimento de fala offline** (ou "Digitação por voz mais rápida") → baixe
  **Português (Brasil)**.
- **iPhone:** Ajustes → Geral → Teclado → use o ditado **no dispositivo** (modelos mais novos).
- **Para conferir:** ligue o **modo avião** e tente ditar. Se funcionar, está offline.

---

## 6. Rotina de segurança

- **Backup toda semana** (na primeira semana de uso, todo dia). O app avisa na tela inicial.
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

## 7. Verificação em duas etapas (fazer uma vez)

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
