<script lang="ts">
  import Desfecho from '../componentes/Desfecho.svelte';
  import Icone from '../componentes/Icone.svelte';
  import MarcarRevisita from '../componentes/MarcarRevisita.svelte';
  import { idadeTexto } from '../lib/dados-ficticios';
  import { formatarData, formatarDataLonga, hojeISO } from '../lib/datas';
  import {
    app,
    cancelarRevisita,
    enderecoCurto,
    familiaPorId,
    historicoDaFamilia,
    mostrarAviso,
    registrarAusencia,
    revisitasAbertas,
  } from '../lib/estado.svelte';
  import { prontuarioIncompleto } from '../lib/pendencias';
  import { NOMES_GRUPO, NOMES_SITUACAO_CASA, NOMES_SITUACAO_MORADOR } from '../lib/rotulos';
  import { ir, voltar } from '../lib/rotas.svelte';

  let { id }: { id: string } = $props();
  const hoje = hojeISO();
  const familia = $derived(familiaPorId(id));
  const visitas = $derived(
    app.visitas.filter((v) => v.familiaId === id).sort((a, b) => b.data.localeCompare(a.data)),
  );
  const atuais = $derived(familia?.moradores.filter((m) => m.situacao === 'mora') ?? []);
  const antigos = $derived(familia?.moradores.filter((m) => m.situacao !== 'mora') ?? []);
  const historico = $derived(historicoDaFamilia(id));
  let aberta = $state<string | null>(null);
  let confirmandoAusencia = $state(false);
  let marcandoRevisita = $state(false);
  const revisitas = $derived(app.revisitas && revisitasAbertas(id));
  async function cancelar(rid: string, motivo: string) {
    if (!confirm(`Cancelar a revisita “${motivo}”?`)) return;
    await cancelarRevisita(rid);
    mostrarAviso('Revisita cancelada');
  }
  let dataAusencia = $state(hoje);

  async function confirmarAusencia() {
    await registrarAusencia(id, dataAusencia);
    confirmandoAusencia = false;
    dataAusencia = hoje;
    mostrarAviso('Ausência registrada ✓ Vai para “Revisitar” e para a fila do Fast.', 3500);
  }

  function quando(iso: string): string {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  }
</script>

<button class="botao secundario pequeno voltar" onclick={() => voltar('busca')}><Icone nome="voltar" /> Voltar</button>

