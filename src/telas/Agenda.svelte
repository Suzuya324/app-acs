<script lang="ts">
  import Icone from '../componentes/Icone.svelte';
  import { formatarData, hojeISO } from '../lib/datas';
  import { agenda, NOMES_QUANDO, quandoE, type Compromisso, type Quando } from '../lib/dia';
  import { app, contextoAcompanhamento, enderecoCurto, esconderDoAcompanhamento, mostrarAviso } from '../lib/estado.svelte';
  import { diferencaDias } from '../lib/datas';
  import { ir, voltar } from '../lib/rotas.svelte';

  const hoje = hojeISO();
  const todos = $derived(agenda(app.familias, app.revisitas, contextoAcompanhamento()));
  /** O que passou há mais de 30 dias some (já deve ter sido perguntado). */
  const itens = $derived(todos.filter((c) => c.data >= hoje || diferencaDias(c.data, hoje) <= 30));
  const ORDEM: Quando[] = ['passou', 'hoje', 'amanha', 'semana', 'depois'];
  const grupos = $derived(ORDEM.map((q) => ({ q, itens: itens.filter((c) => quandoE(c.data, hoje) === q) })).filter((g) => g.itens.length));
  const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  const diaSemana = (iso: string) => DIAS[new Date(`${iso}T12:00:00`).getDay()];

  async function resolvido(c: Compromisso) {
    await esconderDoAcompanhamento(c.chaves, 'Compromisso resolvido');
    mostrarAviso('Tirado da agenda ✓');
  }
</script>

<button class="botao secundario pequeno voltar" onclick={() => voltar('')}><Icone nome="voltar" /> Voltar</button>

<h1>Agenda</h1>
<p class="suave">
  Consultas, exames, cirurgias e retornos que você escreveu nas VDs (“consulta dia 24/11”), mais as revisitas marcadas.
  O que passou fica até você perguntar como foi.
</p>

{#if !grupos.length}
  <p class="cartao suave">Nenhuma data marcada. Quando você escrever na VD algo como “consulta dia 24/11”, aparece aqui.</p>
{/if}

{#each grupos as g (g.q)}
  <h2 class="grupo" class:passou={g.q === 'passou'}>{NOMES_QUANDO[g.q]} <span class="suave">({g.itens.length})</span></h2>
  <ul class="lista">
    {#each g.itens as c, i (i)}
      <li class="cartao item {g.q}">
        <p class="data"><strong>{diaSemana(c.data)}, {formatarData(c.data).slice(0, 5)}</strong> · {c.tipo}</p>
        <button class="quem" onclick={() => ir(c.morador ? `pessoa/${c.familia.id}/${c.morador.id}` : `familia/${c.familia.id}`)}>
          <strong>{c.morador?.nome ?? enderecoCurto(c.familia)}</strong>
          {#if c.morador}<span class="suave pequeno">{enderecoCurto(c.familia)}</span>{/if}
        </button>
        <p class="texto">“{c.texto}”</p>
        <p class="suave pequeno">{c.origem}</p>
        {#if c.chaves.length}
          <button class="botao secundario pequeno" onclick={() => resolvido(c)}>✓ Já perguntei / resolvido</button>
        {/if}
      </li>
    {/each}
  </ul>
{/each}

<style>
  .voltar {
    margin-bottom: 12px;
  }
  .grupo {
    margin: 16px 0 8px;
  }
  .grupo.passou {
    color: var(--ausencia);
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
    border-left: 6px solid var(--primaria);
  }
  .item.passou {
    border-left-color: var(--ausencia);
  }
  .item.hoje,
  .item.amanha {
    border-left-color: var(--perigo);
  }
  .item p {
    margin: 2px 0;
    overflow-wrap: anywhere;
  }
  .data {
    text-transform: capitalize;
  }
  .quem {
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
  .texto {
    margin: 4px 0;
  }
</style>
