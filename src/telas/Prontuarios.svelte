<script lang="ts">
  // Lista de prontuários em ordem numérica, para imprimir ou salvar em PDF (A4 deitado).
  // TEM nomes e endereços: não mandar para ninguém.
  import Icone from '../componentes/Icone.svelte';
  import { formatarData, hojeISO } from '../lib/datas';
  import { app, responsavel } from '../lib/estado.svelte';
  import { ordenarPorProntuario } from '../lib/mapa';
  import { prontuarioIncompleto } from '../lib/pendencias';
  import { NOMES_SITUACAO_CASA } from '../lib/rotulos';
  import { voltar } from '../lib/rotas.svelte';

  let soHabitadas = $state(false);
  let comMoradores = $state(false);
  const lista = $derived(ordenarPorProntuario(app.familias.filter((f) => !soHabitadas || f.situacaoCasa === 'habitada')));
  const semPront = $derived(lista.filter((f) => !f.prontuario.trim() || prontuarioIncompleto(f.prontuario)).length);
  const moram = (f: (typeof lista)[number]) => f.moradores.filter((m) => m.situacao === 'mora');
</script>

<div class="sem-impressao">
  <button class="botao secundario pequeno voltar" onclick={() => voltar('painel')}><Icone nome="voltar" /> Voltar</button>
  <h1>Lista de prontuários</h1>
  <p class="alerta">Esta lista tem <strong>nomes e endereços</strong> de pacientes. Imprima ou salve só para você e não mande para ninguém.</p>
  <label class="opcao"><input type="checkbox" bind:checked={soHabitadas} /> Só casas habitadas</label>
  <label class="opcao"><input type="checkbox" bind:checked={comMoradores} /> Mostrar todos os moradores (não só o responsável)</label>
  <button class="botao largo" onclick={() => window.print()}>Imprimir ou salvar em PDF</button>
  <p class="suave pequeno dica">No celular: Imprimir → “Salvar como PDF”. A folha sai deitada (A4 paisagem).</p>
</div>

<article class="folha">
  <header>
    <h2>Prontuários em ordem numérica</h2>
    <p>
      {#if app.config.nomeAcs}<strong>ACS:</strong> {app.config.nomeAcs} · {/if}
      {lista.length} famílias{semPront ? ` (${semPront} sem prontuário ou incompleto, no fim)` : ''} · gerado em {formatarData(hojeISO())}
    </p>
  </header>
  <table>
    <thead>
      <tr><th>Prontuário</th><th>Endereço</th><th>{comMoradores ? 'Moradores' : 'Responsável'}</th><th class="n">Mor.</th></tr>
    </thead>
    <tbody>
      {#each lista as f (f.id)}
        <tr>
          <td class="pront">{f.prontuario || '—'}</td>
          <td>
            {f.rua}, {f.numero}{f.complemento ? ` – ${f.complemento}` : ''}
            {#if f.situacaoCasa !== 'habitada'}<em> (casa {NOMES_SITUACAO_CASA[f.situacaoCasa].toLowerCase()})</em>{/if}
          </td>
          <td>{comMoradores ? moram(f).map((m) => m.nome).join(', ') || '—' : responsavel(f)}</td>
          <td class="n">{moram(f).length}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</article>

<style>
  .voltar {
    margin-bottom: 12px;
  }
  .opcao {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 48px;
    cursor: pointer;
  }
  .opcao input {
    width: 24px;
    height: 24px;
    accent-color: var(--primaria);
  }
  .dica {
    margin: 6px 0 14px;
  }
  .folha {
    background: #fff;
    color: #111;
    border: 1px solid var(--borda);
    border-radius: var(--raio);
    padding: 12px;
    overflow-x: auto;
  }
  .folha h2 {
    margin: 0 0 4px;
    font-size: 1.1rem;
  }
  .folha header p {
    margin: 0 0 10px;
    font-size: 0.85rem;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
  }
  th,
  td {
    border-bottom: 1px solid #ccc;
    padding: 5px 6px;
    text-align: left;
    vertical-align: top;
  }
  thead th {
    border-bottom: 2px solid #333;
  }
  .pront {
    font-weight: 700;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  .n {
    text-align: right;
  }
  @media print {
    @page {
      size: A4 landscape;
      margin: 10mm;
    }
    .sem-impressao {
      display: none;
    }
    .folha {
      border: 0;
      padding: 0;
      overflow: visible;
    }
    tr {
      break-inside: avoid;
    }
    thead {
      display: table-header-group;
    }
  }
</style>
