<script lang="ts">
  import { untrack } from 'svelte';
  import Etiqueta from '../componentes/Etiqueta.svelte';
  import Icone from '../componentes/Icone.svelte';
  import { normalizar } from '../lib/busca';
  import { formatarData, hojeISO } from '../lib/datas';
  import { app, mostrarAviso } from '../lib/estado.svelte';
  import { etiquetasParaMostrar, idadeHoje, ordenarPrioritarios, textoParaCopiar, type NivelPrio, type Prioritario } from '../lib/prioritarios';
  import { ir } from '../lib/rotas.svelte';

  let { abrir = '' }: { abrir?: string } = $props();
  const hoje = hojeISO();

  /** Contadores (servem de filtro). */
  const CONTADORES: { chave: string; nome: string; tem: (p: Prioritario) => boolean }[] = [
    { chave: 'ACAMADO/DOMICILIADO', nome: 'Acamados', tem: (p) => p.etiquetas.includes('ACAMADO/DOMICILIADO') },
    { chave: 'O2', nome: 'O₂', tem: (p) => p.etiquetas.includes('O2') },
    { chave: 'PALIATIVO', nome: 'Paliativos', tem: (p) => p.etiquetas.includes('PALIATIVO') },
    { chave: 'HAS', nome: 'HAS', tem: (p) => p.etiquetas.includes('HAS') },
    { chave: 'DM', nome: 'DM', tem: (p) => p.etiquetas.includes('DM') },
    { chave: '80', nome: '80+', tem: (p) => etiquetasParaMostrar(p, hoje).includes('IDOSO 80+') },
    { chave: 'SAUDE MENTAL', nome: 'Saúde mental', tem: (p) => p.etiquetas.includes('SAUDE MENTAL') },
    { chave: 'GESTANTE?', nome: 'Gestantes (confirmar)', tem: (p) => p.etiquetas.includes('GESTANTE?') },
  ];

  let filtroEtq = $state<string | null>(null);
  let nivel = $state<'todos' | NivelPrio>('todos');
  let rua = $state('todas');
  let busca = $state('');
  let aberto = $state<string | null>(untrack(() => abrir) || null);

  const lista = $derived(ordenarPrioritarios(app.prioritarios, app.config.ruas));
  const ruas = $derived([...new Set(lista.map((p) => p.rua).filter(Boolean))]);
  const filtrada = $derived.by(() => {
    const q = normalizar(busca);
    const cont = CONTADORES.find((c) => c.chave === filtroEtq);
    return lista.filter(
      (p) =>
        (nivel === 'todos' || p.nivel === nivel) &&
        (rua === 'todas' || p.rua === rua) &&
        (!cont || cont.tem(p)) &&
        (!q || normalizar(`${p.nome} ${p.rua} ${p.casa} ${p.prontuario}`).includes(q) || normalizar(p.prontuario).replace(/\D/g, '').includes(q.replace(/\D/g, '') || '§')),
    );
  });

  async function copiar(p: Prioritario) {
    try {
      await navigator.clipboard.writeText(textoParaCopiar(p, hoje));
      app.desfazer = null; // copiar não se desfaz: não mostra o "Desfazer" de outra ação
      mostrarAviso('Copiado ✓ Cole no WhatsApp da equipe.');
    } catch {
      mostrarAviso('Não consegui copiar.');
    }
  }
</script>

<div class="cab">
  <h1>Prioritários <span class="suave">({app.prioritarios.length})</span></h1>
  <button class="botao secundario pequeno" onclick={() => ir('importar-prioritarios')}>Importar lista</button>
</div>

