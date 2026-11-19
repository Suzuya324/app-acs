<script lang="ts">
  import { onMount } from 'svelte';
  import AusenciaRapida from '../componentes/AusenciaRapida.svelte';
  import Icone from '../componentes/Icone.svelte';
  import { buscar, grupoDaBusca } from '../lib/busca';
  import { contaParaMeta } from '../lib/desfecho';
  import { dentroDoPeriodo, periodoDe } from '../lib/calendario';
  import { formatarData, hojeISO } from '../lib/datas';
  import { app, enderecoCurto, responsavel } from '../lib/estado.svelte';
  import { NOMES_GRUPO, NOMES_SITUACAO_CASA, NOMES_SITUACAO_MORADOR } from '../lib/rotulos';
  import { ir } from '../lib/rotas.svelte';

  let campo: HTMLInputElement;
  onMount(() => {
    if (!app.busca) campo.focus();
  });

  const resultados = $derived(buscar(app.familias, app.busca));
  const prioridadeA = $derived(new Set(app.prioritarios.filter((p) => p.nivel === 'A' && p.familiaId).map((p) => p.familiaId)));
  const grupo = $derived(grupoDaBusca(app.busca));
  const noGrupo = $derived(resultados.filter((r) => r.motivo === 'grupo').reduce((n, r) => n + r.moradores.length, 0));
  const ruas = $derived([...new Set([...app.config.ruas, ...app.familias.map((f) => f.rua)])]);
  const periodo = $derived(periodoDe(hojeISO(), app.config.diaInicioPeriodo));
  const visitadasNoMes = $derived(
    new Set(app.visitas.filter((v) => dentroDoPeriodo(v.data, periodo) && contaParaMeta(v.desfecho)).map((v) => v.familiaId)),
  );
  /** Última VD de cada casa (para saber na hora se já foi e quando). */
  const ultimaVD = $derived.by(() => {
    const m = new Map<string, { data: string; desfecho: string }>();
    for (const v of app.visitas) {
      const u = m.get(v.familiaId);
      if (!u || v.data > u.data) m.set(v.familiaId, { data: v.data, desfecho: app.config.nomesDesfecho[v.desfecho] });
    }
    return m;
  });
  /** As casas das últimas VDs (com a busca vazia), para abrir de novo rápido. */
  const recentes = $derived.by(() => {
    const vistas: string[] = [];
    for (const v of [...app.visitas].sort((a, b) => b.data.localeCompare(a.data) || (b.criadaEm ?? '').localeCompare(a.criadaEm ?? ''))) {
      if (!vistas.includes(v.familiaId)) vistas.push(v.familiaId);
      if (vistas.length >= 6) break;
    }
    return vistas.map((id) => app.familias.find((f) => f.id === id)).filter((f) => !!f);
  });
  const MOTIVO: Record<string, string> = { telefone: 'pelo telefone', referencia: 'pelo ponto de referência', nascimento: 'pela data de nascimento', prontuario: 'pelo prontuário' };
</script>

<h1>Buscar família</h1>

<div class="caixa-busca">
  <Icone nome="busca" />
  <input
    bind:this={campo}
    type="search"
    bind:value={app.busca}
    placeholder="Ex.: Acácias 90, Joana, 00.0012, gestante"
    aria-label="Buscar por nome, rua e número ou prontuário"
    autocomplete="off"
    autocapitalize="none"
    enterkeyhint="search"
  />
</div>

<button class="botao secundario largo nova" onclick={() => ir('nova-familia')}><Icone nome="mais" /> Nova família</button>

