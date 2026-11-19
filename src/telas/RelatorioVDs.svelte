<script lang="ts">
  // Relatório das minhas VDs, COM nomes: quantas, quais casas, quem estava, como foi e se foi lançada no Fast.
  // Para conferir e comprovar o trabalho. Fica só com o ACS (tem dados de pacientes).
  import Icone from '../componentes/Icone.svelte';
  import { entregarArquivo } from '../lib/arquivo';
  import { combina } from '../lib/busca';
  import { periodoDe, periodoVizinho } from '../lib/calendario';
  import { formatarData, hojeISO, somarDias } from '../lib/datas';
  import { app, mostrarAviso } from '../lib/estado.svelte';
  import { diaDaSemana, linhasDoRelatorio, resumoDoRelatorio, textoDoRelatorio } from '../lib/relatorio-vds';
  import { ir, voltar } from '../lib/rotas.svelte';

  const hoje = hojeISO();
  type Modo = 'hoje' | 'ontem' | 'dia' | 'mes' | 'datas';
  let modo = $state<Modo>('hoje');
  let dia = $state(hoje);
  let referencia = $state(hoje);
  const mes = $derived(periodoDe(referencia, app.config.diaInicioPeriodo));
  let de = $state(periodoDe(hoje, app.config.diaInicioPeriodo).inicio);
  let ate = $state(hoje);
  let comRelato = $state(true);
  let busca = $state('');
  let filtroFast = $state<'todas' | 'falta' | 'lancadas'>('todas');

  const faixa = $derived(
    modo === 'hoje' ? { de: hoje, ate: hoje }
    : modo === 'ontem' ? { de: somarDias(hoje, -1), ate: somarDias(hoje, -1) }
    : modo === 'dia' ? { de: dia, ate: dia }
    : modo === 'mes' ? { de: mes.inicio, ate: mes.fim }
    : { de, ate },
  );
  const rotulo = $derived(
    faixa.de === faixa.ate ? `${formatarData(faixa.de)} (${diaDaSemana(faixa.de)})` : modo === 'mes' ? mes.rotulo : `${formatarData(faixa.de)} a ${formatarData(faixa.ate)}`,
  );
  const todas = $derived(linhasDoRelatorio(app.visitas, app.familias, faixa.de, faixa.ate, (d) => app.config.nomesDesfecho[d]));
  const linhas = $derived.by(() => {
    const q = busca.trim();
    return todas.filter((l) => (filtroFast === 'todas' || (filtroFast === 'falta') === !l.lancada) && (!q || combina([l.endereco, l.prontuario, l.responsavel, ...l.presentes, ...l.ausentes].join(' '), q)));
  });
  const resumo = $derived(resumoDoRelatorio(linhas));
  const porDia = $derived(resumo.dias.map((d) => ({ ...d, linhas: linhas.filter((l) => l.data === d.data) })));
  const geradoEm = new Date().toLocaleString('pt-BR');

  const texto = () => textoDoRelatorio(linhas, `${rotulo}${filtroFast === 'falta' ? ' · só as que faltam lançar' : filtroFast === 'lancadas' ? ' · só as lançadas' : ''}${busca.trim() ? ` · busca: ${busca.trim()}` : ''}`, comRelato);
  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto());
      app.desfazer = null;
      mostrarAviso('Relatório copiado ✓');
    } catch {
      mostrarAviso('Não consegui copiar.');
    }
  }
  async function baixar() {
    const ok = await entregarArquivo(`minhas-vds_${faixa.de}${faixa.ate !== faixa.de ? `_a_${faixa.ate}` : ''}.txt`, texto(), 'text/plain');
    if (ok) mostrarAviso('Arquivo pronto ✓');
  }
</script>

