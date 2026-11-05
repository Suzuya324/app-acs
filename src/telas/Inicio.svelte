<script lang="ts">
  import Desfecho from '../componentes/Desfecho.svelte';
  import Icone from '../componentes/Icone.svelte';
  import { diferencaDias, formatarData, formatarDataLonga, hojeISO } from '../lib/datas';
  import { app, descartarRascunho, salvarConfig, enderecoCurto, familiaPorId, opcoesPainel, responsavel, revisitasAbertas } from '../lib/estado.svelte';
  import { calcularAtencao } from '../lib/atencao';
  import { calcularPainel } from '../lib/meta';
  import { listarPendencias } from '../lib/pendencias';
  import { ir } from '../lib/rotas.svelte';
  import type { Desfecho as TDesfecho } from '../lib/tipos';

  const hoje = hojeISO();
  const painel = $derived(calcularPainel(app.familias, app.visitas, hoje, app.config.metaMensal, opcoesPainel()));
  const pct = $derived(Math.min(100, Math.round((painel.familiasVisitadas / painel.meta) * 100)));
  const diasSemBackup = $derived(app.config.ultimoBackup ? diferencaDias(app.config.ultimoBackup, hoje) : null);
  const lembrarBackup = $derived(!app.config.usandoExemplo && (diasSemBackup === null || diasSemBackup >= 7));
  const marcadas = $derived(app.revisitas && revisitasAbertas());
  const atencao = $derived(calcularAtencao(app.familias, app.visitas, hoje));
  const aniversarios = $derived(atencao.filter((a) => a.tipo === 'aniversario').length);
  const totalPendencias = $derived(listarPendencias(app.familias).length);
  const precisaImportar = $derived(app.config.usandoExemplo || app.familias.length === 0);
  const instalado = typeof matchMedia !== 'undefined' && (matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true);
  const passos = $derived([
    { feito: !precisaImportar, texto: 'Importar a sua área', ir: 'importar' },
    { feito: app.visitas.length > 0, texto: 'Registrar a primeira VD', ir: 'busca' },
    { feito: !!app.config.ultimoBackup, texto: 'Fazer o primeiro backup', ir: 'ajustes' },
    { feito: instalado, texto: 'Instalar o app na tela do celular', ir: 'como-usar' },
  ]);
  const mostrarPassos = $derived(!app.config.primeirosPassosOcultos && passos.some((p) => !p.feito));
  function esconderPassos() {
    app.config.primeirosPassosOcultos = true;
    salvarConfig();
  }
  const ordemDesfechos: TDesfecho[] = ['realizada', 'ausente_realizada', 'ausencia_completa', 'recusa'];

  function haQuanto(data: string | null): string {
    if (!data) return 'sem visita registrada';
    const d = diferencaDias(data, hoje);
    return d === 1 ? 'última visita há 1 dia' : `última visita há ${d} dias`;
  }
</script>

<p class="saudacao">Olá, <strong>{app.config.nomeAcs}</strong><br /><span class="suave">{formatarDataLonga(hoje)}</span></p>

