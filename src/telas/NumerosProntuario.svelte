<script lang="ts">
  import Icone from '../componentes/Icone.svelte';
  import { app, enderecoCurto, responsavel, salvarConfig } from '../lib/estado.svelte';
  import { analisarNumeros, emIntervalos, escreverProntuario, lerNumeros, microPrincipal, microsEncontradas, proximoLivre } from '../lib/numeros';
  import { ir, voltar } from '../lib/rotas.svelte';

  const micros = $derived(microsEncontradas(app.familias));
  let microEscolhida = $state<string | null>(null);
  const micro = $derived(microEscolhida ?? microPrincipal(app.familias, app.config.micro));
  let textoPastas = $state(app.config.pastasNaColmeia);
  const pastas = $derived(lerNumeros(app.config.pastasNaColmeia));
  const a = $derived(analisarNumeros(app.familias, micro, pastas));
  const proximo = $derived(escreverProntuario(micro, proximoLivre(a), a.digitos));

  async function guardarPastas() {
    app.config.pastasNaColmeia = textoPastas.trim();
    await salvarConfig();
    app.aviso = app.config.pastasNaColmeia ? `${lerNumeros(textoPastas).length} pastas guardadas ✓` : 'Pastas apagadas';
  }
</script>

<button class="botao secundario pequeno voltar" onclick={() => voltar('painel')}><Icone nome="voltar" /> Voltar</button>

<h1>Números de prontuário</h1>
<p class="suave">Quais números da sua micro estão em uso pelas famílias do app e quais estão livres para criar pasta nova. Tudo é calculado no celular.</p>

