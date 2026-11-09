<script lang="ts">
  import Icone from '../componentes/Icone.svelte';
  import { app, importarPrioritarios, mostrarAviso } from '../lib/estado.svelte';
  import { decodificar } from '../lib/importar-csv';
  import { lerListaPrioritarios, prepararPrioritarios, type PreviaPrioritarios } from '../lib/prioritarios';
  import { trocarPara, voltar } from '../lib/rotas.svelte';

  let previa = $state<PreviaPrioritarios | null>(null);
  let erro = $state('');
  let colado = $state('');
  let salvando = $state(false);
  /** Editados à mão em que o ACS escolheu usar a lista nova. */
  let usarNova = $state<string[]>([]);

  function preparar(texto: string) {
    erro = '';
    try {
      previa = prepararPrioritarios(lerListaPrioritarios(texto, new Date().toISOString()), app.prioritarios, app.familias);
      usarNova = [];
    } catch (e) {
      erro = e instanceof Error ? e.message : String(e);
    }
  }
  async function abrir(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const arq = input.files?.[0];
    input.value = '';
    if (arq) preparar(decodificar(new Uint8Array(await arq.arrayBuffer())));
  }
  async function confirmar() {
    if (!previa) return;
    salvando = true;
    try {
      await importarPrioritarios(previa, new Set(usarNova));
      mostrarAviso('Lista de prioritários importada ✓', 5000);
      trocarPara('prioritarios');
    } finally {
      salvando = false;
    }
  }
</script>

<button class="botao secundario pequeno voltar" onclick={() => voltar('prioritarios')}><Icone nome="voltar" /> Voltar</button>

<h1>Importar lista de prioritários</h1>

{#if !previa}
  <p class="suave">
    Escolha o arquivo JSON dos pacientes prioritários. Quem já está na lista é atualizado (pelo nome e nascimento), quem é novo
    entra, e nada é apagado. O que você editou à mão só muda se você escolher.
  </p>
  <label class="botao largo arquivo">
    <input type="file" onchange={abrir} />
    Escolher arquivo
  </label>
  <details class="colar">
    <summary>Não consegui escolher o arquivo</summary>
    <textarea rows="4" bind:value={colado} placeholder="Cole aqui o conteúdo do arquivo"></textarea>
    <button class="botao secundario largo" disabled={!colado.trim()} onclick={() => preparar(colado)}>Conferir o texto colado</button>
  </details>
  {#if erro}<p class="alerta" role="alert">{erro}</p>{/if}
{:else}
  <section class="cartao destaque">
    <ul class="resumo">
      <li><strong>{previa.novos.length}</strong> {previa.novos.length === 1 ? 'novo' : 'novos'}</li>
      <li><strong>{previa.atualizados.length}</strong> {previa.atualizados.length === 1 ? 'atualizado' : 'atualizados'}</li>
      {#if previa.iguais}<li><strong>{previa.iguais}</strong> sem mudança</li>{/if}
      {#if previa.conflitos.length}<li><strong>{previa.conflitos.length}</strong> que você editou à mão: escolha abaixo</li>{/if}
      {#if previa.ficam}<li><strong>{previa.ficam}</strong> que não estão na lista nova continuam (nada é apagado)</li>{/if}
      {#if previa.semCasa.length}<li><strong>{previa.semCasa.length}</strong> não {previa.semCasa.length === 1 ? 'achado' : 'achados'} no cadastro do app (entram na aba sem ligação com uma casa)</li>{/if}
    </ul>
  </section>

  {#if previa.conflitos.length}
    <section class="cartao">
      <h2>Você editou estes à mão</h2>
      <p class="suave pequeno">Marque só os que devem ficar como na lista nova. Os outros ficam como você deixou.</p>
      {#each previa.conflitos as c (c.atual.id)}
        <label class="opcao">
          <input type="checkbox" value={c.atual.id} bind:group={usarNova} />
          <span><strong>{c.atual.nome}</strong><br /><span class="suave pequeno">no app: nível {c.atual.nivel} · na lista nova: nível {c.novo.nivel}</span></span>
        </label>
      {/each}
    </section>
  {/if}

  {#if previa.semCasa.length}
    <section class="cartao">
      <details>
        <summary>Não achados no cadastro ({previa.semCasa.length})</summary>
        <ul class="nao">{#each previa.semCasa as p (p.id)}<li>{p.nome} · {p.rua} {p.casa}</li>{/each}</ul>
      </details>
    </section>
  {/if}

  <div class="linha-botoes">
    <button class="botao secundario" onclick={() => (previa = null)}>Voltar</button>
    <button class="botao" disabled={salvando} onclick={confirmar}>{salvando ? 'Importando…' : 'Importar'}</button>
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
  .colar textarea {
    width: 100%;
    margin: 6px 0;
  }
  .destaque {
    border: 2px solid var(--primaria);
  }
  .resumo {
    margin: 0;
    padding-left: 20px;
  }
  .opcao {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 52px;
  }
  .opcao input {
    width: 22px;
    height: 22px;
    flex-shrink: 0;
    accent-color: var(--primaria);
  }
  .nao {
    padding-left: 20px;
  }
</style>
