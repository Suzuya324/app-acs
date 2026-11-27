<script lang="ts">
  // Equipe em números: VDs feitas junto com técnica, enfermeira, médica e APA, e se eles foram nos pacientes.
  // Tudo lido do que já está salvo no app (VD compartilhada e o botão "Foi" das listas da equipe).
  import Icone from '../componentes/Icone.svelte';
  import { periodoDe, periodoVizinho } from '../lib/calendario';
  import { formatarData, hojeISO } from '../lib/datas';
  import { listaParaApa, listaParaEnfermeira, listaParaMedica } from '../lib/equipe';
  import { META_JUNTO_PADRAO, NOMES_FUNCAO, resumoEquipe, type Funcao } from '../lib/equipe-numeros';
  import { app, enderecoCurto, mostrarAviso, opcoesPainel, responsavel, salvarConfig } from '../lib/estado.svelte';
  import { calcularPainel } from '../lib/meta';
  import { ir, voltar } from '../lib/rotas.svelte';
  import { listaParaTecnica } from '../lib/tecnica';

  const hoje = hojeISO();
  let referencia = $state(hoje);
  type Parte = 'resumo' | 'profissional' | 'casas' | 'foi';
  let parte = $state<Parte>('resumo');

  const opcoes = $derived(opcoesPainel(referencia));
  const painel = $derived(calcularPainel(app.familias, app.visitas, hoje, app.config.metaMensal, opcoes));
  const r = $derived(resumoEquipe(app.familias, app.visitas, painel.periodo.inicio, painel.periodo.fim, painel.visitasContadas, hoje));
  const temProximo = $derived(painel.periodo.fim < periodoDe(hoje, app.config.diaInicioPeriodo).fim);
  function mudar(direcao: -1 | 1) {
    referencia = periodoVizinho(painel.periodo, direcao, app.config.diaInicioPeriodo).inicio;
  }

  // ---- Meta própria das VDs junto
  const metaJunto = $derived(app.config.metaJunto && app.config.metaJunto > 0 ? app.config.metaJunto : META_JUNTO_PADRAO);
  const pctMetaJunto = $derived(Math.min(100, Math.round((r.vdsJunto / metaJunto) * 100)));
  let editandoMeta = $state(false);
  let novaMeta = $state(0);
  function abrirMeta() {
    novaMeta = metaJunto;
    editandoMeta = !editandoMeta;
  }
  async function salvarMeta() {
    if (!(novaMeta > 0)) return mostrarAviso('A meta precisa ser maior que zero.');
    app.config.metaJunto = Math.round(novaMeta);
    await salvarConfig();
    editandoMeta = false;
    mostrarAviso('Meta salva ✓');
  }

  // ---- Quem foi: pedidos abertos nas listas da equipe x quem já foi no período
  const abertos = $derived<Record<Exclude<Funcao, 'outro'>, number>>({
    tecnica: listaParaTecnica(app.familias, app.visitas, app.casos, app.prioritarios, hoje, app.config.ruas).length,
    enfermeira: listaParaEnfermeira(app.familias, app.visitas, app.casos, app.prioritarios, hoje, app.config.ruas).length,
    medica: listaParaMedica(app.familias, app.visitas, app.casos, app.prioritarios, hoje, app.config.ruas).length,
    apa: listaParaApa(app.familias, app.visitas, app.casos, hoje, app.config.ruas).length,
  });
  const LISTAS: Record<Exclude<Funcao, 'outro'>, string> = { tecnica: 'tecnica', enfermeira: 'equipe/enfermeira', medica: 'equipe/medica', apa: 'equipe/apa' };
  const ORDEM: Exclude<Funcao, 'outro'>[] = ['tecnica', 'enfermeira', 'medica', 'apa'];

  // ---- Gráficos (barras simples)
  const maxLinha = $derived(Math.max(1, ...r.linhas.map((l) => l.total)));
  const maxMes = $derived(Math.max(1, ...r.porMes.map((m) => m.junto + m.sozinho)));
  const NOME_MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const rotuloMes = (m: string) => `${NOME_MES[Number(m.slice(5, 7)) - 1]}/${m.slice(2, 4)}`;
  const porId = $derived(new Map(app.familias.map((f) => [f.id, f])));
  const primeiroNome = (nome: string) => nome.split(' ')[0];
  let verTodas = $state(false);
  const casasMostradas = $derived(verTodas ? r.casas : r.casas.slice(0, 20));
