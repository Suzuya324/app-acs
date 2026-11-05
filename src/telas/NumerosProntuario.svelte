<script lang="ts">
  import Icone from '../componentes/Icone.svelte';
  import { app, enderecoCurto, mostrarAviso, responsavel, salvarConfig, tirarFamiliasDaArea } from '../lib/estado.svelte';
  import { analisarNumeros, emIntervalos, escreverProntuario, lerNumeros, microPrincipal, microsEncontradas, numerosDaMicro, partesProntuario, proximoLivre } from '../lib/numeros';
  import { decodificar } from '../lib/importar-csv';
  import { ir, voltar } from '../lib/rotas.svelte';

  const micros = $derived(microsEncontradas(app.familias));
  let microEscolhida = $state<string | null>(null);
  const micro = $derived(microEscolhida ?? microPrincipal(app.familias, app.config.micro));
  let textoPastas = $state(app.config.pastasNaColmeia);
  const pastas = $derived(lerNumeros(app.config.pastasNaColmeia));
  const emUsoFast = $derived(app.config.emUsoNoFast?.micro === micro ? lerNumeros(app.config.emUsoNoFast.numeros) : []);
  const a = $derived(analisarNumeros(app.familias, micro, pastas, emUsoFast));

  /** Aviso de algo que não se desfaz (ajuste guardado): tira o botão Desfazer da ação anterior. */
  function avisoSimples(texto: string) {
    app.desfazer = null;
    mostrarAviso(texto);
  }

  // ---- Números em uso no Fast ----
  let textoFast = $state('');
  const lidosFast = $derived(textoFast.trim() ? numerosDaMicro(textoFast, micro) : []);
  async function guardarFast(texto = textoFast) {
    const nums = numerosDaMicro(texto, micro);
    app.config.emUsoNoFast = { micro, numeros: emIntervalos(nums) };
    await salvarConfig();
    textoFast = '';
    avisoSimples(`${nums.length} números em uso na micro ${micro} guardados ✓`);
  }
  async function arquivoFast(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const arq = input.files?.[0];
    input.value = '';
    if (arq) await guardarFast(decodificar(new Uint8Array(await arq.arrayBuffer())));
  }
  async function apagarFast() {
    app.config.emUsoNoFast = { micro: '', numeros: '' };
    await salvarConfig();
  }
  const proximo = $derived(escreverProntuario(micro, proximoLivre(a), a.digitos, a.prefixo));

  // ---- Tirar da área as famílias de outra micro ----
  const porMicro = $derived.by(() => {
    const m = new Map<string, typeof a.outraMicro>();
    for (const f of a.outraMicro) {
      const k = partesProntuario(f.prontuario)?.micro ?? '?';
      m.set(k, [...(m.get(k) ?? []), f]);
    }
    return [...m].sort((x, y) => y[1].length - x[1].length);
  });
  let microsParaTirar = $state<string[]>([]);
  /** Ruas de cada micro, para o ACS ver de onde são as famílias antes de tirar. */
  const ruasDe = (fs: typeof a.outraMicro) => {
    const n = new Map<string, number>();
    for (const f of fs) n.set(f.rua || '(sem rua)', (n.get(f.rua || '(sem rua)') ?? 0) + 1);
    return [...n].sort((x, y) => y[1] - x[1]).map(([r, q]) => `${r} (${q})`).join(', ');
  };
  const paraTirar = $derived(porMicro.filter(([k]) => microsParaTirar.includes(k)).flatMap(([, fs]) => fs));
  let tirando = $state(false);
  async function tirar() {
    const n = paraTirar.length;
    if (!n) return;
    const ok = confirm(
      `Tirar ${n} ${n === 1 ? 'família' : 'famílias'} da sua área?\n\nRuas: ${ruasDe(paraTirar)}\n\nElas vão para a Lixeira (Ajustes → Lixeira), junto com as VDs delas, e saem da meta, do mapa e das sugestões. Dá para restaurar depois.`,
    );
    if (!ok) return;
    tirando = true;
    try {
      await tirarFamiliasDaArea(paraTirar.map((f) => f.id), `prontuário de outra micro`);
      mostrarAviso(`${n} ${n === 1 ? 'família tirada' : 'famílias tiradas'} da área ✓`);
    } finally {
      tirando = false;
    }
  }

  async function guardarPastas() {
    app.config.pastasNaColmeia = textoPastas.trim();
    await salvarConfig();
    avisoSimples(app.config.pastasNaColmeia ? `${lerNumeros(textoPastas).length} pastas guardadas ✓` : 'Pastas apagadas');
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
    {#if a.soNoFast.length}
      <h3>Em uso no Fast, sem família no app ({a.soNoFast.length})</h3>
      <p class="suave pequeno">Não entram como livres. Podem ser da Projetada ou de famílias que não estão no app. Quando o Fast mudar, guarde a lista nova.</p>
      <p class="numeros">{emIntervalos(a.soNoFast)}</p>
    {/if}
    <p class="suave pequeno">
      “Livre” aqui quer dizer: nenhuma família do app usa{emUsoFast.length ? ' e não está na lista do Fast' : ''}. Antes de usar, confira no sistema.
    </p>
  </section>

  <section class="cartao">
    <h2>Números em uso no Fast</h2>
    {#if emUsoFast.length}
      <p>Guardados: <strong>{emUsoFast.length}</strong> números da micro {micro}.</p>
    {:else}
      <p class="suave pequeno">Ainda não guardou. Com a lista do Fast, os livres ficam mais certos.</p>
    {/if}
    <p class="suave pequeno">Escolha o arquivo (TXT, CSV ou JSON) ou cole a lista. O app pega só os números de prontuário da micro {micro}; nomes não são guardados.</p>
    <label class="botao secundario largo arquivo">
      <input type="file" onchange={arquivoFast} />
      Escolher arquivo
    </label>
    <label class="campo">
      <span>Ou cole aqui</span>
      <textarea rows="3" bind:value={textoFast} placeholder="Ex.: 0000.{micro}.001, 0000.{micro}.002…"></textarea>
    </label>
    {#if textoFast.trim()}<p class="suave pequeno">Lidos: {lidosFast.length} números da micro {micro}</p>{/if}
    <div class="linha-botoes">
      {#if emUsoFast.length}<button class="botao secundario pequeno" onclick={apagarFast}>Apagar lista guardada</button>{/if}
      <button class="botao pequeno" disabled={!lidosFast.length} onclick={() => guardarFast()}>Guardar</button>
    </div>
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
    <section class="cartao" id="outra-micro">
      <h2>Com prontuário de outra micro ({a.outraMicro.length})</h2>
      <p class="suave pequeno">
        Famílias do app com número que não é da micro {micro}. Se elas são de outro ACS, tire da sua área para não
        ir nessas casas à toa. Vão para a Lixeira e dá para restaurar.
      </p>
      <p class="alerta pequeno">
        Atenção: uma rua inteira com outra micro pode ser <strong>sua</strong> (no Fast ela pode estar cadastrada em outra
        micro). Olhe o nome da rua antes de marcar.
      </p>
      {#each porMicro as [k, fs] (k)}
        <label class="opcao">
          <input type="checkbox" value={k} bind:group={microsParaTirar} />
          <span>Micro {k}: <strong>{fs.length}</strong> {fs.length === 1 ? 'família' : 'famílias'}<br /><span class="suave pequeno">{ruasDe(fs)}</span></span>
        </label>
      {/each}
      {#if porMicro.some(([, fs]) => fs.length <= 3)}
        <p class="suave pequeno">Micro com poucas famílias pode ser erro de digitação no Fast: confira antes de tirar.</p>
      {/if}
      <button class="botao perigo secundario largo" disabled={!paraTirar.length || tirando} onclick={tirar}>
        Tirar {paraTirar.length} {paraTirar.length === 1 ? 'família' : 'famílias'} da minha área
      </button>
      <details>
        <summary>Ver as famílias</summary>
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
  .arquivo {
    position: relative;
    cursor: pointer;
    margin-bottom: 8px;
  }
  .arquivo input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }
  .opcao {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 48px;
    cursor: pointer;
  }
  .opcao input {
    width: 24px;
    height: 24px;
    accent-color: var(--primaria);
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
