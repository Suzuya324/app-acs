<script lang="ts">
  import Icone from '../componentes/Icone.svelte';
  import { mudancasParaSbcd, textoMudancas } from '../lib/bloco4';
  import { formatarData, hojeISO, somarDias } from '../lib/datas';
  import { app, enderecoCurto, mostrarAviso, salvarConfig } from '../lib/estado.svelte';
  import { ir, voltar } from '../lib/rotas.svelte';

  const hoje = hojeISO();
  /** Desde quando mostrar: a última vez que o ACS passou tudo para o SBCD, ou os últimos 30 dias. */
  const desde = $derived(app.config.sbcdAtualizadoAte ?? `${somarDias(hoje, -30)}T00:00:00.000Z`);
  const lista = $derived(mudancasParaSbcd(app.historico, app.familias, desde));
  const porCasa = $derived.by(() => {
    const m = new Map<string, typeof lista>();
    for (const x of lista) m.set(x.familia?.id ?? '?', [...(m.get(x.familia?.id ?? '?') ?? []), x]);
    return [...m.values()];
  });

  async function copiar() {
    try {
      await navigator.clipboard.writeText(textoMudancas(lista, enderecoCurto));
      app.desfazer = null;
      mostrarAviso('Copiado ✓');
    } catch {
      mostrarAviso('Não consegui copiar.');
    }
  }
  async function passei() {
    app.config.sbcdAtualizadoAte = new Date().toISOString();
    await salvarConfig();
    mostrarAviso('Marcado: tudo passado para o SBCD ✓');
  }
</script>

<button class="botao secundario pequeno voltar" onclick={() => voltar('')}><Icone nome="voltar" /> Voltar</button>

<h1>Mudanças para o SBCD</h1>
<p class="suave">
  O que mudou no cadastro {app.config.sbcdAtualizadoAte ? `desde ${formatarData(app.config.sbcdAtualizadoAte.slice(0, 10))} (a última vez que você passou tudo)` : 'nos últimos 30 dias'}:
  quem chegou, mudou, faleceu, data de nascimento, prontuário, endereço. Passe para o SBCD de uma vez.
</p>

{#if !lista.length}
  <p class="cartao suave">Nenhuma mudança para passar. 👍</p>
{:else}
  <div class="botoes">
    <button class="botao secundario" onclick={copiar}><Icone nome="copiar" tamanho={18} /> Copiar a lista</button>
    <button class="botao" onclick={passei}>✓ Já passei tudo</button>
  </div>
  {#each porCasa as grupo, i (i)}
    {@const f = grupo[0].familia}
    <section class="cartao">
      {#if f}<button class="item-link casa" onclick={() => ir(`familia/${f.id}`)}><strong>{enderecoCurto(f)}</strong>{f.prontuario ? ` · ${f.prontuario}` : ''}</button>{:else}<p><strong>(casa excluída)</strong></p>{/if}
      <ul>
        {#each grupo as m, j (j)}<li><span class="suave pequeno">{formatarData(m.quando.slice(0, 10)).slice(0, 5)}</span> {m.texto}</li>{/each}
      </ul>
    </section>
  {/each}
{/if}

<style>
  .voltar {
    margin-bottom: 12px;
  }
  .botoes {
    display: flex;
    gap: 8px;
    margin: 8px 0 12px;
  }
  .botoes .botao {
    flex: 1;
  }
  ul {
    margin: 6px 0 0;
    padding-left: 18px;
  }
  li {
    margin: 3px 0;
    overflow-wrap: anywhere;
  }
</style>
