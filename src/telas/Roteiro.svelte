<script lang="ts">
  import Icone from '../componentes/Icone.svelte';
  import { diferencaDias, formatarData, hojeISO } from '../lib/datas';
  import { contaParaMeta } from '../lib/desfecho';
  import { app, opcoesPainel, responsavel, revisitasAbertas } from '../lib/estado.svelte';
  import { calcularPainel, familiasAtivas } from '../lib/meta';
  import { agruparPorRua } from '../lib/roteiro';
  import { ir, voltar } from '../lib/rotas.svelte';

  const hoje = hojeISO();
  const painel = $derived(calcularPainel(app.familias, app.visitas, hoje, app.config.metaMensal, opcoesPainel()));
  const naoVisitadas = $derived(new Set(painel.naoVisitadas.map((f) => f.id)));
  const revisitar = $derived(new Set(painel.revisitar.map((r) => r.familia.id)));
  let mostrarVisitadas = $state(false);

  /** Motivos das revisitas marcadas, por família. */
  const marcadas = $derived.by(() => {
    const m = new Map<string, string[]>();
    for (const r of app.revisitas && revisitasAbertas()) m.set(r.familiaId, [...(m.get(r.familiaId) ?? []), r.motivo]);
    return m;
  });
  const grupos = $derived(agruparPorRua(familiasAtivas(app.familias), app.config.ruas));
  let ruaEscolhida = $state<string | null>(null);
  const rua = $derived(ruaEscolhida ?? grupos.find((g) => g.familias.some((f) => naoVisitadas.has(f.id)))?.rua ?? grupos[0]?.rua ?? '');
  const casas = $derived(
    (grupos.find((g) => g.rua === rua)?.familias ?? []).filter(
      (f) => mostrarVisitadas || naoVisitadas.has(f.id) || marcadas.has(f.id),
    ),
  );

  /** Última visita que contou, de cada família. */
  const ultima = $derived.by(() => {
    const m = new Map<string, string>();
    for (const v of app.visitas) {
      if (!contaParaMeta(v.desfecho)) continue;
      const a = m.get(v.familiaId);
      if (!a || v.data > a) m.set(v.familiaId, v.data);
    }
    return m;
  });
  function haQuanto(id: string): string {
    const d = ultima.get(id);
    if (!d) return 'nunca visitada';
    const n = diferencaDias(d, hoje);
    return n === 0 ? 'visitada hoje' : `última visita ${formatarData(d)} (há ${n} dia${n === 1 ? '' : 's'})`;
  }
</script>

<button class="botao secundario pequeno voltar" onclick={() => voltar('')}><Icone nome="voltar" /> Voltar</button>

<h1>Planejar a rua do dia</h1>
<p class="suave">Famílias que ainda não contaram em <strong>{painel.periodo.rotulo}</strong>, na ordem dos números.</p>

<div class="ruas" role="tablist" aria-label="Escolher a rua">
  {#each grupos as g (g.rua)}
    {@const faltam = g.familias.filter((f) => naoVisitadas.has(f.id)).length}
    <button class="rua" class:escolhida={g.rua === rua} role="tab" aria-selected={g.rua === rua} onclick={() => (ruaEscolhida = g.rua)}>
      {g.rua}
      <span class="faltam">{faltam}</span>
    </button>
  {/each}
</div>

<label class="opcao">
  <input type="checkbox" bind:checked={mostrarVisitadas} />
  <span>Mostrar também as já visitadas</span>
</label>

{#if casas.length === 0}
  <p class="cartao ok">✓ Todas as famílias desta rua já contaram no período.</p>
{:else}
  <ul class="lista">
    {#each casas as f (f.id)}
      {@const feita = !naoVisitadas.has(f.id)}
      <li>
        <button class="item-link casa" class:feita onclick={() => ir(`familia/${f.id}`)}>
          <span class="numero">{f.numero}{#if f.complemento}<span class="comp"> {f.complemento}</span>{/if}</span>
          <span class="texto">
            <strong>{responsavel(f)}</strong>
            <span class="suave pequeno">{haQuanto(f.id)}</span>
            {#if marcadas.has(f.id)}<span class="marcada">revisita: {marcadas.get(f.id)!.join('; ')}</span>{/if}
            {#if revisitar.has(f.id)}<span class="revisitar">revisitar: ninguém em casa na última tentativa</span>{/if}
            {#if feita}<span class="feito">✓ já contou no período</span>{/if}
          </span>
        </button>
      </li>
    {/each}
  </ul>
{/if}

<style>
  .voltar {
    margin-bottom: 12px;
  }
  .ruas {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding-bottom: 6px;
    margin-bottom: 6px;
  }
  .rua {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 48px;
    padding: 6px 14px;
    border-radius: 999px;
    border: 2px solid var(--borda);
    background: var(--cartao);
    font-weight: 700;
    cursor: pointer;
  }
  .rua.escolhida {
    border-color: var(--primaria);
    background: var(--primaria-clara);
  }
  .faltam {
    min-width: 28px;
    padding: 0 8px;
    border-radius: 999px;
    background: var(--aviso-fundo);
    color: var(--aviso-texto);
    font-size: 0.85rem;
  }
  .opcao {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 52px;
    cursor: pointer;
  }
  .opcao input {
    width: 26px;
    height: 26px;
    accent-color: var(--primaria);
  }
  .casa {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .casa.feita {
    opacity: 0.6;
  }
  .numero {
    flex: 0 0 72px;
    font-size: 1.4rem;
    font-weight: 800;
    color: var(--primaria);
    line-height: 1.1;
  }
  .comp {
    display: block;
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--texto-suave);
  }
  .texto {
    display: flex;
    flex-direction: column;
  }
  .marcada {
    color: var(--primaria);
    font-weight: 700;
    font-size: 0.85rem;
  }
  .revisitar {
    color: var(--ausencia);
    font-weight: 700;
    font-size: 0.85rem;
  }
  .feito {
    color: var(--realizada);
    font-weight: 700;
    font-size: 0.85rem;
  }
  .ok {
    color: var(--realizada);
    font-weight: 700;
  }
</style>
