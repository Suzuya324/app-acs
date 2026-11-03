<script lang="ts">
  import { untrack } from 'svelte';
  import Icone from '../componentes/Icone.svelte';
  import { app, familiaPorId, mostrarAviso, salvarFamilia } from '../lib/estado.svelte';
  import { novoId } from '../lib/ids';
  import { NOMES_SITUACAO_CASA } from '../lib/rotulos';
  import { trocarPara, voltar } from '../lib/rotas.svelte';
  import type { Familia, SituacaoCasa } from '../lib/tipos';

  /** id da família, ou vazio para cadastrar uma nova. */
  let { id }: { id: string } = $props();

  const original = untrack(() => (id ? familiaPorId(id) : undefined));
  const nova = !original;
  let f = $state<Familia>(
    original
      ? ($state.snapshot(original) as Familia)
      : {
          id: novoId('f'),
          rua: app.config.ruas[0] ?? '',
          numero: '',
          complemento: '',
          bairro: app.familias[0]?.bairro ?? '',
          colmeia: '',
          prontuario: '',
          situacaoCasa: 'habitada',
          obs: '',
          responsavelId: '',
          moradores: [],
        },
  );
  const atuais = $derived(f.moradores.filter((m) => m.situacao === 'mora'));
  const ruas = $derived([...new Set([...app.config.ruas, ...app.familias.map((x) => x.rua)])].filter(Boolean));
  let salvando = $state(false);

  async function salvar() {
    f.rua = f.rua.trim();
    f.numero = f.numero.trim() || 'S/N';
    if (!f.rua) return mostrarAviso('Escolha ou escreva a rua.');
    salvando = true;
    try {
      await salvarFamilia($state.snapshot(f) as Familia);
      mostrarAviso(nova ? 'Família cadastrada ✓ Agora inclua os moradores.' : 'Salvo ✓', 3500);
      if (nova) trocarPara(`familia/${f.id}`);
      else voltar(`familia/${f.id}`);
    } finally {
      salvando = false;
    }
  }
</script>

<button class="botao secundario pequeno voltar" onclick={() => voltar(nova ? 'busca' : `familia/${id}`)}><Icone nome="voltar" /> Cancelar</button>

{#if id && !original}
  <p>Família não encontrada.</p>
{:else}
  <h1>{nova ? 'Nova família' : 'Editar família'}</h1>

  <section class="cartao">
    <label class="campo">
      <span>Rua</span>
      <input type="text" list="lista-ruas" bind:value={f.rua} autocomplete="off" />
      <datalist id="lista-ruas">{#each ruas as r (r)}<option value={r}></option>{/each}</datalist>
    </label>
    <div class="dupla">
      <label class="campo">
        <span>Número</span>
        <input type="text" inputmode="numeric" bind:value={f.numero} placeholder="S/N" autocomplete="off" />
      </label>
      <label class="campo">
        <span>Complemento</span>
        <input type="text" bind:value={f.complemento} placeholder="Fundos, Casa 2…" autocomplete="off" />
      </label>
    </div>
    <p class="suave pequeno">Casa sem número: deixe o número em branco que fica “S/N”.</p>
    <label class="campo"><span>Bairro</span><input type="text" bind:value={f.bairro} autocomplete="off" /></label>
    <div class="dupla">
      <label class="campo"><span>Prontuário</span><input type="text" bind:value={f.prontuario} placeholder="00.0000" autocomplete="off" /></label>
      <label class="campo"><span>Nº na colmeia</span><input type="text" inputmode="numeric" bind:value={f.colmeia} autocomplete="off" /></label>
    </div>
    <label class="campo">
      <span>Situação da casa</span>
      <select bind:value={f.situacaoCasa}>
        {#each Object.entries(NOMES_SITUACAO_CASA) as [valor, nome] (valor)}
          <option value={valor as SituacaoCasa}>{nome}</option>
        {/each}
      </select>
    </label>
    {#if !nova && atuais.length}
      <label class="campo">
        <span>Responsável pela família</span>
        <select bind:value={f.responsavelId}>
          <option value="">(ninguém)</option>
          {#each atuais as m (m.id)}<option value={m.id}>{m.nome}</option>{/each}
        </select>
      </label>
    {/if}
    <label class="campo"><span>Observações</span><textarea rows="3" bind:value={f.obs}></textarea></label>
  </section>

  <button class="botao largo" onclick={salvar} disabled={salvando}><Icone nome="ok" /> Salvar</button>
  {#if !nova}
    <p class="suave pequeno nota">Tudo o que você mudar fica registrado no histórico da família.</p>
  {/if}
{/if}

<style>
  .voltar {
    margin-bottom: 12px;
  }
  .dupla {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0 10px;
  }
  .nota {
    margin-top: 10px;
  }
</style>
