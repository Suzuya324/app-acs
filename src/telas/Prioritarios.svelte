<script lang="ts">
  import { untrack } from 'svelte';
  import Acompanhamento from '../componentes/Acompanhamento.svelte';
  import Etiqueta from '../componentes/Etiqueta.svelte';
  import Icone from '../componentes/Icone.svelte';
  import { normalizar } from '../lib/busca';
  import { formatarData, hojeISO } from '../lib/datas';
  import { achadosPeloApp } from '../lib/acompanhamento';
  import { app, contextoAcompanhamento, familiaPorId, mostrarAviso, porNaListaDePrioritarios } from '../lib/estado.svelte';
  import { NOMES_GRUPO } from '../lib/rotulos';
  import { etiquetasParaMostrar, idadeHoje, ordenarPrioritarios, textoParaCopiar, type NivelPrio, type Prioritario } from '../lib/prioritarios';
  import { ir } from '../lib/rotas.svelte';
  import { sugestoesDasVDs, ultimaAnotacao } from '../lib/anotacoes';

  let { abrir = '' }: { abrir?: string } = $props();
  const hoje = hojeISO();

  /** Quem o app achou fora da lista (pela ficha ou pelas VDs) e o acompanhamento de quem tem algo escrito. */
  const area = $derived(achadosPeloApp(app.familias, contextoAcompanhamento()));
  const acompDe = (p: Prioritario) => (p.moradorId ? area.acompanhamentos.get(p.moradorId) : undefined);
  const aConfirmar = (p: Prioritario) => (acompDe(p)?.achadas ?? []).filter((s) => s.sugestao.tipo === 'grupo');
  const moradorDe = (p: Prioritario) => (p.familiaId && p.moradorId ? familiaPorId(p.familiaId)?.moradores.find((m) => m.id === p.moradorId) : undefined);
  /** De onde vem cada pessoa: da lista importada ou achada pelo app. */
  let origem = $state<'todos' | 'lista' | 'app'>('todos');
  const base = $derived(origem === 'lista' ? app.prioritarios : origem === 'app' ? area.achados : [...app.prioritarios, ...area.achados]);

  async function porNaLista(p: Prioritario) {
    const id = await porNaListaDePrioritarios($state.snapshot(p) as Prioritario);
    aberto = id;
    mostrarAviso(`${p.nome.split(' ')[0]} entrou na lista ✓`);
  }

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
    { chave: 'CONFIRMAR', nome: 'A confirmar', tem: (p) => aConfirmar(p).length > 0 },
    { chave: 'PENDENCIA', nome: 'Com pendência', tem: (p) => (acompDe(p)?.pendencias.length ?? 0) > 0 },
  ];

  /** Atualizações para as fichas achadas no que já foi escrito nas VDs. */
  const paraFichas = $derived(sugestoesDasVDs(app.familias, app.visitas, app.casos, app.config.sugestoesEscondidas ?? []).length);

  let filtroEtq = $state<string | null>(null);
  let nivel = $state<'todos' | NivelPrio>('todos');
  let rua = $state('todas');
  let busca = $state('');
  let aberto = $state<string | null>(untrack(() => abrir) || null);

  const lista = $derived(ordenarPrioritarios(base, app.config.ruas));
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
  <h1>Prioritários <span class="suave">({app.prioritarios.length}{area.achados.length ? ` + ${area.achados.length}` : ''})</span></h1>
  <button class="botao secundario pequeno" onclick={() => ir('importar-prioritarios')}>Importar lista</button>
</div>

