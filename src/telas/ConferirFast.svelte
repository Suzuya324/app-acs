<script lang="ts">
  import Icone from '../componentes/Icone.svelte';
  import { periodoDe, periodoVizinho } from '../lib/calendario';
  import { conferirComFast, lerListaFast, type Conferencia } from '../lib/conferir-fast';
  import { formatarData, hojeISO } from '../lib/datas';
  import { app, enderecoCurto, familiaPorId, marcarLancada, mostrarAviso, presentesDaVisita } from '../lib/estado.svelte';
  import { ir, voltar } from '../lib/rotas.svelte';
  import type { Visita } from '../lib/tipos';

  const hoje = hojeISO();
  let referencia = $state(hoje);
  const periodo = $derived(periodoDe(referencia, app.config.diaInicioPeriodo));
  let colado = $state('');
  let r = $state<Conferencia | null>(null);
  let lidas = $state(0);

  function conferir() {
    const linhas = lerListaFast(colado);
    lidas = linhas.filter((l) => l.data || l.pront).length;
    r = conferirComFast(linhas, $state.snapshot(app.familias), $state.snapshot(app.visitas), periodo.inicio, periodo.fim);
  }
  const naoMarcadas = $derived(r ? r.achadas.filter((a) => !app.visitas.find((v) => v.id === a.visita.id)?.lancadaNoFast) : []);
  async function marcarTodas() {
    const ids = naoMarcadas.map((a) => a.visita.id);
    for (const id of ids) await marcarLancada(id, true);
    mostrarAviso(`${ids.length} ${ids.length === 1 ? 'VD marcada' : 'VDs marcadas'} como lançada ✓`);
  }
  const quem = (v: Visita) => {
    const f = familiaPorId(v.familiaId);
    return `${f ? enderecoCurto(f) : '(casa)'}${presentesDaVisita(v).length ? ` · ${presentesDaVisita(v)[0]}` : ''}`;
  };
  const DESF: Record<string, string> = { realizada: 'realizada', ausente_realizada: 'ausente realizada', ausencia_completa: 'ausência', recusa: 'recusa' };
</script>

<button class="botao secundario pequeno voltar" onclick={() => voltar('fila')}><Icone nome="voltar" /> Voltar</button>

<h1>Conferir com o Fast</h1>
<p class="suave">
  No Fast, abra a lista das VDs que você lançou no mês, selecione tudo, copie e cole aqui. O app compara com as VDs dele e
  mostra o que ficou faltando ou foi lançado duas vezes. O app não entra no Fast: só lê o que você colou.
</p>

<div class="navegar">
  <button class="botao secundario pequeno" onclick={() => { referencia = periodoVizinho(periodo, -1, app.config.diaInicioPeriodo).inicio; r = null; }}>‹</button>
  <strong>{periodo.rotulo}</strong>
  <button class="botao secundario pequeno" disabled={periodo.fim >= periodoDe(hoje, app.config.diaInicioPeriodo).fim} onclick={() => { referencia = periodoVizinho(periodo, 1, app.config.diaInicioPeriodo).inicio; r = null; }}>›</button>
</div>

<label class="campo">
  <span>Cole a lista do Fast</span>
  <textarea rows="7" bind:value={colado} placeholder="Ex.: 03/11/2026  3513.04.015  FULANA DE TAL  Visita realizada"></textarea>
</label>
<button class="botao largo" disabled={!colado.trim()} onclick={conferir}>Conferir</button>

{#if r}
  <section class="cartao destaque">
    <p>Li <strong>{lidas}</strong> {lidas === 1 ? 'linha' : 'linhas'}. <strong>{r.achadas.length}</strong> {r.achadas.length === 1 ? 'VD bate' : 'VDs batem'} com o app.</p>
    <ul class="resumo">
      <li class:ruim={r.faltando.length > 0}><strong>{r.faltando.length}</strong> no app e não no Fast (faltou lançar?)</li>
      <li class:ruim={r.repetidas.length > 0}><strong>{r.repetidas.length}</strong> lançadas mais de uma vez</li>
      <li><strong>{r.soNoFast.length}</strong> no Fast e não no app (ou o app não reconheceu a casa)</li>
    </ul>
    {#if naoMarcadas.length}
      <button class="botao" onclick={marcarTodas}>Marcar {naoMarcadas.length} como lançadas no app</button>
    {/if}
  </section>

  {#if r.faltando.length}
    <section class="cartao">
      <h2>Faltou lançar? ({r.faltando.length})</h2>
      <ul class="lista">
        {#each r.faltando as v (v.id)}
          <li><button class="item-link" onclick={() => ir(`familia/${v.familiaId}`)}><strong>{formatarData(v.data)}</strong> · {quem(v)} <span class="suave pequeno">({DESF[v.desfecho]}{v.lancadaNoFast ? ', marcada como lançada no app' : ''})</span></button></li>
        {/each}
      </ul>
    </section>
  {/if}

  {#if r.repetidas.length}
    <section class="cartao">
      <h2>Lançadas duas vezes ({r.repetidas.length})</h2>
      {#each r.repetidas as x (x.visita.id)}
        <div class="item"><p><strong>{formatarData(x.visita.data)}</strong> · {quem(x.visita)}</p>{#each x.linhas as l, i (i)}<p class="pequeno suave">{l.texto}</p>{/each}</div>
      {/each}
    </section>
  {/if}

  {#if r.soNoFast.length}
    <section class="cartao">
      <details>
        <summary><strong>Só no Fast ({r.soNoFast.length})</strong></summary>
        <p class="suave pequeno">VD lançada direto no Fast (sem registro no app), de outro mês, ou casa que o app não reconheceu pelo prontuário ou pelo nome.</p>
        {#each r.soNoFast as l, i (i)}<p class="pequeno linha">{l.texto}</p>{/each}
      </details>
    </section>
  {/if}
{/if}

<style>
  .voltar {
    margin-bottom: 12px;
  }
  .navegar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin: 8px 0;
  }
  .resumo {
    margin: 6px 0 10px;
    padding-left: 18px;
  }
  .ruim {
    color: var(--perigo);
  }
  .lista {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .item {
    border-top: 1px solid var(--borda);
    padding: 6px 0;
  }
  .item p,
  .linha {
    margin: 2px 0;
    overflow-wrap: anywhere;
  }
</style>
