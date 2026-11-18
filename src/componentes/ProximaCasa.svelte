<script lang="ts">
  // Depois de salvar a VD (ou "ninguém em casa"): qual é a próxima casa do roteiro de hoje, para seguir a rua.
  import { onDestroy } from 'svelte';
  import Icone from './Icone.svelte';
  import { maisImportantes, proximaCasa, roteiroDoDia } from '../lib/dia';
  import { app, contextoAcompanhamento, enderecoCurto, responsavel } from '../lib/estado.svelte';
  import { ir } from '../lib/rotas.svelte';
  import type { Familia } from '../lib/tipos';

  let { atual }: { atual: Familia } = $props();
  /** Mesmo tamanho do roteiro do Início (as 15 mais importantes). */
  const casas = $derived(maisImportantes(roteiroDoDia(app.familias, app.revisitas, { ...contextoAcompanhamento(), casos: app.casos }), 15));
  const prox = $derived(proximaCasa(casas, atual, app.config.ruas));
  // Saiu da ficha: o aviso some (não volta a aparecer depois).
  onDestroy(() => (app.proximaDepoisDe = null));
  function irPara(rota: string) {
    app.proximaDepoisDe = null;
    ir(rota);
  }
</script>

<section class="cartao proxima" aria-live="polite">
  {#if prox}
    <p class="pequeno suave">Próxima casa do roteiro de hoje ({casas.length - (casas.some((c) => c.familia.id === atual.id) ? 1 : 0)} {casas.length === 1 ? 'casa' : 'casas'} faltando)</p>
    <button class="destino" onclick={() => irPara(`familia/${prox.familia.id}`)}>
      <strong>{enderecoCurto(prox.familia)}</strong>
      <span class="pequeno">{responsavel(prox.familia)}</span>
      <span class="pequeno motivo">{prox.motivos[0].texto}</span>
      {#if prox.familia.referencia}<span class="pequeno">📍 {prox.familia.referencia}</span>{/if}
    </button>
    <div class="linha">
      <button class="botao pequeno" onclick={() => irPara(`vd/${prox.familia.id}`)}><Icone nome="mais" tamanho={18} /> VD na próxima</button>
      <button class="botao secundario pequeno" onclick={() => irPara('dia')}>Ver o roteiro</button>
      <button class="botao secundario pequeno" onclick={() => (app.proximaDepoisDe = null)}>Fechar</button>
    </div>
  {:else}
    <p>Roteiro de hoje terminado. 👏</p>
    <button class="botao secundario pequeno" onclick={() => (app.proximaDepoisDe = null)}>Fechar</button>
  {/if}
</section>

<style>
  .proxima {
    border-left: 6px solid var(--primaria);
    margin-bottom: 10px;
  }
  .proxima p {
    margin: 0 0 4px;
  }
  .destino {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    width: 100%;
    background: none;
    border: 0;
    padding: 0;
    text-align: left;
    color: var(--texto);
    font: inherit;
    cursor: pointer;
  }
  .destino strong {
    font-size: 1.15em;
  }
  .motivo {
    font-weight: 700;
  }
  .linha {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 8px;
  }
</style>
