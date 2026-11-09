<script lang="ts">
  // Etiqueta colorida de condição (lista de prioritários).
  import { infoEtiqueta } from '../lib/prioritarios';
  let { e }: { e: string } = $props();
  const info = $derived(infoEtiqueta(e));
</script>

<span class="etq {info.cor}">{info.nome}</span>

<style>
  .etq {
    display: inline-block;
    font-size: 0.78rem;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 6px;
    line-height: 1.4;
  }
  .vermelho {
    background: var(--perigo);
    color: var(--cartao);
  }
  .laranja {
    background: var(--ausencia);
    color: var(--cartao);
  }
  .roxo {
    background: var(--roxo);
    color: var(--cartao);
  }
  .azul {
    background: var(--ausente-realizada);
    color: var(--cartao);
  }
  .cinza {
    background: var(--borda);
    color: var(--texto);
  }
</style>
