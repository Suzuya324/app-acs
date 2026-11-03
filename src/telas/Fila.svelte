<script lang="ts">
  import Desfecho from '../componentes/Desfecho.svelte';
  import Icone from '../componentes/Icone.svelte';
  import { copiarTexto } from '../lib/copiar';
  import { formatarData } from '../lib/datas';
  import { app, enderecoCurto, familiaPorId, marcarLancada, mostrarAviso } from '../lib/estado.svelte';
  import type { Visita } from '../lib/tipos';

  const pendentes = $derived(
    app.visitas.filter((v) => !v.lancadaNoFast).sort((a, b) => a.data.localeCompare(b.data)),
  );
  const lancadasRecentes = $derived(
    app.visitas
      .filter((v) => v.lancadaNoFast)
      .sort((a, b) => b.data.localeCompare(a.data))
      .slice(0, 15),
  );
  let copiada = $state<string | null>(null);

  async function copiar(v: Visita) {
    const ok = await copiarTexto(v.relato);
    copiada = v.id;
    mostrarAviso(ok ? 'Relato copiado! Cole no Fast.' : 'Não consegui copiar. Segure o texto e copie à mão.');
  }
  function lancar(v: Visita) {
    marcarLancada(v.id, true);
    mostrarAviso('Marcada como lançada ✓');
  }
  function desfazer(v: Visita) {
    marcarLancada(v.id, false);
    mostrarAviso('Voltou para a fila');
  }
</script>

<h1>Fila pra lançar no Fast</h1>
<p class="suave">
  {pendentes.length === 0 ? 'Tudo lançado. 👏' : pendentes.length === 1 ? '1 visita esperando lançamento.' : `${pendentes.length} visitas esperando lançamento.`}
</p>

<ul class="lista">
  {#each pendentes as v (v.id)}
    {@const f = familiaPorId(v.familiaId)}
    <li class="cartao">
      <div class="cab">
        <strong>{formatarData(v.data)}</strong>
        <Desfecho valor={v.desfecho} />
      </div>
      {#if f}
        <p class="endereco"><strong>{enderecoCurto(f)}</strong><br /><span class="suave pequeno">Pront.: {f.prontuario || '—'} · Motivo: {v.motivo}</span></p>
      {/if}
      <p class="relato">{v.relato}</p>
      <div class="botoes-fila">
        <button class="botao secundario" onclick={() => copiar(v)}>
          <Icone nome="copiar" /> {copiada === v.id ? 'Copiado' : 'Copiar'}
        </button>
        <button class="botao" onclick={() => lancar(v)}><Icone nome="ok" /> Marcar como lançada</button>
      </div>
    </li>
  {/each}
</ul>

{#if lancadasRecentes.length}
  <section class="cartao">
    <details>
      <summary>Lançadas recentemente</summary>
      <ul class="lista">
        {#each lancadasRecentes as v (v.id)}
          {@const f = familiaPorId(v.familiaId)}
          <li class="lancada">
            <span>
              <strong>{formatarData(v.data)}</strong> · {f ? enderecoCurto(f) : ''}
            </span>
            <button class="botao secundario pequeno" onclick={() => desfazer(v)}>Desfazer</button>
          </li>
        {/each}
      </ul>
    </details>
  </section>
{/if}

<style>
  .cab {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }
  .endereco {
    margin-bottom: 8px;
  }
  .relato {
    margin-bottom: 12px;
  }
  .botoes-fila {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }
  .botoes-fila > :first-child {
    flex: 1 1 120px;
  }
  .botoes-fila > :last-child {
    flex: 3 1 250px;
  }
  .lancada {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    padding: 8px 0;
    border-bottom: 1px solid var(--borda);
    font-size: 0.95rem;
  }
</style>
