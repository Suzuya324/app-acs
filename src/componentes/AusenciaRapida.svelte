<script lang="ts">
  // "Ninguém em casa" com 1 toque (mais a confirmação com a data à mostra), para o roteiro e a busca.
  import { formatarDataLonga, hojeISO } from '../lib/datas';
  import { app, mostrarAviso, registrarAusencia } from '../lib/estado.svelte';
  import type { Familia } from '../lib/tipos';

  let { familia }: { familia: Familia } = $props();
  const hoje = hojeISO();
  let aberto = $state(false);
  let data = $state(hoje);
  let salvando = $state(false);

  async function confirmar() {
    salvando = true;
    try {
      await registrarAusencia(familia.id, data);
      mostrarAviso(`Ausência registrada em ${familia.rua.replace(/^(rua|avenida|av\.|travessa|tv\.)\s+(d[aeo]s?\s+)?/i, '')}, ${familia.numero} ✓`, 4000);
      aberto = false;
      data = hoje;
    } finally {
      salvando = false;
    }
  }
</script>

{#if !aberto}
  <button class="botao secundario pequeno" onclick={() => (aberto = true)}>🚪 Ninguém em casa</button>
{:else}
  <div class="confirmar">
    <p class="pequeno"><strong>{app.config.nomesDesfecho.ausencia_completa}</strong> em</p>
    <input type="date" bind:value={data} max={hoje} aria-label="Data da tentativa" />
    <p class="pequeno data">{data ? formatarDataLonga(data, true) : ''}{data === hoje ? ' (hoje)' : ''}</p>
    <div class="linha">
      <button class="botao secundario pequeno" onclick={() => (aberto = false)}>Cancelar</button>
      <button class="botao pequeno" onclick={confirmar} disabled={!data || salvando}>Confirmar</button>
    </div>
  </div>
{/if}

<style>
  .confirmar {
    border: 2px solid var(--borda);
    border-radius: 12px;
    padding: 8px 10px;
    margin-top: 6px;
    width: 100%;
    box-sizing: border-box;
  }
  .confirmar p {
    margin: 0 0 4px;
  }
  .data {
    font-weight: 700;
    margin-top: 4px !important;
  }
  .linha {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }
</style>