{#if paraFichas}
  <button class="cartao aviso-fichas" onclick={() => ir('revisar-fichas')}>
    <strong>{paraFichas} {paraFichas === 1 ? 'atualização' : 'atualizações'} para as fichas</strong>
    <span class="suave pequeno">Achei no que você já escreveu nas VDs e nos casos. Toque para conferir.</span>
  </button>
{/if}

{#if app.prioritarios.length === 0}
  <section class="cartao">
    <p>Ainda não tem lista de prioritários.</p>
    <p class="suave pequeno">Toque em <strong>Importar lista</strong> e escolha o arquivo JSON dos pacientes prioritários.</p>
  </section>
{/if}
{#if app.prioritarios.length + area.achados.length > 0}
  {#if area.achados.length}
    <div class="seg origem" role="radiogroup" aria-label="De onde vem">
      <button class:ativo={origem === 'todos'} role="radio" aria-checked={origem === 'todos'} onclick={() => (origem = 'todos')}>Todos</button>
      <button class:ativo={origem === 'lista'} role="radio" aria-checked={origem === 'lista'} onclick={() => (origem = 'lista')}>Lista ({app.prioritarios.length})</button>
      <button class:ativo={origem === 'app'} role="radio" aria-checked={origem === 'app'} onclick={() => (origem = 'app')}>Achados ({area.achados.length})</button>
    </div>
  {/if}
  <div class="contadores" role="group" aria-label="Filtrar por condição">
    {#each CONTADORES as c (c.chave)}
      {@const n = base.filter(c.tem).length}
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
            {#if p.doApp}<span class="doapp">achado pelo app · fora da lista</span>{/if}
            <span class="etqs">
              {#each etiquetasParaMostrar(p, hoje) as e (e)}<Etiqueta {e} />{/each}
              {#each aConfirmar(p) as s (s.chave)}{#if s.sugestao.tipo === 'grupo'}<span class="etq-q">{NOMES_GRUPO[s.sugestao.grupo]}? confirmar</span>{/if}{/each}
            </span>
          </span>
        </button>
        {#if aberto === p.id}
          <div class="corpo">
            {#if p.familiaId && p.moradorId}
              {@const ult = ultimaAnotacao(p.moradorId, p.familiaId, app.visitas)}
              {#if ult}<p class="ultima"><strong>Última anotação ({formatarData(ult.data)}):</strong> {ult.texto}</p>{/if}
            {/if}
            {#if p.resumo}<p class="resumo">{p.resumo}</p>{/if}
            {#if acompDe(p) && moradorDe(p)}
              <div class="acomp-caixa"><Acompanhamento a={acompDe(p)!} morador={moradorDe(p)!} modo="cartao" /></div>
            {/if}
            <p class="pequeno">
              <strong>Nascimento:</strong> {p.nascimento ? formatarData(p.nascimento) : '—'} · <strong>Nível:</strong> {p.nivel}
              {#if p.ultimaInfo}<br /><strong>Última informação:</strong> {p.ultimaInfo}{/if}
              {#if p.editadoEm}<br /><span class="suave">Editado no app em {formatarData(p.editadoEm.slice(0, 10))}</span>{/if}
            </p>
            <div class="botoes">
              <button class="botao pequeno" onclick={() => copiar(p)}><Icone nome="copiar" tamanho={18} /> Copiar</button>
              {#if p.doApp}<button class="botao secundario pequeno" onclick={() => porNaLista(p)}>Pôr na lista</button>
              {:else}<button class="botao secundario pequeno" onclick={() => ir(`prioritario/${p.id}`)}>Editar</button>{/if}
              {#if p.familiaId && p.moradorId}<button class="botao secundario pequeno" onclick={() => ir(`pessoa/${p.familiaId}/${p.moradorId}`)}>Ver ficha</button>
              {:else if p.familiaId}<button class="botao secundario pequeno" onclick={() => ir(`familia/${p.familiaId}`)}>Ver família</button>{/if}
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
  .ultima {
    margin: 10px 0 0;
    padding: 8px 10px;
    border-radius: 10px;
    background: var(--primaria-clara);
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
  .aviso-fichas {
    display: flex;
    flex-direction: column;
    gap: 2px;
    width: 100%;
    text-align: left;
    border-left: 4px solid var(--primaria);
    color: var(--texto);
    font: inherit;
    cursor: pointer;
    margin-bottom: 12px;
  }
  .origem {
    margin-bottom: 8px;
  }
  .doapp {
    font-size: 0.78rem;
    font-weight: 700;
    color: var(--primaria);
  }
  .etq-q {
    display: inline-block;
    font-size: 0.78rem;
    font-weight: 700;
    padding: 1px 7px;
    border-radius: 6px;
    line-height: 1.4;
    border: 2px dashed var(--ausencia);
    color: var(--texto);
  }
  .acomp-caixa {
    border-top: 1px solid var(--borda);
    border-bottom: 1px solid var(--borda);
    padding: 10px 0;
    margin: 8px 0;
  }
</style>
