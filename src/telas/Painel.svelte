<script lang="ts">
  import Desfecho from '../componentes/Desfecho.svelte';
  import GraficoDias from '../componentes/GraficoDias.svelte';
  import Icone from '../componentes/Icone.svelte';
  import { contarDiasDeCampo, periodoDe, periodoVizinho } from '../lib/calendario';
  import { formatarData, hojeISO } from '../lib/datas';
  import { app, opcoesPainel } from '../lib/estado.svelte';
  import { calcularPainel } from '../lib/meta';
  import { indicadores, pct as porcento, previsaoDaMeta } from '../lib/indicadores';
  import { ir, voltar } from '../lib/rotas.svelte';
  import type { Desfecho as TDesfecho } from '../lib/tipos';

  const hoje = hojeISO();
  /** Uma data dentro do período mostrado. */
  let referencia = $state(hoje);
  const opcoes = $derived(opcoesPainel(referencia));
  const painel = $derived(calcularPainel(app.familias, app.visitas, hoje, app.config.metaMensal, opcoes));
  const pct = $derived(Math.min(100, Math.round((painel.familiasVisitadas / painel.meta) * 100)));
  const diasDeCampo = $derived(contarDiasDeCampo(painel.periodo.inicio, painel.periodo.fim, opcoes.ehDiaDeCampo!));
  const ritmo = $derived(diasDeCampo > 0 ? Math.ceil(painel.meta / diasDeCampo) : 0);
  const previsao = $derived(previsaoDaMeta(painel, hoje, opcoes.ehDiaDeCampo!));
  const inds = $derived(indicadores(app.familias, app.visitas, painel.periodo.inicio, painel.periodo.fim));
  const ordem: TDesfecho[] = ['realizada', 'ausente_realizada', 'ausencia_completa', 'recusa'];

  function mudar(direcao: -1 | 1) {
    referencia = periodoVizinho(painel.periodo, direcao, app.config.diaInicioPeriodo).inicio;
  }
  const temProximo = $derived(painel.periodo.fim < periodoDe(hoje, app.config.diaInicioPeriodo).fim);
</script>

<button class="botao secundario pequeno voltar" onclick={() => voltar('')}><Icone nome="voltar" /> Voltar</button>

<h1>Produção</h1>