<div class="sem-impressao">
  <button class="botao secundario pequeno voltar" onclick={() => voltar('')}><Icone nome="voltar" /> Voltar</button>
  <h1>Minhas VDs</h1>
  <p class="suave">Tudo o que você registrou: quantas VDs, em quais casas, quem estava, como foi e se já foi lançada no Fast.</p>

  <div class="chips" role="tablist" aria-label="Período">
    {#each [['hoje', 'Hoje'], ['ontem', 'Ontem'], ['dia', 'Um dia'], ['mes', 'Mês'], ['datas', 'De… até…']] as [m, nome] (m)}
      <button class="chip" class:ativo={modo === m} role="tab" aria-selected={modo === m} onclick={() => (modo = m as Modo)}>{nome}</button>
    {/each}
  </div>
  {#if modo === 'dia'}
    <label class="campo"><span class="pequeno">Dia</span><input type="date" bind:value={dia} max={hoje} /></label>
  {:else if modo === 'mes'}
    <div class="navegar">
      <button class="botao secundario pequeno" aria-label="Mês anterior" onclick={() => (referencia = periodoVizinho(mes, -1, app.config.diaInicioPeriodo).inicio)}>‹</button>
      <strong>{mes.rotulo}</strong>
      <button class="botao secundario pequeno" aria-label="Próximo mês" disabled={mes.fim >= periodoDe(hoje, app.config.diaInicioPeriodo).fim} onclick={() => (referencia = periodoVizinho(mes, 1, app.config.diaInicioPeriodo).inicio)}>›</button>
    </div>
  {:else if modo === 'datas'}
    <div class="duas">
      <label class="campo"><span class="pequeno">De</span><input type="date" bind:value={de} max={ate} /></label>
      <label class="campo"><span class="pequeno">Até</span><input type="date" bind:value={ate} min={de} max={hoje} /></label>
    </div>
  {/if}
  <div class="chips" role="radiogroup" aria-label="Lançamento no Fast">
    {#each [['todas', 'Todas'], ['falta', 'Falta lançar'], ['lancadas', 'Lançadas']] as [k, nome] (k)}
      <button class="chip" class:ativo={filtroFast === k} role="radio" aria-checked={filtroFast === k} onclick={() => (filtroFast = k as typeof filtroFast)}>{nome}</button>
    {/each}
  </div>
  <label class="campo"><span class="pequeno">Procurar (nome, rua e número, prontuário)</span><input type="search" bind:value={busca} placeholder="Ex.: Acácias 90 ou Joana" autocomplete="off" /></label>
</div>

<article class="relatorio">
  <header>
    <h2 class="titulo">Minhas VDs · {rotulo}</h2>
    {#if app.config.nomeAcs}<p class="pequeno">ACS: {app.config.nomeAcs}{app.config.micro ? ` · ${app.config.micro}` : ''}</p>{/if}
  </header>

  <div class="numeros">
    <div><span class="grande">{resumo.total}</span><span>{resumo.total === 1 ? 'VD' : 'VDs'}</span></div>
    <div><span class="grande">{resumo.familias}</span><span>famílias</span></div>
    <div><span class="grande">{resumo.familiasQueContam}</span><span>contam para a meta</span></div>
    <div><span class="grande">{resumo.pessoas}</span><span>pessoas atendidas</span></div>
  </div>
  <p class="pequeno">
    {app.config.nomesDesfecho.realizada}: <strong>{resumo.porDesfecho.realizada}</strong> ·
    {app.config.nomesDesfecho.ausente_realizada}: <strong>{resumo.porDesfecho.ausente_realizada}</strong> ·
    {app.config.nomesDesfecho.ausencia_completa}: <strong>{resumo.porDesfecho.ausencia_completa}</strong> ·
    {app.config.nomesDesfecho.recusa}: <strong>{resumo.porDesfecho.recusa}</strong>
  </p>
  <p class="pequeno">Lançadas no Fast: <strong>{resumo.lancadas}</strong> · <span class:falta={resumo.faltaLancar > 0}>Falta lançar: <strong>{resumo.faltaLancar}</strong></span></p>

  {#if !linhas.length}
    <p class="suave">Nenhuma VD {busca.trim() ? 'encontrada com essa busca' : 'registrada'} em {rotulo}.</p>
  {/if}

  {#each porDia as d (d.data)}
    <section class="dia">
      <h3>{formatarData(d.data)} ({diaDaSemana(d.data)}) · {d.vds} {d.vds === 1 ? 'VD' : 'VDs'} · {d.familias} {d.familias === 1 ? 'família' : 'famílias'}</h3>
      <ol class="vds">
        {#each d.linhas as l (l.visita.id)}
          <li class="vd" class:nao-conta={!l.conta}>
            <div class="cab-vd">
              <strong>{l.hora ? `${l.hora} · ` : ''}{l.endereco}</strong>
              {#if l.prontuario}<span class="pequeno">pront. {l.prontuario}</span>{/if}
            </div>
            <p><span class="desf">{l.desfecho}</span>{l.conta ? '' : ' (não conta)'} · motivo: {l.motivo}{l.compartilhada ? ` · com ${l.compartilhada}` : ''}</p>
            {#if l.presentes.length}<p><strong>Presentes:</strong> {l.presentes.join(', ')}</p>{:else if l.responsavel}<p><strong>Responsável:</strong> {l.responsavel}</p>{/if}
            {#if l.ausentes.length}<p><strong>Ausentes:</strong> {l.ausentes.join(', ')}</p>{/if}
            {#if l.sinais}<p><strong>Sinais:</strong> {l.sinais}</p>{/if}
            {#if comRelato && l.relato}<p class="relato">{l.relato}</p>{/if}
            <p class="pequeno fast" class:falta={!l.lancada}>
              Fast: {l.lancada ? `lançada${l.lancadaEm ? ` em ${l.lancadaEm}` : ''}` : 'FALTA LANÇAR'}{l.origem !== 'App' ? ` · veio do ${l.origem}` : ''}
            </p>
            {#if l.familia}<button class="link sem-impressao" onclick={() => ir(`familia/${l.familia!.id}`)}>Abrir a família ›</button>{/if}
          </li>
        {/each}
      </ol>
    </section>
  {/each}

  <footer>Gerado em {geradoEm} pelo Facilitador de VDs. Contém dados de pacientes: guarde com cuidado.</footer>
</article>

<div class="sem-impressao acoes">
  <label class="opcao"><input type="checkbox" bind:checked={comRelato} /> Mostrar o relato de cada VD</label>
  <button class="botao largo" onclick={() => window.print()}><Icone nome="pasta" tamanho={20} /> Imprimir ou salvar em PDF</button>
  <button class="botao secundario largo" onclick={copiar}><Icone nome="copiar" tamanho={20} /> Copiar o relatório (texto)</button>
  <button class="botao secundario largo" onclick={baixar}>Baixar o relatório (arquivo de texto)</button>
  <button class="botao secundario largo" onclick={() => ir('conferir-fast')}>Conferir com o Fast (achar VDs que sumiram)</button>
  <button class="botao secundario largo" onclick={() => ir('exportar-visitas')}>Planilha (Excel) e arquivo para o Claude</button>
  <p class="suave pequeno">
    No celular: Imprimir → “Salvar como PDF”. O relatório tem nomes e dados de saúde: guarde num lugar seguro e não mande
    para grupos.
  </p>
</div>

<style>
  .voltar {
    margin-bottom: 12px;
  }
  .chips {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin: 10px 0;
  }
  .chip {
    min-height: 44px;
    padding: 6px 14px;
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
  .navegar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin: 8px 0;
  }
  .duas {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .relatorio {
    background: var(--cartao);
    border: 1px solid var(--borda);
    border-radius: 12px;
    padding: 14px;
    margin-top: 10px;
  }
  .titulo {
    margin: 0 0 4px;
  }
  .numeros {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 8px;
    margin: 10px 0;
  }
  .numeros div {
    border: 1px solid var(--borda);
    border-radius: 10px;
    padding: 8px;
    display: flex;
    flex-direction: column;
  }
  .grande {
    font-size: 1.7rem;
    font-weight: 800;
  }
  .falta {
    color: var(--perigo);
    font-weight: 700;
  }
  .dia h3 {
    margin: 16px 0 6px;
    padding-bottom: 4px;
    border-bottom: 2px solid var(--primaria);
  }
  .vds {
    padding-left: 22px;
    margin: 0;
  }
  .vd {
    padding: 8px 0;
    border-bottom: 1px solid var(--borda);
    overflow-wrap: anywhere;
    break-inside: avoid;
  }
  .vd p {
    margin: 3px 0;
  }
  .vd.nao-conta .desf {
    color: var(--perigo);
  }
  .cab-vd {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: baseline;
    justify-content: space-between;
  }
  .relato {
    font-size: 0.92em;
    border-left: 3px solid var(--borda);
    padding-left: 8px;
  }
  .link {
    background: none;
    border: 0;
    padding: 4px 0;
    color: var(--primaria);
    font-weight: 700;
    cursor: pointer;
    min-height: 36px;
  }
  .acoes {
    margin-top: 12px;
  }
  .opcao {
    display: flex;
    gap: 8px;
    align-items: center;
    margin: 8px 0;
  }
  .opcao input {
    width: 22px;
    height: 22px;
  }
  footer {
    margin-top: 12px;
    font-size: 0.8rem;
    color: var(--suave, #555);
  }
  @media print {
    @page {
      size: A4;
      margin: 12mm;
    }
    .sem-impressao {
      display: none !important;
    }
    .relatorio {
      border: 0;
      padding: 0;
      background: #fff;
      color: #111;
      font-size: 10.5pt;
    }
    .falta,
    .vd.nao-conta .desf {
      color: #000;
    }
  }
</style>
