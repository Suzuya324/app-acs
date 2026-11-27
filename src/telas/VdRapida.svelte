<script lang="ts">
  // "VD sem novidade": registra a visita com poucos toques, mostrando o relato inteiro antes de salvar.
  import { untrack } from 'svelte';
  import Icone from '../componentes/Icone.svelte';
  import { formatarDataLonga, hojeISO } from '../lib/datas';
  import { app, compartilhadosRecentes, enderecoCurto, familiaPorId, mostrarAviso, salvarVisita } from '../lib/estado.svelte';
  import { nomesCurtos } from '../lib/relato';
  import { TEMAS_ORIENTACAO } from '../lib/rotulos';
  import { ir, voltar } from '../lib/rotas.svelte';
  import { emAbertoNaCasa, montarVisitaSemNovidade, OBSERVACAO_PADRAO, temasDaUltimaVD } from '../lib/vd-rapida';

  let { familiaId }: { familiaId: string } = $props();

  const hoje = hojeISO();
  const familia = $derived(familiaPorId(familiaId));
  const ativos = $derived(familia?.moradores.filter((m) => m.situacao === 'mora') ?? []);
  const nomes = $derived(nomesCurtos(ativos));
  const recentes = compartilhadosRecentes();

  let data = $state(hoje);
  // Começa com todos presentes: é o caso mais comum. Toque num nome para tirar quem não estava.
  let presentes = $state<string[]>(untrack(() => (familiaPorId(familiaId)?.moradores ?? []).filter((m) => m.situacao === 'mora').map((m) => m.id)));
  let conversou = $state(false);
  let motivo = $state(app.config.motivoPadrao);
  let compartilhada = $state(false);
  let compartilhadaCom = $state('');
  let temas = $state<string[]>(untrack(() => temasDaUltimaVD(familiaId, app.visitas, hoje)));
  let observacao = $state(OBSERVACAO_PADRAO);
  let salvando = $state(false);

  const aberto = $derived(emAbertoNaCasa(familiaId, app.revisitas, app.casos));
  const temAberto = $derived(aberto.revisitas > 0 || aberto.casos > 0 || !!familia?.atencao);

  const pronta = $derived(
    familia
      ? montarVisitaSemNovidade({
          familia,
          presentes,
          conversou,
          data,
          motivo,
          motivoPadrao: app.config.motivoPadrao,
          compartilhadaCom: compartilhada ? compartilhadaCom : '',
          temas,
          observacao,
          visitas: app.visitas,
          nomeCompleto: app.config.relatoNomeCompleto,
        })
      : null,
  );

  const alternar = (id: string) => (presentes = presentes.includes(id) ? presentes.filter((p) => p !== id) : [...presentes, id]);
  const alternarTema = (t: string) => (temas = temas.includes(t) ? temas.filter((x) => x !== t) : [...temas, t]);

  async function salvar() {
    if (!familia || !pronta || salvando) return;
    salvando = true;
    try {
      await salvarVisita(pronta.visita);
      mostrarAviso('VD salva e colocada na fila do Fast ✓');
      app.proximaDepoisDe = familia.id;
      voltar(`familia/${familia.id}`);
    } finally {
      salvando = false;
    }
  }
</script>

<button class="botao secundario pequeno voltar" onclick={() => voltar(`familia/${familiaId}`)}><Icone nome="voltar" /> Cancelar</button>