{#if !familia}
  <p>Família não encontrada.</p>
{:else}
  <section class="cartao">
    <div class="cabecalho">
      <h1>{familia.rua}, {familia.numero}</h1>
      <button class="botao secundario pequeno" onclick={() => ir(`editar-familia/${familia.id}`)}>Editar</button>
    </div>
    {#if familia.complemento}<p class="suave">{familia.complemento}</p>{/if}
    <dl class="dados">
      <div><dt>Prontuário</dt><dd>{familia.prontuario || '—'}</dd></div>
      <div><dt>Colmeia</dt><dd>{familia.colmeia || '—'}</dd></div>
      <div><dt>Casa</dt><dd>{NOMES_SITUACAO_CASA[familia.situacaoCasa]}</dd></div>
    </dl>
    {#if !familia.prontuario}
      <p class="alerta">Prontuário em branco: completar quando possível.</p>
    {:else if prontuarioIncompleto(familia.prontuario)}
      <p class="alerta">Prontuário incompleto: completar quando possível.</p>
    {/if}
    {#if familia.obs}<p class="obs"><strong>Obs.:</strong> {familia.obs}</p>{/if}
  </section>

  {#if familia.situacaoCasa === 'habitada'}
    <button class="botao largo grande" onclick={() => ir(`vd/${familia.id}`)}>
      <Icone nome="mais" /> {app.rascunho?.familiaId === familia.id && !app.rascunho.visitaId ? 'Continuar visita' : 'Registrar visita'}
    </button>
    {#if !confirmandoAusencia}
      <button class="botao secundario largo ausencia" onclick={() => (confirmandoAusencia = true)}>Ninguém em casa</button>
    {:else}
      <section class="cartao confirmar-ausencia">
        <p><strong>Registrar “{app.config.nomesDesfecho.ausencia_completa}”</strong> em {enderecoCurto(familia)}?</p>
        <label class="campo">
          <span>Data</span>
          <input type="date" bind:value={dataAusencia} max={hoje} />
        </label>
        <p class="data-aus">{dataAusencia ? formatarDataLonga(dataAusencia, true) : ''}{dataAusencia === hoje ? ' (hoje)' : ''}</p>
        <div class="linha-botoes">
          <button class="botao secundario" onclick={() => (confirmandoAusencia = false)}>Cancelar</button>
          <button class="botao" onclick={confirmarAusencia} disabled={!dataAusencia}>Confirmar</button>
        </div>
      </section>
    {/if}
  {/if}

  <section class="cartao">
    <h2>Revisitas marcadas ({revisitas.length})</h2>
    {#each revisitas as r (r.id)}
      {@const atrasada = r.ate < hoje}
      <div class="revisita" class:atrasada>
        <span>
          <strong>{r.motivo}</strong><br />
          <span class="pequeno">{atrasada ? 'atrasada: era até' : r.ate === hoje ? 'hoje,' : 'até'} {formatarDataLonga(r.ate)}</span>
        </span>
        <button class="botao secundario pequeno" onclick={() => cancelar(r.id, r.motivo)}>Cancelar</button>
      </div>
    {/each}
    {#if revisitas.length}
      <p class="suave pequeno">Ao registrar a visita, marque “feito nesta visita”.</p>
    {/if}
    {#if marcandoRevisita}
      <MarcarRevisita familiaId={familia.id} aoTerminar={() => (marcandoRevisita = false)} />
    {:else}
      <button class="botao secundario largo" onclick={() => (marcandoRevisita = true)}><Icone nome="mais" /> Marcar revisita</button>
    {/if}
  </section>

  <section class="cartao">
    <h2>Moradores ({atuais.length})</h2>
    <ul class="lista">
      {#each atuais as m (m.id)}
        <li>
          <button class="morador" onclick={() => ir(`morador/${familia.id}/${m.id}`)}>
            <span class="nome">
              <Icone nome="pessoa" tamanho={20} />
              <strong>{m.nome}</strong>
              {#if m.id === familia.responsavelId}<span class="resp">responsável</span>{/if}
            </span>
            <span class="suave pequeno">
              {m.sexo === 'F' ? 'Feminino' : m.sexo === 'M' ? 'Masculino' : 'Sexo não informado'}{#if m.sexoAConferir}<span class="falta-dado"> (a conferir)</span>{/if} ·
              {#if m.nascimento}{idadeTexto(m, hoje)} ({formatarData(m.nascimento)}){:else}<span class="falta-dado">sem data de nascimento</span>{/if}
            </span>
            {#if m.grupos.length}
              <span>{#each m.grupos as g (g)}<span class="grupo">{NOMES_GRUPO[g]}</span>{/each}</span>
            {/if}
          </button>
        </li>
      {/each}
    </ul>
    {#if atuais.length === 0}<p class="suave">Nenhum morador.</p>{/if}
    <button class="botao secundario largo" onclick={() => ir(`morador/${familia.id}/novo`)}><Icone nome="mais" /> Adicionar morador</button>

    {#if antigos.length}
      <details class="antigos">
        <summary>Não moram mais aqui ({antigos.length})</summary>
        <ul class="lista">
          {#each antigos as m (m.id)}
            <li>
              <button class="morador inativo" onclick={() => ir(`morador/${familia.id}/${m.id}`)}>
                <strong>{m.nome}</strong>
                <span class="suave pequeno">
                  {NOMES_SITUACAO_MORADOR[m.situacao]}{m.situacaoDesde ? ` desde ${formatarData(m.situacaoDesde)}` : ''}
                </span>
              </button>
            </li>
          {/each}
        </ul>
      </details>
    {/if}
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
            <button class="botao secundario pequeno corrigir" onclick={() => ir(`vd/${familia.id}/${v.id}`)}>Corrigir esta VD</button>
          {/if}
        </li>
      {/each}
    </ul>
  </section>

  <section class="cartao">
    <details>
      <summary>Histórico de alterações ({historico.length})</summary>
      {#if historico.length === 0}
        <p class="suave">Nenhuma alteração registrada.</p>
      {/if}
      <ul class="lista historico">
        {#each historico as h (h.id)}
          <li><span class="suave pequeno">{quando(h.quando)}</span><br />{h.texto}</li>
        {/each}
      </ul>
    </details>
  </section>
{/if}

<style>
  .voltar {
    margin-bottom: 12px;
  }
  .cabecalho {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 10px;
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
  .obs {
    margin-top: 8px;
  }
  .grande {
    min-height: 64px;
    font-size: 1.2rem;
    margin-bottom: 10px;
  }
  .revisita {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    padding: 10px 0;
    border-bottom: 1px solid var(--borda);
  }
  .revisita.atrasada strong,
  .revisita.atrasada .pequeno {
    color: var(--perigo);
  }
  .ausencia {
    margin-bottom: 14px;
  }
  .confirmar-ausencia {
    border: 2px solid var(--ausencia);
  }
  .data-aus {
    font-weight: 700;
    margin-top: -6px;
  }
  .corrigir {
    margin: 4px 0 12px;
  }
  .morador {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    width: 100%;
    text-align: left;
    background: none;
    border: 0;
    border-bottom: 1px solid var(--borda);
    padding: 12px 0;
    cursor: pointer;
    min-height: 56px;
  }
  .morador.inativo {
    opacity: 0.75;
  }
  .nome {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }
  .resp {
    font-size: 0.75rem;
    font-weight: 700;
    padding: 1px 8px;
    border-radius: 999px;
    border: 2px solid var(--primaria);
    color: var(--primaria);
  }
  .falta-dado {
    color: var(--ausencia);
    font-weight: 700;
  }
  .antigos {
    margin-top: 14px;
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
  .historico li {
    padding: 8px 0;
    border-bottom: 1px solid var(--borda);
  }
</style>
