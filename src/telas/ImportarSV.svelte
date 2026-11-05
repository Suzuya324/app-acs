<script lang="ts">
  import Icone from '../componentes/Icone.svelte';
  import { formatarData, hojeISO } from '../lib/datas';
  import { app, enderecoCurto, familiaPorId, mostrarAviso, trazerImportacao } from '../lib/estado.svelte';
  import { decodificar } from '../lib/importar-csv';
  import { lerArquivoImportacao, prepararImportacao, type ArquivoImportacao, type Previa } from '../lib/importar-sv';
  import { ir, voltar } from '../lib/rotas.svelte';

  let arquivo = $state<ArquivoImportacao | null>(null);
  let previa = $state<Previa | null>(null);
  let erro = $state('');
  let salvando = $state(false);
  let pronto = $state(false);

  let colado = $state('');

  async function abrir(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const arq = input.files?.[0];
    input.value = '';
    if (!arq) return;
    preparar(decodificar(new Uint8Array(await arq.arrayBuffer())));
  }

  function preparar(texto: string) {
    erro = '';
    try {
      arquivo = lerArquivoImportacao(texto.trim());
      previa = prepararImportacao(
        arquivo,
        app.familias,
        app.visitas,
        { motivoPadrao: app.config.motivoPadrao, quando: new Date().toISOString(), hoje: hojeISO() },
        { casos: app.casos, revisitas: app.revisitas },
      );
    } catch (err) {
      erro = err instanceof Error ? err.message : String(err);
    }
  }

  const nRelatos = $derived(previa ? [...previa.relatos.values()].reduce((n, l) => n + l.length, 0) : 0);
  const porMes = $derived.by(() => {
    const m = new Map<string, number>();
    for (const v of previa?.visitas ?? []) m.set(v.data.slice(0, 7), (m.get(v.data.slice(0, 7)) ?? 0) + 1);
    return [...m].sort();
  });

  async function trazer() {
    if (!previa || !arquivo) return;
    salvando = true;
    try {
      await trazerImportacao(previa, arquivo.origem);
      mostrarAviso('Trazido do Sistema de Visitas ✓', 5000);
      pronto = true;
    } finally {
      salvando = false;
    }
  }
</script>

<button class="botao secundario pequeno voltar" onclick={() => voltar('ajustes')}><Icone nome="voltar" /> Voltar</button>

<h1>Trazer do Sistema de Visitas</h1>

