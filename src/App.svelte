<script lang="ts">
  import Icone from './componentes/Icone.svelte';
  import { app } from './lib/estado.svelte';
  import { ir, rota } from './lib/rotas.svelte';
  import Busca from './telas/Busca.svelte';
  import Familia from './telas/Familia.svelte';
  import Fila from './telas/Fila.svelte';
  import Inicio from './telas/Inicio.svelte';
  import NovaVD from './telas/NovaVD.svelte';

  const prefereEscuro = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  let escuro = $state(prefereEscuro);
  $effect(() => {
    document.documentElement.dataset.tema = escuro ? 'escuro' : 'claro';
  });

  const pendentes = $derived(app.visitas.filter((v) => !v.lancadaNoFast).length);
  const abas = [
    { tela: 'inicio', caminho: '', rotulo: 'Início', icone: 'casa' },
    { tela: 'busca', caminho: 'busca', rotulo: 'Buscar', icone: 'busca' },
    { tela: 'fila', caminho: 'fila', rotulo: 'Fila do Fast', icone: 'fila' },
  ];
  const abaAtiva = $derived(rota.tela === 'familia' || rota.tela === 'vd' ? 'busca' : rota.tela);
</script>

<div class="faixa-prototipo" role="note">PROTÓTIPO · dados fictícios · nada é salvo</div>

<header class="topo">
  <div>
    <strong>App do ACS</strong>
    <span class="suave pequeno">{app.config.micro}</span>
  </div>
  <button
    class="botao-tema"
    onclick={() => (escuro = !escuro)}
    aria-label={escuro ? 'Usar modo claro' : 'Usar modo escuro'}
  >
    <Icone nome={escuro ? 'sol' : 'lua'} />
  </button>
</header>

<main class="conteudo">
  {#if rota.tela === 'busca'}
    <Busca />
  {:else if rota.tela === 'familia'}
    {#key rota.id}<Familia id={rota.id} />{/key}
  {:else if rota.tela === 'vd'}
    {#key rota.id}<NovaVD familiaId={rota.id} />{/key}
  {:else if rota.tela === 'fila'}
    <Fila />
  {:else}
    <Inicio />
  {/if}
</main>

{#if app.aviso}
  <div class="toast" role="status">{app.aviso}</div>
{/if}

<nav class="abas" aria-label="Navegação principal">
  {#each abas as aba (aba.tela)}
    <button class="aba" class:ativa={abaAtiva === aba.tela} onclick={() => ir(aba.caminho)}>
      <span class="icone-aba">
        <Icone nome={aba.icone} tamanho={26} />
        {#if aba.tela === 'fila' && pendentes > 0}
          <span class="contador">{pendentes}</span>
        {/if}
      </span>
      <span>{aba.rotulo}</span>
    </button>
  {/each}
</nav>

<style>
  .faixa-prototipo {
    background: var(--aviso-fundo);
    color: var(--aviso-texto);
    text-align: center;
    font-size: 0.8rem;
    font-weight: 700;
    padding: 4px 8px;
    letter-spacing: 0.02em;
  }
  .topo {
    position: sticky;
    top: 0;
    z-index: 5;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 16px;
    background: var(--cartao);
    border-bottom: 1px solid var(--borda);
  }
  .topo div {
    display: flex;
    flex-direction: column;
    line-height: 1.2;
  }
  .botao-tema {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    border: 2px solid var(--borda);
    background: transparent;
    display: grid;
    place-items: center;
    cursor: pointer;
  }
  .abas {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 10;
    display: flex;
    background: var(--cartao);
    border-top: 1px solid var(--borda);
    padding-bottom: env(safe-area-inset-bottom);
  }
  .aba {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 8px 4px 10px;
    min-height: 64px;
    border: 0;
    background: transparent;
    color: var(--texto-suave);
    font-size: 0.85rem;
    font-weight: 700;
    cursor: pointer;
  }
  .aba.ativa {
    color: var(--primaria);
  }
  .aba.ativa .icone-aba {
    background: var(--primaria-clara);
  }
  .icone-aba {
    position: relative;
    display: grid;
    place-items: center;
    width: 56px;
    height: 32px;
    border-radius: 999px;
  }
  .contador {
    position: absolute;
    top: -6px;
    right: 2px;
    min-width: 22px;
    height: 22px;
    padding: 0 6px;
    border-radius: 999px;
    background: var(--perigo);
    color: #fff;
    font-size: 0.75rem;
    display: grid;
    place-items: center;
  }
  .toast {
    position: fixed;
    left: 16px;
    right: 16px;
    bottom: 88px;
    z-index: 20;
    max-width: 600px;
    margin: 0 auto;
    background: var(--texto);
    color: var(--fundo);
    padding: 14px 16px;
    border-radius: 12px;
    font-weight: 700;
    text-align: center;
  }
</style>
