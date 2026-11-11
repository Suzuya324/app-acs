<script lang="ts">
  import { onMount } from 'svelte';
  import Icone from './componentes/Icone.svelte';
  import { salvarConfig, app, desfazerUltima, iniciar, instalarBloqueioAutomatico, instalarSincronizacao, trancar } from './lib/estado.svelte';
  import { atualizarApp } from './lib/pwa';
  import { ir, rota } from './lib/rotas.svelte';
  import Ajustes from './telas/Ajustes.svelte';
  import Atencao from './telas/Atencao.svelte';
  import ComoUsar from './telas/ComoUsar.svelte';
  import Mapa from './telas/Mapa.svelte';
  import Prontuarios from './telas/Prontuarios.svelte';
  import ImportarGrupos from './telas/ImportarGrupos.svelte';
  import RevisarFichas from './telas/RevisarFichas.svelte';
  import AtualizarCadastro from './telas/AtualizarCadastro.svelte';
  import Tecnica from './telas/Tecnica.svelte';
  import RoteiroDia from './telas/RoteiroDia.svelte';
  import Agenda from './telas/Agenda.svelte';
  import Sumidos from './telas/Sumidos.svelte';
  import Confirmar from './telas/Confirmar.svelte';
  import Gestantes from './telas/Gestantes.svelte';
  import MudancasSbcd from './telas/MudancasSbcd.svelte';
  import ConferirFast from './telas/ConferirFast.svelte';
  import ImportarSV from './telas/ImportarSV.svelte';
  import Casos from './telas/Casos.svelte';
  import Prioritarios from './telas/Prioritarios.svelte';
  import Pessoa from './telas/Pessoa.svelte';
  import PrioritarioEditar from './telas/PrioritarioEditar.svelte';
  import ImportarPrioritarios from './telas/ImportarPrioritarios.svelte';
  import CasoForm from './telas/CasoForm.svelte';
  import NumerosProntuario from './telas/NumerosProntuario.svelte';
  import Busca from './telas/Busca.svelte';
  import Configurar from './telas/Configurar.svelte';
  import Desbloquear from './telas/Desbloquear.svelte';
  import EditarFamilia from './telas/EditarFamilia.svelte';
  import EditarMorador from './telas/EditarMorador.svelte';
  import Importar from './telas/Importar.svelte';
  import Painel from './telas/Painel.svelte';
  import Relatorio from './telas/Relatorio.svelte';
  import Pendencias from './telas/Pendencias.svelte';
  import Roteiro from './telas/Roteiro.svelte';
  import Familia from './telas/Familia.svelte';
  import Fila from './telas/Fila.svelte';
  import Inicio from './telas/Inicio.svelte';
  import Lancar from './telas/Lancar.svelte';
  import Lixeira from './telas/Lixeira.svelte';
  import NovaVD from './telas/NovaVD.svelte';

  const prefereEscuro = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  let escuro = $state(prefereEscuro);
  $effect(() => {
    document.documentElement.dataset.tema = escuro ? 'escuro' : 'claro';
  });
  // Modo rua: letra maior e mais contraste (fica salvo nos ajustes).
  $effect(() => {
    document.documentElement.classList.toggle('modo-rua', !!app.config.modoRua);
  });
  function alternarModoRua() {
    app.config.modoRua = !app.config.modoRua;
    if (app.fase === 'aberto') void salvarConfig();
  }

  onMount(() => {
    iniciar();
    instalarBloqueioAutomatico();
    instalarSincronizacao();
  });

  const pendentes = $derived(app.visitas.filter((v) => !v.lancadaNoFast).length);
  /** Casos urgentes abertos (número vermelho na aba Casos). */
  const urgentes = $derived(app.casos.filter((c) => !c.resolvidoEm && c.categoria === 'urgente' && app.familias.some((f) => f.id === c.familiaId)).length);
  const abas = [
    { tela: 'inicio', caminho: '', rotulo: 'Início', icone: 'casa' },
    { tela: 'busca', caminho: 'busca', rotulo: 'Buscar', icone: 'busca' },
    { tela: 'prioritarios', caminho: 'prioritarios', rotulo: 'Prioritários', icone: 'estrela' },
    { tela: 'casos', caminho: 'casos', rotulo: 'Casos', icone: 'pasta' },
    { tela: 'fila', caminho: 'fila', rotulo: 'Fila', icone: 'fila' },
    { tela: 'ajustes', caminho: 'ajustes', rotulo: 'Ajustes', icone: 'engrenagem' },
  ];
  const abaAtiva = $derived(
    rota.tela === 'caso' || rota.tela === 'tecnica'
      ? 'casos'
      : ['familia', 'vd', 'editar-familia', 'nova-familia', 'morador', 'pessoa'].includes(rota.tela)
      ? 'busca'
      : ['prioritario', 'importar-prioritarios', 'revisar-fichas'].includes(rota.tela)
        ? 'prioritarios'
      : rota.tela === 'lancar' || rota.tela === 'conferir-fast'
        ? 'fila'
        : ['importar', 'lixeira', 'como-usar', 'importar-grupos', 'importar-sv', 'atualizar-cadastro'].includes(rota.tela)
        ? 'ajustes'
        : ['pendencias', 'painel', 'roteiro', 'relatorio', 'atencao', 'mapa', 'prontuarios', 'numeros', 'dia', 'agenda', 'sumidos', 'confirmar', 'gestantes', 'mudancas'].includes(rota.tela)
          ? 'inicio'
          : rota.tela,
  );
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
    <strong>Facilitador de VDs</strong>
    {#if app.fase === 'aberto' && app.config.micro}<span class="suave pequeno">{app.config.micro}</span>{/if}
  </div>
  <div class="acoes-topo">
    {#if app.fase === 'aberto'}
      <button class="botao-topo aa" class:ligado={!!app.config.modoRua} onclick={alternarModoRua} aria-pressed={!!app.config.modoRua} aria-label={app.config.modoRua ? 'Desligar o modo rua (letra normal)' : 'Ligar o modo rua (letra maior, para o sol)'}>A+</button>
    {/if}
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
    {#key `${rota.id}/${rota.sub}`}<NovaVD familiaId={rota.id} visitaId={rota.sub} />{/key}
  {:else if rota.tela === 'fila'}
    <Fila />
  {:else if rota.tela === 'lancar'}
    <Lancar />
  {:else if rota.tela === 'lixeira'}
    <Lixeira />
  {:else if rota.tela === 'ajustes'}
    <Ajustes />
  {:else if rota.tela === 'editar-familia'}
    {#key rota.id}<EditarFamilia id={rota.id} />{/key}
  {:else if rota.tela === 'nova-familia'}
    <EditarFamilia id="" />
  {:else if rota.tela === 'morador'}
    {#key `${rota.id}/${rota.sub}`}<EditarMorador familiaId={rota.id} moradorId={rota.sub} />{/key}
  {:else if rota.tela === 'importar'}
    <Importar />
  {:else if rota.tela === 'pendencias'}
    <Pendencias />
  {:else if rota.tela === 'painel'}
    <Painel />
  {:else if rota.tela === 'relatorio'}
    <Relatorio />
  {:else if rota.tela === 'mapa'}
    <Mapa />
  {:else if rota.tela === 'pessoa'}
    {#key `${rota.id}/${rota.sub}`}<Pessoa familiaId={rota.id} moradorId={rota.sub} />{/key}
  {:else if rota.tela === 'prioritarios'}
    {#key rota.id}<Prioritarios abrir={rota.id} />{/key}
  {:else if rota.tela === 'prioritario'}
    {#key rota.id}<PrioritarioEditar id={rota.id} />{/key}
  {:else if rota.tela === 'importar-prioritarios'}
    <ImportarPrioritarios />
  {:else if rota.tela === 'casos'}
    <Casos />
  {:else if rota.tela === 'caso'}
    {#key `${rota.id}/${rota.sub}`}<CasoForm familiaId={rota.id} casoId={rota.sub} />{/key}
  {:else if rota.tela === 'importar-sv'}
    <ImportarSV />
  {:else if rota.tela === 'importar-grupos'}
    <ImportarGrupos />
  {:else if rota.tela === 'conferir-fast'}
    <ConferirFast />
  {:else if rota.tela === 'confirmar'}
    <Confirmar />
  {:else if rota.tela === 'gestantes'}
    <Gestantes />
  {:else if rota.tela === 'mudancas'}
    <MudancasSbcd />
  {:else if rota.tela === 'dia'}
    <RoteiroDia />
  {:else if rota.tela === 'agenda'}
    <Agenda />
  {:else if rota.tela === 'sumidos'}
    <Sumidos />
  {:else if rota.tela === 'tecnica'}
    <Tecnica />
  {:else if rota.tela === 'atualizar-cadastro'}
    <AtualizarCadastro />
  {:else if rota.tela === 'revisar-fichas'}
    <RevisarFichas />
  {:else if rota.tela === 'numeros'}
    <NumerosProntuario />
  {:else if rota.tela === 'prontuarios'}
    <Prontuarios />
  {:else if rota.tela === 'como-usar'}
    <ComoUsar />
  {:else if rota.tela === 'atencao'}
    <Atencao />
  {:else if rota.tela === 'roteiro'}
    <Roteiro />
  {:else}
    <Inicio />
  {/if}
</main>

{#if app.aviso}
  <div class="toast" class:sem-abas={app.fase !== 'aberto'} role="status">
    <span>{app.aviso}</span>
    {#if app.desfazer && app.fase === 'aberto'}
      <button class="desfazer" onclick={desfazerUltima}>Desfazer</button>
    {/if}
  </div>
{/if}

{#if app.fase === 'aberto'}
  <nav class="abas" aria-label="Navegação principal">
    {#each abas as aba (aba.tela)}
      <button class="aba" class:ativa={abaAtiva === aba.tela} onclick={() => ir(aba.caminho)}>
        <span class="icone-aba">
          <Icone nome={aba.icone} tamanho={26} />
          {#if aba.tela === 'fila' && pendentes > 0}
            <span class="contador">{pendentes}</span>
          {:else if aba.tela === 'casos' && urgentes > 0}
            <span class="contador">{urgentes}</span>
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
    font-size: 0.7rem;
    font-weight: 700;
    cursor: pointer;
    min-width: 0;
    overflow-wrap: anywhere;
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
    width: min(50px, 100%);
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
  .toast {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    flex-wrap: wrap;
  }
  .desfazer {
    min-height: 40px;
    padding: 4px 14px;
    border-radius: 10px;
    border: 2px solid var(--fundo);
    background: transparent;
    color: var(--fundo);
    font-weight: 800;
    cursor: pointer;
  }
  .toast.sem-abas {
    bottom: 24px;
  }
  .aa {
    font-weight: 900;
    font-size: 1rem;
  }
  .aa.ligado {
    background: var(--primaria);
    color: var(--primaria-texto);
    border-color: var(--primaria);
  }
</style>
