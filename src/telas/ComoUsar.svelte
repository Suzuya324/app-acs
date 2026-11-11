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
      <li><strong>Salvar</strong>. O relato fica pronto na <strong>Fila</strong> (do Fast).</li>
    </ol>
    <p class="suave pequeno">Se sair no meio, a VD fica guardada e aparece no Início como “Visita pela metade”.</p>
  </details>
</section>

<section class="cartao">
  <details>
    <summary>3. Lançar no Fast</summary>
    <p>Aba <strong>Fila</strong> (do Fast) → <strong>Lançar em sequência</strong>: copie o prontuário, copie o relato, cole no Fast e toque em <strong>Lancei no Fast, próxima</strong>. O app nunca envia nada ao Fast: você copia e cola.</p>
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
      <li><strong>Números livres para prontuário novo</strong> (Painel): mostra o próximo número livre da sua micro. Digitando os números das pastas da colmeia, mostra também as pastas que não são de família sua e as famílias sem pasta. Famílias com prontuário de outra micro podem ser tiradas da sua área de uma vez (vão para a Lixeira).</li>
    </ul>
  </details>
</section>

<section class="cartao">
  <details>
    <summary>5. Atenção e grupos</summary>
    <ul>
      <li><strong>Atenção</strong> (no Início): gestantes, puérperas, crianças e acamados sem VD há 30 dias; hipertensos sem P.A. e diabéticos sem glicemia há 60 dias; aniversários da semana; quem fez 60 anos ou deixou de ser criança pequena (com botão para ajustar o grupo).</li>
      <li>Na <strong>Busca</strong>, digite um grupo (“gestante”, “acamado”, “hipertenso”, “diabético”, “idoso”) para ver todas as famílias com alguém dele.</li>
      <li>Para entrar nesses lembretes, o morador precisa estar no grupo e ter a data de nascimento.</li>
      <li><strong>Casos</strong> (no Início): urgente, importante, social/cadastro e NPV, com eMulti. Abra pela família (“Abrir caso”) e marque “Resolvido” quando acabar.</li>
      <li><strong>Nível A/B/C</strong>: A volta a cada 10 dias (80+ ou condição grave), B a cada 30 (60+ ou doença crônica). Dá para marcar à mão em Editar família. A ficha e a VD mostram <strong>o que perguntar</strong>.</li>
      <li><strong>Marcar grupos de uma vez:</strong> em Ajustes → <strong>Marcar grupos colando uma lista</strong>, escolha o arquivo de pacientes prioritários (JSON, CSV ou TXT) ou cole a lista copiada do Fast. O app acha cada pessoa e mostra o que vai marcar antes de salvar.</li>
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
    <summary>7. Prioritários e ficha da pessoa</summary>
    <ul>
      <li><strong>Prioritários</strong> (aba da estrela): toque em <strong>Importar lista</strong> e escolha o arquivo dos pacientes prioritários. Os números de cima filtram (acamados, O₂, HAS, DM…).</li>
      <li><strong>Ficha da pessoa:</strong> na família, toque no morador. Ela mostra as condições, a prioridade e a linha do tempo com tudo o que foi escrito sobre a pessoa.</li>
      <li><strong>Na VD</strong>, use <strong>“Sobre cada pessoa”</strong> para anotar. O app sugere o que atualizar na ficha (ex.: “ficou acamada” → Acamado); só muda o que você tocar.</li>
      <li><strong>Casos</strong> (aba da prancheta): o app acha casos no que você escreve na VD (“precisa da assistente social”, “caiu”, “pedir VD da enfermeira”) e oferece abrir o caso já com a categoria, a eMulti e o ponto para a reunião. Na aba, <strong>Copiar a pauta</strong> monta a lista da reunião de equipe. Caso aberto sobe a prioridade da casa (urgente = nível A).</li>
      <li><strong>Números do mês</strong>: previsão da meta no Início, indicadores por grupo no Painel e relatório em PDF com casos. No fim de Ajustes, a <strong>versão do app</strong> (para saber se atualizou).</li>
      <li><strong>Não perder ninguém</strong> (Início): <strong>A confirmar</strong>, <strong>Gestantes e crianças</strong> (DPP e caderneta), <strong>Mudanças para o SBCD</strong>; e em Atenção, quem vai fazer 2, 60 ou 80 anos.</li>
      <li><strong>VD mais rápida</strong>: botões de <strong>frases prontas</strong> embaixo dos campos de texto, <strong>“↺ Igual à última VD”</strong> no topo da VD e o <strong>modo rua</strong> (botão “A+” lá em cima: letra maior para o sol).</li>
      <li><strong>Hoje na rua</strong> (Início): <strong>Roteiro de hoje</strong> com as casas mais importantes em ordem de rua, lembretes das consultas e cirurgias, <strong>Agenda</strong> e <strong>Sumidos</strong>.</li>
      <li><strong>Caso parado</strong> (2 semanas sem novidade) sobe na lista e entra na pauta. Depois da reunião, abra o caso e toque em <strong>Anotar resposta</strong>.</li>
      <li><strong>Lista para a técnica</strong> (aba Casos): quem precisa de P.A., glicemia, curativo, sonda ou coleta. <strong>Copiar a lista</strong> e mande para ela.</li>
      <li><strong>Cadastro atualizado no SBCD?</strong> Ajustes → <strong>Atualizar cadastro pelo SBCD</strong>: o app mostra só as diferenças (prontuário, pessoa nova, casa nova, óbito…). Marque o que aceitar e salve. Nada é apagado.</li>
      <li><strong>Acompanhamento:</strong> o app lê tudo o que você escreve (VDs, anotações, casos) e monta para cada pessoa: remédios, P.A. e glicemia, pendências (exame, consulta, resultado) e <strong>o que perguntar na próxima VD</strong>. Aparece na ficha, no cartão de prioritário e na tela da VD. Ele só procura palavras: confira. Toque em <strong>Confirmar</strong> ou <strong>Não é</strong> nas condições achadas e em <strong>Resolvida</strong> nas pendências.</li>
      <li><strong>Achados pelo app:</strong> quem não está na lista importada, mas tem condição marcada, condição achada nas VDs ou remédio, entra sozinho na aba Prioritários. Use <strong>Todos / Lista / Achados</strong> para filtrar.</li>
      <li><strong>VDs já feitas:</strong> Ajustes → <strong>Atualizar fichas pelas VDs já feitas</strong> (ou o aviso na aba Prioritários). O app lê o que você já escreveu e mostra o que daria para atualizar, com a frase de onde tirou. Toque em <strong>Atualizar</strong> no que estiver certo e em <strong>Não é</strong> no que estiver errado.</li>
    </ul>
  </details>
