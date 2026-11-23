<script lang="ts">
  import Icone from '../componentes/Icone.svelte';
  import { periodoDe, periodoVizinho } from '../lib/calendario';
  import { conferirComFast, efeitosDaConferencia, lerListaFast, type Conferencia } from '../lib/conferir-fast';
  import { diferencaDias, formatarData, hojeISO } from '../lib/datas';
  import { app, enderecoCurto, familiaPorId, guardarConferenciaFast, marcarLancada, mostrarAviso, presentesDaVisita } from '../lib/estado.svelte';
  import { ir, voltar } from '../lib/rotas.svelte';
  import type { Visita } from '../lib/tipos';

  const hoje = hojeISO();
  let referencia = $state(hoje);
  const periodo = $derived(periodoDe(referencia, app.config.diaInicioPeriodo));
  let colado = $state('');
  let r = $state<Conferencia | null>(null);
  let lidas = $state(0);

  let guardada = $state(false);
  function conferir() {
    const linhas = lerListaFast(colado);
    lidas = linhas.filter((l) => l.data || l.pront).length;
    r = conferirComFast(linhas, $state.snapshot(app.familias), $state.snapshot(app.visitas), periodo.inicio, periodo.fim);
    guardada = false;
  }
  /** Guarda o que estava no Fast hoje: na próxima conferência o app aponta qual VD sumiu de lá e desde quando. */
  async function guardar() {
    if (!r) return;
    const e = efeitosDaConferencia(r);
    await guardarConferenciaFast(e.vistas, e.sumiram, hoje);
    guardada = true;
    mostrarAviso(`Conferência guardada ✓ ${e.vistas.length} ${e.vistas.length === 1 ? 'VD vista' : 'VDs vistas'} no Fast${e.sumiram.length ? `, ${e.sumiram.length} ${e.sumiram.length === 1 ? 'sumiu' : 'sumiram'}` : ''}.`, 4000);
  }
  const ultima = $derived(app.config.ultimaConferenciaFast);
  const atual = (id: string) => app.visitas.find((x) => x.id === id);
  const naoMarcadas = $derived(r ? r.achadas.filter((a) => !app.visitas.find((v) => v.id === a.visita.id)?.lancadaNoFast) : []);
  // O Fast perdeu: a VD estava marcada como lançada, mas não está na lista colada. Volta para a fila para relançar.
  const sumiram = $derived(r ? r.sumiram.filter((v) => app.visitas.find((x) => x.id === v.id)?.lancadaNoFast) : []);
  const faltouLancar = $derived(r ? r.faltando.filter((v) => !atual(v.id)?.lancadaNoFast && !r!.sumiramDoFast.some((x) => x.id === v.id)) : []);
  const sumiramDoFast = $derived(r ? r.sumiramDoFast.filter((v) => atual(v.id)?.lancadaNoFast) : []);
  async function voltarParaFila(ids: string[]) {
    for (const id of ids) await marcarLancada(id, false);
    mostrarAviso(`${ids.length} ${ids.length === 1 ? 'VD voltou' : 'VDs voltaram'} para a fila do Fast ✓ Lance de novo.`, 4000);
  }
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

