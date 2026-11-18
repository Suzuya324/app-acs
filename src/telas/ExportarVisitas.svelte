<script lang="ts">
  import Icone from '../componentes/Icone.svelte';
  import { entregarArquivo } from '../lib/arquivo';
  import { periodoDe, periodoVizinho } from '../lib/calendario';
  import { contaParaMeta } from '../lib/desfecho';
  import { formatarData, hojeISO } from '../lib/datas';
  import { app, mostrarAviso } from '../lib/estado.svelte';
  import { arquivoUnico, csvFamilias, csvVisitas, perguntaParaAssistente, type OpcoesExportar } from '../lib/exportar-visitas';
  import { voltar } from '../lib/rotas.svelte';

  const hoje = hojeISO();
  type Modo = 'periodo' | 'tudo' | 'datas';
  let modo = $state<Modo>('periodo');
  let referencia = $state(hoje);
  const periodo = $derived(periodoDe(referencia, app.config.diaInicioPeriodo));
  let de = $state(periodoDe(hoje, app.config.diaInicioPeriodo).inicio);
  let ate = $state(hoje);
  let nomes = $state(true);
  let relato = $state(true);

  const faixa = $derived(modo === 'periodo' ? { de: periodo.inicio, ate: periodo.fim } : modo === 'tudo' ? { de: '', ate: '' } : { de, ate });
  const rotulo = $derived(modo === 'periodo' ? periodo.rotulo : modo === 'tudo' ? 'todas as VDs' : `${formatarData(de)} a ${formatarData(ate)}`);
  const naFaixa = $derived(app.visitas.filter((v) => (!faixa.de || v.data >= faixa.de) && (!faixa.ate || v.data <= faixa.ate)));
  const familiasVisitadas = $derived(new Set(naFaixa.filter((v) => contaParaMeta(v.desfecho)).map((v) => v.familiaId)).size);

  const opcoes = (): OpcoesExportar => ({ ...faixa, nomes, relato, nomeDesfecho: (d) => app.config.nomesDesfecho[d] });
  const sufixo = $derived(modo === 'tudo' ? 'tudo' : `${faixa.de || 'inicio'}_a_${faixa.ate || hoje}`);

  async function baixarVisitas() {
    const ok = await entregarArquivo(`visitas_${sufixo}.csv`, csvVisitas($state.snapshot(app.visitas), $state.snapshot(app.familias), opcoes()), 'text/csv');
    if (ok) mostrarAviso('Planilha das VDs pronta ✓');
  }
  const pergunta = $derived(perguntaParaAssistente(rotulo, app.config.metaMensal));
  async function baixarTudo() {
    const v = csvVisitas($state.snapshot(app.visitas), $state.snapshot(app.familias), opcoes());
    const f = csvFamilias($state.snapshot(app.familias), $state.snapshot(app.visitas), opcoes(), hoje);
    const ok = await entregarArquivo(`visitas-e-familias_${sufixo}.txt`, arquivoUnico(pergunta, v, f), 'text/plain');
    if (ok) mostrarAviso('Arquivo pronto ✓ É só anexar na conversa com o Claude.');
  }
  async function copiarPergunta() {
    try {
      await navigator.clipboard.writeText(pergunta);
      app.desfazer = null;
      mostrarAviso('Pergunta copiada ✓ Cole na conversa junto com as planilhas.');
    } catch {
      mostrarAviso('Não consegui copiar.');
    }
  }
  async function baixarFamilias() {
    const ok = await entregarArquivo(`familias_${sufixo}.csv`, csvFamilias($state.snapshot(app.familias), $state.snapshot(app.visitas), opcoes(), hoje), 'text/csv');
    if (ok) mostrarAviso('Planilha das famílias pronta ✓');
  }
</script>

<button class="botao secundario pequeno voltar" onclick={() => voltar('ajustes')}><Icone nome="voltar" /> Voltar</button>

<h1>Exportar minhas visitas</h1>
<p class="suave">
  Gera planilhas (CSV) para você conferir, abrir no computador ou mandar para um assistente (como o Claude) e perguntar
  quais casas já visitou e quais faltam.
</p>

<div class="chips" role="tablist" aria-label="Período">
  <button class="chip" class:ativo={modo === 'periodo'} role="tab" aria-selected={modo === 'periodo'} onclick={() => (modo = 'periodo')}>Um mês</button>
  <button class="chip" class:ativo={modo === 'tudo'} role="tab" aria-selected={modo === 'tudo'} onclick={() => (modo = 'tudo')}>Tudo</button>
  <button class="chip" class:ativo={modo === 'datas'} role="tab" aria-selected={modo === 'datas'} onclick={() => (modo = 'datas')}>Escolher datas</button>
</div>

