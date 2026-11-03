<script lang="ts">
  // Formulário curto: motivo (toque ou escrito) + para quando.
  import { deISO, formatarDataLonga, hojeISO, somarDias } from '../lib/datas';
  import { marcarRevisita, mostrarAviso } from '../lib/estado.svelte';
  import { MOTIVOS_REVISITA } from '../lib/rotulos';

  let { familiaId, aoTerminar }: { familiaId: string; aoTerminar: () => void } = $props();
  const hoje = hojeISO();
  /** Próximo dia útil a partir de amanhã. */
  const amanha = (() => {
    let d = somarDias(hoje, 1);
    while ([0, 6].includes(deISO(d).getDay())) d = somarDias(d, 1);
    return d;
  })();
  /** Próxima sexta-feira depois de hoje. */
  const fimDaSemana = (() => {
    let d = somarDias(hoje, 1);
    while (deISO(d).getDay() !== 5) d = somarDias(d, 1);
    return d;
  })();

  let motivo = $state('');
  let ate = $state(hoje);
  const opcoesData = [
    { rotulo: 'Hoje', data: hoje },
    { rotulo: deISO(amanha).getDay() === 1 && deISO(hoje).getDay() >= 5 ? 'Segunda' : 'Amanhã', data: amanha },
    { rotulo: 'Até sexta', data: fimDaSemana },
  ];

  async function salvar() {
    if (!motivo.trim()) return mostrarAviso('Escolha ou escreva o motivo.');
    if (!ate) return mostrarAviso('Escolha a data.');
    await marcarRevisita(familiaId, motivo, ate);
    mostrarAviso('Revisita marcada ✓');
    aoTerminar();
  }
</script>

<section class="cartao marcar">
  <h2>Marcar revisita</h2>
  <p class="rotulo">Motivo</p>
  <div class="chips">
    {#each MOTIVOS_REVISITA as m (m.motivo)}
      <button class="chip" class:marcado={motivo === m.motivo} aria-pressed={motivo === m.motivo} onclick={() => (motivo = m.motivo)}>{m.motivo}</button>
    {/each}
  </div>
  <label class="campo"><span>Ou escreva</span><input type="text" bind:value={motivo} placeholder="Ex.: levar cartão SUS" /></label>

  <p class="rotulo">Para quando</p>
  <div class="chips">
    {#each opcoesData as o (o.rotulo)}
      <button class="chip" class:marcado={ate === o.data} aria-pressed={ate === o.data} onclick={() => (ate = o.data)}>{o.rotulo}</button>
    {/each}
  </div>
  <label class="campo"><span>Ou escolha a data</span><input type="date" bind:value={ate} min={hoje} /></label>
  <p class="data">{ate ? formatarDataLonga(ate, true) : ''}</p>

  <div class="linha-botoes">
    <button class="botao secundario" onclick={aoTerminar}>Cancelar</button>
    <button class="botao" onclick={salvar}>Marcar</button>
  </div>
</section>

<style>
  .marcar {
    border: 2px solid var(--primaria);
  }
  .rotulo {
    font-weight: 600;
    margin: 8px 0 4px;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 10px;
  }
  .chip {
    border: 2px solid var(--borda);
    background: var(--cartao);
    border-radius: 999px;
    padding: 6px 14px;
    font-weight: 600;
    min-height: 48px;
    cursor: pointer;
    text-align: left;
  }
  .chip.marcado {
    border-color: var(--primaria);
    background: var(--primaria-clara);
  }
  .data {
    font-weight: 700;
    margin-top: -6px;
  }
</style>
