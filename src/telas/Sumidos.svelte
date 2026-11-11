<script lang="ts">
  import Icone from '../componentes/Icone.svelte';
  import { formatarData, hojeISO } from '../lib/datas';
  import { sumidos } from '../lib/dia';
  import { app, enderecoCurto, responsavel } from '../lib/estado.svelte';
  import { ir, voltar } from '../lib/rotas.svelte';

  const hoje = hojeISO();
  let dias = $state(60);
  const lista = $derived(sumidos(app.familias, app.visitas, hoje, dias));
  const nunca = $derived(lista.filter((s) => s.dias === null).length);
</script>

<button class="botao secundario pequeno voltar" onclick={() => voltar('')}><Icone nome="voltar" /> Voltar</button>

<h1>Quem está sumido</h1>
<p class="suave">Casas habitadas sem VD que conta (no app ou trazida de fora) há muito tempo. A mais esquecida primeiro.</p>

<div class="chips" role="tablist" aria-label="Há quanto tempo">
  {#each [60, 90, 180] as d (d)}
    <button class="chip" class:ativo={dias === d} role="tab" aria-selected={dias === d} onclick={() => (dias = d)}>{d}+ dias</button>
  {/each}
</div>

<p><strong>{lista.length}</strong> {lista.length === 1 ? 'casa' : 'casas'}{nunca ? ` (${nunca} sem nenhuma VD registrada)` : ''}.</p>

<ul class="lista">
  {#each lista as s (s.familia.id)}
    <li class="cartao item">
      <button class="topo" onclick={() => ir(`familia/${s.familia.id}`)}>
        <strong>{enderecoCurto(s.familia)}</strong>
        <span class="suave pequeno">{responsavel(s.familia)} · {s.ultima ? `última VD ${formatarData(s.ultima)} (há ${s.dias} dias)` : 'nenhuma VD registrada'}</span>
      </button>
      <button class="botao pequeno" onclick={() => ir(`vd/${s.familia.id}`)}><Icone nome="mais" tamanho={18} /> Registrar VD</button>
    </li>
  {/each}
</ul>

<style>
  .voltar {
    margin-bottom: 12px;
  }
  .chips {
    display: flex;
    gap: 8px;
    margin: 8px 0;
  }
  .chip {
    min-height: 44px;
    padding: 6px 12px;
    border-radius: 999px;
    border: 2px solid var(--borda);
    background: var(--cartao);
    color: var(--texto);
    font-weight: 700;
    cursor: pointer;
  }
  .chip.ativo {
    border-color: var(--primaria);
    background: var(--primaria-clara);
  }
  .lista {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .item {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .topo {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    background: none;
    border: 0;
    padding: 0;
    text-align: left;
    color: var(--texto);
    font: inherit;
    cursor: pointer;
  }
</style>