{#if !app.busca.trim()}
  <p class="suave">
    Digite um <strong>nome</strong> (pode errar uma letra), a <strong>rua + número</strong> (pode abreviar, ex.: “ac 90”, “ac 30 casa 2”),
    o <strong>prontuário</strong>, o <strong>telefone</strong>, a <strong>data de nascimento</strong> (“10/03/1950”), o <strong>ponto de referência</strong>
    ou um <strong>grupo</strong> (“gestante”, “acamado”, “hipertenso”).
  </p>
  {#if recentes.length}
    <h2>Visitadas por último</h2>
    <ul class="lista recentes">
      {#each recentes as f (f.id)}
        <li>
          <button class="item-link" onclick={() => ir(`familia/${f.id}`)}>
            <strong>{enderecoCurto(f)}</strong>
            <span class="suave pequeno"> · {responsavel(f)}{ultimaVD.get(f.id) ? ` · ${formatarData(ultimaVD.get(f.id)!.data).slice(0, 5)}` : ''}</span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
  <h2>Ruas da área</h2>
  {#if app.familias.length === 0}
    <p class="alerta">Ainda não há famílias cadastradas. O importador da sua área (planilha CSV) chega na Etapa 3.</p>
  {/if}
  <ul class="lista">
    {#each ruas as rua (rua)}
      <li>
        <button class="item-link" onclick={() => (app.busca = rua)}>
          <strong>{rua}</strong>
          <span class="suave pequeno"> · {app.familias.filter((f) => f.rua === rua).length} domicílios</span>
        </button>
      </li>
    {/each}
  </ul>
{:else}
  {#if grupo}
    <p class="cartao grupo-achado"><strong>{NOMES_GRUPO[grupo]}:</strong> {noGrupo} {noGrupo === 1 ? 'pessoa' : 'pessoas'} em {resultados.filter((r) => r.motivo === 'grupo').length} famílias</p>
  {/if}
  <p class="suave pequeno" aria-live="polite">
    {resultados.length === 0 ? 'Nada encontrado. Confira a rua e o número, ou digite só o começo do nome.' : resultados.length === 1 ? '1 família encontrada' : `${resultados.length} famílias encontradas`}
    {#if resultados.length && resultados.every((r) => r.parecido)} · escrita parecida: confira se é a casa certa{/if}
  </p>
  <ul class="lista">
    {#each resultados.slice(0, 80) as r (r.familia.id)}
      {@const f = r.familia}
      <li>
        <button class="item-link resultado" onclick={() => ir(`familia/${f.id}`)}>
          <span class="linha1">
            <strong>{enderecoCurto(f)}</strong>
            {#if prioridadeA.has(f.id)}<span class="selo-a">Prioridade A</span>{/if}
            {#if visitadasNoMes.has(f.id)}<span class="visitada" title="Já visitada no mês"><Icone nome="ok" tamanho={18} /> no mês</span>{/if}
          </span>
          <span class="pequeno">
            {#if r.motivo === 'nome' || r.motivo === 'grupo' || r.motivo === 'nascimento'}
              {r.moradores.map((m) => (m.situacao === 'mora' ? m.nome : `${m.nome} (${NOMES_SITUACAO_MORADOR[m.situacao].toLowerCase()})`)).join(', ')}
            {:else}
              {responsavel(f)}
            {/if}
          </span>
          <span class="suave pequeno">
            Pront.: {f.prontuario || '—'} · {f.moradores.filter((m) => m.situacao === 'mora').length} morador(es)
            {#if f.situacaoCasa !== 'habitada'} · casa {NOMES_SITUACAO_CASA[f.situacaoCasa].toLowerCase()}{/if}
          </span>
          <span class="pequeno ultima">
            {#if ultimaVD.get(f.id)}Última VD: <strong>{formatarData(ultimaVD.get(f.id)!.data)}</strong> ({ultimaVD.get(f.id)!.desfecho}){:else}<span class="suave">Sem VD no app</span>{/if}
            {#if MOTIVO[r.motivo]}<span class="motivo"> · achada {MOTIVO[r.motivo]}{r.motivo === 'telefone' && f.telefone ? ` (${f.telefone})` : r.motivo === 'referencia' && f.referencia ? ` (${f.referencia})` : ''}</span>{/if}
            {#if r.parecido}<span class="parecido"> · escrita parecida</span>{/if}
          </span>
        </button>
        {#if resultados.length <= 3 && f.situacaoCasa === 'habitada'}
          <div class="acoes-rapidas">
            <button class="botao pequeno" onclick={() => ir(`vd/${f.id}`)}><Icone nome="mais" tamanho={18} /> Registrar VD</button>
            <AusenciaRapida familia={f} />
          </div>
        {/if}
      </li>
    {/each}
  </ul>
  {#if resultados.length > 80}
    <p class="suave pequeno">Mostrando as 80 primeiras. Digite mais para filtrar.</p>
  {/if}
{/if}

<style>
  .ultima {
    color: var(--texto);
  }
  .motivo {
    color: var(--texto-suave);
  }
  .parecido {
    color: var(--aviso-texto);
    font-weight: 700;
  }
  .recentes {
    margin-bottom: 12px;
  }
  .acoes-rapidas {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 6px 0 4px;
  }
  .selo-a {
    font-size: 0.75rem;
    font-weight: 800;
    padding: 2px 8px;
    border-radius: 6px;
    background: var(--perigo);
    color: var(--cartao);
    white-space: nowrap;
  }
  .grupo-achado {
    border: 2px solid var(--primaria);
    margin-bottom: 8px;
  }
  .caixa-busca {
    position: sticky;
    top: 66px;
    z-index: 4;
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--cartao);
    border: 2px solid var(--primaria);
    border-radius: 14px;
    padding: 0 12px;
    margin-bottom: 12px;
    color: var(--texto-suave);
  }
  .caixa-busca input {
    border: 0;
    outline: none;
    background: transparent;
    min-height: 58px;
    padding: 0;
    font-size: 1.15rem;
    color: var(--texto);
  }
  .caixa-busca:focus-within {
    outline: 3px solid var(--primaria);
    outline-offset: 1px;
  }
  .nova {
    margin-bottom: 12px;
  }
  .resultado {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .linha1 {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    align-items: flex-start;
  }
  .visitada {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    color: var(--realizada);
    font-size: 0.8rem;
    font-weight: 700;
    white-space: nowrap;
  }
</style>
