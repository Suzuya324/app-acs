<script lang="ts">
  import Icone from '../componentes/Icone.svelte';
  import { formatarData, hojeISO, proximoDiaDaSemana } from '../lib/datas';
  import { app, enderecoCurto, familiaPorId, resolverCaso } from '../lib/estado.svelte';
  import { NOMES_CATEGORIA_CASO } from '../lib/rotulos';
  import { ir, voltar } from '../lib/rotas.svelte';
  import type { Caso, CategoriaCaso } from '../lib/tipos';

  type Filtro = 'todos' | CategoriaCaso | 'emulti' | 'resolvidos';
  const FILTROS: [Filtro, string][] = [
    ['todos', 'Todos'],
    ['urgente', 'Urgente'],
    ['importante', 'Importante'],
    ['social', 'Social / cadastro'],
    ['npv', 'NPV'],
    ['emulti', 'eMulti'],
    ['resolvidos', 'Resolvidos'],
  ];
  const ORDEM: CategoriaCaso[] = ['urgente', 'importante', 'social', 'npv'];
  let filtro = $state<Filtro>('todos');
  let aberto = $state<string | null>(null);

  const ativos = $derived(app.casos.filter((c) => familiaPorId(c.familiaId)));
  const abertos = $derived(ativos.filter((c) => !c.resolvidoEm));
  const lista = $derived.by(() => {
    const base = filtro === 'resolvidos' ? ativos.filter((c) => c.resolvidoEm) : abertos;
    const f = (c: Caso) =>
      filtro === 'todos' || filtro === 'resolvidos' ? true : filtro === 'emulti' ? !!c.emulti?.trim() : c.categoria === filtro;
    return base.filter(f).sort((a, b) => ORDEM.indexOf(a.categoria) - ORDEM.indexOf(b.categoria) || b.atualizadoEm.localeCompare(a.atualizadoEm));
  });
  const conta = (f: Filtro) =>
    f === 'todos' ? abertos.length : f === 'resolvidos' ? ativos.length - abertos.length : f === 'emulti' ? abertos.filter((c) => c.emulti?.trim()).length : abertos.filter((c) => c.categoria === f).length;

  /** Próxima reunião de equipe (dia da semana escolhido em Ajustes; padrão: quarta). */
  const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  const diaReuniao = $derived(app.config.diaReuniao ?? 3);
  const reuniao = $derived(diaReuniao >= 0 ? proximoDiaDaSemana(hojeISO(), diaReuniao) : '');
</script>

<button class="botao secundario pequeno voltar" onclick={() => voltar('')}><Icone nome="voltar" /> Voltar</button>

<h1>Casos</h1>
<p class="suave">Situações para acompanhar de perto. Para abrir um caso novo, vá na família e toque em “Abrir caso”.</p>
{#if reuniao && conta('npv') + conta('urgente') > 0}
  <p class="alerta pequeno">
    Reunião de equipe (toda {DIAS[diaReuniao]}):
    <strong>{reuniao === hojeISO() ? 'hoje' : `${DIAS[diaReuniao]}, ${formatarData(reuniao)}`}</strong>. Leve os casos urgentes e os de NPV.
  </p>
{/if}

<div class="chips" role="tablist" aria-label="Filtrar casos">
  {#each FILTROS as [f, nome] (f)}
    <button class="chip" class:ativo={filtro === f} role="tab" aria-selected={filtro === f} onclick={() => (filtro = f)}>
      {nome} <span class="n">{conta(f)}</span>
    </button>
  {/each}
</div>

{#if lista.length === 0}
  <p class="cartao suave">Nenhum caso aqui.</p>
{/if}

<ul class="casos">
  {#each lista as c (c.id)}
    {@const f = familiaPorId(c.familiaId)}
    <li class="cartao caso {c.categoria}" class:resolvido={!!c.resolvidoEm}>
      <button class="cab" onclick={() => (aberto = aberto === c.id ? null : c.id)} aria-expanded={aberto === c.id}>
        <span class="tag {c.categoria}">{NOMES_CATEGORIA_CASO[c.categoria]}</span>
        <strong>{c.titulo}</strong>
        <span class="suave pequeno">{f ? enderecoCurto(f) : ''} · atualizado {formatarData(c.atualizadoEm.slice(0, 10))}</span>
        {#if c.emulti}<span class="tag emulti">eMulti: {c.emulti}</span>{/if}
        {#if aberto !== c.id}<span class="previa">{c.texto}</span>{/if}
      </button>
      {#if aberto === c.id}
        <p class="texto">{c.texto}</p>
        {#if c.npv}<p class="pequeno"><strong>NPV:</strong> {c.npv}</p>{/if}
        <div class="linha-botoes">
          <button class="botao secundario pequeno" onclick={() => ir(`familia/${c.familiaId}`)}>Ver família</button>
          <button class="botao secundario pequeno" onclick={() => ir(`caso/${c.familiaId}/${c.id}`)}>Editar</button>
          <button class="botao pequeno" onclick={() => resolverCaso(c.id, !c.resolvidoEm)}>{c.resolvidoEm ? 'Reabrir' : 'Resolvido'}</button>
        </div>
      {/if}
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
  .casos {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .caso {
    border-left: 6px solid var(--borda);
    margin: 0;
  }
  .caso.urgente {
    border-left-color: var(--perigo);
  }
  .caso.importante {
    border-left-color: var(--ausencia);
  }
  .caso.social {
    border-left-color: var(--ausente-realizada);
  }
  .caso.resolvido {
    opacity: 0.65;
  }
  .cab {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    width: 100%;
    text-align: left;
    background: none;
    border: 0;
    padding: 0;
    color: inherit;
    cursor: pointer;
  }
  .tag {
    font-size: 0.75rem;
    font-weight: 800;
    padding: 2px 8px;
    border-radius: 6px;
    background: var(--primaria-clara);
  }
  .tag.urgente {
    background: var(--perigo);
    color: var(--cartao);
  }
  .tag.importante {
    background: var(--ausencia);
    color: var(--cartao);
  }
  .tag.emulti {
    background: var(--aviso-fundo);
    color: var(--aviso-texto);
  }
  .previa {
    font-size: 0.9rem;
    color: var(--texto-suave);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .texto {
    white-space: pre-wrap;
    margin: 10px 0;
  }
</style>
