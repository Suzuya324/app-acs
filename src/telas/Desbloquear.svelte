<script lang="ts">
  import { AUTOR, NOME_APP } from '../lib/edicao';
  import { onDestroy, onMount } from 'svelte';
  import TecladoPin from '../componentes/TecladoPin.svelte';
  import { textoDoBloqueio } from '../lib/bloqueios';
  import { app, apagarTudo, desbloquear, esperaRestante } from '../lib/estado.svelte';

  let pin = $state('');
  let abrindo = $state(false);
  let mensagem = $state('');
  let espera = $state(0);
  let esqueci = $state(false);
  let confirmaApagar = $state('');
  let timer: ReturnType<typeof setInterval> | undefined;

  function contar(seg: number) {
    espera = seg;
    clearInterval(timer);
    if (seg > 0) {
      timer = setInterval(() => {
        espera = Math.max(0, espera - 1);
        if (espera === 0) clearInterval(timer);
      }, 1000);
    }
  }

  onMount(async () => {
    const r = await esperaRestante();
    contar(r.segundos);
  });
  onDestroy(() => clearInterval(timer));

  async function entrar() {
    abrindo = true;
    mensagem = '';
    try {
      const r = await desbloquear(pin);
      if (!r.ok) {
        pin = '';
        mensagem = r.erros > 0 ? `PIN errado (${r.erros} ${r.erros === 1 ? 'tentativa' : 'tentativas'}).` : '';
        contar(r.esperar);
      }
    } catch (e) {
      mensagem = 'Erro ao abrir os dados: ' + (e instanceof Error ? e.message : String(e));
    } finally {
      abrindo = false;
    }
  }
</script>

<section class="tela-pin">
  <div class="cadeado" aria-hidden="true">🔒</div>
  <h1>{NOME_APP}</h1>
  {#if !esqueci}
    {#if app.ultimoBloqueio}
      <p class="motivo pequeno" role="status">
        {textoDoBloqueio(app.ultimoBloqueio, app.config)}
        {#if app.ultimoBloqueio.motivo === 'parado' || app.ultimoBloqueio.motivo === 'fora'}
          <br /><span class="suave">Dá para mudar o tempo em Ajustes → Bloqueio automático.</span>
        {:else if app.ultimoBloqueio.motivo === 'fechado'}
          <br /><span class="suave">Nada se perde: a VD pela metade fica guardada.</span>
        {/if}
      </p>
    {/if}
    <p class="suave">Digite seu PIN</p>
    <TecladoPin bind:valor={pin} onconfirmar={entrar} desabilitado={abrindo || espera > 0} />
    <p class="estado" aria-live="assertive">
      {#if abrindo}Abrindo…{:else if espera > 0}{mensagem} Aguarde {espera >= 60 ? `${Math.floor(espera / 60)} min ${String(espera % 60).padStart(2, '0')} s` : `${espera} s`} para tentar de novo.{:else}{mensagem}{/if}
    </p>
    <button class="link" onclick={() => (esqueci = true)}>Esqueci o PIN</button>
  {:else}
    <div class="cartao esqueci">
      <h2>Esqueceu o PIN?</h2>
      <p>
        Por segurança, <strong>não existe forma de recuperar o PIN</strong>: nem você, nem ninguém
        consegue abrir os dados sem ele. Se esqueceu, a saída é <strong>apagar tudo</strong> e, depois,
        <strong>restaurar o último backup</strong> (a senha do backup é diferente do PIN).
      </p>
      <label class="campo">
        <span>Para apagar tudo, digite APAGAR</span>
        <input type="text" bind:value={confirmaApagar} autocapitalize="characters" autocomplete="off" />
      </label>
      <div class="linha-botoes">
        <button class="botao secundario" onclick={() => (esqueci = false)}>Voltar</button>
        <button class="botao perigo" disabled={confirmaApagar.trim().toUpperCase() !== 'APAGAR'} onclick={apagarTudo}>Apagar tudo</button>
      </div>
    </div>
  {/if}

  <aside class="privacidade" aria-label="Aviso de privacidade">
    <p class="titulo-priv">🔒 Privacidade dos pacientes</p>
    <p>
      Tudo o que está neste aplicativo é <strong>sigiloso</strong> e usado com <strong>discrição</strong>: nada aqui invade a
      privacidade de ninguém. Os dados ficam <strong>só nos seus aparelhos</strong>, trancados com o seu PIN e embaralhados
      (criptografados). Nada é vendido, mostrado ou compartilhado com terceiros, nem enviado para o Fast.
    </p>
  </aside>
  
  <p class="assinatura" aria-label="Autor do app">{AUTOR}</p>
</section>

<style>
  /* Assinatura do autor: só na tela de bloqueio, canto esquerdo de baixo, fixa, discreta e sem atrapalhar o toque. */
  .assinatura {
    position: fixed;
    left: 8px;
    bottom: calc(6px + env(safe-area-inset-bottom));
    z-index: 11;
    margin: 0;
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: var(--texto-suave);
    background: var(--fundo);
    padding: 1px 6px;
    border-radius: 6px;
    pointer-events: none;
    user-select: none;
  }
  .privacidade {
    margin-top: 16px;
    padding: 12px 14px;
    text-align: left;
    border-left: 4px solid var(--primaria);
    background: var(--primaria-clara);
    border-radius: 8px;
    font-size: 0.85rem;
    line-height: 1.4;
  }
  .privacidade p {
    margin: 0;
  }
  .privacidade .titulo-priv {
    margin-bottom: 4px;
    font-weight: 800;
  }
  .motivo {
    background: var(--aviso-fundo);
    color: var(--aviso-texto);
    border-radius: 10px;
    padding: 8px 12px;
    margin: 4px 0 10px;
    text-align: center;
  }
  .tela-pin {
    text-align: center;
    padding-top: 16px;
  }
  .cadeado {
    font-size: 2.4rem;
  }
  .estado {
    min-height: 3em;
    margin-top: 14px;
    font-weight: 700;
    color: var(--perigo);
  }
  .link {
    background: none;
    border: 0;
    color: var(--primaria);
    font-weight: 700;
    text-decoration: underline;
    min-height: 48px;
    cursor: pointer;
  }
  .esqueci {
    text-align: left;
  }
</style>
