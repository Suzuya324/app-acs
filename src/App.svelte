<script lang="ts">
  import { onMount } from 'svelte';
  import Icone from './componentes/Icone.svelte';
  import { app, iniciar, instalarBloqueioAutomatico, trancar } from './lib/estado.svelte';
  import { atualizarApp } from './lib/pwa';
  import { ir, rota } from './lib/rotas.svelte';
  import Ajustes from './telas/Ajustes.svelte';
  import Busca from './telas/Busca.svelte';
  import Configurar from './telas/Configurar.svelte';
  import Desbloquear from './telas/Desbloquear.svelte';
  import Familia from './telas/Familia.svelte';
  import Fila from './telas/Fila.svelte';
  import Inicio from './telas/Inicio.svelte';
  import NovaVD from './telas/NovaVD.svelte';

  const prefereEscuro = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  let escuro = $state(prefereEscuro);
  $effect(() => {
    document.documentElement.dataset.tema = escuro ? 'escuro' : 'claro';
  });

  onMount(() => {
    iniciar();
    instalarBloqueioAutomatico();
  });

  const pendentes = $derived(app.visitas.filter((v) => !v.lancadaNoFast).length);
  const abas = [
    { tela: 'inicio', caminho: '', rotulo: 'Início', icone: 'casa' },
    { tela: 'busca', caminho: 'busca', rotulo: 'Buscar', icone: 'busca' },
    { tela: 'fila', caminho: 'fila', rotulo: 'Fila do Fast', icone: 'fila' },
    { tela: 'ajustes', caminho: 'ajustes', rotulo: 'Ajustes', icone: 'engrenagem' },
  ];
  const abaAtiva = $derived(rota.tela === 'familia' || rota.tela === 'vd' ? 'busca' : rota.tela);
</script>

{#if app.novaVersao}
  <div class="faixa nova-versao" role="status">
    Nova versão do app disponível.
    <button class="botao pequeno" onclick={atualizarApp}>Atualizar</button>
  </div>
{/if}

{#if app.fase === 'aberto' && app.config.usandoExemplo}
  <div class="faixa" role="note">Usando dados de EXEMPLO (inventados)</div>
{/if}

<header class="topo">
  <div>
    <strong>App do ACS</strong>
    {#if app.fase === 'aberto' && app.config.micro}<span class="suave pequeno">{app.config.micro}</span>{/if}
  </div>
  <div class="acoes-topo">
    <button class="botao-topo" onclick={() => (escuro = !escuro)} aria-label={escuro ? 'Usar modo claro' : 'Usar modo escuro'}>
      <Icone nome={escuro ? 'sol' : 'lua'} />
    </button>
    {#if app.fase === 'aberto'}
      <button class="botao-topo" onclick={trancar} aria-label="Trancar o app agora">
        <Icone nome="cadeado" />
      </button>
    {/if}
  </div>
</header>

<main class="conteudo" class:sem-abas={app.fase !== 'aberto'}>
  {#if app.fase === 'carregando'}
    <p class="suave">Abrindo…</p>
  {:else if app.fase === 'erro'}
    <div class="cartao"><h2>Não foi possível abrir o app</h2><p>{app.erro}</p></div>
  {:else if app.fase === 'configurar'}
    <Configurar />
  {:else if app.fase === 'trancado'}
    <Desbloquear />
  {:else if rota.tela === 'busca'}
    <Busca />
  {:else if rota.tela === 'familia'}
    {#key rota.id}<Familia id={rota.id} />{/key}
  {:else if rota.tela === 'vd'}
    {#key rota.id}<NovaVD familiaId={rota.id} />{/key}
  {:else if rota.tela === 'fila'}
    <Fila />
  {:else if rota.tela === 'ajustes'}
    <Ajustes />
  {:else}
    <Inicio />
  {/if}
</main>

{#if app.aviso}
  <div class="toast" class:sem-abas={app.fase !== 'aberto'} role="status">{app.aviso}</div>
{/if}

{#if app.fase === 'aberto'}
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
{/if}

<style>
  .faixa {
    background: var(--aviso-fundo);
    color: var(--aviso-texto);
    text-align: center;
    font-size: 0.85rem;
    font-weight: 700;
    padding: 4px 8px;
  }
  .nova-versao {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 12px;
    padding: 8px;
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
  .topo > div:first-child {
    display: flex;
    flex-direction: column;
    line-height: 1.2;
  }
  .acoes-topo {
    display: flex;
    gap: 8px;
  }
  .botao-topo {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    border: 2px solid var(--borda);
    background: transparent;
    display: grid;
    place-items: center;
    cursor: pointer;
  }
  .sem-abas {
    padding-bottom: 32px;
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
    padding: 8px 2px 10px;
    min-height: 64px;
    border: 0;
    background: transparent;
    color: var(--texto-suave);
    font-size: 0.8rem;
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
    right: 0;
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
  .toast.sem-abas {
    bottom: 24px;
  }
</style>