{#if app.prioritarios.length === 0}
  <section class="cartao">
    <p>Ainda não tem lista de prioritários.</p>
    <p class="suave pequeno">Toque em <strong>Importar lista</strong> e escolha o arquivo JSON dos pacientes prioritários.</p>
  </section>
{:else}
  <div class="contadores" role="group" aria-label="Filtrar por condição">
    {#each CONTADORES as c (c.chave)}
      {@const n = app.prioritarios.filter(c.tem).length}
      <button class="cont" class:ativo={filtroEtq === c.chave} aria-pressed={filtroEtq === c.chave} onclick={() => (filtroEtq = filtroEtq === c.chave ? null : c.chave)}>
        <strong>{n}</strong><span>{c.nome}</span>
      </button>
    {/each}
  </div>

  <div class="caixa-busca">
    <Icone nome="busca" />
    <input type="search" bind:value={busca} placeholder="Nome, casa ou prontuário" aria-label="Buscar prioritário" autocomplete="off" />
  </div>

  <div class="filtros">
    <div class="seg" role="radiogroup" aria-label="Nível">
      {#each ['todos', 'A', 'B', 'C'] as n (n)}
        <button class="nivel-{n}" class:ativo={nivel === n} role="radio" aria-checked={nivel === n} onclick={() => (nivel = n as typeof nivel)}>{n === 'todos' ? 'Todos' : n}</button>
      {/each}
    </div>
    <div class="seg" role="radiogroup" aria-label="Rua">
      {#each ['todas', ...ruas] as r (r)}
        <button class:ativo={rua === r} role="radio" aria-checked={rua === r} onclick={() => (rua = r)}>{r === 'todas' ? 'Todas' : r}</button>
      {/each}
    </div>
  </div>

  <p class="suave pequeno">{filtrada.length} {filtrada.length === 1 ? 'paciente' : 'pacientes'}</p>

  <ul class="lista-prio">
    {#each filtrada as p (p.id)}
      {@const anos = idadeHoje(p, hoje)}
      <li class="cartao card" class:aberto={aberto === p.id}>
        <button class="topo" onclick={() => (aberto = aberto === p.id ? null : p.id)} aria-expanded={aberto === p.id}>
          <span class="bola nivel-{p.nivel}" title="Nível {p.nivel}" aria-label="Nível {p.nivel}"></span>
          <span class="txt">
            <span class="nome"><strong>{p.nome}</strong>{anos !== null ? ` · ${anos} anos` : ''}</span>
            <span class="suave pequeno">{p.rua} {p.casa} · {p.prontuario ? `Pront. ${p.prontuario}` : 'sem prontuário'}</span>
            {#if p.obito}<span class="obito">⚠️ óbito a confirmar</span>{/if}
            {#if !p.familiaId}<span class="semcasa">não achado no cadastro do app</span>{/if}
            <span class="etqs">{#each etiquetasParaMostrar(p, hoje) as e (e)}<Etiqueta {e} />{/each}</span>
          </span>
        </button>
        {#if aberto === p.id}
          <div class="corpo">
            {#if p.resumo}<p class="resumo">{p.resumo}</p>{/if}
            <p class="pequeno">
              <strong>Nascimento:</strong> {p.nascimento ? formatarData(p.nascimento) : '—'} · <strong>Nível:</strong> {p.nivel}
              {#if p.ultimaInfo}<br /><strong>Última informação:</strong> {p.ultimaInfo}{/if}
              {#if p.editadoEm}<br /><span class="suave">Editado no app em {formatarData(p.editadoEm.slice(0, 10))}</span>{/if}
            </p>
            <div class="botoes">
              <button class="botao pequeno" onclick={() => copiar(p)}><Icone nome="copiar" tamanho={18} /> Copiar</button>
              <button class="botao secundario pequeno" onclick={() => ir(`prioritario/${p.id}`)}>Editar</button>
              {#if p.familiaId}<button class="botao secundario pequeno" onclick={() => ir(`familia/${p.familiaId}`)}>Ver família</button>{/if}
            </div>
          </div>
        {/if}
      </li>
    {/each}
  </ul>
{/if}

<style>
  .cab {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
  }
  .contadores {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
    margin: 6px 0 10px;
  }
  .cont {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 58px;
    padding: 4px 2px;
    border-radius: 12px;
    border: 2px solid var(--borda);
    background: var(--cartao);
    color: var(--texto);
    cursor: pointer;
    line-height: 1.1;
  }
  .cont strong {
    font-size: 1.25rem;
  }
  .cont span {
    font-size: 0.72rem;
    text-align: center;
  }
  .cont.ativo {
    border-color: var(--primaria);
    background: var(--primaria-clara);
  }
  .caixa-busca {
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--cartao);
    border: 2px solid var(--primaria);
    border-radius: 14px;
    padding: 0 12px;
    color: var(--texto-suave);
  }
  .caixa-busca input {
    flex: 1;
    min-width: 0;
    border: 0;
    outline: none;
    background: transparent;
    min-height: 52px;
    padding: 0;
    font-size: 1.05rem;
    color: var(--texto);
  }
  .caixa-busca:focus-within {
    outline: 3px solid var(--primaria);
    outline-offset: 1px;
  }
  .filtros {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 8px 0;
  }
  .seg {
    display: flex;
    gap: 6px;
    overflow-x: auto;
  }
  .seg button {
    flex: 1 0 auto;
    min-height: 42px;
    padding: 4px 12px;
    border-radius: 10px;
    border: 2px solid var(--borda);
    background: var(--cartao);
    color: var(--texto);
    font-weight: 700;
    cursor: pointer;
  }
  .seg button.ativo {
    border-color: var(--primaria);
    background: var(--primaria-clara);
  }
  .lista-prio {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .card {
    margin: 0;
    padding: 0;
  }
  .topo {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    width: 100%;
    text-align: left;
    background: none;
    border: 0;
    padding: 12px;
    color: inherit;
    cursor: pointer;
  }
  .bola {
    flex: 0 0 16px;
    height: 16px;
    margin-top: 4px;
    border-radius: 50%;
    background: var(--borda);
  }
  .bola.nivel-A {
    background: var(--perigo);
  }
  .bola.nivel-B {
    background: var(--ausencia);
  }
  .txt {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }
  .nome {
    overflow-wrap: anywhere;
  }
  .etqs {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 2px;
  }
  .obito {
    font-weight: 800;
    color: var(--perigo);
    font-size: 0.9rem;
  }
  .semcasa {
    font-size: 0.8rem;
    color: var(--aviso-texto);
  }
  .corpo {
    padding: 0 12px 12px;
    border-top: 1px solid var(--borda);
  }
  .resumo {
    white-space: pre-wrap;
    margin: 10px 0;
  }
  .botoes {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: 8px;
  }
</style>