{#if ultima}
  <p class="pequeno ultima-conf">Última conferência guardada: <strong>{formatarData(ultima)}</strong>{diferencaDias(ultima, hoje) > 0 ? ` (há ${diferencaDias(ultima, hoje)} ${diferencaDias(ultima, hoje) === 1 ? 'dia' : 'dias'})` : ' (hoje)'}</p>
{:else}
  <p class="pequeno ultima-conf">Dica: confira e toque em <strong>“Guardar a conferência”</strong> uma vez por semana. Assim o app fica sabendo quais VDs estavam no Fast e avisa <strong>qual sumiu</strong> e desde quando.</p>
{/if}

<label class="campo">
  <span>Cole a lista do Fast</span>
  <textarea rows="7" bind:value={colado} placeholder="Ex.: 03/11/2026  3513.04.015  FULANA DE TAL  Visita realizada"></textarea>
</label>
<button class="botao largo" disabled={!colado.trim()} onclick={conferir}>Conferir</button>

{#if r}
  <section class="cartao destaque">
    <p>Li <strong>{lidas}</strong> {lidas === 1 ? 'linha' : 'linhas'}. <strong>{r.achadas.length}</strong> {r.achadas.length === 1 ? 'VD bate' : 'VDs batem'} com o app.</p>
    <ul class="resumo">
      {#if r.sumiramDoFast.length}<li class="ruim"><strong>{r.sumiramDoFast.length}</strong> {r.sumiramDoFast.length === 1 ? 'sumiu' : 'sumiram'} do Fast (já {r.sumiramDoFast.length === 1 ? 'esteve' : 'estiveram'} lá)</li>{/if}
      {#if r.sumiram.length}<li class="ruim"><strong>{r.sumiram.length}</strong> {r.sumiram.length === 1 ? 'marcada' : 'marcadas'} como lançada{r.sumiram.length === 1 ? '' : 's'} e não {r.sumiram.length === 1 ? 'está' : 'estão'} no Fast</li>{/if}
      <li class:ruim={faltouLancar.length > 0}><strong>{faltouLancar.length}</strong> no app e ainda não lançadas</li>
      <li class:ruim={r.repetidas.length > 0}><strong>{r.repetidas.length}</strong> lançadas mais de uma vez</li>
      <li><strong>{r.soNoFast.length}</strong> no Fast e não no app (ou o app não reconheceu a casa)</li>
    </ul>
    {#if r.cobertura.de !== periodo.inicio || r.cobertura.ate !== periodo.fim}
      <p class="pequeno suave">A lista colada vai de {formatarData(r.cobertura.de)} a {formatarData(r.cobertura.ate)}: VDs lançadas fora dessas datas não foram conferidas.</p>
    {/if}
    {#if naoMarcadas.length}
      <button class="botao" onclick={marcarTodas}>Marcar {naoMarcadas.length} como lançadas no app</button>
    {/if}
    {#if !guardada}
      <button class="botao largo guardar" onclick={guardar}>✓ Guardar a conferência</button>
      <p class="pequeno suave">O app anota que estas {r.achadas.length} VDs estavam no Fast hoje. Se alguma sumir depois, a próxima conferência mostra qual e desde quando. Só guarde se colou a lista inteira do período.</p>
    {:else}
      <p class="pequeno ok-fila">✓ Conferência guardada hoje.</p>
    {/if}
  </section>

  {#if r.sumiramDoFast.length}
    <section class="cartao perdidas">
      <h2>🚨 Sumiram do Fast ({r.sumiramDoFast.length})</h2>
      <p class="pequeno">Estas VDs <strong>já apareceram no Fast</strong> numa conferência anterior e agora não estão mais lá. Volte para a fila e lance de novo. Os dados completos estão em “Minhas VDs”.</p>
      <ul class="lista">
        {#each r.sumiramDoFast as v (v.id)}
          {@const naFila = !atual(v.id)?.lancadaNoFast}
          {@const sumiu = atual(v.id)?.sumiuDoFastEm ?? v.sumiuDoFastEm}
          <li class="perdida">
            <button class="item-link" onclick={() => ir(`familia/${v.familiaId}`)}>
              <strong>{formatarData(v.data)}</strong> · {quem(v)} <span class="suave pequeno">({DESF[v.desfecho]})</span><br />
              <span class="pequeno">Estava no Fast em {formatarData(v.vistaNoFastEm!)}{sumiu ? `; sumiu em ${formatarData(sumiu)}` : ''}</span>
            </button>
            {#if naFila}<span class="pequeno ok-fila">✓ na fila</span>{:else}<button class="botao secundario pequeno" onclick={() => voltarParaFila([v.id])}>Voltar para a fila</button>{/if}
          </li>
        {/each}
      </ul>
      {#if sumiramDoFast.length > 1}
        <button class="botao largo" onclick={() => voltarParaFila(sumiramDoFast.map((v) => v.id))}>Voltar as {sumiramDoFast.length} para a fila do Fast</button>
      {/if}
    </section>
  {/if}

  {#if r.sumiram.length}
    <section class="cartao perdidas">
      <h2>⚠️ Marcadas como lançadas, mas não estão no Fast ({r.sumiram.length})</h2>
      <p class="pequeno">Você marcou como lançadas no app, mas não estão na lista que você colou: o Fast perdeu, ou o lançamento não chegou a salvar. Confira no Fast e, se não estiverem lá, volte para a fila e lance de novo.</p>
      <ul class="lista">
        {#each r.sumiram as v (v.id)}
          {@const naFila = !app.visitas.find((x) => x.id === v.id)?.lancadaNoFast}
          <li class="perdida">
            <button class="item-link" onclick={() => ir(`familia/${v.familiaId}`)}><strong>{formatarData(v.data)}</strong> · {quem(v)} <span class="suave pequeno">({DESF[v.desfecho]})</span></button>
            {#if naFila}<span class="pequeno ok-fila">✓ na fila</span>{:else}<button class="botao secundario pequeno" onclick={() => voltarParaFila([v.id])}>Voltar para a fila</button>{/if}
          </li>
        {/each}
      </ul>
      {#if sumiram.length > 1}
        <button class="botao largo" onclick={() => voltarParaFila(sumiram.map((v) => v.id))}>Voltar as {sumiram.length} para a fila do Fast</button>
      {/if}
    </section>
  {/if}

  {#if faltouLancar.length}
    <section class="cartao">
      <h2>Faltou lançar? ({faltouLancar.length})</h2>
      <ul class="lista">
        {#each faltouLancar as v (v.id)}
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
  .perdidas {
    border-left: 6px solid var(--perigo);
  }
  .perdida {
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
    border-top: 1px solid var(--borda);
    padding: 4px 0;
  }
  .ultima-conf {
    margin: 4px 0 10px;
  }
  .guardar {
    margin-top: 10px;
  }
  .ok-fila {
    color: var(--realizada);
    font-weight: 700;
    white-space: nowrap;
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