</section>

<section class="cartao">
  <details>
    <summary>8. Errei! Desfazer e lixeira</summary>
    <ul>
      <li>Depois de salvar, corrigir ou excluir, aparece <strong>Desfazer</strong> no aviso de baixo por alguns segundos.</li>
      <li><strong>Excluir</strong> é só para cadastro feito por engano. Quem mudou-se ou faleceu: mude a <strong>situação</strong>.</li>
      <li>O excluído vai para <strong>Ajustes → Lixeira</strong>, onde dá para restaurar.</li>
    </ul>
  </details>
</section>

<section class="cartao">
  <details>
    <summary>9. Celular, tablet e computador (sincronizar) e backup</summary>
    <ul>
      <li><strong>Sincronizar:</strong> em Ajustes → <strong>Sincronizar aparelhos</strong>, conecte cada aparelho uma vez (o passo a passo está lá). Depois, tudo fica igual sozinho, sem backup manual. Vai para a nuvem só uma cópia trancada com a sua senha de sincronização.</li>
      <li><strong>Backup</strong>: Ajustes → Backup. Com a sincronização ligada, uma vez por mês basta; sem ela, toda semana. O app lembra no Início.</li>
      <li>Para passar do celular para o computador (e voltar): faça backup num, leve o arquivo e use <strong>Juntar com um backup</strong> no outro. Juntar nunca apaga nada.</li>
      <li><strong>Restaurar</strong> substitui tudo: use só em celular novo ou depois de perder os dados.</li>
    </ul>
  </details>
</section>

<section class="cartao">
  <details>
    <summary>10. Segurança</summary>
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
