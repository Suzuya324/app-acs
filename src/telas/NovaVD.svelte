<script lang="ts">
  import { untrack } from 'svelte';
  import Icone from '../componentes/Icone.svelte';
  import { copiarTexto } from '../lib/copiar';
  import { idadeTexto } from '../lib/dados-ficticios';
  import { formatarDataLonga, hojeISO } from '../lib/datas';
  import { sugerirDesfecho } from '../lib/desfecho';
  import { app, enderecoCurto, familiaPorId, mostrarAviso, salvarVisita } from '../lib/estado.svelte';
  import { gerarRelato, juntarNomes, nomesCurtos } from '../lib/relato';
  import { TEMAS_ORIENTACAO } from '../lib/rotulos';
  import { voltar } from '../lib/rotas.svelte';
  import type { Desfecho, SinaisVitais } from '../lib/tipos';

  let { familiaId }: { familiaId: string } = $props();
  const hoje = hojeISO();
  const familia = $derived(familiaPorId(familiaId));
  const ativos = $derived(familia?.moradores.filter((m) => m.situacao === 'mora') ?? []);

  let data = $state(hoje);
  let presentes = $state<string[]>([]);
  let conversou = $state(false);
  let recusou = $state(false);
  let desfechoManual = $state<Desfecho | null>(null);
  let motivo = $state(app.config.motivoPadrao);
  let compartilhada = $state(false);
  let compartilhadaCom = $state('');
  /** Sinais vitais de cada morador (chave = id do morador). */
  let sinais = $state<Record<string, SinaisVitais>>(
    Object.fromEntries(
      (familiaPorId(untrack(() => familiaId))?.moradores ?? []).map((m) => [
        m.id,
        { pa: '', temperatura: '', peso: '', altura: '', glicemia: '' },
      ]),
    ),
  );
  /** Assuntos tocados nos botões + texto livre. */
  let temas = $state<string[]>([]);
  let outrosTemas = $state('');
  const orientacoes = $derived(juntarNomes([...temas, ...(outrosTemas.trim() ? [outrosTemas.trim()] : [])]));
  const nomes = $derived(nomesCurtos(ativos));
  const comSinais = $derived(ativos.filter((m) => presentes.includes(m.id)));
  let relatoEditado = $state<string | null>(null);

  const sugerido = $derived(
    sugerirDesfecho({
      totalMoradores: ativos.length,
      presentes: presentes.length,
      conversouComFamilia: conversou,
      recusou,
    }),
  );
  const desfecho = $derived(desfechoManual ?? sugerido);

  const relatoGerado = $derived(
    gerarRelato({
      desfecho,
      presentes: ativos.filter((m) => presentes.includes(m.id)),
      ausentes: ativos.filter((m) => !presentes.includes(m.id)),
      conversouComFamilia: conversou,
      sinais: sinaisPreenchidos(),
      orientacoes,
      compartilhadaCom: compartilhada ? compartilhadaCom : '',
      contador: app.visitas.length,
    }),
  );
  const relato = $derived(relatoEditado ?? relatoGerado);

  const ordem: Desfecho[] = ['realizada', 'ausente_realizada', 'ausencia_completa', 'recusa'];

  function alternar(id: string) {
    recusou = false;
    presentes = presentes.includes(id) ? presentes.filter((p) => p !== id) : [...presentes, id];
  }
  function todos() {
    recusou = false;
    presentes = ativos.map((m) => m.id);
  }
  function ninguem() {
    presentes = [];
    conversou = false;
    recusou = false;
    desfechoManual = null;
  }
  function marcarRecusa() {
    recusou = !recusou;
    desfechoManual = null;
  }
  function alternarTema(t: string) {
    temas = temas.includes(t) ? temas.filter((x) => x !== t) : [...temas, t];
  }
  /** Só os sinais de quem estava presente e com algum valor preenchido. */
  function sinaisPreenchidos(): Record<string, SinaisVitais> {
    const r: Record<string, SinaisVitais> = {};
    for (const id of presentes) {
      const s = sinais[id];
      if (s && Object.values(s).some((v) => (v ?? '').trim())) r[id] = { ...s };
    }
    return r;
  }

  async function copiar() {
    const ok = await copiarTexto(relato);
    mostrarAviso(ok ? 'Relato copiado!' : 'Não consegui copiar. Segure o texto e copie à mão.');
  }

  function salvar() {
    if (!familia) return;
    salvarVisita({
      familiaId: familia.id,
      data,
      presentes: [...presentes],
      conversouComFamilia: conversou,
      desfecho,
      motivo,
      compartilhadaCom: compartilhada ? compartilhadaCom.trim() : '',
      sinais: sinaisPreenchidos(),
      orientacoes,
      relato,
      lancadaNoFast: false,
    });
    mostrarAviso('VD salva e colocada na fila do Fast ✓');
    voltar(`familia/${familia.id}`);
  }
</script>