</script>

<button class="botao secundario pequeno voltar" onclick={() => voltar('')}><Icone nome="voltar" /> Voltar</button>

<h1>Equipe em números</h1>
<p class="suave">VDs feitas junto com a técnica, a enfermeira, a Dra. e o APA, e se eles foram nos pacientes.</p>

<div class="navegar" role="group" aria-label="Escolher o período">
  <button class="seta" onclick={() => mudar(-1)} aria-label="Período anterior"><Icone nome="voltar" /></button>
  <div class="periodo">
    <strong>{painel.periodo.rotulo}</strong>
    <span class="suave pequeno">{formatarData(painel.periodo.inicio)} a {formatarData(painel.periodo.fim)}</span>
    {#if painel.atual}<span class="suave pequeno">período atual</span>{:else}<button class="link" onclick={() => (referencia = hoje)}>voltar para o atual</button>{/if}
  </div>
  <button class="seta" onclick={() => mudar(1)} disabled={!temProximo} aria-label="Próximo período"><Icone nome="seta" /></button>
</div>

<div class="partes" role="tablist" aria-label="O que ver">
  <button role="tab" class:ativa={parte === 'resumo'} aria-selected={parte === 'resumo'} onclick={() => (parte = 'resumo')}>Resumo</button>
  <button role="tab" class:ativa={parte === 'profissional'} aria-selected={parte === 'profissional'} onclick={() => (parte = 'profissional')}>Por profissional</button>
  <button role="tab" class:ativa={parte === 'casas'} aria-selected={parte === 'casas'} onclick={() => (parte = 'casas')}>Casas <span class="n">{r.casas.length}</span></button>
  <button role="tab" class:ativa={parte === 'foi'} aria-selected={parte === 'foi'} onclick={() => (parte = 'foi')}>Quem foi</button>
</div>

{#if parte === 'resumo'}
  <section class="cartao">
    <h2>Entre as VDs do período</h2>
    <p class="numero-meta"><strong>{r.vdsJunto}</strong> <span class="suave">de {r.vdsDoPeriodo} VDs foram junto com a equipe ({r.pctJunto}%)</span></p>
    <div class="barra" role="progressbar" aria-valuemin="0" aria-valuemax={Math.max(1, r.vdsDoPeriodo)} aria-valuenow={r.vdsJunto} aria-label="VDs junto com a equipe, dentro das VDs do período">
      <div class="preenchido" style="width: {r.pctJunto}%"></div>
    </div>
    <p class="suave pequeno">As outras {Math.max(0, r.vdsDoPeriodo - r.vdsJunto)} foram só suas.</p>
  </section>

  <section class="cartao">
    <h2>Meta das VDs junto com a equipe</h2>
    <p class="numero-meta"><strong>{r.vdsJunto}</strong> <span class="suave">de {metaJunto} no período</span></p>
    <div class="barra" role="progressbar" aria-valuemin="0" aria-valuemax={metaJunto} aria-valuenow={r.vdsJunto} aria-label="Meta das VDs junto com a equipe">
      <div class="preenchido" style="width: {pctMetaJunto}%"></div>
    </div>
    {#if r.vdsJunto >= metaJunto}<p class="ok"><strong>Meta batida! 🎉</strong></p>{:else}<p class="suave pequeno">Faltam {metaJunto - r.vdsJunto}.</p>{/if}
    <button class="link" onclick={abrirMeta}>{editandoMeta ? 'Fechar' : 'Mudar essa meta'}</button>
    {#if editandoMeta}
      <div class="meta-edit">
        <label class="campo"><span>VDs junto com a equipe por período</span><input type="number" inputmode="numeric" min="1" bind:value={novaMeta} /></label>
        <button class="botao pequeno" onclick={salvarMeta}>Salvar meta</button>
      </div>
    {/if}
  </section>

  <section class="cartao">
    <h2>Mês a mês</h2>
    <p class="suave pequeno">Casas visitadas junto com a equipe e idas deles sozinhos (botão "Foi").</p>
    <ul class="meses">
      {#each r.porMes as m (m.mes)}
        <li>
          <span class="mes">{rotuloMes(m.mes)}</span>
          <span class="trilho" aria-hidden="true">
            <span class="junto" style="width: {(m.junto / maxMes) * 100}%"></span><span class="sozinho" style="width: {(m.sozinho / maxMes) * 100}%"></span>
          </span>
          <span class="valores">{m.junto} + {m.sozinho}</span>
        </li>
      {/each}
    </ul>
    <p class="legenda pequeno"><span class="cor junto"></span> junto com você <span class="cor sozinho"></span> foi sozinho</p>
  </section>
{:else if parte === 'profissional'}
  <section class="cartao">
    <h2>Por profissional</h2>
    {#if !r.linhas.length}
      <p class="suave">Nenhuma ida da equipe neste período. Quando você marcar "VD compartilhada" na VD ou "Foi" nas listas da equipe, aparece aqui.</p>
    {:else}
      <ul class="barras">
        {#each r.linhas as l (l.chave)}
          <li>
            <div class="topo-barra"><strong>{l.nome}</strong><span>{l.total}</span></div>
            <span class="trilho" aria-hidden="true"><span class="junto" style="width: {(l.junto / maxLinha) * 100}%"></span><span class="sozinho" style="width: {(l.sozinho / maxLinha) * 100}%"></span></span>
          </li>
        {/each}
      </ul>
      <p class="legenda pequeno"><span class="cor junto"></span> junto com você <span class="cor sozinho"></span> foi sozinho</p>
      <div class="rolar">
        <table>
          <thead><tr><th>Profissional</th><th class="n">Junto</th><th class="n">Sozinho</th><th class="n">Total</th><th>Última</th></tr></thead>
          <tbody>
            {#each r.linhas as l (l.chave)}
              <tr><td>{l.nome}</td><td class="n">{l.junto}</td><td class="n">{l.sozinho}</td><td class="n"><strong>{l.total}</strong></td><td>{formatarData(l.ultima).slice(0, 5)}</td></tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </section>
{:else if parte === 'casas'}
  <section class="cartao">
    <h2>Casas atendidas junto ou pela equipe</h2>
    {#if !r.casas.length}
      <p class="suave">Nenhuma casa neste período.</p>
    {:else}
      <ul class="casas">
        {#each casasMostradas as c (c.familiaId)}
          {@const f = porId.get(c.familiaId)}
          {#if f}
            <li>
              <button class="item-link" onclick={() => ir(`familia/${f.id}`)}>
                <strong>{enderecoCurto(f)}</strong>
                <span class="suave pequeno">
                  {c.presentes.length ? c.presentes.map((id) => primeiroNome(f.moradores.find((m) => m.id === id)?.nome ?? '')).filter(Boolean).join(', ') : responsavel(f)}
                </span>
                <span class="pequeno">{c.quem.join(' e ')} · {formatarData(c.ultima).slice(0, 5)}{c.vezes > 1 ? ` · ${c.vezes} vezes` : ''}</span>
              </button>
            </li>
          {/if}
        {/each}
      </ul>
      {#if r.casas.length > 20 && !verTodas}<button class="link" onclick={() => (verTodas = true)}>Ver as {r.casas.length} casas</button>{/if}
    {/if}
  </section>
{:else}
  <section class="cartao">
    <h2>Eles foram nos pacientes?</h2>
    <p class="suave pequeno">"Pedidos abertos" são as pessoas que ainda estão nas listas de cada um. "Foi" conta o que você marcou no período.</p>
    <ul class="quemfoi">
      {#each ORDEM as f (f)}
        {@const p = r.porFuncao[f]}
        <li>
          <div class="topo-barra"><strong>{NOMES_FUNCAO[f]}</strong><span class="etq" class:zero={abertos[f] === 0}>{abertos[f]} {abertos[f] === 1 ? 'pedido aberto' : 'pedidos abertos'}</span></div>
          <p class="pequeno">
            Foi <strong>{p.junto + p.sozinho}</strong> {p.junto + p.sozinho === 1 ? 'vez' : 'vezes'} no período ({p.junto} junto, {p.sozinho} sozinho)
            {#if p.ultima}· última {formatarData(p.ultima).slice(0, 5)}{:else}· ainda não foi{/if}
          </p>
          <button class="botao secundario pequeno" onclick={() => ir(LISTAS[f])}>Ver a lista e marcar "Foi"</button>
        </li>
      {/each}
    </ul>
  </section>
{/if}

<style>
  .voltar {
    margin-bottom: 12px;
  }
  .navegar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin: 12px 0;
  }
  .seta {
    width: 52px;
    height: 52px;
    border-radius: 12px;
    border: 2px solid var(--primaria);
    background: var(--cartao);
    color: var(--primaria);
    display: grid;
    place-items: center;
    cursor: pointer;
  }
  .seta:disabled {
    opacity: 0.35;
  }
  .periodo {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }
  .periodo strong {
    font-size: 1.15rem;
  }
  .link {
    background: none;
    border: 0;
    color: var(--primaria);
    font-weight: 700;
    text-decoration: underline;
    cursor: pointer;
    min-height: 40px;
    padding: 0;
  }
  .partes {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin-bottom: 12px;
  }
  .partes button {
    flex: 1 1 auto;
    min-height: 44px;
    padding: 6px 12px;
    border-radius: 999px;
    border: 2px solid var(--borda);
    background: var(--cartao);
    color: var(--texto);
    font-weight: 700;
    cursor: pointer;
  }
  .partes button.ativa {
    background: var(--primaria);
    border-color: var(--primaria);
    color: #fff;
  }
  .n {
    font-variant-numeric: tabular-nums;
  }
  .ok {
    color: var(--primaria);
    margin: 4px 0;
  }
  .meta-edit {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 6px;
  }
  .meses,
  .barras,
  .casas,
  .quemfoi {
    list-style: none;
    margin: 8px 0;
    padding: 0;
  }
  .meses li {
    display: grid;
    grid-template-columns: 52px 1fr 64px;
    align-items: center;
    gap: 8px;
    padding: 4px 0;
  }
  .valores {
    text-align: right;
    font-variant-numeric: tabular-nums;
    font-weight: 700;
  }
  .trilho {
    display: flex;
    height: 14px;
    background: var(--primaria-clara);
    border-radius: 7px;
    overflow: hidden;
  }
  .trilho .junto {
    background: var(--primaria);
  }
  .trilho .sozinho {
    background: var(--texto-suave);
  }
  .barras li {
    margin: 10px 0;
  }
  .topo-barra {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 4px;
  }
  .legenda {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 14px;
    margin: 6px 0 10px;
  }
  .cor {
    display: inline-block;
    width: 12px;
    height: 12px;
    border-radius: 3px;
    margin-right: 4px;
  }
  .cor.junto {
    background: var(--primaria);
  }
  .cor.sozinho {
    background: var(--texto-suave);
  }
  .rolar {
    overflow-x: auto;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.88rem;
  }
  th {
    white-space: nowrap;
  }
  th,
  td {
    padding: 8px 4px;
    border-bottom: 1px solid var(--borda);
    text-align: left;
  }
  th.n,
  td.n {
    text-align: right;
  }
  .casas li {
    border-bottom: 1px solid var(--borda);
  }
  .casas .item-link {
    display: flex;
    flex-direction: column;
    gap: 2px;
    width: 100%;
    text-align: left;
    padding: 10px 0;
    background: none;
    border: 0;
    cursor: pointer;
    color: inherit;
  }
  .quemfoi li {
    padding: 12px 0;
    border-bottom: 1px solid var(--borda);
  }
  .quemfoi p {
    margin: 2px 0 8px;
  }
  .etq {
    padding: 2px 10px;
    border-radius: 999px;
    background: var(--aviso-fundo);
    color: var(--aviso-texto);
    font-weight: 700;
    font-size: 0.85rem;
  }
  .etq.zero {
    background: var(--primaria-clara);
    color: var(--primaria);
  }
</style>
