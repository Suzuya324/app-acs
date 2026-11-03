<script lang="ts">
  // Ícones desenhados aqui mesmo (sem baixar nada da internet).
  let { nome, tamanho = 24 }: { nome: string; tamanho?: number } = $props();
</script>

<svg
  width={tamanho}
  height={tamanho}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2.2"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  {#if nome === 'casa'}
    <path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" />
  {:else if nome === 'busca'}
    <circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" />
  {:else if nome === 'fila'}
    <path d="M9 6h11M9 12h11M9 18h11" /><path d="M4 6h.01M4 12h.01M4 18h.01" />
  {:else if nome === 'copiar'}
    <rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3" />
  {:else if nome === 'ok'}
    <path d="M5 12l5 5 9-10" />
  {:else if nome === 'voltar'}
    <path d="M15 5l-7 7 7 7" />
  {:else if nome === 'mais'}
    <path d="M12 5v14M5 12h14" />
  {:else if nome === 'sol'}
    <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  {:else if nome === 'lua'}
    <path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z" />
  {:else if nome === 'pessoa'}
    <circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0116 0" />
  {:else if nome === 'seta'}
    <path d="M9 5l7 7-7 7" />
  {/if}
</svg>
