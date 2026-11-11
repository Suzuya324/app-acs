<script lang="ts">
  import Icone from '../componentes/Icone.svelte';
  import { formatarData, hojeISO, proximoDiaDaSemana } from '../lib/datas';
  import { casoDoAchado, casosAchados, casosDaPauta, DIAS_PARADO, PARADOS_NA_PAUTA, textoDoCaso, ultimaNovidade, diasParado, ordenarCasos, textoDaPauta, textoParado, type CasoAchado } from '../lib/casos-auto';
  import { app, enderecoCurto, esconderDoAcompanhamento, familiaPorId, mostrarAviso, resolverCaso, responderCaso, salvarCaso } from '../lib/estado.svelte';
  import { NOMES_CATEGORIA_CASO } from '../lib/rotulos';
  import { ir } from '../lib/rotas.svelte';
  import type { Caso, CategoriaCaso } from '../lib/tipos';

  type Filtro = 'todos' | 'pauta' | CategoriaCaso | 'emulti' | 'resolvidos';
  const FILTROS: [Filtro, string][] = [
    ['todos', 'Todos'],
    ['pauta', 'Reunião'],
    ['urgente', 'Urgente'],
    ['importante', 'Importante'],
    ['social', 'Social / cadastro'],
    ['npv', 'NPV'],
    ['emulti', 'eMulti'],
    ['resolvidos', 'Resolvidos'],
  ];
  let filtro = $state<Filtro>('todos');
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
  const lista = $derived.by(() => {
    const base = filtro === 'resolvidos' ? ativos.filter((c) => c.resolvidoEm) : abertos;
    if (filtro === 'pauta') return casosDaPauta(abertos, hoje);
    const f = (c: Caso) =>
      filtro === 'todos' || filtro === 'resolvidos' ? true : filtro === 'emulti' ? !!c.emulti?.trim() : c.categoria === filtro;
    return ordenarCasos(base.filter(f), hoje);
  });
  const conta = (f: Filtro) =>
    f === 'todos' ? abertos.length : f === 'pauta' ? casosDaPauta(abertos, hoje).length : f === 'resolvidos' ? ativos.length - abertos.length : f === 'emulti' ? abertos.filter((c) => c.emulti?.trim()).length : abertos.filter((c) => c.categoria === f).length;

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
<p class="suave">Situações para acompanhar de perto e levar à equipe. O app também acha casos no que você escreve nas VDs.</p>

{#if reuniao}
  <section class="cartao reuniao">
    <p>
      <strong>Reunião de equipe: {reuniao === hojeISO() ? 'hoje' : `${DIAS[diaReuniao]}, ${formatarData(reuniao)}`}</strong><br />
      <span class="suave pequeno">{conta('pauta')} {conta('pauta') === 1 ? 'caso' : 'casos'} na pauta (urgentes, eMulti, os marcados para a reunião e os parados).</span>
      {#if parados}<br /><span class="pequeno"><strong>{parados} {parados === 1 ? 'caso parado' : 'casos parados'}</strong> há {DIAS_PARADO} dias ou mais sem resposta. Os {Math.min(parados, PARADOS_NA_PAUTA)} mais esquecidos entram na pauta; anotando a resposta, os próximos sobem.</span>{/if}
    </p>
    <div class="linha-botoes">
      <button class="botao secundario pequeno" onclick={() => (filtro = 'pauta')}>Ver a pauta</button>
      <button class="botao pequeno" disabled={!conta('pauta')} onclick={copiarPauta}><Icone nome="copiar" tamanho={18} /> Copiar a pauta</button>
    </div>
  </section>
{/if}

<button class="botao secundario largo tecnica" onclick={() => ir('tecnica')}>Lista para a técnica de enfermagem (P.A., glicemia, curativo)</button>

{#if achados.length}
  <section class="cartao achados">
    <h2>Achei nas VDs <span class="suave">({achados.length})</span></h2>
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
  </section>
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
      <button class="cab" onclick={() => { aberto = aberto === c.id ? null : c.id; resposta = ''; resolverJunto = false; }} aria-expanded={aberto === c.id}>
        <span class="tag {c.categoria}">{NOMES_CATEGORIA_CASO[c.categoria]}</span>
        <strong>{c.titulo}</strong>
        <span class="suave pequeno">{f ? enderecoCurto(f) : ''}{f?.prontuario.trim() ? ` · pront. ${f.prontuario.trim()}` : ''} · última novidade {ultimaNovidade(c) ? formatarData(ultimaNovidade(c)) : '—'}</span>
        {#if !c.resolvidoEm && diasParado(c, hoje) >= DIAS_PARADO}<span class="tag parado">Sem resposta {textoParado(diasParado(c, hoje))}</span>{/if}
        {#if c.emulti}<span class="tag emulti">eMulti: {c.emulti}</span>{/if}
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
</style>
