<script lang="ts">
  import { app } from '../lib/estado.svelte';
  import type { Desfecho } from '../lib/tipos';
  let { valor }: { valor: Desfecho } = $props();
</script>

<span class="etiqueta d-{valor}">{app.config.nomesDesfecho[valor]}</span>
