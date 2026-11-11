<script lang="ts">
  import Icone from '../componentes/Icone.svelte';
  import { hojeISO } from '../lib/datas';
  import { app, enderecoCurto, mostrarAviso } from '../lib/estado.svelte';
  import { ir, voltar } from '../lib/rotas.svelte';
  import { listaParaTecnica, textoParaTecnica, type TipoTecnica } from '../lib/tecnica';

  const hoje = hojeISO();
  const todos = $derived(listaParaTecnica(app.familias, app.visitas, app.casos, app.prioritarios, hoje, app.config.ruas));
  type Filtro = 'todos' | 'importantes' | TipoTecnica;
  let filtro = $state<Filtro>('importantes');
  const FILTROS: [Filtro, string][] = [
    ['importantes', 'Mais importantes'],
    ['todos', 'Todos'],
    ['pa', 'P.A.'],
    ['glicemia', 'Glicemia'],
    ['curativo', 'Curativo'],
    ['outro', 'Outros'],
  ];
  const passa = (f: Filtro) => (it: (typeof todos)[number]) =>
    f === 'todos' ? true : f === 'importantes' ? it.peso >= 50 : it.pedidos.some((p) => p.tipo === f);
  const lista = $derived(todos.filter(passa(filtro)).map((it) => ({ ...it, pedidos: filtro === 'todos' || filtro === 'importantes' ? it.pedidos : it.pedidos.filter((p) => p.tipo === filtro) })));
  const conta = (f: Filtro) => todos.filter(passa(f)).length;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(textoParaTecnica(lista, hoje, enderecoCurto));
      app.desfazer = null;
      mostrarAviso('Lista copiada ✓ Cole no WhatsApp da técnica.');
    } catch {
      mostrarAviso('Não consegui copiar.');
    }
  }
</script>

<button class="botao secundario pequeno voltar" onclick={() => voltar('casos')}><Icone nome="voltar" /> Voltar</button>

<h1>Para a técnica de enfermagem</h1>
<p class="suave">
  Quem precisa de P.A., glicemia, curativo ou outro cuidado, pelo que está no app. Quando a técnica fizer, registre a VD
  (compartilhada) com a P.A. ou a glicemia: a pessoa sai da lista sozinha.
</p>

<div class="chips" role="tablist" aria-label="Filtrar">
  {#each FILTROS as [f, nome] (f)}
    <button class="chip" class:ativo={filtro === f} role="tab" aria-selected={filtro === f} onclick={() => (filtro = f)}>{nome} <span class="n">{conta(f)}</span></button>
  {/each}
</div>

{#if lista.length}
  <button class="botao largo" onclick={copiar}><Icone nome="copiar" tamanho={20} /> Copiar a lista ({lista.length})</button>
{:else}
  <p class="cartao suave">Ninguém aqui. 👍</p>
{/if}

<ul class="lista">
  {#each lista as it (it.morador.id)}
    <li class="cartao item" class:alto={it.peso >= 70}>
      <button class="nome" onclick={() => ir(`pessoa/${it.familia.id}/${it.morador.id}`)}>
        <strong>{it.morador.nome}</strong>
        <span class="suave pequeno">{enderecoCurto(it.familia)}</span>
      </button>
      <ul class="pedidos">
        {#each it.pedidos as p, i (i)}<li class={p.tipo}>{p.texto}</li>{/each}
      </ul>
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
  .n {
    font-weight: 400;
    opacity: 0.8;
  }
  .lista {
    list-style: none;
    padding: 0;
    margin: 12px 0 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .item {
    margin: 0;
    border-left: 6px solid var(--borda);
  }
  .item.alto {
    border-left-color: var(--perigo);
  }
  .nome {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    width: 100%;
    background: none;
    border: 0;
    padding: 0;
    text-align: left;
    color: var(--texto);
    cursor: pointer;
    font: inherit;
  }
  .pedidos {
    margin: 6px 0 0;
    padding-left: 18px;
  }
  .pedidos li {
    margin: 3px 0;
    overflow-wrap: anywhere;
  }
</style>
