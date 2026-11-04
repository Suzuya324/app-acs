<script lang="ts">
  import TecladoPin from '../componentes/TecladoPin.svelte';
  import { ArquivoInvalido, lerBackup, SenhaBackupErrada } from '../lib/backup';
  import type { Dados } from '../lib/cofre';
  import { problemaNoPin } from '../lib/cripto';
  import { criarCofre } from '../lib/estado.svelte';
  import { CONFIG_PADRAO } from '../lib/rotulos';

  type Passo = 'inicio' | 'dados' | 'exemplo' | 'backup' | 'pin' | 'confirmar' | 'criando';
  let passo = $state<Passo>('inicio');

  // Dados do ACS
  let nome = $state('');
  let micro = $state('');
  let meta = $state(CONFIG_PADRAO.metaMensal);
  let ruas = $state<string[]>([]);
  let novaRua = $state('');
  let origem = $state<'exemplo' | 'vazio'>('exemplo');

  // Backup
  let arquivo = $state<File | null>(null);
  let senhaBackup = $state('');
  let restaurado = $state<Dados | null>(null);

  // PIN
  let pin = $state('');
  let pin2 = $state('');
  let erro = $state('');

  function addRua() {
    const r = novaRua.trim();
    if (r && !ruas.includes(r)) ruas = [...ruas, r];
    novaRua = '';
  }

  function seguirDados() {
    erro = '';
    if (!nome.trim()) return (erro = 'Digite seu nome.');
    if (!(meta > 0)) return (erro = 'A meta precisa ser maior que zero.');
    passo = 'exemplo';
  }

  async function abrirBackup() {
    erro = '';
    if (!arquivo) return (erro = 'Escolha o arquivo do backup.');
    try {
      restaurado = await lerBackup(await arquivo.text(), senhaBackup);
      passo = 'pin';
    } catch (e) {
      erro = e instanceof SenhaBackupErrada || e instanceof ArquivoInvalido ? e.message : 'Não consegui abrir o arquivo.';
    }
  }

  function seguirPin() {
    erro = problemaNoPin(pin);
    if (erro) {
      pin = '';
      return;
    }
    passo = 'confirmar';
  }

  async function confirmarPin() {
    if (pin2 !== pin) {
      erro = 'Os PINs não são iguais. Vamos começar o PIN de novo.';
      pin = '';
      pin2 = '';
      passo = 'pin';
      return;
    }
    erro = '';
    passo = 'criando';
    try {
      const config = {
        ...structuredClone(CONFIG_PADRAO),
        nomeAcs: nome.trim(),
        micro: micro.trim(),
        metaMensal: Math.round(meta),
        ruas: $state.snapshot(ruas),
      };
      await criarCofre(pin, config, restaurado ?? origem);
      location.hash = '#/';
    } catch (e) {
      erro = 'Erro ao criar o cofre: ' + (e instanceof Error ? e.message : String(e));
      passo = 'pin';
      pin = '';
      pin2 = '';
    }
  }
</script>

