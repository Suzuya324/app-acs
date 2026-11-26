<script lang="ts">
  // Trazer VDs de um texto colado ou de um arquivo .txt (ex.: lista de visitas copiada da administração do SBCD).
  import Icone from '../componentes/Icone.svelte';
  import { formatarData } from '../lib/datas';
  import { app, enderecoCurto, mostrarAviso, trazerVdsDoTexto } from '../lib/estado.svelte';
  import { decodificar } from '../lib/importar-csv';
  import { lerVdsDoTexto, type LeituraVds } from '../lib/importar-vds-texto';
  import { ir, voltar } from '../lib/rotas.svelte';

  let texto = $state('');
  let r = $state<LeituraVds | null>(null);
  let jaLancadas = $state(true);
  let marcarAsQueJaEstavam = $state(true);
  let salvando = $state(false);
  let pronto = $state(0);

  async function lerArquivo(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const arq = input.files?.[0];
    input.value = '';
    if (!arq) return;
    texto = decodificar(new Uint8Array(await arq.arrayBuffer()));
    conferir();
  }
  function conferir() {
    r = lerVdsDoTexto(texto, $state.snapshot(app.familias), $state.snapshot(app.visitas), app.config.motivos, app.config.motivoPadrao);
    pronto = 0;
  }
  const jaNaoLancadas = $derived(r ? r.jaEstavam.filter((x) => !app.visitas.find((v) => v.id === x.visita.id)?.lancadaNoFast) : []);
  async function salvar() {
    if (!r) return;
    salvando = true;
    try {
      const marcar = marcarAsQueJaEstavam ? jaNaoLancadas.map((x) => x.visita.id) : [];
      await trazerVdsDoTexto($state.snapshot(r.novas) as LeituraVds['novas'], jaLancadas, marcar);
      pronto = r.novas.length;
      mostrarAviso(`${r.novas.length} ${r.novas.length === 1 ? 'VD trazida' : 'VDs trazidas'} ✓`, 4000);
      r = null;
      texto = '';
    } finally {
      salvando = false;
    }
  }
  const nomeDesf = (d: keyof typeof app.config.nomesDesfecho) => app.config.nomesDesfecho[d];
</script>

<button class="botao secundario pequeno voltar" onclick={() => voltar('ajustes')}><Icone nome="voltar" /> Voltar</button>

<h1>Trazer VDs de um texto</h1>
<p class="suave">
  Copie a lista das suas visitas (por exemplo, da administração do SBCD) e cole aqui, ou escolha um arquivo .txt. O app
  procura em cada linha a data, a casa (prontuário, nome de alguém da casa ou rua e número), o desfecho e o motivo.
  Nada é salvo antes de você conferir.
</p>

{#if pronto}
  <section class="cartao ok-cartao">
    <p><strong>Pronto!</strong> {pronto} {pronto === 1 ? 'VD entrou' : 'VDs entraram'} no app. Elas já contam na meta e aparecem em Minhas VDs.</p>
    <button class="botao" onclick={() => ir('minhas-vds')}>Ver em Minhas VDs</button>
  </section>
{/if}

<label class="campo">
  <span>Cole o texto aqui</span>
  <textarea rows="8" bind:value={texto} placeholder={'Ex.:\n03/11/2026  0000.04.015  FULANA DE TAL  Visita realizada\n04/11/2026  RUA DAS ACÁCIAS, 30  Ausência'}></textarea>
</label>
<div class="botoes">
  <button class="botao" disabled={!texto.trim()} onclick={conferir}>Conferir</button>
  <label class="botao secundario arquivo">
    Escolher arquivo .txt
    <input type="file" accept=".txt,.csv,text/plain" onchange={lerArquivo} />
  </label>
</div>

{#if r}
  <section class="cartao destaque">
    <ul class="resumo">
      <li><strong>{r.novas.length}</strong> {r.novas.length === 1 ? 'VD nova' : 'VDs novas'} (vão entrar no app)</li>
      <li><strong>{r.jaEstavam.length}</strong> já {r.jaEstavam.length === 1 ? 'estava' : 'estavam'} no app (mesma casa, mesmo dia: não repete)</li>
      {#if r.repetidasNoTexto}<li><strong>{r.repetidasNoTexto}</strong> {r.repetidasNoTexto === 1 ? 'vinha repetida' : 'vinham repetidas'} no texto (fica uma só)</li>{/if}
      {#if r.naoReconhecidas.length}<li class="ruim"><strong>{r.naoReconhecidas.length}</strong> {r.naoReconhecidas.length === 1 ? 'linha' : 'linhas'} sem casa reconhecida (veja abaixo)</li>{/if}
    </ul>
    {#if r.novas.length}
      <label class="opcao"><input type="checkbox" bind:checked={jaLancadas} /> <span>Essas VDs já estão no sistema oficial (entram como <strong>lançadas</strong>, fora da fila do Fast)</span></label>
    {/if}
    {#if jaNaoLancadas.length}
      <label class="opcao"><input type="checkbox" bind:checked={marcarAsQueJaEstavam} /> <span>Marcar como lançadas as {jaNaoLancadas.length} que já estavam no app e ainda estavam na fila</span></label>
    {/if}
    {#if r.novas.length || (marcarAsQueJaEstavam && jaNaoLancadas.length)}
      <button class="botao largo" disabled={salvando} onclick={salvar}>{salvando ? 'Salvando…' : `Salvar ${r.novas.length} ${r.novas.length === 1 ? 'VD' : 'VDs'}`}</button>
    {/if}
  </section>

  {#if r.novas.length}
    <section class="cartao">
      <h2>VDs novas ({r.novas.length})</h2>
      <ul class="lista">
        {#each r.novas as v, i (i)}
          <li>
            <strong>{formatarData(v.data)}</strong> · {enderecoCurto(v.familia)}
            <span class="suave pequeno"> · {nomeDesf(v.desfecho)}{v.motivo !== app.config.motivoPadrao ? ` · ${v.motivo}` : ''}{v.presentes.length ? ` · ${v.presentes.length} ${v.presentes.length === 1 ? 'pessoa' : 'pessoas'}` : ''}</span>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  {#if r.naoReconhecidas.length}
    <section class="cartao">
      <details open={r.naoReconhecidas.length <= 10}>
        <summary><strong>Linhas sem casa reconhecida ({r.naoReconhecidas.length})</strong></summary>
        <p class="suave pequeno">O app não achou a casa pelo prontuário, pelo nome nem pela rua e número. Registre essas VDs pela busca, se forem suas.</p>
        {#each r.naoReconhecidas as l, i (i)}<p class="pequeno linha">{l}</p>{/each}
      </details>
    </section>
  {/if}
{/if}

<style>
  .voltar {
    margin-bottom: 12px;
  }
  .botoes {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 8px 0 12px;
  }
  .arquivo {
    position: relative;
    overflow: hidden;
  }
  .arquivo input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }
  .resumo {
    margin: 0 0 8px;
    padding-left: 18px;
  }
  .ruim {
    color: var(--perigo);
  }
  .opcao {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    margin: 8px 0;
  }
  .opcao input {
    width: 22px;
    height: 22px;
    flex: 0 0 auto;
  }
  .lista {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .lista li,
  .linha {
    border-top: 1px solid var(--borda);
    padding: 5px 0;
    margin: 0;
    overflow-wrap: anywhere;
  }
  .ok-cartao {
    border-left: 6px solid var(--realizada);
  }
</style>
