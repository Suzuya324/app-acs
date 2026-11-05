<script lang="ts">
  import Icone from '../componentes/Icone.svelte';
  import { periodoDe } from '../lib/calendario';
  import { hojeISO } from '../lib/datas';
  import { app, responsavel } from '../lib/estado.svelte';
  import { coresDoMapa, NOMES_COR, ORDEM_COR, ordenarPorColmeia, type CorCasa } from '../lib/mapa';
  import { agruparPorRua } from '../lib/roteiro';
  import { ir, voltar } from '../lib/rotas.svelte';

  const SIMBOLO: Record<CorCasa, string> = { conta: '✓', marcada: '↻', revisitar: '!', falta: '', fora: '–' };

  const periodo = $derived(periodoDe(hojeISO(), app.config.diaInicioPeriodo));
  const cores = $derived(coresDoMapa(app.familias, app.visitas, app.revisitas ?? [], periodo));
  const temColmeia = $derived(app.familias.some((f) => /\d/.test(f.colmeia)));
  let ordem = $state<'numero' | 'colmeia'>('numero');
  let destaque = $state<CorCasa | null>(null);
  const ruas = $derived(
    agruparPorRua(app.familias, app.config.ruas).map((g) => ({
      ...g,
      familias: ordem === 'colmeia' ? ordenarPorColmeia(g.familias) : g.familias,
    })),
  );
  const contagem = $derived(ORDEM_COR.map((c) => ({ cor: c, n: [...cores.values()].filter((x) => x === c).length })));
</script>

<button class="botao secundario pequeno voltar" onclick={() => voltar('')}><Icone nome="voltar" /> Voltar</button>

<h1>Mapa da área</h1>
<p class="suave">Cada quadrado é uma família, na ordem da rua. Cores de <strong>{periodo.rotulo}</strong>. Toque para abrir.</p>

<div class="legenda" role="group" aria-label="Legenda (toque para destacar)">
  {#each contagem as c (c.cor)}
    <button class="chip" class:ativo={destaque === c.cor} aria-pressed={destaque === c.cor} onclick={() => (destaque = destaque === c.cor ? null : c.cor)}>
      <span class="amostra {c.cor}">{SIMBOLO[c.cor]}</span>
      {NOMES_COR[c.cor]} <strong>{c.n}</strong>
    </button>
  {/each}
</div>

{#if temColmeia}
  <div class="ordem" role="radiogroup" aria-label="Ordem das casas">
    <label><input type="radio" bind:group={ordem} value="numero" /> Número da casa</label>
    <label><input type="radio" bind:group={ordem} value="colmeia" /> Colmeia</label>
  </div>
{:else}
  <p class="suave pequeno">Dica: preencha o número da colmeia (Editar família) para ver também na ordem da colmeia.</p>
{/if}

{#each ruas as g (g.rua)}
  {@const contam = g.familias.filter((f) => cores.get(f.id) === 'conta').length}
  {@const ativas = g.familias.filter((f) => cores.get(f.id) !== 'fora').length}
  <section class="cartao">
    <h2>{g.rua} <span class="suave pequeno">· {contam} de {ativas} contaram</span></h2>
    <div class="grade">
      {#each g.familias as f (f.id)}
        {@const cor = cores.get(f.id) ?? 'falta'}
        <button
          class="casa {cor}"
          class:apagada={destaque !== null && destaque !== cor}
          aria-label="{f.numero}{f.complemento ? ` ${f.complemento}` : ''}: {NOMES_COR[cor]}, {responsavel(f)}"
          onclick={() => ir(`familia/${f.id}`)}
        >
          {#if ordem === 'colmeia'}
            <span class="num">{f.colmeia || '?'}</span><span class="comp">nº {f.numero}</span>
          {:else}
            <span class="num">{f.numero}</span>{#if f.complemento}<span class="comp">{f.complemento}</span>{/if}
          {/if}
          {#if SIMBOLO[cor]}<span class="simbolo" aria-hidden="true">{SIMBOLO[cor]}</span>{/if}
        </button>
      {/each}
    </div>
  </section>
{/each}

<style>
  .voltar {
    margin-bottom: 12px;
  }
  .legenda {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 10px;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    padding: 4px 12px 4px 6px;
    border-radius: 999px;
    border: 2px solid var(--borda);
    background: var(--cartao);
    color: var(--texto);
    font-size: 0.9rem;
    cursor: pointer;
  }
  .chip.ativo {
    border-color: var(--primaria);
    background: var(--primaria-clara);
  }
  .amostra {
    display: inline-grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border-radius: 8px;
    font-weight: 800;
  }
  .ordem {
    display: flex;
    gap: 18px;
    margin: 4px 0 12px;
  }
  .ordem label {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
  }
  .ordem input {
    width: 22px;
    height: 22px;
    accent-color: var(--primaria);
  }
  h2 {
    font-size: 1.05rem;
  }
  .grade {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(58px, 1fr));
    gap: 6px;
  }
  .casa {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 54px;
    padding: 4px 2px;
    border-radius: 10px;
    font-weight: 800;
    font-size: 1rem;
    line-height: 1.1;
    cursor: pointer;
    overflow: hidden;
    transition: opacity 0.2s;
  }
  .comp {
    font-size: 0.65rem;
    font-weight: 600;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .simbolo {
    position: absolute;
    top: 1px;
    right: 4px;
    font-size: 0.75rem;
  }
  .apagada {
    opacity: 0.2;
  }
  .conta {
    background: var(--realizada);
    color: var(--cartao);
    border: 2px solid var(--realizada);
  }
  .marcada {
    background: var(--ausente-realizada);
    color: var(--cartao);
    border: 2px solid var(--ausente-realizada);
  }
  .revisitar {
    background: var(--ausencia);
    color: var(--cartao);
    border: 2px solid var(--ausencia);
  }
  .falta {
    background: var(--cartao);
    color: var(--texto);
    border: 2px solid var(--texto-suave);
  }
  .fora {
    background: repeating-linear-gradient(45deg, var(--fundo), var(--fundo) 5px, var(--borda) 5px, var(--borda) 7px);
    color: var(--texto-suave);
    border: 2px dashed var(--borda);
  }
</style>
