<script lang="ts">
  import { untrack } from 'svelte';
  import Icone from '../componentes/Icone.svelte';
  import { hojeISO } from '../lib/datas';
  import { enderecoCurto, familiaPorId, mostrarAviso, salvarMorador } from '../lib/estado.svelte';
  import { novoId } from '../lib/ids';
  import { NOMES_GRUPO, NOMES_SITUACAO_MORADOR } from '../lib/rotulos';
  import { voltar } from '../lib/rotas.svelte';
  import type { Grupo, Morador, SituacaoMorador } from '../lib/tipos';

  /** moradorId = "novo" para incluir um morador. */
  let { familiaId, moradorId }: { familiaId: string; moradorId: string } = $props();

  const hoje = hojeISO();
  const familia = untrack(() => familiaPorId(familiaId));
  const original = untrack(() => familia?.moradores.find((m) => m.id === moradorId));
  const novo = !original;

  let m = $state<Morador>(
    original
      ? ($state.snapshot(original) as Morador)
      : { id: novoId('m'), nome: '', sexo: '', nascimento: '', situacao: 'mora', situacaoDesde: hoje, grupos: [], obs: '' },
  );
  let responsavel = $state(!!familia && familia.responsavelId === m.id);
  const situacaoMudou = $derived(!novo && original?.situacao !== m.situacao);

  // Ao trocar a situação, a data já vem como hoje (dá para mudar).
  let ultimaSituacao = untrack(() => m.situacao);
  $effect(() => {
    if (m.situacao !== ultimaSituacao) {
      ultimaSituacao = m.situacao;
      m.situacaoDesde = hoje;
    }
  });

  function alternarGrupo(g: Grupo) {
    m.grupos = m.grupos.includes(g) ? m.grupos.filter((x) => x !== g) : [...m.grupos, g];
  }

  let salvando = $state(false);
  async function salvar() {
    m.nome = m.nome.trim().replace(/\s+/g, ' ');
    if (!m.nome) return mostrarAviso('Digite o nome.');
    if (m.nascimento && m.nascimento > hoje) return mostrarAviso('A data de nascimento não pode ser no futuro.');
    salvando = true;
    try {
      await salvarMorador(familiaId, $state.snapshot(m) as Morador, responsavel);
      mostrarAviso(novo ? 'Morador incluído ✓' : 'Salvo ✓');
      voltar(`familia/${familiaId}`);
    } finally {
      salvando = false;
    }
  }
</script>

<button class="botao secundario pequeno voltar" onclick={() => voltar(`familia/${familiaId}`)}><Icone nome="voltar" /> Cancelar</button>

{#if !familia || (moradorId !== 'novo' && !original)}
  <p>Morador não encontrado.</p>
{:else}
  <h1>{novo ? 'Novo morador' : 'Editar morador'}</h1>
  <p class="suave endereco">{enderecoCurto(familia)}</p>

  <section class="cartao">
    <label class="campo"><span>Nome completo</span><input type="text" bind:value={m.nome} autocomplete="off" autocapitalize="words" /></label>
    <fieldset class="sexo">
      <legend>Sexo</legend>
      <label><input type="radio" bind:group={m.sexo} value="F" /> Feminino</label>
      <label><input type="radio" bind:group={m.sexo} value="M" /> Masculino</label>
    </fieldset>
    <label class="campo"><span>Data de nascimento</span><input type="date" bind:value={m.nascimento} max={hoje} /></label>
    {#if m.situacao === 'mora'}
      <label class="opcao"><input type="checkbox" bind:checked={responsavel} /> <span>Responsável pela família</span></label>
    {/if}
  </section>

  <section class="cartao">
    <h2>Situação</h2>
    <label class="campo">
      <span>Situação</span>
      <select bind:value={m.situacao}>
        {#each Object.entries(NOMES_SITUACAO_MORADOR) as [valor, nome] (valor)}
          <option value={valor as SituacaoMorador}>{nome}</option>
        {/each}
      </select>
    </label>
    <label class="campo">
      <span>{novo ? 'Mora aqui desde' : 'Desde quando'}</span>
      <input type="date" bind:value={m.situacaoDesde} max={hoje} />
    </label>
    {#if situacaoMudou}
      <p class="alerta">A mudança de situação fica guardada no histórico, com a data. Nada é apagado.</p>
    {/if}
  </section>

  <section class="cartao">
    <h2>Condições e grupos</h2>
    <div class="chips">
      {#each Object.entries(NOMES_GRUPO) as [g, nome] (g)}
        {@const marcado = m.grupos.includes(g as Grupo)}
        <button class="chip" class:marcado aria-pressed={marcado} onclick={() => alternarGrupo(g as Grupo)}>
          {#if marcado}<Icone nome="ok" tamanho={18} />{/if}{nome}
        </button>
      {/each}
    </div>
  </section>

  <section class="cartao">
    <label class="campo"><span>Observações</span><textarea rows="3" bind:value={m.obs}></textarea></label>
  </section>

  <button class="botao largo" onclick={salvar} disabled={salvando}><Icone nome="ok" /> Salvar</button>
{/if}

<style>
  .voltar {
    margin-bottom: 12px;
  }
  .endereco {
    font-weight: 600;
  }
  .sexo {
    border: 0;
    padding: 0;
    margin: 0 0 12px;
    display: flex;
    gap: 18px;
    flex-wrap: wrap;
  }
  .sexo legend {
    font-weight: 600;
    margin-bottom: 4px;
    padding: 0;
  }
  .sexo label {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 48px;
    cursor: pointer;
  }
  .sexo input,
  .opcao input {
    width: 26px;
    height: 26px;
    accent-color: var(--primaria);
  }
  .opcao {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 52px;
    cursor: pointer;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    border: 2px solid var(--borda);
    background: var(--cartao);
    border-radius: 999px;
    padding: 6px 14px;
    font-weight: 600;
    cursor: pointer;
    min-height: 48px;
  }
  .chip.marcado {
    border-color: var(--primaria);
    background: var(--primaria-clara);
  }
</style>
