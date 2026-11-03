<script lang="ts">
  // Gráfico de colunas: famílias que contaram para a meta em cada dia do período.
  // Uma série só (o título diz o que é), barras finas com ponta arredondada,
  // linha de referência do "ritmo para a meta", toque na coluna para ver os números e tabela.
  import { formatarData, formatarDataLonga } from '../lib/datas';

  type Dia = { data: string; contam: number; naoContam: number; diaDeCampo: boolean };
  let { dias, ritmo = 0 }: { dias: Dia[]; ritmo?: number } = $props();

  const W = 360;
  const H = 170;
  const M = { topo: 18, direita: 8, base: 22, esquerda: 26 };
  const larguraUtil = W - M.esquerda - M.direita;
  const alturaUtil = H - M.topo - M.base;

  const maximo = $derived(Math.max(4, ritmo, ...dias.map((d) => d.contam)));
  /** Topo do eixo arredondado para um número "limpo". */
  const topoEixo = $derived.by(() => {
    const passo = maximo <= 10 ? 2 : maximo <= 20 ? 5 : 10;
    return Math.ceil(maximo / passo) * passo;
  });
  const marcas = $derived(Number.isInteger(topoEixo / 2) ? [0, topoEixo / 2, topoEixo] : [0, topoEixo]);
  const slot = $derived(larguraUtil / Math.max(1, dias.length));
  const larguraBarra = $derived(Math.max(3, Math.min(24, slot - 2)));
  const y = (v: number) => M.topo + alturaUtil - (v / topoEixo) * alturaUtil;
  const xCentro = (i: number) => M.esquerda + slot * i + slot / 2;
  const maiorDia = $derived(dias.reduce((m, d, i) => (d.contam > (dias[m]?.contam ?? -1) ? i : m), 0));

  /** Coluna com ponta de cima arredondada (4px) e base reta. */
  function coluna(i: number, valor: number): string {
    const w = larguraBarra;
    const x = xCentro(i) - w / 2;
    const yTopo = y(valor);
    const base = y(0);
    const r = Math.min(4, w / 2, base - yTopo);
    return `M${x},${base} V${yTopo + r} Q${x},${yTopo} ${x + r},${yTopo} H${x + w - r} Q${x + w},${yTopo} ${x + w},${yTopo + r} V${base} Z`;
  }

  let escolhido = $state<number | null>(null);
  const info = $derived(escolhido === null ? null : dias[escolhido]);
  const comVisita = $derived(dias.filter((d) => d.contam || d.naoContam));
</script>

<div class="grafico">
  <p class="leitura" aria-live="polite">
    {#if info}
      <strong>{formatarDataLonga(info.data, true)}</strong>: {info.contam} família{info.contam === 1 ? '' : 's'} que contam
      {#if info.naoContam} · {info.naoContam} outra{info.naoContam === 1 ? '' : 's'} visita{info.naoContam === 1 ? '' : 's'}{/if}
      {#if !info.diaDeCampo} · sem campo{/if}
    {:else}
      <span class="suave">Toque numa coluna para ver o dia.</span>
    {/if}
  </p>

  <svg viewBox="0 0 {W} {H}" role="img" aria-label="Famílias que contaram para a meta, por dia">
    <!-- dias sem campo (fim de semana, feriado, folga): faixa bem clara -->
    {#each dias as d, i (d.data)}
      {#if !d.diaDeCampo}
        <rect class="sem-campo" x={M.esquerda + slot * i} y={M.topo} width={slot} height={alturaUtil} />
      {/if}
    {/each}

    <!-- grade e eixo -->
    {#each marcas as m (m)}
      <line class="grade" x1={M.esquerda} x2={W - M.direita} y1={y(m)} y2={y(m)} />
      <text class="eixo" x={M.esquerda - 5} y={y(m) + 3.5} text-anchor="end">{m}</text>
    {/each}

    <!-- linha do ritmo necessário para a meta -->
    {#if ritmo > 0}
      <line class="ritmo" x1={M.esquerda} x2={W - M.direita} y1={y(ritmo)} y2={y(ritmo)} />
      <text class="rotulo-ritmo" x={W - M.direita} y={y(ritmo) - 4} text-anchor="end">ritmo da meta: {ritmo}/dia</text>
    {/if}

    <!-- colunas -->
    {#each dias as d, i (d.data)}
      {#if d.contam > 0}
        <path class="barra" class:apagada={escolhido !== null && escolhido !== i} d={coluna(i, d.contam)} />
      {/if}
    {/each}

    <!-- valor só na maior coluna (rótulo seletivo) -->
    {#if dias[maiorDia]?.contam && Math.abs(y(dias[maiorDia].contam) - y(ritmo)) > 12}
      <text class="valor" x={xCentro(maiorDia)} y={y(dias[maiorDia].contam) - 4} text-anchor="middle">{dias[maiorDia].contam}</text>
    {/if}

    <!-- dias no eixo de baixo: alguns, para não embolar -->
    {#each dias as d, i (d.data)}
      {@const dia = Number(d.data.slice(8))}
      {#if i === 0 || (dia % 5 === 0 && dias.length - 1 - i >= 3) || i === dias.length - 1}
        <text class="eixo" x={xCentro(i)} y={H - 6} text-anchor="middle">{Number(d.data.slice(8))}</text>
      {/if}
    {/each}

    <!-- áreas de toque (a coluna inteira, maior que a barra) -->
    {#each dias as d, i (d.data)}
      <rect
        class="toque"
        x={M.esquerda + slot * i}
        y={M.topo}
        width={slot}
        height={alturaUtil + M.base}
        role="button"
        tabindex="0"
        aria-label="{formatarData(d.data)}: {d.contam} famílias"
        onclick={() => (escolhido = escolhido === i ? null : i)}
        onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (escolhido = escolhido === i ? null : i)}
      />
    {/each}
  </svg>

  <details class="tabela">
    <summary>Ver em tabela</summary>
    {#if comVisita.length === 0}
      <p class="suave">Nenhuma visita neste período.</p>
    {:else}
      <table>
        <thead><tr><th>Dia</th><th>Famílias que contam</th><th>Outras visitas</th></tr></thead>
        <tbody>
          {#each comVisita as d (d.data)}
            <tr><td>{formatarData(d.data)}</td><td>{d.contam}</td><td>{d.naoContam}</td></tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </details>
</div>

<style>
  .grafico svg {
    width: 100%;
    height: auto;
    display: block;
    touch-action: manipulation;
  }
  .leitura {
    min-height: 3em;
    font-size: 0.95rem;
    margin-bottom: 4px;
  }
  .sem-campo {
    fill: var(--fundo);
  }
  .grade {
    stroke: var(--borda);
    stroke-width: 1;
  }
  .ritmo {
    stroke: var(--texto-suave);
    stroke-width: 1.5;
  }
  .rotulo-ritmo,
  .valor {
    fill: var(--texto);
    font-size: 10px;
    font-weight: 700;
  }
  .eixo {
    fill: var(--texto-suave);
    font-size: 10px;
  }
  .barra {
    fill: var(--grafico-barra);
    transition: opacity 0.15s;
  }
  .barra.apagada {
    opacity: 0.35;
  }
  .toque {
    fill: transparent;
    cursor: pointer;
    outline: none;
  }
  .toque:focus-visible {
    stroke: var(--primaria);
    stroke-width: 2;
  }
  .tabela {
    margin-top: 8px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.95rem;
  }
  th,
  td {
    text-align: left;
    padding: 6px 4px;
    border-bottom: 1px solid var(--borda);
  }
</style>
