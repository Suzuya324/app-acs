<script lang="ts">
  import { onMount } from 'svelte';
  import Icone from '../componentes/Icone.svelte';
  import { buscar } from '../lib/busca';
  import { contaParaMeta } from '../lib/desfecho';
  import { dentroDoPeriodo, periodoDe } from '../lib/calendario';
  import { hojeISO } from '../lib/datas';
  import { app, enderecoCurto, responsavel } from '../lib/estado.svelte';
  import { NOMES_SITUACAO_CASA, NOMES_SITUACAO_MORADOR } from '../lib/rotulos';
  import { ir } from '../lib/rotas.svelte';

  let campo: HTMLInputElement;
  onMount(() => {
    if (!app.busca) campo.focus();
  });

  const resultados = $derived(buscar(app.familias, app.busca));
  const ruas = $derived([...new Set([...app.config.ruas, ...app.familias.map((f) => f.rua)])]);
  const periodo = $derived(periodoDe(hojeISO(), app.config.diaInicioPeriodo));
  const visitadasNoMes = $derived(
    new Set(app.visitas.filter((v) => dentroDoPeriodo(v.data, periodo) && contaParaMeta(v.desfecho)).map((v) => v.familiaId)),
  );
</script>

<h1>Buscar família</h1>

<div class="caixa-busca">
  <Icone nome="busca" />
  <input
    bind:this={campo}
    type="search"
    bind:value={app.busca}
    placeholder="Ex.: Acácias 90, Joana, 00.0012"
    aria-label="Buscar por nome, rua e número ou prontuário"
    autocomplete="off"
    autocapitalize="none"
    enterkeyhint="search"
  />
</div>

<button class="botao secundario largo nova" onclick={() => ir('nova-familia')}><Icone nome="mais" /> Nova família</button>

{#if !app.busca.trim()}
  <p class="suave">Digite um <strong>nome</strong>, a <strong>rua + número</strong> (pode abreviar, ex.: “ac 90”, “ipe 120”) ou o <strong>prontuário</strong>.</p>
  <h2>Ruas da área</h2>
  {#if app.familias.length === 0}
    <p class="alerta">Ainda não há famílias cadastradas. O importador da sua área (planilha CSV) chega na Etapa 3.</p>
  {/if}
  <ul class="lista">
    {#each ruas as rua (rua)}
      <li>
        <button class="item-link" onclick={() => (app.busca = rua)}>
          <strong>{rua}</strong>
          <span class="suave pequeno"> · {app.familias.filter((f) => f.rua === rua).length} domicílios</span>
        </button>
      </li>
    {/each}
  </ul>
{:else}
  <p class="suave pequeno" aria-live="polite">
    {resultados.length === 0 ? 'Nada encontrado.' : resultados.length === 1 ? '1 família encontrada' : `${resultados.length} famílias encontradas`}
  </p>
  <ul class="lista">
    {#each resultados.slice(0, 80) as r (r.familia.id)}
      {@const f = r.familia}
      <li>
        <button class="item-link resultado" onclick={() => ir(`familia/${f.id}`)}>
          <span class="linha1">
            <strong>{enderecoCurto(f)}</strong>
            {#if visitadasNoMes.has(f.id)}<span class="visitada" title="Já visitada no mês"><Icone nome="ok" tamanho={18} /> no mês</span>{/if}
          </span>
          <span class="pequeno">
            {#if r.motivo === 'nome'}
              {r.moradores.map((m) => (m.situacao === 'mora' ? m.nome : `${m.nome} (${NOMES_SITUACAO_MORADOR[m.situacao].toLowerCase()})`)).join(', ')}
            {:else}
              {responsavel(f)}
            {/if}
          </span>
          <span class="suave pequeno">
            Pront.: {f.prontuario || '—'} · {f.moradores.filter((m) => m.situacao === 'mora').length} morador(es)
            {#if f.situacaoCasa !== 'habitada'} · casa {NOMES_SITUACAO_CASA[f.situacaoCasa].toLowerCase()}{/if}
          </span>
        </button>
      </li>
    {/each}
  </ul>
  {#if resultados.length > 80}
    <p class="suave pequeno">Mostrando as 80 primeiras. Digite mais para filtrar.</p>
  {/if}
{/if}

<style>
  .caixa-busca {
    position: sticky;
    top: 66px;
    z-index: 4;
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--cartao);
    border: 2px solid var(--primaria);
    border-radius: 14px;
    padding: 0 12px;
    margin-bottom: 12px;
    color: var(--texto-suave);
  }
  .caixa-busca input {
    border: 0;
    outline: none;
    background: transparent;
    min-height: 58px;
    padding: 0;
    font-size: 1.15rem;
    color: var(--texto);
  }
  .caixa-busca:focus-within {
    outline: 3px solid var(--primaria);
    outline-offset: 1px;
  }
  .nova {
    margin-bottom: 12px;
  }
  .resultado {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .linha1 {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    align-items: flex-start;
  }
  .visitada {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    color: var(--realizada);
    font-size: 0.8rem;
    font-weight: 700;
    white-space: nowrap;
  }
</style>
