<script lang="ts">
  import Icone from '../componentes/Icone.svelte';
  import { app, mostrarAviso, restaurarDaLixeira, restaurarVariosDaLixeira } from '../lib/estado.svelte';
  import { itensNaLixeira, NaoDaParaRestaurar } from '../lib/lixeira';
  import { voltar } from '../lib/rotas.svelte';

  const itens = $derived(itensNaLixeira({ lixeira: app.lixeira }));
  const nomeTipo = { visita: 'VD', familia: 'Família', morador: 'Morador' } as const;

  async function restaurar(id: string) {
    try {
      await restaurarDaLixeira(id);
      mostrarAviso('Restaurado ✓');
    } catch (e) {
      mostrarAviso(e instanceof NaoDaParaRestaurar ? e.message : 'Não consegui restaurar.', 5000);
    }
  }
  /** Famílias tiradas da área de uma vez (tela de números de prontuário). */
  const tiradas = $derived(itens.filter((i) => i.tipo === 'familia' && i.descricao.includes('prontuário de outra micro')));
  async function restaurarTiradas() {
    const n = tiradas.length;
    if (!confirm(`Restaurar as ${n} famílias tiradas da área?`)) return;
    const feitos = await restaurarVariosDaLixeira(tiradas.map((i) => i.id));
    mostrarAviso(`${feitos} ${feitos === 1 ? 'família restaurada' : 'famílias restauradas'} ✓`);
  }
  function quando(iso: string) {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  }
</script>

<button class="botao secundario pequeno voltar" onclick={() => voltar('ajustes')}><Icone nome="voltar" /> Voltar</button>

<h1>Lixeira</h1>
<p class="suave">O que foi excluído por engano fica aqui. Nada é apagado de verdade: toque em <strong>Restaurar</strong> para voltar.</p>

{#if tiradas.length}
  <section class="cartao destaque">
    <strong>{tiradas.length} famílias tiradas da área de uma vez</strong>
    <p class="suave pequeno">Foram tiradas por terem prontuário de outra micro. Se foi engano (ex.: era uma rua sua), restaure todas juntas.</p>
    <button class="botao largo" onclick={restaurarTiradas}>Restaurar as {tiradas.length} famílias</button>
  </section>
{/if}

{#if itens.length === 0}
  <p class="cartao vazio">A lixeira está vazia.</p>
{:else}
  <ul class="lista">
    {#each itens as i (i.id)}
      <li class="cartao item">
        <span class="texto">
          <span class="tipo">{nomeTipo[i.tipo]}</span>
          <strong>{i.descricao}</strong>
          <span class="suave pequeno">Excluído em {quando(i.excluidoEm)}</span>
        </span>
        <button class="botao secundario pequeno" onclick={() => restaurar(i.id)}>Restaurar</button>
      </li>
    {/each}
  </ul>
{/if}

<style>
  .voltar {
    margin-bottom: 12px;
  }
  .destaque {
    border: 2px solid var(--primaria);
    margin-bottom: 12px;
  }
  .vazio {
    color: var(--texto-suave);
  }
  .item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
  }
  .texto {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .tipo {
    font-size: 0.75rem;
    font-weight: 800;
    text-transform: uppercase;
    color: var(--texto-suave);
    letter-spacing: 0.05em;
  }
</style>
