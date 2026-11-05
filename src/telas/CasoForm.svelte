<script lang="ts">
  import { untrack } from 'svelte';
  import Icone from '../componentes/Icone.svelte';
  import { app, enderecoCurto, familiaPorId, mostrarAviso, salvarCaso } from '../lib/estado.svelte';
  import { NOMES_CATEGORIA_CASO } from '../lib/rotulos';
  import { trocarPara, voltar } from '../lib/rotas.svelte';
  import type { CategoriaCaso } from '../lib/tipos';

  let { familiaId, casoId }: { familiaId: string; casoId: string } = $props();
  const familia = $derived(familiaPorId(familiaId));
  const original = untrack(() => app.casos.find((c) => c.id === casoId));
  let categoria = $state<CategoriaCaso>(original?.categoria ?? 'importante');
  let titulo = $state(original?.titulo ?? '');
  let texto = $state(original?.texto ?? '');
  let emulti = $state(original?.emulti ?? '');
  let npv = $state(original?.npv ?? '');
  const SUGESTOES_EMULTI = ['Psicologia', 'Nutrição', 'Fisioterapia', 'Fonoaudiologia', 'Serviço social', 'Farmácia', 'Odontologia'];

  async function salvar() {
    if (!titulo.trim() || !texto.trim()) return mostrarAviso('Escreva quem é e o que está acontecendo.', 4000);
    await salvarCaso({
      id: original?.id,
      familiaId,
      categoria,
      titulo: titulo.trim(),
      texto: texto.trim(),
      emulti: emulti.trim() || undefined,
      npv: npv.trim() || undefined,
      resolvidoEm: original?.resolvidoEm,
    });
    mostrarAviso('Caso salvo ✓');
    trocarPara('casos');
  }
</script>

<button class="botao secundario pequeno voltar" onclick={() => voltar(`familia/${familiaId}`)}><Icone nome="voltar" /> Voltar</button>

<h1>{original ? 'Editar caso' : 'Abrir caso'}</h1>
{#if familia}<p class="suave">{enderecoCurto(familia)}</p>{/if}

<section class="cartao">
  <fieldset class="categorias">
    <legend>Tipo</legend>
    {#each Object.entries(NOMES_CATEGORIA_CASO) as [c, nome] (c)}
      <label class="opcao"><input type="radio" bind:group={categoria} value={c} /> {nome}</label>
    {/each}
  </fieldset>
  <label class="campo">
    <span>Quem</span>
    <input type="text" bind:value={titulo} list="moradores-caso" placeholder="Nome (e idade)" autocomplete="off" />
    <datalist id="moradores-caso">
      {#each familia?.moradores.filter((m) => m.situacao === 'mora') ?? [] as m (m.id)}<option value={m.nome}></option>{/each}
    </datalist>
  </label>
  <label class="campo">
    <span>O que está acontecendo (o que já foi feito e o que falta)</span>
    <textarea rows="7" bind:value={texto}></textarea>
  </label>
  <label class="campo">
    <span>Encaminhar para a eMulti (opcional)</span>
    <input type="text" bind:value={emulti} list="emulti" placeholder="Ex.: Psicologia" autocomplete="off" />
    <datalist id="emulti">{#each SUGESTOES_EMULTI as s (s)}<option value={s}></option>{/each}</datalist>
  </label>
  <label class="campo">
    <span>Ponto para a reunião de equipe – NPV (opcional)</span>
    <input type="text" bind:value={npv} autocomplete="off" />
  </label>
  <button class="botao largo" onclick={salvar}>Salvar caso</button>
</section>

<style>
  .voltar {
    margin-bottom: 12px;
  }
  .categorias {
    border: 0;
    padding: 0;
    margin: 0 0 10px;
  }
  .categorias legend {
    font-weight: 700;
    margin-bottom: 4px;
  }
  .opcao {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 44px;
  }
  .opcao input {
    width: 22px;
    height: 22px;
    accent-color: var(--primaria);
  }
  textarea {
    width: 100%;
    font-size: 1rem;
  }
</style>
