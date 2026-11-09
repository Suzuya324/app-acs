<script lang="ts">
  // Ficha do paciente: dados, condições, prioridade e a linha do tempo (tudo o que foi anotado).
  import Etiqueta from '../componentes/Etiqueta.svelte';
  import Icone from '../componentes/Icone.svelte';
  import { idadeTexto } from '../lib/dados-ficticios';
  import { linhaDoTempo } from '../lib/anotacoes';
  import { formatarData, hojeISO } from '../lib/datas';
  import { app, enderecoCurto, familiaPorId } from '../lib/estado.svelte';
  import { etiquetasParaMostrar } from '../lib/prioritarios';
  import { NOMES_GRUPO, NOMES_SITUACAO_MORADOR } from '../lib/rotulos';
  import { ir, voltar } from '../lib/rotas.svelte';

  let { familiaId, moradorId }: { familiaId: string; moradorId: string } = $props();
  const hoje = hojeISO();
  const familia = $derived(familiaPorId(familiaId));
  const m = $derived(familia?.moradores.find((x) => x.id === moradorId));
  const prio = $derived(app.prioritarios.find((p) => p.moradorId === moradorId));
  const linha = $derived(m && familia ? linhaDoTempo(m, familia, app.visitas, (d) => app.config.nomesDesfecho[d], prio) : []);
  let mostrarTudo = $state(false);
</script>

<button class="botao secundario pequeno voltar" onclick={() => voltar(`familia/${familiaId}`)}><Icone nome="voltar" /> Voltar</button>

{#if !familia || !m}
  <p>Pessoa não encontrada.</p>
{:else}
  <section class="cartao">
    <div class="cab">
      <h1>{m.nome}</h1>
      <button class="botao secundario pequeno" onclick={() => ir(`morador/${familiaId}/${moradorId}`)}>Editar</button>
    </div>
    <p class="suave">
      {m.nascimento ? `${idadeTexto(m, hoje)} (${formatarData(m.nascimento)})` : 'sem data de nascimento'} ·
      <button class="link" onclick={() => ir(`familia/${familiaId}`)}>{enderecoCurto(familia)}</button>
    </p>
    {#if m.situacao !== 'mora'}
      <p class="alerta">{NOMES_SITUACAO_MORADOR[m.situacao]}{m.situacaoDesde ? ` desde ${formatarData(m.situacaoDesde)}` : ''}</p>
    {/if}
    {#if m.grupos.length}
      <p class="grupos">{#each m.grupos as g (g)}<span class="grupo">{NOMES_GRUPO[g]}</span>{/each}</p>
    {/if}
    {#if prio}
      <div class="prio">
        <span class="bola nivel-{prio.nivel}"></span>
        <span><strong>Prioritário nível {prio.nivel}</strong>{prio.obito ? ' · ⚠️ óbito a confirmar' : ''}</span>
      </div>
      <p class="etqs">{#each etiquetasParaMostrar(prio, hoje) as e (e)}<Etiqueta {e} />{/each}</p>
    {/if}
    {#if m.obs}<p class="obs"><strong>Obs.:</strong> {m.obs}</p>{/if}
  </section>

  <section class="cartao">
    <h2>Linha do tempo</h2>
    <p class="suave pequeno">Tudo o que foi anotado sobre {m.nome.split(' ')[0]}, do mais novo ao mais antigo. Para anotar, registre uma VD e use “Sobre cada pessoa”.</p>
    {#if linha.length === 0}
      <p class="suave">Nada anotado ainda.</p>
    {/if}
    <ol class="linha">
      {#each mostrarTudo ? linha : linha.slice(0, 8) as it, i (i)}
        <li class={it.origem}>
          <span class="quando">{it.data ? formatarData(it.data) : 'sem data'}</span>
          <strong class="titulo">{it.titulo}</strong>
          {#if it.sinais}<span class="sinais">{it.sinais}</span>{/if}
          {#if it.texto}<span class="texto">{it.texto}</span>{/if}
        </li>
      {/each}
    </ol>
    {#if linha.length > 8 && !mostrarTudo}
      <button class="botao secundario largo" onclick={() => (mostrarTudo = true)}>Ver tudo ({linha.length})</button>
    {/if}
  </section>

  <button class="botao largo" onclick={() => ir(`vd/${familiaId}`)}><Icone nome="mais" /> Registrar visita nesta casa</button>
{/if}

<style>
  .voltar {
    margin-bottom: 12px;
  }
  .cab {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 10px;
  }
  .cab h1 {
    margin: 0;
    overflow-wrap: anywhere;
  }
  .link {
    background: none;
    border: 0;
    padding: 0;
    color: var(--primaria);
    font-weight: 700;
    cursor: pointer;
    font-size: inherit;
  }
  .grupos,
  .etqs {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin: 6px 0;
  }
  .prio {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 8px;
  }
  .bola {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--borda);
  }
  .bola.nivel-A {
    background: var(--perigo);
  }
  .bola.nivel-B {
    background: var(--ausencia);
  }
  .linha {
    list-style: none;
    padding: 0;
    margin: 8px 0 0;
    border-left: 3px solid var(--primaria-clara);
  }
  .linha li {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 0 0 14px 14px;
  }
  .linha li::before {
    content: '';
    position: absolute;
    left: -8px;
    top: 4px;
    width: 13px;
    height: 13px;
    border-radius: 50%;
    background: var(--primaria);
  }
  .linha li.lista::before {
    background: var(--ausencia);
  }
  .linha li.relato::before {
    background: var(--texto-suave);
  }
  .quando {
    font-size: 0.8rem;
    color: var(--texto-suave);
    font-weight: 700;
  }
  .titulo {
    font-size: 0.95rem;
  }
  .sinais {
    font-weight: 700;
    color: var(--primaria);
  }
  .texto {
    white-space: pre-wrap;
  }
</style>
