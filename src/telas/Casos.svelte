<script lang="ts">
  import Icone from '../componentes/Icone.svelte';
  import { formatarData, hojeISO, proximoDiaDaSemana } from '../lib/datas';
  import { agruparCasos, buscarCasos, casoDoAchado, casosAchados, casosDaPauta, DIAS_PARADO, PARADOS_NA_PAUTA, textoDoCaso, ultimaNovidade, diasParado, ordenarCasos, textoDaPauta, textoParado, type CasoAchado } from '../lib/casos-auto';
  import { app, enderecoCurto, esconderDoAcompanhamento, familiaPorId, mostrarAviso, resolverCaso, responderCaso, salvarCaso } from '../lib/estado.svelte';
  import { NOMES_CATEGORIA_CASO } from '../lib/rotulos';
  import { ir } from '../lib/rotas.svelte';
  import type { Caso, CategoriaCaso } from '../lib/tipos';

  /** Primeira linha de filtros: o que mostrar. Segunda linha: de que tipo. */
  type Situacao = 'abertos' | 'pauta' | 'parados' | 'resolvidos';
  type Tipo = 'todos' | CategoriaCaso | 'emulti';
  const SITUACOES: [Situacao, string][] = [
    ['abertos', 'Abertos'],
    ['pauta', 'Reunião'],
    ['parados', 'Parados'],
    ['resolvidos', 'Resolvidos'],
  ];
  const TIPOS: [Tipo, string][] = [
    ['todos', 'Todos os tipos'],
    ['urgente', 'Urgente'],
    ['importante', 'Importante'],
    ['social', 'Social / cadastro'],
    ['npv', 'NPV'],
    ['emulti', 'eMulti'],
  ];
  let situacao = $state<Situacao>('abertos');
  let tipo = $state<Tipo>('todos');
  let busca = $state('');
  const hoje = hojeISO();
  const parados = $derived(abertosParados());
  function abertosParados() {
    return app.casos.filter((c) => !c.resolvidoEm && familiaPorId(c.familiaId) && diasParado(c, hoje) >= DIAS_PARADO).length;
  }
  /** Resposta sendo escrita no caso aberto. */
  let resposta = $state('');
  let daReuniao = $state(true);
  let resolverJunto = $state(false);
  async function responder(c: Caso) {
    if (!resposta.trim()) return;
    await responderCaso(c.id, resposta, { reuniao: daReuniao, resolver: resolverJunto });
    mostrarAviso(resolverJunto ? 'Resposta anotada e caso resolvido ✓' : 'Resposta anotada ✓');
    resposta = '';
    resolverJunto = false;
  }
  let aberto = $state<string | null>(null);

  const ativos = $derived(app.casos.filter((c) => familiaPorId(c.familiaId)));
  const abertos = $derived(ativos.filter((c) => !c.resolvidoEm));
  const paradosAbertos = $derived(abertos.filter((c) => diasParado(c, hoje) >= DIAS_PARADO));
  const doTipo = (c: Caso, t: Tipo) => (t === 'todos' ? true : t === 'emulti' ? !!c.emulti?.trim() : c.categoria === t);
  /** Casos da situação escolhida (antes de filtrar por tipo e busca). */
  const base = $derived(
    situacao === 'resolvidos' ? ativos.filter((c) => c.resolvidoEm) : situacao === 'pauta' ? casosDaPauta(abertos, hoje) : situacao === 'parados' ? paradosAbertos : abertos,
  );
  const lista = $derived(
    ordenarCasos(
      buscarCasos(
        base.filter((c) => doTipo(c, tipo)),
        busca,
        (c) => endereco(c.familiaId),
      ),
      hoje,
    ),
  );
  const secoes = $derived(situacao === 'abertos' ? agruparCasos(lista, hoje) : []);
  const contaSituacao = (s: Situacao) =>
    s === 'abertos' ? abertos.length : s === 'pauta' ? casosDaPauta(abertos, hoje).length : s === 'parados' ? paradosAbertos.length : ativos.length - abertos.length;
  const contaTipo = (t: Tipo) => base.filter((c) => doTipo(c, t)).length;
  /** Atalho antigo usado no cartão da reunião. */
  const conta = (f: 'pauta') => contaSituacao(f);

  /** Casos que o app achou no que você escreveu e que ainda não foram abertos. */
  const achados = $derived(casosAchados(app.familias, app.visitas, app.casos, hojeISO(), app.config.sugestoesEscondidas ?? [], app.prioritarios));
  let verTodosAchados = $state(false);
  let ocupado = $state(false);
  async function abrirAchado(a: CasoAchado) {
    if (ocupado) return;
    ocupado = true;
    try {
      await salvarCaso(casoDoAchado($state.snapshot(a) as CasoAchado));
      mostrarAviso(`Caso aberto: ${a.titulo.split(',')[0]} ✓`);
    } finally {
      ocupado = false;
    }
  }
  async function naoE(a: CasoAchado) {
    if (ocupado) return;
    ocupado = true;
    try {
      await esconderDoAcompanhamento([a.chave], 'Marcar “não é caso”');
      mostrarAviso('Não aparece mais ✓');
    } finally {
      ocupado = false;
    }
  }
  const NOME_CAT: Record<CategoriaCaso, string> = { urgente: 'Urgente', importante: 'Importante', social: 'Social', npv: 'NPV' };
  /** Endereço com o prontuário (para a pauta e para mandar à equipe). */
  const endereco = (id: string) => {
    const f = familiaPorId(id);
    return f ? `${enderecoCurto(f)} (${f.prontuario.trim() ? `pront. ${f.prontuario.trim()}` : 'sem prontuário'})` : '';
  };
  async function copiarCaso(c: Caso) {
    try {
      await navigator.clipboard.writeText(textoDoCaso(c, endereco, hoje));
      app.desfazer = null;
      mostrarAviso('Caso copiado ✓ Cole no WhatsApp de quem vai ajudar.');
    } catch {
      mostrarAviso('Não consegui copiar.');
    }
  }
  async function copiarPauta() {
    try {
      await navigator.clipboard.writeText(textoDaPauta(abertos, endereco, reuniao ? formatarData(reuniao) : '', hoje));
      app.desfazer = null;
      mostrarAviso('Pauta copiada ✓ Cole no WhatsApp da equipe ou no caderno.');
    } catch {
      mostrarAviso('Não consegui copiar.');
    }
  }

  /** Próxima reunião de equipe (dia da semana escolhido em Ajustes; padrão: quarta). */
  const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  const diaReuniao = $derived(app.config.diaReuniao ?? 3);
  const reuniao = $derived(diaReuniao >= 0 ? proximoDiaDaSemana(hojeISO(), diaReuniao) : '');