{#if app.rascunho}
  {@const r = app.rascunho}
  {@const fr = familiaPorId(r.familiaId)}
  <div class="cartao chamada">
    <strong>Visita pela metade{fr ? `: ${enderecoCurto(fr)}` : ''}</strong>
    <span class="suave pequeno">{r.visitaId ? 'Correção de VD' : 'VD'} de {formatarData(r.data)} que você começou e não salvou.</span>
    <div class="linha-botoes">
      <button class="botao secundario pequeno" onclick={() => confirm('Descartar a visita pela metade?') && descartarRascunho()}>Descartar</button>
      <button class="botao pequeno" onclick={() => ir(r.visitaId ? `vd/${r.familiaId}/${r.visitaId}` : `vd/${r.familiaId}`)}>Continuar</button>
    </div>
  </div>
{/if}

{#if mostrarPassos}
  <section class="cartao chamada" aria-labelledby="t-passos">
    <h2 id="t-passos">Primeiros passos</h2>
    <ul class="passos">
      {#each passos as p (p.texto)}
        <li class:feito={p.feito}>
          <span class="marca" aria-hidden="true">{p.feito ? '✓' : '○'}</span>
          {#if p.feito}<span>{p.texto}</span>{:else}<button class="link-simples passo" onclick={() => ir(p.ir)}>{p.texto} ›</button>{/if}
        </li>
      {/each}
    </ul>
    <div class="linha-botoes">
      <button class="botao secundario pequeno" onclick={esconderPassos}>Esconder</button>
      <button class="botao pequeno" onclick={() => ir('como-usar')}>Como usar o app</button>
    </div>
  </section>
{/if}

{#if precisaImportar}
  <div class="cartao chamada">
    <strong>{app.config.usandoExemplo ? 'Você está usando dados de exemplo.' : 'Sua área ainda está vazia.'}</strong>
    <span>Importe a lista da sua área (planilha CSV) para começar de verdade.</span>
    <button class="botao pequeno" onclick={() => ir('importar')}>Importar minha área</button>
  </div>
{/if}

{#if lembrarBackup && !precisaImportar}
  <div class="alerta lembrete">
    <span>{diasSemBackup === null ? 'Você ainda não fez nenhum backup.' : `Último backup há ${diasSemBackup} dias.`} Faça um agora para não perder nada.</span>
    <button class="botao pequeno" onclick={() => ir('ajustes')}>Fazer backup</button>
  </div>
{/if}

<section class="cartao" aria-labelledby="t-meta">
  <h2 id="t-meta">Meta de {painel.periodo.rotulo}</h2>
  <p class="numero-meta">
    <strong>{painel.familiasVisitadas}</strong> <span class="suave">de {painel.meta} famílias</span>
  </p>
  <div class="barra" role="progressbar" aria-valuemin="0" aria-valuemax={painel.meta} aria-valuenow={painel.familiasVisitadas} aria-label="Famílias visitadas no mês">
    <div class="preenchido" style="width: {pct}%"></div>
  </div>
  {#if painel.faltam > 0}
    <p class="falta">
      Faltam <strong>{painel.faltam}</strong> famílias: cerca de
      <strong>{painel.porDiaUtil} por dia de campo</strong>
      <span class="suave">({painel.diasUteisRestantes} dias de campo até o fim, sem feriados)</span>
    </p>
  {:else}
    <p class="falta"><strong>Meta batida! 🎉</strong></p>
  {/if}
  <button class="link-simples ver-mais" onclick={() => ir('painel')}>Ver gráfico e meses anteriores ›</button>
</section>

<button class="botao largo grande" onclick={() => ir('busca')}>
  <Icone nome="mais" /> Nova visita
</button>

<section class="numeros" aria-label="Resumo de visitas">
  <div class="cartao mini"><strong>{painel.visitasHoje}</strong><span>hoje</span></div>
  <div class="cartao mini"><strong>{painel.visitasSemana}</strong><span>na semana</span></div>
  <div class="cartao mini"><strong>{painel.totalVisitasMes}</strong><span>VDs no mês</span></div>
</section>

{#if atencao.length > 0}
  <button class="item-link pendencias" onclick={() => ir('atencao')}>
    <span><strong>Atenção</strong><br /><span class="suave pequeno">gestantes, acamados, P.A., glicemia, idades{aniversarios ? ` · ${aniversarios} aniversário(s) na semana` : ''}</span></span>
    <span class="num-pend">{atencao.length}</span>
  </button>
{/if}

{#if totalPendencias > 0}
  <button class="item-link pendencias" onclick={() => ir('pendencias')}>
    <span><strong>O que falta completar</strong><br /><span class="suave pequeno">prontuários, datas de nascimento, responsáveis…</span></span>
    <span class="num-pend">{totalPendencias}</span>
  </button>
{/if}

<section class="cartao">
  <h2>Visitas do mês por desfecho</h2>
  <ul class="lista desfechos">
    {#each ordemDesfechos as d (d)}
      <li><Desfecho valor={d} /> <strong>{painel.porDesfecho[d]}</strong></li>
    {/each}
  </ul>
  <p class="suave pequeno">Contam para a meta: Visita realizada e Ausente realizada (cada família uma vez por mês).</p>
</section>

{#if marcadas.length}
  <section class="cartao">
    <h2>Revisitas marcadas ({marcadas.length})</h2>
    <ul class="lista">
      {#each marcadas.slice(0, 8) as r (r.id)}
        {@const f = familiaPorId(r.familiaId)}
        {@const atrasada = r.ate < hoje}
        <li>
          <button class="item-link" onclick={() => ir(`familia/${r.familiaId}`)}>
            <strong>{f ? enderecoCurto(f) : '(família)'}</strong><br />
            <span class="pequeno">{r.motivo}</span>
            <span class="pequeno quando" class:atrasada class:hoje={r.ate === hoje}>
              · {atrasada ? `atrasada (era até ${formatarData(r.ate)})` : r.ate === hoje ? 'hoje' : `até ${formatarData(r.ate)}`}
            </span>
          </button>
        </li>
      {/each}
    </ul>
    {#if marcadas.length > 8}<p class="suave pequeno">…e mais {marcadas.length - 8}.</p>{/if}
  </section>
{/if}

{#if painel.revisitar.length}
  <section class="cartao">
    <h2>Revisitar ({painel.revisitar.length})</h2>
    <p class="suave pequeno">Ninguém em casa na última tentativa.</p>
    <ul class="lista">
      {#each painel.revisitar as r (r.familia.id)}
        <li>
          <button class="item-link" onclick={() => ir(`familia/${r.familia.id}`)}>
            <strong>{enderecoCurto(r.familia)}</strong><br />
            <span class="suave pequeno">{responsavel(r.familia)} · tentativa em {formatarData(r.data)}</span>
          </button>
        </li>
      {/each}
    </ul>
  </section>
{/if}

<section class="cartao">
  <h2>Sugestão do dia</h2>
  <p class="suave pequeno">Famílias há mais tempo sem visita.</p>
  <ul class="lista">
    {#each painel.sugestoes.slice(0, 5) as s (s.familia.id)}
      <li>
        <button class="item-link" onclick={() => ir(`familia/${s.familia.id}`)}>
          <strong>{enderecoCurto(s.familia)}</strong><br />
          <span class="suave pequeno">{responsavel(s.familia)} · {haQuanto(s.ultimaVisita)}</span>
        </button>
      </li>
    {/each}
  </ul>
</section>

<button class="item-link planejar" onclick={() => ir('mapa')}>
  <span><strong>Mapa da área</strong><br /><span class="suave pequeno">todas as casas, coloridas pela situação no mês</span></span>
  <Icone nome="casa" />
</button>

<button class="item-link planejar" onclick={() => ir('roteiro')}>
  <span><strong>Planejar a rua do dia</strong><br /><span class="suave pequeno">casas que faltam, na ordem dos números</span></span>
  <span class="num-pend">{painel.naoVisitadas.length}</span>
</button>

<style>
  .chamada {
    display: flex;
    flex-direction: column;
    gap: 8px;
    border: 2px solid var(--primaria);
  }
  .passos {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .passos li {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 44px;
  }
  .passos li.feito {
    color: var(--texto-suave);
    text-decoration: line-through;
  }
  .marca {
    width: 22px;
    text-align: center;
    font-weight: 800;
    color: var(--primaria);
  }
  .passo {
    border-bottom: 0;
    padding: 6px 0;
  }
  .pendencias {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
  }
  .num-pend {
    min-width: 44px;
    padding: 4px 10px;
    border-radius: 999px;
    background: var(--aviso-fundo);
    color: var(--aviso-texto);
    font-weight: 800;
    text-align: center;
  }
  .lembrete {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 14px;
  }
  .saudacao {
    margin: 4px 0 12px;
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
    transition: width 0.4s;
  }
  .falta {
    margin-top: 10px;
  }
  .grande {
    min-height: 64px;
    font-size: 1.2rem;
    margin-bottom: 14px;
  }
  .numeros {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
  }
  .mini {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 12px 6px;
    text-align: center;
  }
  .mini strong {
    font-size: 1.8rem;
    line-height: 1.1;
  }
  .mini span {
    font-size: 0.9rem;
    color: var(--texto-suave);
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
  .ver-mais {
    border-bottom: 0;
    padding-bottom: 0;
  }
  .quando {
    font-weight: 700;
  }
  .quando.atrasada {
    color: var(--perigo);
  }
  .quando.hoje {
    color: var(--ausencia);
  }
  .planejar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
  }
  .link-simples {
    background: none;
    border: 0;
    padding: 10px 0;
    width: 100%;
    text-align: left;
    color: var(--primaria);
    font-weight: 600;
    cursor: pointer;
    border-bottom: 1px solid var(--borda);
  }
</style>
