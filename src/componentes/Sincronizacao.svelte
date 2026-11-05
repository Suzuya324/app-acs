<script lang="ts">
  // Quadro "Sincronizar aparelhos" (em Ajustes): liga, mostra como está e desliga a sincronização.
  import { entregarArquivo } from '../lib/arquivo';
  import { decodificar } from '../lib/importar-csv';
  import { app, arquivoDeConexao, conectarSinc, desligarSinc, mostrarAviso, sincronizar } from '../lib/estado.svelte';
  import { lerArquivoConexao, limparRepo } from '../lib/sinc';

  const SUGESTOES_APARELHO = ['Celular', 'Tablet', 'Computador'];

  let modo = $state<'manual' | 'arquivo'>('manual');
  let repo = $state('');
  let token = $state('');
  let senha = $state('');
  let senha2 = $state('');
  let aparelho = $state('');
  let textoConexao = $state('');
  let conectando = $state(false);
  let erro = $state('');

  const quando = $derived(
    app.sinc.ultima ? new Date(app.sinc.ultima).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '',
  );

  async function lerConexao(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const arq = input.files?.[0];
    input.value = '';
    if (!arq) return;
    textoConexao = decodificar(new Uint8Array(await arq.arrayBuffer()));
    erro = '';
  }

  async function conectar() {
    erro = '';
    if (senha.length < 10) return (erro = 'A senha de sincronização precisa ter pelo menos 10 caracteres.');
    if (!aparelho.trim()) return (erro = 'Dê um nome para este aparelho (ex.: Celular).');
    conectando = true;
    try {
      let dados = { repo: limparRepo(repo), token: token.trim() };
      if (modo === 'arquivo') {
        if (!textoConexao) throw new Error('Escolha o arquivo de conexão.');
        dados = await lerArquivoConexao(textoConexao, senha);
      } else {
        if (senha !== senha2) throw new Error('As duas senhas não são iguais.');
        if (!dados.repo.includes('/')) throw new Error('Escreva o repositório assim: seu-usuario/facilitador-dados');
        if (!dados.token) throw new Error('Cole a chave do GitHub.');
      }
      await conectarSinc({ ...dados, senha, aparelho: aparelho.trim() });
      repo = token = senha = senha2 = textoConexao = '';
      mostrarAviso('Aparelho conectado ✓ Agora sincroniza sozinho.', 5000);
    } catch (e) {
      erro = e instanceof Error ? e.message : String(e);
    } finally {
      conectando = false;
    }
  }

  async function salvarConexao() {
    const t = await arquivoDeConexao();
    if (!t) return;
    const ok = await entregarArquivo('conexao-facilitador.json', t, 'application/json', 'baixar');
    if (ok) mostrarAviso('Arquivo de conexão salvo. Leve para o outro aparelho e apague depois.', 5000);
  }

  async function desligar() {
    if (!confirm('Desligar a sincronização NESTE aparelho? Os dados daqui e da nuvem continuam.')) return;
    await desligarSinc();
    mostrarAviso('Sincronização desligada neste aparelho');
  }
</script>

