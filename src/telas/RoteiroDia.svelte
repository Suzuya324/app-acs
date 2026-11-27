<script lang="ts">
  import AusenciaRapida from '../componentes/AusenciaRapida.svelte';
  import Icone from '../componentes/Icone.svelte';
  import { formatarData, hojeISO } from '../lib/datas';
  import { casasDescansando, casasGraves, casasPausadas, DIAS_DESCANSO, DIAS_DESCANSO_GRAVE, emOrdemDeRua, maisImportantes, puladaHoje, roteiroDoDia } from '../lib/dia';
  import { app, contextoAcompanhamento, enderecoCurto, mostrarAviso, opcoesPainel, pularCasaHoje, responsavel } from '../lib/estado.svelte';
  import { calcularPainel } from '../lib/meta';
  import { ir, voltar } from '../lib/rotas.svelte';

  const hoje = hojeISO();
  // Na versão básica, o roteiro já vem com as casas que faltam visitar no mês.
  let comMeta = $state(!!app.config.versaoBasica);
  const faltam = $derived(new Set(calcularPainel(app.familias, app.visitas, hoje, app.config.metaMensal, opcoesPainel()).naoVisitadas.map((f) => f.id)));
  const todas = $derived(
    roteiroDoDia(app.familias, app.revisitas, { ...contextoAcompanhamento(), casos: app.casos }, comMeta ? faltam : new Set()),
  );
  /** Quantas casas para hoje (as mais importantes primeiro; 0 = todas). */
  let quantas = $state(15);
  const casas = $derived(maisImportantes(todas, quantas));
  const nuncaMostradas = $derived(casas.filter((c) => c.nunca).length);
  const ruas = $derived(emOrdemDeRua(casas, app.config.ruas));
  let ruaEscolhida = $state<string | null>(null);
  const mostrar = $derived(ruaEscolhida ? ruas.filter((r) => r.rua === ruaEscolhida) : ruas);
  const importantes = $derived(casas.filter((c) => c.peso >= 50).length);
  const diasDescanso = $derived(app.config.diasDescanso ?? DIAS_DESCANSO);
  /** Casas que tiveram VD (ou tentativa) há poucos dias: ficam de fora até a data de volta. */
  const habitadas = $derived(app.familias.filter((f) => f.situacaoCasa === 'habitada'));
  const graves = $derived(casasGraves(habitadas, { ...contextoAcompanhamento(), casos: app.casos }));
  const descansando = $derived(casasDescansando(habitadas, app.visitas, hoje, diasDescanso, graves, app.config.diasDescansoGrave ?? DIAS_DESCANSO_GRAVE));
  /** Casas que o ACS pulou hoje (voltam amanhã). */
  const puladas = $derived(habitadas.filter((f) => puladaHoje(f, hoje)));
  /** Casas com 3 ausências seguidas: fora do roteiro até confirmar se ainda moram ali. */
  const pausadas = $derived(casasPausadas(habitadas, app.visitas, hoje));

  async function pular(id: string) {
    await pularCasaHoje(id, hoje);
    mostrarAviso('Pulada: volta amanhã ✓');
  }
  async function desfazerPular(id: string) {
    await pularCasaHoje(id, hoje, false);
    mostrarAviso('Voltou ao roteiro ✓');
  }
</script>

<button class="botao secundario pequeno voltar" onclick={() => voltar('')}><Icone nome="voltar" /> Voltar</button>

<h1>Roteiro de hoje</h1>
<p class="suave">
  {formatarData(hoje)} · <strong>{casas.length}</strong> {casas.length === 1 ? 'casa' : 'casas'}{importantes ? `, ${importantes} mais importantes (em vermelho)` : ''}.
  Quem teve VD ou “ninguém em casa” há menos de {diasDescanso} dias fica de fora (a casa descansa). Junta: caso urgente, nível A/B vencido, revisita, consulta que passou ou é amanhã, caso parado, quem está sumido e as casas que nunca tiveram VD (na lista curta, 1 vaga em cada 3 é delas, mesmo no nível C). Em ordem de rua.
