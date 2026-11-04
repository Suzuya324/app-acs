<script lang="ts">
  // Lançar no Fast em sequência: uma VD por vez, na ordem do Fast.
  // 1) copiar prontuário  2) copiar relato  3) "Lancei, próxima".
  import { untrack } from 'svelte';
  import Desfecho from '../componentes/Desfecho.svelte';
  import Icone from '../componentes/Icone.svelte';
  import { copiarTexto } from '../lib/copiar';
  import { formatarData, formatarDataLonga } from '../lib/datas';
  import { app, enderecoCurto, familiaPorId, marcarLancada, mostrarAviso, presentesDaVisita, responsavel } from '../lib/estado.svelte';
  import { voltar } from '../lib/rotas.svelte';

  /** Lista fixada ao abrir a tela (assim marcar como lançada não "pula" a ordem). */
  const ids = untrack(() =>
    app.visitas
      .filter((v) => !v.lancadaNoFast)
      .sort((a, b) => a.data.localeCompare(b.data))
      .map((v) => v.id),
  );
  let i = $state(0);
  let lancadas = $state(0);
  const visita = $derived(app.visitas.find((v) => v.id === ids[i]));
  const familia = $derived(visita ? familiaPorId(visita.familiaId) : undefined);
  let copiou = $state<{ pront: boolean; relato: boolean }>({ pront: false, relato: false });

  async function copiar(oque: 'pront' | 'relato') {
    const texto = oque === 'pront' ? (familia?.prontuario ?? '') : (visita?.relato ?? '');
    const ok = await copiarTexto(texto);
    if (ok) copiou = { ...copiou, [oque]: true };
    mostrarAviso(ok ? (oque === 'pront' ? 'Prontuário copiado' : 'Relato copiado') : 'Não consegui copiar.');
  }
  function proxima() {
    i++;
    copiou = { pront: false, relato: false };
    window.scrollTo(0, 0);
  }
  async function lancei() {
    if (!visita) return;
    await marcarLancada(visita.id, true);
    lancadas++;
    proxima();
  }
</script>

<button class="botao secundario pequeno voltar" onclick={() => voltar('fila')}><Icone nome="voltar" /> Voltar para a fila</button>

<h1>Lançar em sequência</h1>

{#if app.config.urlFast}
  <a class="botao secundario largo abrir" href={app.config.urlFast} target="_blank" rel="noopener noreferrer">Abrir o Fast ↗</a>
{/if}

{#if ids.length === 0}
  <p class="cartao ok">✓ Nada para lançar.</p>
{:else if i >= ids.length}
  <section class="cartao">
    <h2 class="ok">✓ Fim da fila</h2>
    <p>{lancadas} de {ids.length} {ids.length === 1 ? 'VD marcada' : 'VDs marcadas'} como lançada{lancadas === 1 ? '' : 's'}.</p>
    <button class="botao largo" onclick={() => voltar('fila')}>Voltar para a fila</button>
  </section>
{:else if visita}
  <p class="progresso"><strong>{i + 1}</strong> de {ids.length}</p>
  <div class="barra" aria-hidden="true"><div class="preenchido" style="width: {(i / ids.length) * 100}%"></div></div>

  <section class="cartao">
    <div class="cab">
      <strong>{familia ? enderecoCurto(familia) : '(família)'}</strong>
      <Desfecho valor={visita.desfecho} />
    </div>
    <p class="info">
      <span>Data: <strong>{formatarDataLonga(visita.data, true)}</strong></span><br />
      <span>Motivo: <strong>{visita.motivo}</strong></span>
      {#if familia}<br /><span>Responsável: <strong>{responsavel(familia)}</strong></span>{/if}
      {#if presentesDaVisita(visita).length}<br /><span>Presentes: <strong>{presentesDaVisita(visita).join(', ')}</strong></span>{/if}
    </p>

    <div class="passo">
      <span class="num">1</span>
      <div class="corpo">
        <span>Prontuário: <strong>{familia?.prontuario || '—'}</strong></span>
        <button class="botao" class:secundario={copiou.pront} onclick={() => copiar('pront')} disabled={!familia?.prontuario}>
          <Icone nome="copiar" /> {copiou.pront ? 'Copiado ✓' : 'Copiar prontuário'}
        </button>
      </div>
    </div>

    <div class="passo">
      <span class="num">2</span>
      <div class="corpo">
        <p class="relato">{visita.relato}</p>
        <button class="botao" class:secundario={copiou.relato} onclick={() => copiar('relato')}>
          <Icone nome="copiar" /> {copiou.relato ? 'Copiado ✓' : 'Copiar relato'}
        </button>
      </div>
    </div>

    <div class="passo">
      <span class="num">3</span>
      <div class="corpo">
        <button class="botao lancei" onclick={lancei}><Icone nome="ok" /> Lancei no Fast, próxima</button>
        <button class="botao secundario pequeno" onclick={proxima}>Pular esta (fica na fila)</button>
      </div>
    </div>
  </section>
  <p class="suave pequeno">Data da VD: {formatarData(visita.data)} · confira a data no Fast.</p>
{/if}

<style>
  .voltar {
    margin-bottom: 12px;
  }
  .abrir {
    margin-bottom: 12px;
  }
  .ok {
    color: var(--realizada);
    font-weight: 700;
  }
  .progresso {
    font-size: 1.1rem;
    margin-bottom: 4px;
  }
  .barra {
    height: 10px;
    border-radius: 999px;
    background: var(--primaria-clara);
    overflow: hidden;
    margin-bottom: 12px;
  }
  .preenchido {
    height: 100%;
    background: var(--primaria);
  }
  .cab {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 8px;
  }
  .info {
    margin: 8px 0 12px;
  }
  .passo {
    display: flex;
    gap: 12px;
    padding: 12px 0;
    border-top: 1px solid var(--borda);
  }
  .num {
    flex: 0 0 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--primaria);
    color: var(--primaria-texto);
    font-weight: 800;
    display: grid;
    place-items: center;
  }
  .corpo {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .lancei {
    min-height: 60px;
    font-size: 1.1rem;
  }
</style>