</script>

<h1>Casos</h1>

{#if reuniao}
  <section class="cartao reuniao">
    <p class="linha-reuniao">
      <strong>Reunião {reuniao === hojeISO() ? 'hoje' : `${DIAS[diaReuniao]}, ${formatarData(reuniao).slice(0, 5)}`}</strong>
      <span>{conta('pauta')} {conta('pauta') === 1 ? 'caso' : 'casos'} na pauta{parados ? ` · ${parados} ${parados === 1 ? 'parado' : 'parados'}` : ''}</span>
    </p>
    <div class="linha-botoes">
      <button class="botao secundario pequeno" onclick={() => { situacao = 'pauta'; tipo = 'todos'; busca = ''; }}>Ver a pauta</button>
      <button class="botao pequeno" disabled={!conta('pauta')} onclick={copiarPauta}><Icone nome="copiar" tamanho={18} /> Copiar a pauta</button>
    </div>
    <details class="como">
      <summary>Como entra na pauta</summary>
      <p class="suave pequeno">Urgentes, eMulti, os marcados para a reunião e os parados. {#if parados}Há {parados} {parados === 1 ? 'caso parado' : 'casos parados'} há {DIAS_PARADO} dias ou mais sem resposta: os {Math.min(parados, PARADOS_NA_PAUTA)} mais esquecidos entram; anotando a resposta, os próximos sobem.{/if}</p>
    </details>
  </section>
{/if}

<details class="equipe">
  <summary class="botao secundario largo">👥 Listas para a equipe</summary>
  <div class="menu-equipe">
    <button class="botao largo" onclick={() => ir('equipe-numeros')}>📊 Equipe em números (VDs junto e quem foi)</button>
    <button class="botao secundario" onclick={() => ir('tecnica')}>Técnica de enfermagem (P.A., glicemia, curativo)</button>
    <button class="botao secundario" onclick={() => ir('equipe/enfermeira')}>Enfermeira</button>
    <button class="botao secundario" onclick={() => ir('equipe/medica')}>Dra.</button>
    <button class="botao secundario" onclick={() => ir('equipe/apa')}>APA (Agente de Promoção Ambiental)</button>
  </div>
</details>

{#if achados.length}
  <details class="cartao achados">
    <summary><strong>📥 {achados.length} {achados.length === 1 ? 'caso achado' : 'casos achados'} nas suas VDs</strong> <span class="suave pequeno">· toque para conferir</span></summary>
    <p class="suave pequeno">Casos em tudo o que você já escreveu (VDs, relatos, observações, lista de prioritários) que ainda não foram abertos. Confira e toque em <strong>Abrir caso</strong>.</p>
    {#each verTodosAchados ? achados : achados.slice(0, 5) as a (a.chave)}
      <div class="achado {a.categoria}">
        <p class="topo-achado">
          <span class="tag {a.categoria}">{NOME_CAT[a.categoria]}</span>
          {#if a.emulti}<span class="tag emulti">eMulti: {a.emulti}</span>{/if}
          {#if a.reuniao}<span class="tag reun">Reunião</span>{/if}
        </p>
        <p><strong>{a.titulo}</strong> <span class="suave pequeno">· {endereco(a.familiaId)}</span></p>
        <p class="pequeno">“{a.provas[0].frase}” <span class="suave">({a.provas[0].data ? formatarData(a.provas[0].data).slice(0, 5) : a.provas[0].origem}{a.provas.length > 1 ? ` e mais ${a.provas.length - 1}` : ''})</span></p>
        <div class="linha-botoes">
          <button class="botao pequeno" disabled={ocupado} onclick={() => abrirAchado(a)}>Abrir caso</button>
          <button class="botao secundario pequeno" disabled={ocupado} onclick={() => naoE(a)}>Não é caso</button>
        </div>
      </div>
    {/each}
    {#if achados.length > 5 && !verTodosAchados}
      <button class="botao secundario largo" onclick={() => (verTodosAchados = true)}>Ver todos ({achados.length})</button>
    {/if}
  </details>
{/if}

<label class="busca">
  <span class="sr">Buscar caso</span>
  <input type="search" placeholder="Buscar: nome, rua, prontuário" bind:value={busca} autocomplete="off" />
</label>

<div class="chips" role="tablist" aria-label="Mostrar casos">
  {#each SITUACOES as [s, nome] (s)}
    <button class="chip" class:ativo={situacao === s} role="tab" aria-selected={situacao === s} onclick={() => (situacao = s)}>
      {nome} <span class="n">{contaSituacao(s)}</span>
    </button>
  {/each}
</div>
<div class="chips tipos" role="tablist" aria-label="Tipo de caso">
  {#each TIPOS as [t, nome] (t)}
    <button class="chip fino" class:ativo={tipo === t} role="tab" aria-selected={tipo === t} onclick={() => (tipo = t)}>
      {nome} <span class="n">{contaTipo(t)}</span>
    </button>
  {/each}
</div>

{#snippet cartaoCaso(c: Caso)}
  {@const f = familiaPorId(c.familiaId)}
  {@const dias = !c.resolvidoEm ? diasParado(c, hoje) : 0}
  <li class="cartao caso {c.categoria}" class:resolvido={!!c.resolvidoEm}>
    <button class="cab" onclick={() => { aberto = aberto === c.id ? null : c.id; resposta = ''; resolverJunto = false; }} aria-expanded={aberto === c.id}>
      <span class="tags">
        <span class="tag {c.categoria}">{NOMES_CATEGORIA_CASO[c.categoria]}</span>
        {#if dias >= DIAS_PARADO}<span class="tag parado">Sem resposta {textoParado(dias)}</span>{/if}
        {#if c.emulti}<span class="tag emulti">eMulti: {c.emulti}</span>{/if}
      </span>
      <strong>{c.titulo}</strong>
      <span class="suave pequeno">{f ? enderecoCurto(f) : ''}{f?.prontuario.trim() ? ` · pront. ${f.prontuario.trim()}` : ''} · novidade {ultimaNovidade(c) ? formatarData(ultimaNovidade(c)).slice(0, 5) : '—'}</span>
      {#if aberto !== c.id}<span class="previa">{c.texto}</span>{/if}
    </button>
    {#if aberto === c.id}
      <p class="texto">{c.texto}</p>
      {#if c.npv}<p class="pequeno"><strong>NPV:</strong> {c.npv}</p>{/if}
      {#if c.respostas?.length}
        <div class="respostas">
          <p class="pequeno"><strong>Respostas e andamento</strong></p>
          <ol>
            {#each [...c.respostas].reverse() as r, i (i)}
              <li><span class="suave pequeno">{formatarData(r.data)}{r.reuniao ? ' · reunião' : ''}</span><br />{r.texto}</li>
            {/each}
          </ol>
        </div>
      {/if}
      {#if !c.resolvidoEm}
        <div class="responder">
          <label class="campo">
            <span>O que a equipe decidiu / novidade</span>
            <textarea rows="2" bind:value={resposta} placeholder="Ex.: VD médica marcada dia 20; encaminhado para a psicologia"></textarea>
          </label>
          <label class="opcao pequeno"><input type="checkbox" bind:checked={daReuniao} /> Foi na reunião de equipe</label>
          <label class="opcao pequeno"><input type="checkbox" bind:checked={resolverJunto} /> Resolveu o caso</label>
          <button class="botao pequeno" disabled={!resposta.trim()} onclick={() => responder(c)}>Anotar resposta</button>
        </div>
      {/if}
      <div class="linha-botoes">
        <button class="botao pequeno" onclick={() => copiarCaso(c)}><Icone nome="copiar" tamanho={18} /> Copiar caso</button>
        <button class="botao secundario pequeno" onclick={() => ir(`familia/${c.familiaId}`)}>Ver família</button>
        <button class="botao secundario pequeno" onclick={() => ir(`caso/${c.familiaId}/${c.id}`)}>Editar</button>
        <button class="botao pequeno" onclick={() => resolverCaso(c.id, !c.resolvidoEm)}>{c.resolvidoEm ? 'Reabrir' : 'Resolvido'}</button>
      </div>
    {/if}
  </li>
{/snippet}

{#if lista.length === 0}
  <p class="cartao suave">{busca.trim() ? 'Nenhum caso encontrado para essa busca.' : 'Nenhum caso aqui.'}</p>
{:else if situacao === 'abertos'}
  {#each secoes as g (g.secao)}
    <details class="secao {g.secao}" open={g.secao !== 'acompanhando' || g.casos.length <= 10 || !!busca.trim()}>
      <summary><h2>{g.nome} <span class="suave">({g.casos.length})</span></h2></summary>
      <ul class="casos">
        {#each g.casos as c (c.id)}{@render cartaoCaso(c)}{/each}
      </ul>
    </details>
  {/each}
{:else}
  <ul class="casos">
    {#each lista as c (c.id)}{@render cartaoCaso(c)}{/each}
  </ul>
{/if}

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
  .reuniao {
    border-left: 6px solid var(--primaria);
  }
  .reuniao p {
    margin: 0 0 8px;
  }
  .achados h2 {
    margin: 0 0 4px;
  }
  .achado {
    border-top: 1px solid var(--borda);
    padding: 10px 0;
  }
  .achado p {
    margin: 3px 0;
    overflow-wrap: anywhere;
  }
  .topo-achado {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .tag.reun {
    background: var(--primaria-clara);
    color: var(--texto);
  }
  .linha-botoes {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .tag.parado {
    background: var(--aviso-fundo);
    color: var(--aviso-texto);
    border: 1px solid var(--aviso-texto);
  }
  .respostas ol {
    margin: 4px 0 8px;
    padding-left: 18px;
  }
  .respostas li {
    margin: 4px 0;
    overflow-wrap: anywhere;
  }
  .responder {
    border-top: 1px solid var(--borda);
    padding-top: 8px;
    margin: 8px 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .responder .opcao {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .linha-reuniao {
    display: flex;
    flex-wrap: wrap;
    gap: 2px 10px;
    align-items: baseline;
  }
  .como {
    margin-top: 6px;
  }
  .como summary {
    cursor: pointer;
    font-size: 0.85rem;
    color: var(--texto-suave);
  }
  .equipe {
    margin: 8px 0;
  }
  .equipe summary {
    list-style: none;
    cursor: pointer;
    text-align: center;
  }
  .equipe summary::-webkit-details-marker {
    display: none;
  }
  .menu-equipe {
    display: grid;
    gap: 8px;
    margin-top: 8px;
  }
  .achados summary {
    cursor: pointer;
    list-style: none;
  }
  .achados summary::-webkit-details-marker {
    display: none;
  }
  .achados[open] summary {
    margin-bottom: 6px;
  }
  .busca {
    display: block;
    margin: 10px 0 0;
  }
  .busca input {
    width: 100%;
    min-height: 48px;
    padding: 8px 12px;
    font-size: 1rem;
    border: 2px solid var(--borda);
    border-radius: 12px;
    background: var(--cartao);
    color: var(--texto);
    box-sizing: border-box;
  }
  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }
  .chips.tipos {
    margin-top: 0;
  }
  .chip.fino {
    min-height: 36px;
    padding: 2px 10px;
    font-size: 0.85rem;
    border-width: 1px;
  }
  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .secao {
    margin: 14px 0 0;
  }
  .secao > summary {
    cursor: pointer;
    list-style: none;
    position: sticky;
    top: 0;
    padding: 6px 0;
    background: var(--fundo);
    z-index: 1;
  }
  .secao > summary::-webkit-details-marker {
    display: none;
  }
  .secao > summary h2 {
    flex: 1;
    font-size: 1.1rem;
    margin: 0;
    text-align: left;
  }
  .secao.urgentes > summary h2 {
    color: var(--perigo);
  }
</style>
