<script lang="ts">
  import { untrack } from 'svelte';
  import Etiqueta from '../componentes/Etiqueta.svelte';
  import Icone from '../componentes/Icone.svelte';
  import { formatarData } from '../lib/datas';
  import { app, mostrarAviso, salvarPrioritario } from '../lib/estado.svelte';
  import { ETIQUETAS, type NivelPrio, type Prioritario } from '../lib/prioritarios';
  import { trocarPara, voltar } from '../lib/rotas.svelte';

  let { id }: { id: string } = $props();
  const original = untrack(() => app.prioritarios.find((p) => p.id === id));
  let p = $state<Prioritario | null>(original ? ($state.snapshot(original) as Prioritario) : null);
  /** Todas as etiquetas conhecidas + as que só este paciente tem (ex.: "PNEUMONIA (27/10)"). */
  const opcoes = $derived([...new Set([...ETIQUETAS.filter((e) => e.chave !== 'IDOSO 80+').map((e) => e.chave), ...(p?.etiquetas ?? []).filter((e) => e !== 'IDOSO 80+')])]);

  function alternar(e: string) {
    if (!p) return;
    p.etiquetas = p.etiquetas.includes(e) ? p.etiquetas.filter((x) => x !== e) : [...p.etiquetas, e];
  }
  async function salvar() {
    if (!p) return;
    await salvarPrioritario($state.snapshot(p) as Prioritario);
    mostrarAviso('Salvo ✓');
    trocarPara(`prioritarios/${p.id}`);
  }
</script>

<button class="botao secundario pequeno voltar" onclick={() => voltar('prioritarios')}><Icone nome="voltar" /> Voltar</button>

{#if !p}
  <p>Paciente não encontrado.</p>
{:else}
  <h1>{p.nome}</h1>
  <p class="suave">{p.rua} {p.casa} · {p.prontuario ? `Pront. ${p.prontuario}` : 'sem prontuário'} · nasc. {p.nascimento ? formatarData(p.nascimento) : '—'}</p>

  <section class="cartao">
    <h2>Nível</h2>
    <div class="seg" role="radiogroup" aria-label="Nível">
      {#each ['A', 'B', 'C'] as n (n)}
        <button class="n{n}" class:ativo={p.nivel === n} role="radio" aria-checked={p.nivel === n} onclick={() => p && (p.nivel = n as NivelPrio)}>
          {n}<span>{n === 'A' ? 'mais urgente' : n === 'B' ? 'acompanhar' : 'estável'}</span>
        </button>
      {/each}
    </div>
  </section>

  <section class="cartao">
    <h2>Condições</h2>
    <p class="suave pequeno">Toque para marcar ou desmarcar. “80+” vem sozinho pela data de nascimento.</p>
    <div class="etqs">
      {#each opcoes as e (e)}
        {@const marcada = p.etiquetas.includes(e)}
        <button class="opc" class:marcada aria-pressed={marcada} onclick={() => alternar(e)}>
          <span class="marca">{marcada ? '✓' : '+'}</span><Etiqueta {e} />
        </button>
      {/each}
    </div>
  </section>

  <section class="cartao">
    <label class="campo"><span>Resumo</span><textarea rows="6" bind:value={p.resumo}></textarea></label>
    <label class="opcao">
      <input type="checkbox" checked={!!p.obito} onchange={(e) => p && (p.obito = e.currentTarget.checked || undefined)} />
      <span>Aviso “óbito a confirmar”</span>
    </label>
  </section>

  <button class="botao largo" onclick={salvar}>Salvar</button>
  <p class="suave pequeno">Uma lista nova não troca o que você editou aqui sem perguntar antes.</p>
{/if}

<style>
  .voltar {
    margin-bottom: 12px;
  }
  .seg {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
  .seg button {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-height: 60px;
    border-radius: 12px;
    border: 2px solid var(--borda);
    background: var(--cartao);
    color: var(--texto);
    font-size: 1.3rem;
    font-weight: 800;
    cursor: pointer;
  }
  .seg button span {
    font-size: 0.72rem;
    font-weight: 600;
  }
  .seg button.ativo.nA {
    border-color: var(--perigo);
    background: var(--perigo);
    color: var(--cartao);
  }
  .seg button.ativo.nB {
    border-color: var(--ausencia);
    background: var(--ausencia);
    color: var(--cartao);
  }
  .seg button.ativo.nC {
    border-color: var(--texto-suave);
    background: var(--borda);
  }
  .etqs {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .opc {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
    padding: 4px 10px 4px 8px;
    border-radius: 12px;
    border: 2px dashed var(--borda);
    background: var(--cartao);
    color: var(--texto);
    cursor: pointer;
    opacity: 0.75;
  }
  .opc.marcada {
    border-style: solid;
    border-color: var(--primaria);
    opacity: 1;
  }
  .marca {
    font-weight: 800;
    width: 14px;
  }
  textarea {
    width: 100%;
  }
  .opcao {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 48px;
  }
  .opcao input {
    width: 22px;
    height: 22px;
    accent-color: var(--primaria);
  }
</style>
