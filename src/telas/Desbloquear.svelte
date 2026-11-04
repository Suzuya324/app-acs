<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import TecladoPin from '../componentes/TecladoPin.svelte';
  import { apagarTudo, desbloquear, esperaRestante } from '../lib/estado.svelte';

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
  <h1>Facilitador de VDs</h1>
  {#if !esqueci}
    <p class="suave">Digite seu PIN</p>
    <TecladoPin bind:valor={pin} onconfirmar={entrar} desabilitado={abrindo || espera > 0} />
    <p class="estado" aria-live="assertive">
      {#if abrindo}Abrindo…{:else if espera > 0}{mensagem} Aguarde {espera} s para tentar de novo.{:else}{mensagem}{/if}
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
</section>

<style>
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