{#if micros.length > 1}
  <div class="micros" role="radiogroup" aria-label="Micro">
    {#each micros as m (m.micro)}
      <label class="chip" class:ativo={m.micro === micro}>
        <input type="radio" name="micro" value={m.micro} checked={m.micro === micro} onchange={() => (microEscolhida = m.micro)} />
        Micro {m.micro} <span class="suave">({m.familias})</span>
      </label>
    {/each}
  </div>
{/if}

{#if !micro}
  <p class="cartao">Nenhuma família tem prontuário ainda. Preencha os prontuários (Editar família) para ver os números.</p>
{:else}
  <section class="cartao destaque">
    <p class="proximo">Próximo número livre: <strong>{proximo}</strong></p>
    <ul class="resumo">
      <li><strong>{a.usados.size}</strong> números em uso pelas suas famílias</li>
      <li><strong>{a.livres.length}</strong> livres de 1 a {a.maior}{pastas.length ? ' (sem família e sem pasta)' : ''}</li>
      {#if a.livresComPasta.length}<li><strong>{a.livresComPasta.length}</strong> livres, mas ainda com pasta antiga na colmeia</li>{/if}
      <li>Depois do {a.maior}, todos estão livres ({a.maior + 1} em diante).</li>
    </ul>
  </section>

  {#if a.repetidos.length}
    <section class="cartao alerta-cartao">
      <h2>Número repetido ({a.repetidos.length})</h2>
      <p class="suave pequeno">Duas famílias com o mesmo número: confira no sistema e corrija uma delas.</p>
      <ul class="lista">
        {#each a.repetidos as r (r.numero)}
          {#each r.familias as f (f.id)}
            <li><button class="item-link" onclick={() => ir(`editar-familia/${f.id}`)}><strong>{f.prontuario}</strong> · {enderecoCurto(f)}<br /><span class="suave pequeno">{responsavel(f)}</span></button></li>
          {/each}
        {/each}
      </ul>
    </section>
  {/if}

  <section class="cartao">
    <h2>Números livres</h2>
    {#if a.livres.length}
      <p class="numeros">{emIntervalos(a.livres)}</p>
    {:else}
      <p class="suave">Nenhum livre até o {a.maior}. Use do {a.maior + 1} em diante.</p>
    {/if}
    {#if a.livresComPasta.length}
      <h3>Livres depois de tirar a pasta antiga</h3>
      <p class="suave pequeno">Têm pasta na colmeia, mas nenhuma família sua usa. Tire a pasta (e confirme que a família já tem outro número no sistema) antes de reaproveitar.</p>
      <p class="numeros">{emIntervalos(a.livresComPasta)}</p>
    {/if}
    <p class="suave pequeno">“Livre” aqui quer dizer: nenhuma família do app usa. Antes de usar, confira no sistema se o número não está com outra família.</p>
  </section>

  <section class="cartao">
    <h2>Conferir a colmeia</h2>
    <p class="suave pequeno">
      Olhando a colmeia, digite só os <strong>números</strong> das pastas (sem nomes). Pode usar intervalos:
      “1-50, 52, 60 a 75”. Fica guardado no celular, criptografado.
    </p>
    <label class="campo">
      <span>Números das pastas na colmeia (micro {micro})</span>
      <textarea rows="4" bind:value={textoPastas} inputmode="numeric" placeholder="Ex.: 1-50, 52, 60 a 75"></textarea>
    </label>
    <p class="suave pequeno">Lidos: {lerNumeros(textoPastas).length} números{lerNumeros(textoPastas).length ? ` (${emIntervalos(lerNumeros(textoPastas))})` : ''}</p>
    <button class="botao pequeno" onclick={guardarPastas}>Guardar e conferir</button>

    {#if a.colmeia}
      <h3>Pastas que não são de família sua ({a.colmeia.sobrando.length})</h3>
      {#if a.colmeia.sobrando.length}
        <p class="suave pequeno">Nenhuma família do app tem esses números: podem ser de quem saiu da área. Separe para devolver ou passar para quem cuida agora.</p>
        <p class="numeros">{emIntervalos(a.colmeia.sobrando)}</p>
      {:else}
        <p class="suave">Nenhuma ✓</p>
      {/if}
      {#if a.colmeia.semPasta.length}
        <details open={a.colmeia.semPasta.length <= 15}>
        <summary>Famílias suas sem pasta na colmeia ({a.colmeia.semPasta.length})</summary>
        <p class="suave pequeno">Números: {emIntervalos(a.colmeia.semPasta.map((x) => x.numero))}</p>
        <ul class="lista">
          {#each a.colmeia.semPasta as s (s.familia.id)}
            <li><button class="item-link" onclick={() => ir(`familia/${s.familia.id}`)}><strong>{s.familia.prontuario}</strong> · {enderecoCurto(s.familia)}<br /><span class="suave pequeno">{responsavel(s.familia)}</span></button></li>
          {/each}
        </ul>
        </details>
      {:else}
        <h3>Famílias suas sem pasta na colmeia</h3>
        <p class="suave">Nenhuma ✓</p>
      {/if}
    {/if}
  </section>

  {#if a.outraMicro.length}
    <section class="cartao">
      <details>
        <summary>Com prontuário de outra micro ({a.outraMicro.length})</summary>
        <p class="suave pequeno">Famílias do app com número que não é da micro {micro}. Confira no sistema se está certo.</p>
        <ul class="lista">
          {#each a.outraMicro as f (f.id)}
            <li><button class="item-link" onclick={() => ir(`editar-familia/${f.id}`)}><strong>{f.prontuario}</strong> · {enderecoCurto(f)}<br /><span class="suave pequeno">{responsavel(f)}</span></button></li>
          {/each}
        </ul>
      </details>
    </section>
  {/if}

  {#if a.semNumero.length}
    <button class="item-link sem-numero" onclick={() => ir('pendencias')}>
      <span><strong>Sem prontuário ou incompleto</strong><br /><span class="suave pequeno">não entram na conta: complete em “O que falta completar”</span></span>
      <span class="num">{a.semNumero.length}</span>
    </button>
  {/if}
{/if}

<style>
  .voltar {
    margin-bottom: 12px;
  }
  .micros {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 12px;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
    padding: 4px 14px;
    border-radius: 999px;
    border: 2px solid var(--borda);
    background: var(--cartao);
    font-weight: 700;
    cursor: pointer;
  }
  .chip input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }
  .chip.ativo {
    border-color: var(--primaria);
    background: var(--primaria-clara);
  }
  .destaque {
    border: 2px solid var(--primaria);
  }
  .proximo {
    font-size: 1.15rem;
    margin: 0 0 8px;
  }
  .proximo strong {
    font-size: 1.6rem;
    color: var(--primaria);
  }
  .resumo {
    margin: 0;
    padding-left: 20px;
  }
  .resumo li {
    margin-bottom: 4px;
  }
  .alerta-cartao {
    border: 2px solid var(--perigo);
  }
  .numeros {
    font-size: 1.05rem;
    font-weight: 700;
    line-height: 1.6;
    word-spacing: 2px;
    font-variant-numeric: tabular-nums;
  }
  details {
    margin-top: 16px;
  }
  h3 {
    font-size: 1rem;
    margin: 16px 0 4px;
  }
  textarea {
    width: 100%;
    font-size: 1.05rem;
  }
  .sem-numero {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
  }
  .num {
    min-width: 44px;
    padding: 4px 10px;
    border-radius: 999px;
    background: var(--aviso-fundo);
    color: var(--aviso-texto);
    font-weight: 800;
    text-align: center;
  }
</style>
