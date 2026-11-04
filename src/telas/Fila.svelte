<script lang="ts">
  import Desfecho from '../componentes/Desfecho.svelte';
  import Icone from '../componentes/Icone.svelte';
  import { copiarTexto } from '../lib/copiar';
  import { formatarData, formatarDataLonga } from '../lib/datas';
  import { app, enderecoCurto, familiaPorId, marcarLancada, mostrarAviso } from '../lib/estado.svelte';
  import { ir } from '../lib/rotas.svelte';
  import type { Visita } from '../lib/tipos';

  const pendentes = $derived(
    app.visitas.filter((v) => !v.lancadaNoFast).sort((a, b) => a.data.localeCompare(b.data)),
  );
  /** Pendentes agrupadas por dia (mais antigo primeiro). */
  const porDia = $derived.by(() => {
    const grupos = new Map<string, Visita[]>();
    for (const v of pendentes) grupos.set(v.data, [...(grupos.get(v.data) ?? []), v]);
    return [...grupos.entries()];
  });
  const lancadasRecentes = $derived(
    app.visitas
      .filter((v) => v.lancadaNoFast)
      .sort((a, b) => b.data.localeCompare(a.data))
      .slice(0, 15),
  );
  let copiado = $state<string | null>(null);

  async function copiar(v: Visita, oque: 'relato' | 'prontuario') {
    const f = familiaPorId(v.familiaId);
    const texto = oque === 'relato' ? v.relato : (f?.prontuario ?? '');
    const ok = await copiarTexto(texto);
    copiado = `${v.id}-${oque}`;
    mostrarAviso(
      ok
        ? oque === 'relato'
          ? 'Relato copiado! Cole no Fast.'
          : `Prontuário ${texto} copiado!`
        : 'Não consegui copiar. Segure o texto e copie à mão.',
    );
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

{#if pendentes.length}
  <button class="botao largo sequencia" onclick={() => ir('lancar')}>Lançar em sequência ({pendentes.length})</button>
{/if}
{#if app.config.urlFast}
  <a class="botao secundario largo sequencia" href={app.config.urlFast} target="_blank" rel="noopener noreferrer">Abrir o Fast ↗</a>
{/if}

{#each porDia as [dia, visitas] (dia)}
  <h2 class="dia">{formatarDataLonga(dia, true)} <span class="suave pequeno">({visitas.length})</span></h2>
  <ul class="lista">
    {#each visitas as v (v.id)}
      {@const f = familiaPorId(v.familiaId)}
      <li class="cartao">
        <div class="cab">
          <strong>{f ? enderecoCurto(f) : '(família não encontrada)'}</strong>
          <Desfecho valor={v.desfecho} />
        </div>
        <p class="suave pequeno info">Data: {formatarData(v.data)} · Motivo: {v.motivo}</p>
        {#if f}
          <div class="pront">
            <span>Prontuário: <strong>{f.prontuario || '—'}</strong></span>
            {#if f.prontuario}
              <button class="botao secundario pequeno" onclick={() => copiar(v, 'prontuario')}>
                <Icone nome="copiar" tamanho={20} /> {copiado === `${v.id}-prontuario` ? 'Copiado' : 'Copiar'}
              </button>
            {/if}
          </div>
        {/if}
        <p class="relato">{v.relato}</p>
        <div class="botoes-fila">
          <button class="botao secundario" onclick={() => copiar(v, 'relato')}>
            <Icone nome="copiar" /> {copiado === `${v.id}-relato` ? 'Relato copiado' : 'Copiar relato'}
          </button>
          <button class="botao" onclick={() => lancar(v)}><Icone nome="ok" /> Marcar como lançada</button>
        </div>
        <button class="link" onclick={() => ir(`vd/${v.familiaId}/${v.id}`)}>Corrigir esta VD</button>
      </li>
    {/each}
  </ul>
{/each}

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
  .sequencia {
    margin-bottom: 10px;
  }
  .dia {
    margin: 18px 0 8px;
  }
  .cab {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 8px;
    margin-bottom: 4px;
  }
  .info {
    margin-bottom: 6px;
  }
  .pront {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
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
    flex: 1 1 140px;
  }
  .botoes-fila > :last-child {
    flex: 3 1 250px;
  }
  .link {
    background: none;
    border: 0;
    color: var(--primaria);
    font-weight: 700;
    text-decoration: underline;
    min-height: 44px;
    margin-top: 6px;
    cursor: pointer;
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
