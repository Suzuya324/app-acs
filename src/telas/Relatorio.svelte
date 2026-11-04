<script lang="ts">
  // Relatório de produção do período, SEM nomes nem endereços de pacientes.
  // Para imprimir ou salvar em PDF (menu Imprimir → Salvar como PDF).
  import Icone from '../componentes/Icone.svelte';
  import { contarDiasDeCampo, motivoSemCampo, periodoVizinho } from '../lib/calendario';
  import { formatarData, formatarDataLonga, hojeISO } from '../lib/datas';
  import { app, opcoesPainel } from '../lib/estado.svelte';
  import { calcularPainel } from '../lib/meta';
  import { voltar } from '../lib/rotas.svelte';
  import type { Desfecho } from '../lib/tipos';

  const hoje = hojeISO();
  let referencia = $state(hoje);
  const opcoes = $derived(opcoesPainel(referencia));
  const painel = $derived(calcularPainel(app.familias, app.visitas, hoje, app.config.metaMensal, opcoes));
  const calendario = $derived({ feriadosIgnorados: app.config.feriadosIgnorados, diasSemCampo: app.config.diasSemCampo });
  const diasDeCampo = $derived(contarDiasDeCampo(painel.periodo.inicio, painel.periodo.fim, opcoes.ehDiaDeCampo!));
  const diasComVisita = $derived(painel.porDia.filter((d) => d.contam + d.naoContam > 0).length);
  const media = $derived(diasComVisita ? (painel.familiasVisitadas / diasComVisita).toFixed(1).replace('.', ',') : '0');
  const pct = $derived(Math.round((painel.familiasVisitadas / painel.meta) * 100));
  const ordem: Desfecho[] = ['realizada', 'ausente_realizada', 'ausencia_completa', 'recusa'];
  const geradoEm = new Date().toLocaleString('pt-BR');

  function mudar(d: -1 | 1) {
    referencia = periodoVizinho(painel.periodo, d, app.config.diaInicioPeriodo).inicio;
  }
</script>

<div class="sem-impressao">
  <button class="botao secundario pequeno voltar" onclick={() => voltar('painel')}><Icone nome="voltar" /> Voltar</button>
  <div class="navegar">
    <button class="botao secundario pequeno" onclick={() => mudar(-1)}>‹ Anterior</button>
    <button class="botao secundario pequeno" onclick={() => mudar(1)} disabled={painel.atual}>Próximo ›</button>
  </div>
  <button class="botao largo" onclick={() => window.print()}>Imprimir ou salvar em PDF</button>
  <p class="suave pequeno dica">No celular: Imprimir → escolha “Salvar como PDF”. O relatório não tem nomes nem endereços de pacientes.</p>
</div>

<article class="relatorio">
  <header>
    <h1>Relatório de produção: visitas domiciliares</h1>
    <p>
      {#if app.config.nomeAcs}<strong>ACS:</strong> {app.config.nomeAcs} · {/if}
      <strong>Período:</strong> {painel.periodo.rotulo} ({formatarData(painel.periodo.inicio)} a {formatarData(painel.periodo.fim)})
      {#if painel.atual} · <em>parcial, até {formatarData(hoje)}</em>{/if}
    </p>
  </header>

  <section class="numeros">
    <div><span class="grande">{painel.familiasVisitadas}</span><span>famílias visitadas (contam para a meta)</span></div>
    <div><span class="grande">{painel.meta}</span><span>meta do período</span></div>
    <div><span class="grande">{pct}%</span><span>da meta</span></div>
    <div><span class="grande">{painel.totalVisitasMes}</span><span>visitas registradas</span></div>
    <div><span class="grande">{diasComVisita}</span><span>dias com visita (de {diasDeCampo} dias de campo)</span></div>
    <div><span class="grande">{media}</span><span>famílias por dia trabalhado</span></div>
  </section>

  <section>
    <h2>Visitas por desfecho</h2>
    <table>
      <thead><tr><th>Desfecho</th><th class="n">Visitas</th><th>Conta para a meta?</th></tr></thead>
      <tbody>
        {#each ordem as d (d)}
          <tr>
            <td>{app.config.nomesDesfecho[d]}</td>
            <td class="n">{painel.porDesfecho[d]}</td>
            <td>{d === 'realizada' || d === 'ausente_realizada' ? 'Sim' : 'Não'}</td>
          </tr>
        {/each}
      </tbody>
    </table>
    <p class="nota">Cada família conta uma vez no período. O total de visitas inclui revisitas e visitas que não contam.</p>
  </section>

  <section>
    <h2>Dia a dia</h2>
    <table>
      <thead><tr><th>Dia</th><th class="n">Famílias que contam</th><th class="n">Outras visitas</th><th>Observação</th></tr></thead>
      <tbody>
        {#each painel.porDia as d (d.data)}
          {@const motivo = motivoSemCampo(d.data, calendario)}
          {#if d.contam || d.naoContam || (motivo && motivo !== 'fim de semana')}
            <tr class:sem-campo={!!motivo}>
              <td>{formatarDataLonga(d.data, true)}</td>
              <td class="n">{d.contam}</td>
              <td class="n">{d.naoContam}</td>
              <td>{motivo && motivo !== 'fim de semana' ? motivo : ''}</td>
            </tr>
          {/if}
        {/each}
      </tbody>
    </table>
  </section>

  <footer>Gerado em {geradoEm} pelo Facilitador de VDs. Sem dados de identificação de pacientes.</footer>
</article>

<style>
  .voltar {
    margin-bottom: 12px;
  }
  .navegar {
    display: flex;
    justify-content: space-between;
    margin-bottom: 10px;
  }
  .dica {
    margin: 8px 0 16px;
  }
  .relatorio {
    background: #fff;
    color: #111;
    border: 1px solid var(--borda);
    border-radius: 12px;
    padding: 16px;
    font-size: 0.95rem;
  }
  .relatorio h1 {
    font-size: 1.25rem;
  }
  .relatorio h2 {
    font-size: 1.05rem;
    margin-top: 16px;
  }
  .numeros {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 10px;
    margin: 12px 0;
  }
  .numeros div {
    border: 1px solid #ccc;
    border-radius: 8px;
    padding: 8px;
    display: flex;
    flex-direction: column;
  }
  .grande {
    font-size: 1.6rem;
    font-weight: 800;
  }
  table {
    width: 100%;
    border-collapse: collapse;
  }
  th,
  td {
    border-bottom: 1px solid #ddd;
    padding: 5px 4px;
    text-align: left;
  }
  .n {
    text-align: right;
  }
  .sem-campo td {
    color: #666;
  }
  .nota,
  footer {
    color: #555;
    font-size: 0.8rem;
    margin-top: 8px;
  }
  @media print {
    @page {
      size: A4 landscape;
      margin: 12mm;
    }
    .sem-impressao {
      display: none;
    }
    .relatorio {
      border: 0;
      padding: 0;
    }
  }
</style>