<button class="botao secundario pequeno voltar" onclick={() => voltar(`familia/${familiaId}`)}><Icone nome="voltar" /> Cancelar</button>

{#if !familia}
  <p>Família não encontrada.</p>
{:else}
  <h1>Nova visita</h1>
  <p class="suave endereco">{enderecoCurto(familia)}</p>

  <!-- DATA: sempre visível e editável -->
  <section class="cartao">
    <label class="campo">
      <span>Data da visita</span>
      <input type="date" bind:value={data} max={hoje} required />
    </label>
    <p class="data-longa"><strong>{data ? formatarDataLonga(data, true) : 'Escolha a data'}</strong></p>
    {#if data && data !== hoje}
      <p class="alerta">Atenção: a data não é hoje.</p>
    {/if}
  </section>

  <!-- QUEM ESTAVA EM CASA -->
  <section class="cartao">
    <h2>Quem estava em casa?</h2>
    <p class="suave pequeno">Toque nos moradores presentes.</p>
    <ul class="lista pessoas">
      {#each ativos as m (m.id)}
        {@const marcado = presentes.includes(m.id)}
        <li>
          <button class="pessoa" class:marcado onclick={() => alternar(m.id)} aria-pressed={marcado}>
            <span class="caixa">{#if marcado}<Icone nome="ok" tamanho={22} />{/if}</span>
            <span>
              <strong>{m.nome}</strong><br />
              <span class="suave pequeno">{idadeTexto(m, data || hoje)}</span>
            </span>
          </button>
        </li>
      {/each}
    </ul>
    <div class="linha-botoes">
      <button class="botao secundario pequeno" onclick={todos}>Todos presentes</button>
      <button class="botao secundario pequeno" onclick={ninguem}>Ninguém em casa</button>
    </div>
    <label class="opcao">
      <input type="checkbox" bind:checked={conversou} onchange={() => (desfechoManual = null)} />
      <span>Conversei com a família (alguém respondeu por todos)</span>
    </label>
    <label class="opcao">
      <input type="checkbox" checked={recusou} onchange={marcarRecusa} />
      <span>A família não quis receber a visita</span>
    </label>
  </section>

  <!-- DESFECHO -->
  <section class="cartao">
    <h2>Desfecho</h2>
    <div class="desfechos" role="radiogroup" aria-label="Desfecho">
      {#each ordem as d (d)}
        <button
          class="opcao-desfecho d-{d}"
          class:escolhido={desfecho === d}
          role="radio"
          aria-checked={desfecho === d}
          onclick={() => (desfechoManual = d === sugerido ? null : d)}
        >
          <span>{app.config.nomesDesfecho[d]}</span>
          {#if d === sugerido}<span class="auto">automático</span>{/if}
        </button>
      {/each}
    </div>
    {#if desfechoManual}
      <p class="pequeno">Você trocou o desfecho. <button class="link" onclick={() => (desfechoManual = null)}>Voltar ao automático</button></p>
    {/if}
    {#if desfecho === 'ausencia_completa'}
      <p class="suave pequeno">Vai para a lista “Revisitar”. Não conta para a meta.</p>
    {/if}

    <label class="campo motivo">
      <span>Motivo</span>
      <select bind:value={motivo}>
        {#each app.config.motivos as m (m)}<option value={m}>{m}</option>{/each}
      </select>
    </label>
  </section>

  <!-- DETALHES OPCIONAIS -->
  <section class="cartao">
    <details>
      <summary>Sinais vitais (opcional)</summary>
      <p class="suave pequeno">Entram só no texto do relato, com o nome da pessoa.</p>
      {#if comSinais.length === 0}
        <p class="alerta">Marque primeiro quem estava em casa.</p>
      {/if}
      {#each comSinais as m (m.id)}
        <fieldset class="sinais-pessoa">
          <legend>{nomes.get(m.id)}</legend>
          <div class="grade">
            <label class="campo"><span>P.A.</span><input type="text" inputmode="numeric" placeholder="120/80" bind:value={sinais[m.id].pa} /></label>
            <label class="campo"><span>Glicemia</span><input type="text" inputmode="numeric" placeholder="mg/dL" bind:value={sinais[m.id].glicemia} /></label>
            <label class="campo"><span>Temp. (°C)</span><input type="text" inputmode="decimal" placeholder="36,5" bind:value={sinais[m.id].temperatura} /></label>
            <label class="campo"><span>Peso (kg)</span><input type="text" inputmode="decimal" bind:value={sinais[m.id].peso} /></label>
            <label class="campo"><span>Altura (m)</span><input type="text" inputmode="decimal" placeholder="1,65" bind:value={sinais[m.id].altura} /></label>
          </div>
        </fieldset>
      {/each}
    </details>
  </section>

  <section class="cartao">
    <h2>Orientações</h2>
    <p class="suave pequeno">Toque nos assuntos conversados.</p>
    <div class="chips">
      {#each TEMAS_ORIENTACAO as t (t)}
        {@const marcado = temas.includes(t)}
        <button class="chip" class:marcado aria-pressed={marcado} onclick={() => alternarTema(t)}>
          {#if marcado}<Icone nome="ok" tamanho={18} />{/if}{t}
        </button>
      {/each}
    </div>
    <label class="campo">
      <span>Outros assuntos</span>
      <input type="text" bind:value={outrosTemas} placeholder="Ex.: cartão SUS" />
    </label>
  </section>

  <section class="cartao">
    <label class="opcao">
      <input type="checkbox" bind:checked={compartilhada} />
      <span>Visita compartilhada com outro profissional</span>
    </label>
    {#if compartilhada}
      <label class="campo">
        <span>Nome e função</span>
        <input type="text" bind:value={compartilhadaCom} placeholder="Ex.: técnica de enfermagem Rosa" />
      </label>
    {/if}
  </section>

  <!-- RELATO -->
  <section class="cartao">
    <h2>Relato</h2>
    <textarea class="relato" rows="6" value={relato} oninput={(e) => (relatoEditado = e.currentTarget.value)} aria-label="Texto do relato"></textarea>
    {#if relatoEditado !== null}
      <p class="pequeno">Você editou o texto. <button class="link" onclick={() => (relatoEditado = null)}>Refazer automático</button></p>
    {/if}
    <button class="botao secundario largo" onclick={copiar}><Icone nome="copiar" /> Copiar relato</button>
  </section>

  <div class="rodape-salvar">
    <button class="botao largo" onclick={salvar} disabled={!data}><Icone nome="ok" /> Salvar VD</button>
  </div>
  <div class="espaco" aria-hidden="true"></div>
{/if}

<style>
  .voltar {
    margin-bottom: 12px;
  }
  .endereco {
    font-weight: 600;
    margin-bottom: 12px;
  }
  .data-longa {
    margin: -4px 0 4px;
  }
  .pessoas li {
    margin-bottom: 8px;
  }
  .pessoa {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: 60px;
    padding: 10px 12px;
    text-align: left;
    border-radius: 12px;
    border: 2px solid var(--borda);
    background: var(--cartao);
    cursor: pointer;
  }
  .pessoa.marcado {
    border-color: var(--primaria);
    background: var(--primaria-clara);
  }
  .caixa {
    flex: 0 0 32px;
    height: 32px;
    border-radius: 8px;
    border: 2px solid var(--primaria);
    display: grid;
    place-items: center;
    color: var(--primaria);
  }
  .marcado .caixa {
    background: var(--primaria);
    color: var(--primaria-texto);
  }
  .opcao {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 52px;
    margin-top: 6px;
    cursor: pointer;
  }
  .opcao input {
    width: 26px;
    height: 26px;
    flex: 0 0 26px;
    accent-color: var(--primaria);
  }
  .desfechos {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .opcao-desfecho {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    min-height: 64px;
    padding: 8px 10px;
    text-align: left;
    border-radius: 12px;
    border: 2px solid var(--borda);
    background: var(--cartao);
    font-weight: 700;
    font-size: 0.95rem;
    cursor: pointer;
  }
  .opcao-desfecho.escolhido {
    border-color: currentColor;
    border-width: 3px;
    background: var(--fundo);
  }
  .opcao-desfecho:not(.escolhido) {
    color: var(--texto-suave);
  }
  .auto {
    font-size: 0.75rem;
    font-weight: 600;
    opacity: 0.85;
  }
  .motivo {
    margin-top: 14px;
  }
  .grade {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0 10px;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 8px 0 10px;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    border: 2px solid var(--borda);
    background: var(--cartao);
    border-radius: 999px;
    padding: 6px 16px;
    font-weight: 600;
    cursor: pointer;
    min-height: 48px;
  }
  .chip.marcado {
    border-color: var(--primaria);
    background: var(--primaria-clara);
  }
  .sinais-pessoa {
    border: 1px solid var(--borda);
    border-radius: 12px;
    margin: 8px 0 12px;
    padding: 8px 12px 0;
  }
  .sinais-pessoa legend {
    font-weight: 700;
    padding: 0 6px;
  }
  .link {
    background: none;
    border: 0;
    color: var(--primaria);
    font-weight: 700;
    text-decoration: underline;
    padding: 6px 0;
    cursor: pointer;
  }
  textarea.relato {
    margin-bottom: 10px;
    line-height: 1.4;
  }
  .espaco {
    height: 70px;
  }
  .rodape-salvar {
    position: fixed;
    left: 0;
    right: 0;
    bottom: calc(64px + env(safe-area-inset-bottom));
    z-index: 6;
    padding: 10px 16px;
    background: linear-gradient(to top, var(--fundo) 70%, transparent);
  }
  .rodape-salvar .botao {
    max-width: 608px;
    margin: 0 auto;
    display: flex;
    min-height: 60px;
    font-size: 1.15rem;
  }
</style>
