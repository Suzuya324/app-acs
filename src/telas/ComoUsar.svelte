<script lang="ts">
  import Icone from '../componentes/Icone.svelte';
  import { voltar } from '../lib/rotas.svelte';
</script>

<button class="botao secundario pequeno voltar" onclick={() => voltar('')}><Icone nome="voltar" /> Voltar</button>

<h1>Como usar</h1>
<p class="suave">Toque em um assunto para abrir.</p>

<section class="cartao">
  <details open>
    <summary>1. Primeiros passos</summary>
    <ol>
      <li><strong>Instale o app:</strong> no Android, menu do Chrome (⋮) → <em>Instalar app</em>. No iPhone, Safari → Compartilhar → <em>Adicionar à Tela de Início</em>. Instalado, ele funciona sem internet.</li>
      <li><strong>Importe a sua área:</strong> Ajustes → <em>Importar minha área</em>. Pode colar a lista copiada do Fast ou escolher uma planilha CSV. Confira o resumo e confirme.</li>
      <li><strong>Faça o primeiro backup:</strong> Ajustes → Backup. Guarde o arquivo e a senha em lugares diferentes.</li>
    </ol>
  </details>
</section>

<section class="cartao">
  <details>
    <summary>2. Fazer uma visita (VD)</summary>
    <ol>
      <li><strong>Buscar</strong> → digite a rua e o número (“ac 90”), um nome ou o prontuário.</li>
      <li>Na família, toque em <strong>Nova VD</strong>. Confira a <strong>data</strong> no topo.</li>
      <li>Toque em <strong>quem estava presente</strong>. O app escolhe o desfecho sozinho (dá para trocar).</li>
      <li>Se quiser, marque orientações, sinais vitais e escreva uma observação (pode ditar pelo microfone do teclado).</li>
      <li><strong>Salvar</strong>. O relato fica pronto na <strong>Fila do Fast</strong>.</li>
    </ol>
    <p class="suave pequeno">Se sair no meio, a VD fica guardada e aparece no Início como “Visita pela metade”.</p>
  </details>
</section>

<section class="cartao">
  <details>
    <summary>3. Lançar no Fast</summary>
    <p>Aba <strong>Fila do Fast</strong> → <strong>Lançar em sequência</strong>: copie o prontuário, copie o relato, cole no Fast e toque em <strong>Lancei no Fast, próxima</strong>. O app nunca envia nada ao Fast: você copia e cola.</p>
  </details>
</section>

<section class="cartao">
  <details>
    <summary>4. Meta, painel e planejamento</summary>
    <ul>
      <li>O <strong>Início</strong> mostra as famílias que contam no mês (Visita realizada e Ausente realizada), quanto falta e quantas por dia de campo.</li>
      <li><strong>Planejar a rua do dia</strong>: casas que faltam, na ordem dos números.</li>
      <li><strong>Mapa da área</strong>: cada casa é um quadrado colorido (verde: contou; laranja: ninguém em casa; azul: revisita marcada; branco: falta). Toque em uma cor da legenda para destacar só ela.</li>
      <li>No <strong>Painel</strong>: gráfico, meses anteriores, relatório de produção e lista de prontuários (PDF).</li>
      <li><strong>Números livres para prontuário novo</strong> (Painel): mostra o próximo número livre da sua micro. Digitando os números das pastas da colmeia, mostra também as pastas que não são de família sua e as famílias sem pasta.</li>
    </ul>
  </details>
</section>

<section class="cartao">
  <details>
    <summary>5. Atenção e grupos</summary>
    <ul>
      <li><strong>Atenção</strong> (no Início): gestantes, puérperas, crianças e acamados sem VD há 30 dias; hipertensos sem P.A. e diabéticos sem glicemia há 60 dias; aniversários da semana; quem fez 60 anos ou deixou de ser criança pequena (com botão para ajustar o grupo).</li>
      <li>Na <strong>Busca</strong>, digite um grupo (“gestante”, “acamado”, “hipertenso”, “diabético”, “idoso”) para ver todas as famílias com alguém dele.</li>
      <li>Para entrar nesses lembretes, o morador precisa estar no grupo (Editar morador → Condições) e ter a data de nascimento.</li>
    </ul>
  </details>
</section>

<section class="cartao">
  <details>
    <summary>6. Revisitas</summary>
    <p>Na família, <strong>Marcar revisita</strong> (ex.: entregar guia de encaminhamento) com a data. Ela aparece no Início e, na próxima VD dessa casa, é só marcar como feita: entra no relato.</p>
  </details>
</section>

<section class="cartao">
  <details>
    <summary>7. Errei! Desfazer e lixeira</summary>
    <ul>
      <li>Depois de salvar, corrigir ou excluir, aparece <strong>Desfazer</strong> no aviso de baixo por alguns segundos.</li>
      <li><strong>Excluir</strong> é só para cadastro feito por engano. Quem mudou-se ou faleceu: mude a <strong>situação</strong>.</li>
      <li>O excluído vai para <strong>Ajustes → Lixeira</strong>, onde dá para restaurar.</li>
    </ul>
  </details>
</section>

<section class="cartao">
  <details>
    <summary>8. Backup, celular e computador</summary>
    <ul>
      <li><strong>Backup toda semana</strong>: Ajustes → Backup. O app lembra no Início.</li>
      <li>Para passar do celular para o computador (e voltar): faça backup num, leve o arquivo e use <strong>Juntar com um backup</strong> no outro. Juntar nunca apaga nada.</li>
      <li><strong>Restaurar</strong> substitui tudo: use só em celular novo ou depois de perder os dados.</li>
    </ul>
  </details>
</section>

<section class="cartao">
  <details>
    <summary>9. Segurança</summary>
    <ul>
      <li>Os dados ficam <strong>só no aparelho</strong>, trancados com o seu PIN. O app tranca sozinho depois de alguns minutos.</li>
      <li>Esqueceu o PIN? Não tem como recuperar: só com o backup.</li>
      <li>Não use o app em computador da unidade ou compartilhado, e não mande prints com dados de pacientes.</li>
    </ul>
  </details>
</section>

<style>
  .voltar {
    margin-bottom: 12px;
  }
  ol,
  ul {
    padding-left: 20px;
    margin: 8px 0;
  }
  li {
    margin-bottom: 8px;
    line-height: 1.45;
  }
</style>
