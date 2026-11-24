<script lang="ts">
  import Icone from '../componentes/Icone.svelte';
  import { app, limparOrdemDaRua, mostrarAviso, responsavel, salvarOrdemDaRua } from '../lib/estado.svelte';
  import { ordenarParaAndar } from '../lib/roteiro';
  import { voltar } from '../lib/rotas.svelte';
  import { NOMES_SITUACAO_CASA } from '../lib/rotulos';

  const ruas = $derived([...new Set([...app.config.ruas, ...app.familias.map((f) => f.rua)])].filter(Boolean));
  let escolhida = $state('');
  /** A rua escolhida (ou a primeira da lista, enquanto não escolher). */
  const rua = $derived(escolhida || ruas[0] || '');
  /** Ids na ordem que o ACS está montando (só vale depois de tocar em ▲ ou ▼). */
  let ordem = $state<string[] | null>(null);
  let salvando = $state(false);

  const daRua = $derived(app.familias.filter((f) => f.rua === rua));
  const lista = $derived.by(() => {
    const base = ordem ? ordem.map((id) => daRua.find((f) => f.id === id)).filter((f) => !!f) : ordenarParaAndar(daRua);
    return base as typeof daRua;
  });
  const temOrdemSalva = $derived(daRua.some((f) => f.ordemNaRua !== undefined));
  const mudou = $derived(ordem !== null);

  function escolher(r: string) {
    escolhida = r;
    ordem = null;
  }
  function mover(i: number, delta: number) {
    const ids = (ordem ?? lista.map((f) => f.id)).slice();
    const j = i + delta;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    ordem = ids;
  }
  function paraOTopo(i: number) {
    const ids = (ordem ?? lista.map((f) => f.id)).slice();
    const [x] = ids.splice(i, 1);
    ids.unshift(x);
    ordem = ids;
  }
  async function salvar() {
    if (!ordem || salvando) return;
    salvando = true;
    try {
      await salvarOrdemDaRua(rua, ordem);
      ordem = null;
      mostrarAviso('Ordem da rua salva ✓ O roteiro passa a seguir essa ordem.', 3500);
    } finally {
      salvando = false;
    }
  }
  async function limpar() {
    if (!confirm('Voltar esta rua para a ordem pelo número da casa?')) return;
    await limparOrdemDaRua(rua);
    ordem = null;
    mostrarAviso('Voltou para a ordem pelo número ✓');
  }
</script>

<button class="botao secundario pequeno voltar" onclick={() => voltar('dia')}><Icone nome="voltar" /> Voltar</button>

<h1>Ordem de caminhada da rua</h1>
<p class="suave">
  Você anda do jeito do morro, não do número da casa. Monte aqui a ordem em que você passa pelas casas: o roteiro, a "próxima casa" e o mapa seguem essa ordem.
  Casa nova que ainda não foi posicionada fica no fim da rua.
</p>

<div class="chips" role="tablist" aria-label="Escolher a rua">
  {#each ruas as r (r)}
    <button class="chip" class:ativo={rua === r} role="tab" aria-selected={rua === r} onclick={() => escolher(r)}>{r}</button>
  {/each}
</div>

<div class="acoes">
  <button class="botao" disabled={!mudou || salvando} onclick={salvar}>{mudou ? 'Salvar a ordem' : 'Sem mudança'}</button>
  {#if mudou}<button class="botao secundario" onclick={() => (ordem = null)}>Desfazer</button>{/if}
  {#if temOrdemSalva && !mudou}<button class="botao secundario" onclick={limpar}>Voltar à ordem do número</button>{/if}
</div>

<p class="suave pequeno">{lista.length} {lista.length === 1 ? 'casa' : 'casas'} · {temOrdemSalva ? 'ordem montada por você' : 'ordem pelo número da casa'}</p>

<ol class="lista">
  {#each lista as f, i (f.id)}
    <li class="cartao casa" class:inativa={f.situacaoCasa !== 'habitada'}>
      <span class="pos">{i + 1}</span>
      <span class="info">
        <strong>{f.numero}{f.complemento ? ` – ${f.complemento}` : ''}</strong>
        <span class="suave pequeno">{f.situacaoCasa === 'habitada' ? responsavel(f) : NOMES_SITUACAO_CASA[f.situacaoCasa]}</span>
        {#if f.referencia}<span class="pequeno">📍 {f.referencia}</span>{/if}
      </span>
      <span class="botoes">
        <button class="botao secundario pequeno" aria-label="Subir" disabled={i === 0} onclick={() => mover(i, -1)}>▲</button>
        <button class="botao secundario pequeno" aria-label="Descer" disabled={i === lista.length - 1} onclick={() => mover(i, 1)}>▼</button>
        <button class="botao secundario pequeno" aria-label="Levar para o começo" disabled={i === 0} onclick={() => paraOTopo(i)}>⤒</button>
      </span>
    </li>
  {/each}
</ol>

<style>
  .voltar {
    margin-bottom: 12px;
  }
  .chips {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding-bottom: 6px;
    margin: 10px 0;
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
  .acoes {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 8px 0;
  }
  .lista {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .casa {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0;
    padding: 8px 10px;
  }
  .casa.inativa {
    opacity: 0.7;
  }
  .pos {
    flex: 0 0 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--primaria-clara);
    display: grid;
    place-items: center;
    font-weight: 700;
  }
  .info {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .botoes {
    display: flex;
    gap: 4px;
  }
  .botoes :global(.botao) {
    min-width: 44px;
    padding-left: 0;
    padding-right: 0;
  }
</style>
