<script lang="ts">
  // Teclado numérico grande para digitar o PIN com uma mão.
  let {
    valor = $bindable(''),
    onconfirmar,
    rotuloConfirmar = 'Entrar',
    desabilitado = false,
    maximo = 12,
  }: {
    valor?: string;
    onconfirmar: () => void;
    rotuloConfirmar?: string;
    desabilitado?: boolean;
    maximo?: number;
  } = $props();

  function tecla(d: string) {
    if (desabilitado || valor.length >= maximo) return;
    valor += d;
    navigator.vibrate?.(10);
  }
  function apagar() {
    if (!desabilitado) valor = valor.slice(0, -1);
  }
  function teclado(e: KeyboardEvent) {
    if (/^\d$/.test(e.key)) tecla(e.key);
    else if (e.key === 'Backspace') apagar();
    else if (e.key === 'Enter' && !desabilitado && valor.length >= 6) onconfirmar();
  }
</script>

<svelte:window onkeydown={teclado} />

<div class="pontos" aria-live="polite" aria-label="{valor.length} números digitados">
  {#each { length: Math.max(6, valor.length) } as _, i (i)}
    <span class="ponto" class:cheio={i < valor.length}></span>
  {/each}
</div>

<div class="teclado">
  {#each ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as d (d)}
    <button class="tecla" onclick={() => tecla(d)} disabled={desabilitado}>{d}</button>
  {/each}
  <button class="tecla acao" onclick={apagar} disabled={desabilitado || !valor} aria-label="Apagar">⌫</button>
  <button class="tecla" onclick={() => tecla('0')} disabled={desabilitado}>0</button>
  <button class="tecla acao ok" onclick={onconfirmar} disabled={desabilitado || valor.length < 6}>{rotuloConfirmar}</button>
</div>

<style>
  .pontos {
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
    gap: 12px;
    margin: 12px 0 20px;
    min-height: 22px;
  }
  .ponto {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 2px solid var(--texto-suave);
  }
  .ponto.cheio {
    background: var(--primaria);
    border-color: var(--primaria);
  }
  .teclado {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    max-width: 360px;
    margin: 0 auto;
  }
  .tecla {
    min-height: 66px;
    font-size: 1.7rem;
    font-weight: 700;
    border-radius: 16px;
    border: 2px solid var(--borda);
    background: var(--cartao);
    cursor: pointer;
    touch-action: manipulation;
  }
  .tecla:active:not(:disabled) {
    background: var(--primaria-clara);
  }
  .tecla:disabled {
    opacity: 0.45;
  }
  .acao {
    font-size: 1.3rem;
  }
  .ok {
    background: var(--primaria);
    color: var(--primaria-texto);
    border-color: var(--primaria);
    font-size: 1.1rem;
  }
</style>