<div class="navegar" role="group" aria-label="Escolher o período">
  <button class="seta" onclick={() => mudar(-1)} aria-label="Período anterior"><Icone nome="voltar" /></button>
  <div class="periodo">
    <strong>{painel.periodo.rotulo}</strong>
    <span class="suave pequeno">{formatarData(painel.periodo.inicio)} a {formatarData(painel.periodo.fim)}</span>
    {#if painel.atual}<span class="suave pequeno">período atual</span>{:else}<button class="link" onclick={() => (referencia = hoje)}>voltar para o atual</button>{/if}
  </div>
  <button class="seta" onclick={() => mudar(1)} disabled={!temProximo} aria-label="Próximo período"><Icone nome="seta" /></button>
</div>

<section class="cartao">
  <p class="numero-meta"><strong>{painel.familiasVisitadas}</strong> <span class="suave">de {painel.meta} famílias</span></p>
  <div class="barra" role="progressbar" aria-valuemin="0" aria-valuemax={painel.meta} aria-valuenow={painel.familiasVisitadas} aria-label="Famílias visitadas no período">
    <div class="preenchido" style="width: {pct}%"></div>
  </div>
  {#if painel.faltam === 0}
    <p class="resultado ok">Meta batida! 🎉</p>
  {:else if painel.passado}
    <p class="resultado">Faltaram <strong>{painel.faltam}</strong> famílias para a meta.</p>
  {:else}
    <p class="resultado">
      Faltam <strong>{painel.faltam}</strong>: cerca de <strong>{painel.porDiaUtil} por dia de campo</strong>
      <span class="suave">({painel.diasUteisRestantes} dias de campo até o fim)</span>
    </p>
  {/if}
  <p class="suave pequeno">{painel.totalVisitasMes} visitas no período · {diasDeCampo} dias de campo (sem fins de semana, feriados e dias marcados em Ajustes)</p>
  {#if previsao}
    <p class="previsao" class:bom={previsao.vaiBater}>
      {previsao.vaiBater ? '📈' : '⚠️'} No ritmo de agora ({previsao.ritmo.toFixed(1).replace('.', ',')} por dia de campo), você fecha o mês com
      <strong>~{previsao.previsto}</strong> famílias{previsao.vaiBater ? ': vai bater a meta.' : `: faltariam ${painel.meta - previsao.previsto}.`}
    </p>
  {/if}
</section>

{#if inds.length}
  <section class="cartao">
    <h2>Indicadores do período</h2>
    <p class="suave pequeno">Por grupo: quantas pessoas tiveram a casa visitada (VD que conta) e, para hipertensos e diabéticos, quantas tiveram a medida registrada na VD.</p>
    <table class="ind">
      <thead><tr><th>Grupo</th><th>Pessoas</th><th>Visitadas</th><th>Medida</th></tr></thead>
      <tbody>
        {#each inds as i (i.grupo)}
          <tr>
            <td>{i.nome}</td>
            <td class="n">{i.total}</td>
            <td class="n">{i.visitadas} <span class="suave">({porcento(i.visitadas, i.total)}%)</span></td>
            <td class="n">{#if i.medida}{i.medida.feitas} <span class="suave">({porcento(i.medida.feitas, i.total)}%)</span>{:else}—{/if}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </section>
{/if}

<section class="cartao">
  <h2>Famílias visitadas por dia</h2>
  <p class="suave pequeno">Cada família conta uma vez, no dia da primeira visita que conta para a meta.</p>
  <GraficoDias dias={painel.porDia} {ritmo} />
</section>

<section class="cartao">
  <h2>Visitas por desfecho</h2>
  <ul class="lista desfechos">
    {#each ordem as d (d)}
      <li><Desfecho valor={d} /> <strong>{painel.porDesfecho[d]}</strong></li>
    {/each}
  </ul>
  <p class="suave pequeno">Contam para a meta: {app.config.nomesDesfecho.realizada} e {app.config.nomesDesfecho.ausente_realizada} (cada família uma vez no período).</p>
</section>

<button class="botao largo relatorio" onclick={() => ir('relatorio')}>Relatório de produção (imprimir/PDF)</button>
<button class="botao secundario largo prontuarios" onclick={() => ir('prontuarios')}>Lista de prontuários em ordem (PDF)</button>
<button class="botao secundario largo prontuarios" onclick={() => ir('numeros')}>Números livres para prontuário novo</button>

{#if painel.atual}
  <button class="botao secundario largo" onclick={() => ir('roteiro')}>Planejar a rua do dia ({painel.naoVisitadas.length} não visitadas)</button>
{/if}

<style>
  .voltar {
    margin-bottom: 12px;
  }
  .prontuarios {
    margin-top: 10px;
  }
  .relatorio {
    margin-bottom: 10px;
  }
  .navegar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 12px;
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
    min-height: 36px;
  }
  .numero-meta {
    font-size: 1.15rem;
    margin-bottom: 8px;
  }
  .numero-meta strong {
    font-size: 2.6rem;
    color: var(--primaria);
  }
  .barra {
    height: 20px;
    border-radius: 999px;
    background: var(--primaria-clara);
    overflow: hidden;
    border: 1px solid var(--borda);
  }
  .preenchido {
    height: 100%;
    background: var(--primaria);
    border-radius: 999px;
  }
  .resultado {
    margin-top: 10px;
  }
  .ok {
    color: var(--realizada);
    font-weight: 700;
  }
  .desfechos li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid var(--borda);
  }
  .desfechos li:last-child {
    border-bottom: 0;
  }
  .previsao {
    margin: 8px 0 0;
    padding: 6px 10px;
    border-radius: 10px;
    background: var(--aviso-fundo);
    color: var(--aviso-texto);
  }
  .previsao.bom {
    background: var(--primaria-clara);
    color: var(--texto);
  }
  .ind {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.92rem;
  }
  .ind th,
  .ind td {
    padding: 6px 4px;
    border-bottom: 1px solid var(--borda);
    text-align: left;
  }
  .ind .n {
    text-align: right;
    white-space: nowrap;
  }
</style>