{#if !familia}
  <p>Família não encontrada.</p>
{:else}
  <h1>VD sem novidade</h1>
  <p class="suave endereco">{enderecoCurto(familia)}</p>

  {#if temAberto}
    <section class="alerta">
      <strong>Esta casa tem coisa em aberto:</strong>
      {#if familia.atencao}<div>Atenção: {familia.atencao}</div>{/if}
      {#if aberto.revisitas}<div>{aberto.revisitas} {aberto.revisitas === 1 ? 'revisita marcada' : 'revisitas marcadas'}</div>{/if}
      {#if aberto.casos}<div>{aberto.casos} {aberto.casos === 1 ? 'caso aberto' : 'casos abertos'}</div>{/if}
      <p class="pequeno">Se teve novidade ou se você resolveu algo, use a visita completa.</p>
      <button class="botao secundario pequeno" onclick={() => ir(`vd/${familia.id}`)}>Abrir a visita completa</button>
    </section>
  {/if}

  <label class="campo">
    <span>Data da visita</span>
    <input type="date" bind:value={data} max={hoje} />
  </label>
  <p class="pequeno suave">{data ? formatarDataLonga(data, true) : ''}{data === hoje ? ' (hoje)' : ''}</p>

  <section class="cartao">
    <h2>Quem estava?</h2>
    <p class="suave pequeno">Já vem todo mundo marcado. Toque para tirar quem não estava.</p>
    <div class="chips">
      {#each ativos as m (m.id)}
        <button class="chip" class:ativo={presentes.includes(m.id)} aria-pressed={presentes.includes(m.id)} onclick={() => alternar(m.id)}>
          {presentes.includes(m.id) ? '✓ ' : ''}{nomes.get(m.id) ?? m.nome}
        </button>
      {/each}
    </div>
    {#if presentes.length > 0 && presentes.length < ativos.length}
      <label class="marca"><input type="checkbox" bind:checked={conversou} /> Conversei com a família (quem atendeu respondeu por todos)</label>
    {/if}
    {#if presentes.length === 0}
      <p class="aviso">Ninguém marcado. Se não tinha ninguém em casa, volte e use “Ninguém em casa”.</p>
    {/if}
  </section>

  <section class="cartao">
    <h2>Orientações</h2>
    <div class="chips">
      {#each TEMAS_ORIENTACAO as t (t)}
        <button class="chip" class:ativo={temas.includes(t)} aria-pressed={temas.includes(t)} onclick={() => alternarTema(t)}>{temas.includes(t) ? '✓ ' : ''}{t}</button>
      {/each}
    </div>
    <label class="campo">
      <span>O que foi observado (pode mudar)</span>
      <textarea rows="2" bind:value={observacao}></textarea>
    </label>
  </section>

  <section class="cartao">
    <label class="campo">
      <span>Motivo</span>
      <select bind:value={motivo}>
        {#each app.config.motivos as m (m)}<option value={m}>{m}</option>{/each}
      </select>
    </label>
    <label class="marca"><input type="checkbox" bind:checked={compartilhada} /> Visita compartilhada (com técnica ou outro profissional)</label>
    {#if compartilhada}
      <label class="campo">
        <span>Com quem</span>
        <input type="text" list="recentes-vd" bind:value={compartilhadaCom} placeholder="Ex.: técnica de enfermagem" />
        <datalist id="recentes-vd">{#each recentes as r (r)}<option value={r}></option>{/each}</datalist>
      </label>
    {/if}
  </section>

  <section class="cartao previa">
    <h2>Como vai ficar o relato</h2>
    {#if pronta}
      <p class="relato">{pronta.relato}</p>
      <p class="pequeno suave">Resultado: <strong>{app.config.nomesDesfecho[pronta.desfecho]}</strong> · conta para a meta</p>
    {:else}
      <p class="suave">Marque quem estava para ver o relato.</p>
    {/if}
  </section>

  <button class="botao largo grande" disabled={!pronta || !data || salvando} onclick={salvar}>
    <Icone nome="mais" /> Salvar VD
  </button>
  <button class="botao secundario largo espaco" onclick={() => ir(`vd/${familia.id}`)}>Preciso anotar mais coisas (visita completa)</button>
{/if}

<style>
  .voltar {
    margin-bottom: 12px;
  }
  .endereco {
    margin-top: -6px;
  }
  .alerta {
    background: var(--aviso-fundo);
    color: var(--aviso-texto);
    border-radius: 12px;
    padding: 10px 12px;
    margin: 10px 0;
  }
  .alerta p {
    margin: 6px 0;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 8px 0;
  }
  .chip {
    min-height: 44px;
    padding: 6px 14px;
    border-radius: 999px;
    border: 2px solid var(--borda);
    background: var(--cartao);
    color: var(--texto);
    font-weight: 700;
    cursor: pointer;
  }
  .chip.ativo {
    border-color: var(--primaria);
    background: var(--primaria-clara);
  }
  .marca {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 40px;
  }
  .marca input {
    width: 22px;
    height: 22px;
    flex: none;
  }
  .aviso {
    color: var(--aviso-texto);
    background: var(--aviso-fundo);
    padding: 4px 8px;
    border-radius: 8px;
  }
  .relato {
    white-space: pre-wrap;
    margin: 6px 0;
  }
  .previa {
    border-left: 6px solid var(--primaria);
  }
  .espaco {
    margin-top: 10px;
  }
</style>