{#if passo === 'inicio'}
  <section class="cartao">
    <h1>Bem-vindo ao Facilitador de VDs</h1>
    <p>Antes de começar, três coisas importantes:</p>
    <ol class="itens">
      <li><strong>Seus dados ficam só neste celular.</strong> Nada vai para a internet, nem para o Fast.</li>
      <li><strong>Tudo é guardado embaralhado (criptografado)</strong> e só abre com o seu PIN.</li>
      <li><strong>Se o celular quebrar ou for perdido, só o backup salva seus dados.</strong> Faça backup toda semana.</li>
    </ol>
  </section>
  <button class="botao largo" onclick={() => (passo = 'dados')}>Começar</button>
  <button class="botao secundario largo espaco" onclick={() => (passo = 'backup')}>Já tenho um backup</button>
{:else if passo === 'dados'}
  <h1>Seus dados</h1>
  <section class="cartao">
    <label class="campo"><span>Seu nome</span><input type="text" bind:value={nome} autocomplete="off" /></label>
    <label class="campo"><span>Micro / equipe</span><input type="text" bind:value={micro} placeholder="Ex.: Micro 04" autocomplete="off" /></label>
    <label class="campo"><span>Meta de famílias por mês</span><input type="number" inputmode="numeric" min="1" bind:value={meta} /></label>
  </section>
  <section class="cartao">
    <h2>Ruas da sua área</h2>
    <p class="suave pequeno">Opcional agora. As ruas também vêm junto quando você importar a área (Etapa 3).</p>
    <ul class="lista">
      {#each ruas as r (r)}
        <li class="rua">
          <span>{r}</span>
          <button class="botao secundario pequeno" onclick={() => (ruas = ruas.filter((x) => x !== r))} aria-label="Tirar {r}">Tirar</button>
        </li>
      {/each}
    </ul>
    <div class="nova-rua">
      <input type="text" bind:value={novaRua} placeholder="Nome da rua" onkeydown={(e) => e.key === 'Enter' && addRua()} />
      <button class="botao pequeno" onclick={addRua}>Adicionar</button>
    </div>
  </section>
  {#if erro}<p class="alerta">{erro}</p>{/if}
  <div class="linha-botoes">
    <button class="botao secundario" onclick={() => (passo = 'inicio')}>Voltar</button>
    <button class="botao" onclick={seguirDados}>Continuar</button>
  </div>
{:else if passo === 'exemplo'}
  <h1>Como quer começar?</h1>
  <section class="cartao">
    <label class="escolha">
      <input type="radio" bind:group={origem} value="exemplo" />
      <span><strong>Com dados de exemplo (inventados)</strong><br /><span class="suave pequeno">Para testar o app enquanto o importador da sua área não fica pronto (Etapa 3).</span></span>
    </label>
    <label class="escolha">
      <input type="radio" bind:group={origem} value="vazio" />
      <span><strong>Vazio</strong><br /><span class="suave pequeno">Sem nenhuma família por enquanto.</span></span>
    </label>
  </section>
  <div class="linha-botoes">
    <button class="botao secundario" onclick={() => (passo = 'dados')}>Voltar</button>
    <button class="botao" onclick={() => (passo = 'pin')}>Continuar</button>
  </div>
{:else if passo === 'backup'}
  <h1>Restaurar backup</h1>
  <section class="cartao">
    <label class="campo">
      <span>Arquivo do backup</span>
      <input type="file" accept=".json,application/json" onchange={(e) => (arquivo = e.currentTarget.files?.[0] ?? null)} />
    </label>
    <label class="campo">
      <span>Senha do backup</span>
      <input type="password" bind:value={senhaBackup} autocomplete="off" />
    </label>
  </section>
  {#if erro}<p class="alerta">{erro}</p>{/if}
  <div class="linha-botoes">
    <button class="botao secundario" onclick={() => ((passo = 'inicio'), (erro = ''))}>Voltar</button>
    <button class="botao" onclick={abrirBackup}>Abrir backup</button>
  </div>
{:else if passo === 'pin'}
  <section class="centro">
    <h1>Crie seu PIN</h1>
    {#if restaurado}<p class="ok">✓ Backup aberto: {restaurado.familias.length} famílias e {restaurado.visitas.length} visitas.</p>{/if}
    <p>Use <strong>6 números ou mais</strong>. Quanto mais números, mais difícil de alguém adivinhar.</p>
    <p class="suave pequeno">Não use data de nascimento, 123456 nem números repetidos. Não existe “esqueci o PIN”: guarde-o bem.</p>
    <TecladoPin bind:valor={pin} onconfirmar={seguirPin} rotuloConfirmar="Seguir" />
    {#if erro}<p class="alerta erro-pin">{erro}</p>{/if}
  </section>
{:else if passo === 'confirmar'}
  <section class="centro">
    <h1>Digite o PIN de novo</h1>
    <p class="suave">Para ter certeza de que está certo.</p>
    <TecladoPin bind:valor={pin2} onconfirmar={confirmarPin} rotuloConfirmar="Pronto" />
  </section>
{:else}
  <section class="centro">
    <h1>Preparando…</h1>
    <p>Criando o cofre criptografado. Pode levar alguns segundos.</p>
  </section>
{/if}

<style>
  .itens li {
    margin-bottom: 10px;
  }
  .espaco {
    margin-top: 10px;
  }
  .rua {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    padding: 6px 0;
    border-bottom: 1px solid var(--borda);
  }
  .nova-rua {
    display: flex;
    gap: 8px;
    margin-top: 10px;
  }
  .escolha {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    padding: 10px 0;
    cursor: pointer;
  }
  .escolha input {
    width: 26px;
    height: 26px;
    flex: 0 0 26px;
    margin-top: 2px;
    accent-color: var(--primaria);
  }
  .centro {
    text-align: center;
  }
  .ok {
    color: var(--realizada);
    font-weight: 700;
  }
  .erro-pin {
    margin-top: 14px;
  }
</style>
