<script lang="ts">
  // Nível da casa (A/B/C), próxima VD, recado de atenção e "o que perguntar" (ficha da família e VD).
  import { formatarData, hojeISO } from '../lib/datas';
  import { app } from '../lib/estado.svelte';
  import { nivelDaFamilia, perguntasDaFamilia, proximaVisita } from '../lib/nivel';
  import type { Familia } from '../lib/tipos';

  let { familia, aberto = false }: { familia: Familia; aberto?: boolean } = $props();
  const hoje = hojeISO();
  const nv = $derived(nivelDaFamilia(familia, hoje, app.prioritarios, app.casos));
  const prox = $derived(proximaVisita(familia, app.visitas, hoje, app.prioritarios, app.casos));
  const perguntas = $derived(perguntasDaFamilia(familia, hoje));
</script>

<section class="cartao prioridade nivel-{nv.nivel}">
  <div class="topo">
    <span class="nivel" title="A: voltar a cada 10 dias · B: a cada 30 dias">Nível {nv.nivel}</span>
    {#if prox}
      <span class="prox" class:vencida={prox <= hoje}>{prox <= hoje ? 'Revisitar já' : `Revisitar até ${formatarData(prox)}`}</span>
    {/if}
  </div>
  {#if nv.motivo}<p class="suave pequeno">Por quê: {nv.motivo}{nv.nivel !== 'C' ? ` · volta a cada ${nv.nivel === 'A' ? 10 : 30} dias` : ''}</p>{/if}
  <details open={aberto}>
    <summary>O que perguntar</summary>
    <ul class="perguntas">
      {#each perguntas as p (p)}<li>{p}</li>{/each}
    </ul>
  </details>
</section>

<style>
  .prioridade {
    border-left: 6px solid var(--borda);
  }
  .nivel-A {
    border-left-color: var(--perigo);
  }
  .nivel-B {
    border-left-color: var(--ausencia);
  }
  .topo {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }
  .nivel {
    font-weight: 800;
    padding: 2px 10px;
    border-radius: 8px;
    background: var(--primaria-clara);
  }
  .nivel-A .nivel {
    background: var(--perigo);
    color: var(--cartao);
  }
  .nivel-B .nivel {
    background: var(--ausencia);
    color: var(--cartao);
  }
  .prox {
    font-weight: 700;
    font-size: 0.9rem;
  }
  .prox.vencida {
    color: var(--perigo);
  }
  .perguntas {
    margin: 6px 0 0;
    padding-left: 20px;
  }
  .perguntas li {
    margin-bottom: 4px;
  }
</style>