<section class="cartao" id="sinc">
  <h2>Sincronizar aparelhos</h2>

  {#if app.sinc.estado !== 'desligada'}
    <p class="status {app.sinc.estado}" role="status">
      {#if app.sinc.estado === 'sincronizando'}
        ⟳ Sincronizando…
      {:else if app.sinc.estado === 'ok'}
        ✓ Sincronizado{quando ? ` às ${quando}` : ''}
      {:else if app.sinc.estado === 'offline'}
        Sem internet: sincroniza quando a conexão voltar.
      {:else if app.sinc.estado === 'erro'}
        ⚠️ {app.sinc.mensagem}
      {:else}
        Ligada
      {/if}
    </p>
    <p class="suave pequeno">Este aparelho: <strong>{app.sinc.aparelho}</strong> · nuvem: {app.sinc.repo}</p>
    <p class="suave pequeno">
      Sincroniza sozinho ao abrir o app, alguns segundos depois de cada alteração, a cada 3 minutos e antes de trancar.
      Nada é apagado: vale sempre a alteração mais recente.
    </p>
    <div class="botoes">
      <button class="botao largo" disabled={app.sinc.estado === 'sincronizando'} onclick={() => sincronizar()}>Sincronizar agora</button>
      <button class="botao secundario largo" onclick={salvarConexao}>Salvar arquivo para ligar outro aparelho</button>
      <button class="botao perigo secundario largo" onclick={desligar}>Desligar neste aparelho</button>
    </div>
  {:else}
    <p>
      Use o app no <strong>celular, no tablet e no computador</strong> sem fazer backup toda hora: cada aparelho manda uma
      cópia <strong>trancada</strong> (só abre com a sua senha de sincronização) para um cofre <strong>privado</strong> no seu
      GitHub, e os outros pegam sozinhos.
    </p>

    <details class="passos">
      <summary>Primeira vez: como criar o cofre e a chave (uma vez só)</summary>
      <ol>
        <li>
          <strong>Criar o cofre:</strong> entre em <strong>github.com/new</strong> → em “Repository name” escreva
          <code>facilitador-dados</code> → marque <strong>Private</strong> → <strong>Create repository</strong>.
        </li>
        <li>
          <strong>Criar a chave:</strong> entre em <strong>github.com/settings/personal-access-tokens/new</strong> →
          “Token name”: <code>facilitador</code> → “Expiration”: escolha a maior (anote a data para renovar) →
          “Repository access”: <strong>Only select repositories</strong> → escolha <code>facilitador-dados</code> →
          “Permissions” → “Repository permissions” → <strong>Contents</strong>: <strong>Read and write</strong> →
          <strong>Generate token</strong> → copie a chave (começa com <code>github_pat_</code>).
        </li>
        <li>Aqui embaixo: cole o repositório e a chave, crie a <strong>senha de sincronização</strong> e toque em Conectar.</li>
        <li>
          Nos outros aparelhos: neste aparelho, toque em “Salvar arquivo para ligar outro aparelho”, leve o arquivo e use
          “Tenho o arquivo de conexão” (aí só digita a senha).
        </li>
      </ol>
    </details>

    <div class="modo" role="radiogroup" aria-label="Como conectar">
      <label><input type="radio" bind:group={modo} value="manual" /> Primeiro aparelho (repositório e chave)</label>
      <label><input type="radio" bind:group={modo} value="arquivo" /> Tenho o arquivo de conexão</label>
    </div>

    {#if modo === 'manual'}
      <label class="campo"><span>Repositório</span><input type="text" bind:value={repo} placeholder="seu-usuario/facilitador-dados" autocomplete="off" autocapitalize="none" /></label>
      <label class="campo"><span>Chave do GitHub</span><input type="password" bind:value={token} placeholder="github_pat_…" autocomplete="off" /></label>
    {:else}
      <label class="botao secundario largo arquivo">
        <input type="file" onchange={lerConexao} />
        {textoConexao ? 'Arquivo escolhido ✓' : 'Escolher arquivo de conexão'}
      </label>
    {/if}

    <label class="campo">
      <span>Senha de sincronização {modo === 'manual' ? '(crie uma, mínimo 10 caracteres)' : '(a mesma dos outros aparelhos)'}</span>
      <input type="password" bind:value={senha} autocomplete="new-password" />
    </label>
    {#if modo === 'manual'}
      <label class="campo"><span>Repita a senha</span><input type="password" bind:value={senha2} autocomplete="new-password" /></label>
    {/if}
    <label class="campo">
      <span>Nome deste aparelho</span>
      <input type="text" bind:value={aparelho} list="nomes-aparelho" placeholder="Celular, Tablet, Computador…" autocomplete="off" />
      <datalist id="nomes-aparelho">{#each SUGESTOES_APARELHO as n (n)}<option value={n}></option>{/each}</datalist>
    </label>
    <p class="suave pequeno">
      Guarde a senha de sincronização num lugar seguro: sem ela, a cópia da nuvem não abre (os dados de cada aparelho
      continuam lá). A chave e a senha ficam só neste aparelho, trancadas com o seu PIN.
    </p>
    {#if erro}<p class="alerta" role="alert">{erro}</p>{/if}
    <button class="botao largo" disabled={conectando} onclick={conectar}>{conectando ? 'Conectando…' : 'Conectar'}</button>
  {/if}
</section>

<style>
  .status {
    font-weight: 700;
    margin-bottom: 4px;
  }
  .status.ok {
    color: var(--realizada);
  }
  .status.erro {
    color: var(--perigo);
  }
  .status.offline,
  .status.sincronizando {
    color: var(--texto-suave);
  }
  .botoes {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 10px;
  }
  .passos {
    margin: 10px 0;
  }
  .passos ol {
    padding-left: 20px;
  }
  .passos li {
    margin-bottom: 10px;
    line-height: 1.45;
  }
  code {
    font-size: 0.9em;
    background: var(--primaria-clara);
    padding: 1px 5px;
    border-radius: 6px;
    overflow-wrap: anywhere;
  }
  .modo {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin: 8px 0;
  }
  .modo label {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 44px;
  }
  .modo input {
    width: 22px;
    height: 22px;
    accent-color: var(--primaria);
  }
  .arquivo {
    position: relative;
    cursor: pointer;
    margin: 8px 0;
  }
  .arquivo input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }
</style>