{#if pronto}
  <section class="cartao ok">
    <p><strong>Pronto!</strong> Tudo já está nas famílias (VDs, relatos, casos, condições, níveis e revisitas). Se a sincronização estiver ligada, eles vão sozinhos para os outros aparelhos.</p>
    <p class="alerta pequeno">Agora apague o arquivo do celular (pasta Download): ele tem informações de saúde e não é trancado.</p>
    <button class="botao largo" onclick={() => ir('')}>Ir para o início</button>
  </section>
{:else if !previa}
  <p class="suave">Escolha o arquivo que o Claude montou a partir do Sistema de Visitas. O app acha cada casa (pelo prontuário, endereço ou nome) e mostra tudo antes de salvar. Nada é duplicado.</p>
  <label class="botao largo arquivo">
    <input type="file" onchange={abrir} />
    Escolher arquivo
  </label>
  {#if erro}<p class="alerta" role="alert">{erro}</p>{/if}
  <details class="colar">
    <summary>Não consegui escolher o arquivo</summary>
    <p class="suave pequeno">Abra o arquivo no celular, toque e segure no texto → “Selecionar tudo” → “Copiar”, e cole aqui.</p>
    <textarea rows="4" bind:value={colado} placeholder="Cole aqui o conteúdo do arquivo"></textarea>
    <button class="botao secundario largo" disabled={!colado.trim()} onclick={() => preparar(colado)}>Conferir o texto colado</button>
  </details>
  <p class="suave pequeno">
    Não achou o arquivo? Ele costuma ficar na pasta <strong>Download</strong> (no seletor, toque nos 3 risquinhos ☰ e
    escolha “Downloads”). Se baixou pelo app do Claude, procure o nome <code>sistema-de-visitas-para-o-app</code>.
  </p>
{:else}
  <section class="cartao destaque">
    <p>Do <strong>{arquivo?.origem}</strong>:</p>
    <ul class="resumo">
      <li><strong>{previa.visitas.length}</strong> {previa.visitas.length === 1 ? 'VD' : 'VDs'} para trazer{porMes.length ? ` (${porMes.map(([m, n]) => `${n} de ${m.slice(5)}/${m.slice(0, 4)}`).join(', ')})` : ''}</li>
      <li><strong>{nRelatos}</strong> {nRelatos === 1 ? 'relato anterior' : 'relatos anteriores'}{previa.relatos.size ? `, em ${previa.relatos.size} ${previa.relatos.size === 1 ? 'família' : 'famílias'}` : ''}</li>
      {#if previa.casos.length}<li><strong>{previa.casos.length}</strong> {previa.casos.length === 1 ? 'caso' : 'casos'} (urgente, importante, social, NPV)</li>{/if}
      {#if previa.condicoes.length}<li><strong>{previa.condicoes.length}</strong> {previa.condicoes.length === 1 ? 'pessoa' : 'pessoas'} com condições (diabetes, hipertensão…)</li>{/if}
      {#if previa.niveis.length}<li><strong>{previa.niveis.length}</strong> {previa.niveis.length === 1 ? 'casa' : 'casas'} com nível A/B, atenção ou última VD</li>{/if}
      {#if previa.revisitas.length}<li><strong>{previa.revisitas.length}</strong> {previa.revisitas.length === 1 ? 'casa para voltar' : 'casas para voltar'} (viram revisitas)</li>{/if}
      {#if previa.juntadas}<li><strong>{previa.juntadas}</strong> registros repetidos do mesmo dia juntados numa VD só</li>{/if}
      {#if previa.jaExistiam}<li><strong>{previa.jaExistiam}</strong> já estavam no app (não serão repetidos)</li>{/if}
      {#if previa.naoAchados.length}<li><strong>{previa.naoAchados.length}</strong> não {previa.naoAchados.length === 1 ? 'encontrado' : 'encontrados'} na sua área (ficam de fora)</li>{/if}
    </ul>
  </section>

  {#if previa.visitas.length}
    <section class="cartao">
      <details>
        <summary>Ver as VDs ({previa.visitas.length})</summary>
        <ul class="lista">
          {#each [...previa.visitas].sort((a, b) => a.data.localeCompare(b.data)) as v (v.id)}
            {@const f = familiaPorId(v.familiaId)}
            <li class="vd">
              <strong>{formatarData(v.data)}</strong> · {f ? enderecoCurto(f) : ''} · {app.config.nomesDesfecho[v.desfecho]}
              {#if v.relato}<br /><span class="suave pequeno">{v.relato.slice(0, 120)}{v.relato.length > 120 ? '…' : ''}</span>{/if}
            </li>
          {/each}
        </ul>
      </details>
    </section>
  {/if}

  {#if previa.naoAchados.length}
    <section class="cartao">
      <details>
        <summary>Não encontrados ({previa.naoAchados.length})</summary>
        <p class="suave pequeno">Casas ou pessoas que não estão no app (podem ser de outra área ou ter sido tiradas). Ficam só no Sistema de Visitas.</p>
        <ul class="nao">
          {#each previa.naoAchados as n, i (i)}<li>{n.rotulo} <span class="suave pequeno">({({ vd: 'VD', relato: 'relato', caso: 'caso', condicoes: 'condições', nivel: 'nível', voltar: 'voltar' })[n.tipo]})</span></li>{/each}
        </ul>
      </details>
    </section>
  {/if}

  <div class="linha-botoes">
    <button class="botao secundario" onclick={() => (previa = arquivo = null)}>Voltar</button>
    <button class="botao" disabled={salvando || (!previa.visitas.length && !nRelatos && !previa.casos.length && !previa.condicoes.length && !previa.niveis.length && !previa.revisitas.length)} onclick={trazer}>
      {salvando ? 'Trazendo…' : 'Trazer para o app'}
    </button>
  </div>
{/if}

<style>
  .voltar {
    margin-bottom: 12px;
  }
  .arquivo {
    position: relative;
    cursor: pointer;
    margin: 10px 0;
  }
  .arquivo input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }
  .destaque {
    border: 2px solid var(--primaria);
  }
  .ok {
    border: 2px solid var(--realizada);
  }
  .resumo {
    margin: 4px 0 0;
    padding-left: 20px;
  }
  .vd {
    padding: 8px 0;
    border-bottom: 1px solid var(--borda);
  }
  .colar {
    margin: 12px 0;
  }
  .colar textarea {
    width: 100%;
    margin-bottom: 8px;
  }
  code {
    overflow-wrap: anywhere;
  }
  .nao {
    padding-left: 20px;
  }
</style>