</p>

<div class="chips" role="radiogroup" aria-label="Quantas casas">
  {#each [10, 15, 20, 0] as n (n)}
    <button class="chip" class:ativo={quantas === n} role="radio" aria-checked={quantas === n} onclick={() => (quantas = n)}>{n ? `${n} casas` : `Todas (${todas.length})`}</button>
  {/each}
</div>
{#if quantas && todas.length > quantas}<p class="suave pequeno">Mostrando as {quantas} mais importantes de {todas.length}{nuncaMostradas ? `, com ${nuncaMostradas} ${nuncaMostradas === 1 ? 'casa que nunca teve VD' : 'casas que nunca tiveram VD'}` : ''}. As outras ficam para os próximos dias.</p>{/if}

<label class="opcao">
  <input type="checkbox" bind:checked={comMeta} />
  <span>Incluir as que faltam para a meta do mês</span>
</label>

{#if ruas.length > 1}
  <div class="chips" role="tablist" aria-label="Escolher a rua">
    <button class="chip" class:ativo={!ruaEscolhida} role="tab" aria-selected={!ruaEscolhida} onclick={() => (ruaEscolhida = null)}>Todas <span class="n">{casas.length}</span></button>
    {#each ruas as r (r.rua)}
      <button class="chip" class:ativo={ruaEscolhida === r.rua} role="tab" aria-selected={ruaEscolhida === r.rua} onclick={() => (ruaEscolhida = r.rua)}>{r.rua} <span class="n">{r.casas.length}</span></button>
    {/each}
  </div>
{/if}

{#if descansando.length}
  <details class="descanso">
    <summary>{descansando.length} {descansando.length === 1 ? 'casa descansando' : 'casas descansando'} (VD há menos de {diasDescanso} dias)</summary>
    <ul class="lista">
      {#each descansando as d (d.familia.id)}
        <li class="pequeno">
          <button class="link" onclick={() => ir(`familia/${d.familia.id}`)}>{enderecoCurto(d.familia)}</button>
          <span class="suave"> · última VD {formatarData(d.ultima)} · volta em {formatarData(d.voltaEm)}{d.grave ? ' (caso grave: descansa menos)' : ''}</span>
        </li>
      {/each}
    </ul>
  </details>
{/if}

{#if puladas.length}
  <details class="descanso">
    <summary>{puladas.length} {puladas.length === 1 ? 'casa pulada hoje' : 'casas puladas hoje'} (voltam amanhã)</summary>
    <ul class="lista">
      {#each puladas as f (f.id)}
        <li class="pequeno">
          <button class="link" onclick={() => ir(`familia/${f.id}`)}>{enderecoCurto(f)}</button>
          <button class="botao secundario pequeno" onclick={() => desfazerPular(f.id)}>Voltar ao roteiro</button>
        </li>
      {/each}
    </ul>
  </details>
{/if}

{#if pausadas.length}
  <details class="descanso">
    <summary>{pausadas.length} {pausadas.length === 1 ? 'casa pausada' : 'casas pausadas'} (ninguém em casa 3 vezes seguidas)</summary>
    <p class="suave pequeno">Fora do roteiro até você confirmar se a família ainda mora ali (vizinho, ficha, enfermeira). Se der um motivo forte, ela volta sozinha.</p>
    <ul class="lista">
      {#each pausadas as p (p.familia.id)}
        <li class="pequeno">
          <button class="link" onclick={() => ir(`familia/${p.familia.id}`)}>{enderecoCurto(p.familia)}</button>
          <span class="suave"> · últimas tentativas: {p.tentativas.slice(0, 3).map((d) => formatarData(d).slice(0, 5)).join(', ')}</span>
        </li>
      {/each}
    </ul>
  </details>
{/if}

<div class="atalhos">
  <button class="botao secundario pequeno" onclick={() => ir('ordem-rua')}>↕ Ordem de caminhada da rua</button>
  <button class="botao secundario pequeno" onclick={() => ir('equipe')}>👥 Listas da equipe</button>
</div>

{#if !casas.length}
  <p class="cartao suave">Nada urgente para hoje. 👍 Marque “Incluir as que faltam para a meta” para ver as outras.</p>
{/if}

{#each mostrar as r (r.rua)}
  <h2 class="rua">{r.rua} <span class="suave">({r.casas.length})</span></h2>
  <ul class="lista">
    {#each r.casas as c (c.familia.id)}
      <li class="cartao casa" class:alta={c.peso >= 80} class:media={c.peso >= 50 && c.peso < 80}>
        <button class="topo" onclick={() => ir(`familia/${c.familia.id}`)}>
          <strong>{c.familia.numero}{c.familia.complemento ? ` – ${c.familia.complemento}` : ''}</strong>
          <span class="suave pequeno">{responsavel(c.familia)}</span>
          {#if c.familia.referencia}<span class="pequeno">📍 {c.familia.referencia}</span>{/if}
          {#if c.familia.telefone || c.familia.melhorHorario}<span class="pequeno">{c.familia.telefone ? `📞 ${c.familia.telefone}` : ''}{c.familia.telefone && c.familia.melhorHorario ? ' · ' : ''}{c.familia.melhorHorario ? `🕒 ${c.familia.melhorHorario}` : ''}</span>{/if}
        </button>
        <ul class="motivos">
          {#each c.motivos as m, i (i)}<li class:forte={m.peso >= 50}>{m.texto}</li>{/each}
        </ul>
        <div class="acoes-rapidas">
          <button class="botao pequeno" onclick={() => ir(`vd/${c.familia.id}`)}><Icone nome="mais" tamanho={18} /> Registrar VD</button>
          <button class="botao secundario pequeno" onclick={() => ir(`vd-rapida/${c.familia.id}`)}>⚡ Sem novidade</button>
          <AusenciaRapida familia={c.familia} />
          <button class="botao secundario pequeno" onclick={() => pular(c.familia.id)}>⏭ Pular hoje</button>
        </div>
        {#if c.puladas >= 3}<p class="aviso-pulada pequeno">Pulada {c.puladas} vezes nos últimos 14 dias. Vale ir hoje ou mudar o motivo.</p>{/if}
      </li>
    {/each}
  </ul>
{/each}

<style>
  .descanso {
    margin: 8px 0;
    padding: 8px 12px;
    border-radius: 12px;
    background: var(--cartao);
    border: 1px solid var(--borda);
  }
  .descanso summary {
    cursor: pointer;
    font-weight: 700;
    min-height: 36px;
  }
  .link {
    background: none;
    border: 0;
    padding: 0;
    color: var(--primaria);
    font-weight: 700;
    text-decoration: underline;
    cursor: pointer;
  }
  .atalhos {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 8px 0;
  }
  .aviso-pulada {
    margin: 4px 0 0;
    color: var(--ausencia);
    font-weight: 700;
  }
  .descanso li {
    margin: 6px 0;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
  }
  .acoes-rapidas {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 6px;
  }
  .voltar {
    margin-bottom: 12px;
  }
  .opcao {
    display: flex;
    gap: 10px;
    align-items: center;
    margin: 8px 0;
  }
  .opcao input {
    width: 22px;
    height: 22px;
  }
  .chips {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding-bottom: 6px;
    margin: 8px 0;
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
  .rua {
    margin: 16px 0 8px;
  }
  .lista {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .casa {
    margin: 0;
    border-left: 6px solid var(--borda);
  }
  .casa.alta {
    border-left-color: var(--perigo);
  }
  .casa.media {
    border-left-color: var(--ausencia);
  }
  .topo {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    width: 100%;
    background: none;
    border: 0;
    padding: 0;
    text-align: left;
    color: var(--texto);
    font: inherit;
    cursor: pointer;
  }
  .topo strong {
    font-size: 1.15rem;
  }
  .motivos {
    margin: 6px 0 10px;
    padding-left: 18px;
  }
  .motivos li {
    margin: 2px 0;
    overflow-wrap: anywhere;
  }
  .motivos .forte {
    font-weight: 700;
  }
</style>
