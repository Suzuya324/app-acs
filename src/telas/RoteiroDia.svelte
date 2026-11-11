<script lang="ts">
  import Icone from '../componentes/Icone.svelte';
  import { formatarData, hojeISO } from '../lib/datas';
  import { emOrdemDeRua, maisImportantes, roteiroDoDia } from '../lib/dia';
  import { app, contextoAcompanhamento, opcoesPainel, responsavel } from '../lib/estado.svelte';
  import { calcularPainel } from '../lib/meta';
  import { ir, voltar } from '../lib/rotas.svelte';

  const hoje = hojeISO();
  let comMeta = $state(false);
  const faltam = $derived(new Set(calcularPainel(app.familias, app.visitas, hoje, app.config.metaMensal, opcoesPainel()).naoVisitadas.map((f) => f.id)));
  const todas = $derived(
    roteiroDoDia(app.familias, app.revisitas, { ...contextoAcompanhamento(), casos: app.casos }, comMeta ? faltam : new Set()),
  );
  /** Quantas casas para hoje (as mais importantes primeiro; 0 = todas). */
  let quantas = $state(15);
  const casas = $derived(maisImportantes(todas, quantas));
  const ruas = $derived(emOrdemDeRua(casas, app.config.ruas));
  let ruaEscolhida = $state<string | null>(null);
  const mostrar = $derived(ruaEscolhida ? ruas.filter((r) => r.rua === ruaEscolhida) : ruas);
  const importantes = $derived(casas.filter((c) => c.peso >= 50).length);
</script>

<button class="botao secundario pequeno voltar" onclick={() => voltar('')}><Icone nome="voltar" /> Voltar</button>

<h1>Roteiro de hoje</h1>
<p class="suave">
  {formatarData(hoje)} · <strong>{casas.length}</strong> {casas.length === 1 ? 'casa' : 'casas'}{importantes ? `, ${importantes} mais importantes (em vermelho)` : ''}.
  Junta: caso urgente, nível A/B vencido, revisita, consulta que passou ou é amanhã, caso parado e quem está sumido. Em ordem de rua.
</p>

<div class="chips" role="radiogroup" aria-label="Quantas casas">
  {#each [10, 15, 20, 0] as n (n)}
    <button class="chip" class:ativo={quantas === n} role="radio" aria-checked={quantas === n} onclick={() => (quantas = n)}>{n ? `${n} casas` : `Todas (${todas.length})`}</button>
  {/each}
</div>
{#if quantas && todas.length > quantas}<p class="suave pequeno">Mostrando as {quantas} mais importantes de {todas.length}. As outras ficam para os próximos dias.</p>{/if}

<label class="opcao">
  <input type="checkbox" bind:checked={comMeta} />
  <span>Incluir as que faltam para a meta do mês</span>
</label>

{#if ruas.length > 1}
  <div class="chips" role="tablist" aria-label="Escolher a rua">
    <button class="chip" class:ativo={!ruaEscolhida} role="tab" aria-selected={!ruaEscolhida} onclick={() => (ruaEscolhida = null)}>Todas <span class="n">{casas.length}</span></button>
    {#each ruas as r (r.rua)}
      <button class="chip" class:ativo={ruaEscolhida === r.rua} role="tab" aria-selected={ruaEscolhida === r.rua} onclick={() => (ruaEscolhida = r.rua)}>{r.rua} <span class="n">{r.casas.length}</span></button>
    {/each}
  </div>
{/if}

{#if !casas.length}
  <p class="cartao suave">Nada urgente para hoje. 👍 Marque “Incluir as que faltam para a meta” para ver as outras.</p>
{/if}

{#each mostrar as r (r.rua)}
  <h2 class="rua">{r.rua} <span class="suave">({r.casas.length})</span></h2>
  <ul class="lista">
    {#each r.casas as c (c.familia.id)}
      <li class="cartao casa" class:alta={c.peso >= 80} class:media={c.peso >= 50 && c.peso < 80}>
        <button class="topo" onclick={() => ir(`familia/${c.familia.id}`)}>
          <strong>{c.familia.numero}{c.familia.complemento ? ` – ${c.familia.complemento}` : ''}</strong>
          <span class="suave pequeno">{responsavel(c.familia)}</span>
        </button>
        <ul class="motivos">
          {#each c.motivos as m, i (i)}<li class:forte={m.peso >= 50}>{m.texto}</li>{/each}
        </ul>
        <button class="botao pequeno" onclick={() => ir(`vd/${c.familia.id}`)}><Icone nome="mais" tamanho={18} /> Registrar VD</button>
      </li>
    {/each}
  </ul>
{/each}

<style>
  .voltar {
    margin-bottom: 12px;
  }
  .opcao {
    display: flex;
    gap: 10px;
    align-items: center;
    margin: 8px 0;
  }
  .opcao input {
    width: 22px;
    height: 22px;
  }
  .chips {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding-bottom: 6px;
    margin: 8px 0;
  }
  .chip {
    flex: 0 0 auto;
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
  .n {
    font-weight: 400;
    opacity: 0.8;
  }
  .rua {
    margin: 16px 0 8px;
  }
  .lista {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .casa {
    margin: 0;
    border-left: 6px solid var(--borda);
  }
  .casa.alta {
    border-left-color: var(--perigo);
  }
  .casa.media {
    border-left-color: var(--ausencia);
  }
  .topo {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    width: 100%;
    background: none;
    border: 0;
    padding: 0;
    text-align: left;
    color: var(--texto);
    font: inherit;
    cursor: pointer;
  }
  .topo strong {
    font-size: 1.15rem;
  }
  .motivos {
    margin: 6px 0 10px;
    padding-left: 18px;
  }
  .motivos li {
    margin: 2px 0;
    overflow-wrap: anywhere;
  }
  .motivos .forte {
    font-weight: 700;
  }
</style>
