<script lang="ts">
  import Desfecho from '../componentes/Desfecho.svelte';
  import Icone from '../componentes/Icone.svelte';
  import { idadeTexto } from '../lib/dados-ficticios';
  import { formatarData, hojeISO } from '../lib/datas';
  import { app, familiaPorId } from '../lib/estado.svelte';
  import { NOMES_GRUPO, NOMES_SITUACAO_CASA, NOMES_SITUACAO_MORADOR } from '../lib/rotulos';
  import { ir, voltar } from '../lib/rotas.svelte';

  let { id }: { id: string } = $props();
  const hoje = hojeISO();
  const familia = $derived(familiaPorId(id));
  const visitas = $derived(
    app.visitas.filter((v) => v.familiaId === id).sort((a, b) => b.data.localeCompare(a.data)),
  );
  const prontIncompleto = $derived(!familia?.prontuario || /\.$/.test(familia.prontuario));
  let aberta = $state<string | null>(null);
</script>

<button class="botao secundario pequeno voltar" onclick={() => voltar('busca')}><Icone nome="voltar" /> Voltar</button>

{#if !familia}
  <p>Família não encontrada.</p>
{:else}
  <section class="cartao">
    <h1>{familia.rua}, {familia.numero}</h1>
    {#if familia.complemento}<p class="suave">{familia.complemento}</p>{/if}
    <dl class="dados">
      <div><dt>Prontuário</dt><dd>{familia.prontuario || '—'}</dd></div>
      <div><dt>Colmeia</dt><dd>{familia.colmeia || '—'}</dd></div>
      <div><dt>Casa</dt><dd>{NOMES_SITUACAO_CASA[familia.situacaoCasa]}</dd></div>
    </dl>
    {#if prontIncompleto}
      <p class="alerta">Prontuário {familia.prontuario ? 'incompleto' : 'em branco'}: completar quando possível.</p>
    {/if}
  </section>

  <button class="botao largo grande" onclick={() => ir(`vd/${familia.id}`)}>
    <Icone nome="mais" /> Registrar visita
  </button>

  <section class="cartao">
    <h2>Moradores ({familia.moradores.filter((m) => m.situacao === 'mora').length})</h2>
    <ul class="lista">
      {#each familia.moradores as m (m.id)}
        <li class="morador" class:inativo={m.situacao !== 'mora'}>
          <div class="nome">
            <Icone nome="pessoa" tamanho={20} />
            <strong>{m.nome}</strong>
          </div>
          <div class="suave pequeno">
            {m.sexo === 'F' ? 'Feminino' : 'Masculino'} ·
            {#if m.nascimento}{idadeTexto(m, hoje)} ({formatarData(m.nascimento)}){:else}<span class="falta-dado">sem data de nascimento</span>{/if}
            {#if m.situacao !== 'mora'} · <strong>{NOMES_SITUACAO_MORADOR[m.situacao]}</strong>{/if}
          </div>
          {#if m.grupos.length}
            <div>{#each m.grupos as g (g)}<span class="grupo">{NOMES_GRUPO[g]}</span>{/each}</div>
          {/if}
        </li>
      {/each}
    </ul>
    {#if familia.moradores.length === 0}<p class="suave">Nenhum morador cadastrado.</p>{/if}
  </section>

  <section class="cartao">
    <h2>Visitas ({visitas.length})</h2>
    {#if visitas.length === 0}
      <p class="suave">Nenhuma visita registrada.</p>
    {/if}
    <ul class="lista">
      {#each visitas.slice(0, 10) as v (v.id)}
        <li class="visita">
          <button class="cab-visita" onclick={() => (aberta = aberta === v.id ? null : v.id)} aria-expanded={aberta === v.id}>
            <span><strong>{formatarData(v.data)}</strong></span>
            <Desfecho valor={v.desfecho} />
          </button>
          {#if aberta === v.id}
            <p class="relato">{v.relato}</p>
            <p class="suave pequeno">Motivo: {v.motivo} · {v.lancadaNoFast ? 'lançada no Fast' : 'pendente no Fast'}</p>
          {/if}
        </li>
      {/each}
    </ul>
  </section>
{/if}

<style>
  .voltar {
    margin-bottom: 12px;
  }
  .dados {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin: 8px 0;
  }
  .dados dt {
    font-size: 0.8rem;
    color: var(--texto-suave);
  }
  .dados dd {
    margin: 0;
    font-weight: 700;
  }
  .grande {
    min-height: 64px;
    font-size: 1.2rem;
    margin-bottom: 14px;
  }
  .morador {
    padding: 10px 0;
    border-bottom: 1px solid var(--borda);
  }
  .morador:last-child {
    border-bottom: 0;
  }
  .morador.inativo {
    opacity: 0.6;
  }
  .nome {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .falta-dado {
    color: var(--ausencia);
    font-weight: 700;
  }
  .visita {
    border-bottom: 1px solid var(--borda);
  }
  .visita:last-child {
    border-bottom: 0;
  }
  .cab-visita {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    min-height: 52px;
    background: none;
    border: 0;
    padding: 6px 0;
    cursor: pointer;
    gap: 8px;
  }
</style>
