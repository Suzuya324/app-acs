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
  {:else if nome === 'cadeado'}
    <rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" />
  {:else if nome === 'engrenagem'}
    <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" />
  {:else if nome === 'seta'}
    <path d="M9 5l7 7-7 7" />
  {:else if nome === 'estrela'}
    <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />
  {/if}
</svg>