{#if modo === 'periodo'}
  <div class="navegar">
    <button class="botao secundario pequeno" aria-label="Mês anterior" onclick={() => (referencia = periodoVizinho(periodo, -1, app.config.diaInicioPeriodo).inicio)}>‹</button>
    <strong>{periodo.rotulo}</strong>
    <button class="botao secundario pequeno" aria-label="Próximo mês" disabled={periodo.fim >= periodoDe(hoje, app.config.diaInicioPeriodo).fim} onclick={() => (referencia = periodoVizinho(periodo, 1, app.config.diaInicioPeriodo).inicio)}>›</button>
  </div>
{:else if modo === 'datas'}
  <div class="duas">
    <label class="campo"><span class="pequeno">De</span><input type="date" bind:value={de} max={ate} /></label>
    <label class="campo"><span class="pequeno">Até</span><input type="date" bind:value={ate} min={de} /></label>
  </div>
{/if}

<section class="cartao destaque">
  <p><strong>{naFaixa.length}</strong> {naFaixa.length === 1 ? 'VD' : 'VDs'} ({rotulo}) · <strong>{familiasVisitadas}</strong> {familiasVisitadas === 1 ? 'família visitada' : 'famílias visitadas'} (que contam para a meta).</p>
</section>

<label class="opcao"><input type="checkbox" bind:checked={nomes} /> Com os nomes completos (desmarcado: só as iniciais)</label>
<label class="opcao"><input type="checkbox" bind:checked={relato} /> Com o texto de cada VD (relato)</label>

<section class="cartao claude">
  <h2>Para mandar ao Claude</h2>
  <button class="botao largo" onclick={baixarTudo}><Icone nome="pasta" tamanho={20} /> Arquivo único (com a pergunta pronta)</button>
  <p class="suave pequeno">Um arquivo só, com as VDs, as famílias e a pergunta. Anexe na conversa e mande “Siga as instruções do arquivo”.</p>
  <button class="botao secundario largo" onclick={copiarPergunta}><Icone nome="copiar" tamanho={20} /> Copiar só a pergunta</button>
  <details>
    <summary class="pequeno">Ver a pergunta</summary>
    <pre class="pequeno">{pergunta}</pre>
  </details>
</section>

<h2 class="separador">Ou as planilhas separadas (Excel, Planilhas Google)</h2>
<button class="botao largo" onclick={baixarVisitas}><Icone nome="pasta" tamanho={20} /> 1. Planilha das VDs</button>
<p class="suave pequeno">Uma linha por VD: data, casa, prontuário, presentes, ausentes, desfecho, se conta para a meta e se já foi lançada no Fast.</p>

<button class="botao largo" onclick={baixarFamilias}><Icone nome="pasta" tamanho={20} /> 2. Planilha das famílias (visitadas e não visitadas)</button>
<p class="suave pequeno">Uma linha por casa da área: se foi visitada no período, quantas VDs, a última VD e há quantos dias.</p>

<section class="cartao aviso">
  <h2>⚠️ Cuidado com esse arquivo</h2>
  <p class="pequeno">
    Diferente do backup, a planilha sai <strong>sem senha</strong>: quem pegar o arquivo lê nomes e informações de saúde.
    Mandar para o Claude ou outro assistente é enviar para fora do seu aparelho. Mande só o necessário (desmarque o
    relato ou os nomes quando não precisar) e apague o arquivo da pasta Downloads depois de usar.
  </p>
</section>

<style>
  .voltar {
    margin-bottom: 12px;
  }
  .chips {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin: 10px 0;
  }
  .chip {
    min-height: 44px;
    padding: 6px 14px;
    border-radius: 999px;
    border: 2px solid var(--borda);
    background: var(--cartao);
    color: var(--texto);
    font-weight: 700;
    cursor: pointer;
  }
  .chip.ativo {
    border-color: var(--primaria);
    background: var(--primaria-clara);
  }
  .navegar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin: 8px 0;
  }
  .duas {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .opcao {
    display: flex;
    gap: 8px;
    align-items: center;
    margin: 8px 0;
  }
  .opcao input {
    width: 22px;
    height: 22px;
  }
  .aviso {
    border-left: 6px solid var(--aviso-texto);
    background: var(--aviso-fundo);
    color: var(--aviso-texto);
    margin-top: 14px;
  }
  .claude {
    border-left: 6px solid var(--primaria);
  }
  .claude h2,
  .separador {
    margin: 0 0 8px;
  }
  .separador {
    margin-top: 14px;
    font-size: 1.05em;
  }
  pre {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    background: var(--fundo);
    padding: 8px;
    border-radius: 8px;
  }
  .aviso h2 {
    margin: 0 0 6px;
  }
</style>
