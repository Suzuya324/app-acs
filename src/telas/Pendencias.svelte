<script lang="ts">
  import Icone from '../componentes/Icone.svelte';
  import {
    app,
    confirmarSexo,
    enderecoCurto,
  } from '../lib/estado.svelte';
  import { listarPendencias, NOMES_PENDENCIA, type Pendencia, type TipoPendencia } from '../lib/pendencias';
  import { ir, voltar } from '../lib/rotas.svelte';

  const pendencias = $derived(listarPendencias(app.familias));
  const ordem: TipoPendencia[] = [
    'sem_prontuario',
    'prontuario_incompleto',
    'sem_responsavel',
    'sem_moradores',
    'sem_nascimento',
    'sem_sexo',
  ];
  const ehSexo = (t: TipoPendencia) => t === 'sem_sexo';
  /** Para onde ir ao tocar: no morador, no formulário da família ou na ficha. */
  function destino(p: Pendencia): string {
    if (p.morador) return `morador/${p.familia.id}/${p.morador.id}`;
    if (p.tipo === 'sem_moradores') return `familia/${p.familia.id}`;
    return `editar-familia/${p.familia.id}`;
  }
  const grupos = $derived(ordem.map((t) => ({ tipo: t, itens: pendencias.filter((p) => p.tipo === t) })).filter((g) => g.itens.length));
</script>

<button class="botao secundario pequeno voltar" onclick={() => voltar('')}><Icone nome="voltar" /> Voltar</button>

<h1>O que falta completar</h1>
{#if pendencias.length === 0}
  <p class="cartao ok">✓ Nada pendente. Cadastro completo!</p>
{:else}
  <p class="suave">{pendencias.length} {pendencias.length === 1 ? 'item' : 'itens'} para completar. Toque para abrir.</p>
{/if}

{#each grupos as g (g.tipo)}
  <section class="cartao">
    <details open={pendencias.length <= 30}>
      <summary>{NOMES_PENDENCIA[g.tipo]} ({g.itens.length})</summary>
      {#if g.tipo === 'sem_sexo'}
        <p class="suave pequeno">Toque em F ou M.</p>
      {/if}
      <ul class="lista">
        {#each g.itens as p (`${p.familia.id}-${p.morador?.id ?? ''}`)}
          <li>
            {#if ehSexo(g.tipo) && p.morador}
              {@const m = p.morador}
              <div class="linha-sexo">
                <button class="item" onclick={() => ir(destino(p))}>
                  <strong>{m.nome}</strong>
                  <span class="suave pequeno">{enderecoCurto(p.familia)}</span>
                </button>
                <div class="sexo-botoes" role="group" aria-label="Sexo de {m.nome}">
                  {#each ['F', 'M'] as const as s (s)}
                    <button
                      class="sexo"
                      
                      aria-label={s === 'F' ? 'Feminino' : 'Masculino'}
                      onclick={() => confirmarSexo(p.familia.id, m.id, s)}>{s}</button
                    >
                  {/each}
                </div>
              </div>
            {:else}
            <button class="item" onclick={() => ir(destino(p))}>
              {#if p.morador}
                <strong>{p.morador.nome}</strong>
                <span class="suave pequeno">{enderecoCurto(p.familia)}</span>
              {:else}
                <strong>{enderecoCurto(p.familia)}</strong>
                <span class="suave pequeno">Prontuário: {p.familia.prontuario || '—'}</span>
              {/if}
            </button>
            {/if}
          </li>
        {/each}
      </ul>
    </details>
  </section>
{/each}

<style>
  .voltar {
    margin-bottom: 12px;
  }
  .ok {
    color: var(--realizada);
    font-weight: 700;
  }
  .linha-sexo {
    display: flex;
    align-items: center;
    gap: 8px;
    border-bottom: 1px solid var(--borda);
  }
  .linha-sexo .item {
    border-bottom: 0;
    flex: 1;
  }
  .sexo-botoes {
    display: flex;
    gap: 6px;
  }
  .sexo {
    width: 52px;
    height: 48px;
    border-radius: 12px;
    border: 2px solid var(--primaria);
    background: transparent;
    color: var(--primaria);
    font-weight: 800;
    font-size: 1.1rem;
    cursor: pointer;
  }
  .item {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    width: 100%;
    text-align: left;
    background: none;
    border: 0;
    border-bottom: 1px solid var(--borda);
    padding: 10px 0;
    min-height: 52px;
    cursor: pointer;
  }
</style>
