<script lang="ts">
  import Icone from '../componentes/Icone.svelte';
  import { aConfirmar } from '../lib/bloco4';
  import { formatarData, hojeISO } from '../lib/datas';
  import { sugestoesDasVDs } from '../lib/anotacoes';
  import { listarPendencias } from '../lib/pendencias';
  import { app, contextoAcompanhamento, enderecoCurto, esconderDoAcompanhamento, mostrarAviso, salvarMorador, salvarPrioritario } from '../lib/estado.svelte';
  import type { Prioritario } from '../lib/prioritarios';
  import type { Morador } from '../lib/tipos';
  import { ir, voltar } from '../lib/rotas.svelte';

  const hoje = hojeISO();
  const r = $derived(aConfirmar(app.familias, contextoAcompanhamento()));
  const fichas = $derived(sugestoesDasVDs(app.familias, app.visitas, app.casos, app.config.sugestoesEscondidas ?? []).length);
  const faltam = $derived(listarPendencias(app.familias).length);
  let ocupado = $state(false);

  async function fazer(acao: () => Promise<unknown>, aviso: string) {
    if (ocupado) return;
    ocupado = true;
    try {
      await acao();
      mostrarAviso(aviso);
    } finally {
      ocupado = false;
    }
  }
  const snap = <T,>(x: T) => $state.snapshot(x) as T;
  const confirmarObito = (p: Prioritario, familiaId: string, m: Morador) =>
    fazer(async () => {
      await salvarMorador(familiaId, { ...snap(m), situacao: 'faleceu', situacaoDesde: hoje });
      await salvarPrioritario({ ...snap(p), obito: false, resumo: `${p.resumo} (óbito confirmado em ${formatarData(hoje)})`.trim() });
    }, 'Óbito registrado ✓');
  const naoFaleceu = (p: Prioritario) => fazer(() => salvarPrioritario({ ...snap(p), obito: false }), 'Tirado da lista ✓');
  const eGestante = (p: Prioritario, sim: boolean) =>
    fazer(
      () => salvarPrioritario({ ...snap(p), etiquetas: sim ? [...new Set(p.etiquetas.map((e) => (e === 'GESTANTE?' ? 'GESTANTE' : e)))] : p.etiquetas.filter((e) => e !== 'GESTANTE?') }),
      sim ? 'Marcada como gestante ✓' : 'Tirado da lista ✓',
    );
  const total = $derived(r.obitos.length + r.gestantes.length + r.anotacoes.length);
</script>

<button class="botao secundario pequeno voltar" onclick={() => voltar('')}><Icone nome="voltar" /> Voltar</button>

<h1>A confirmar</h1>
<p class="suave">Tudo o que está em dúvida, num lugar só. Confirme na próxima VD e toque no botão certo.</p>

{#if !total && !fichas && !faltam}<p class="cartao suave">Nada a confirmar. 👍</p>{/if}

{#if r.obitos.length}
  <section class="cartao">
    <h2>Óbito a confirmar ({r.obitos.length})</h2>
    {#each r.obitos as x (x.p.id)}
      <div class="item">
        <p><strong>{x.p.nome}</strong> <span class="suave pequeno">{x.familia ? enderecoCurto(x.familia) : `${x.p.rua} ${x.p.casa}`}</span></p>
        {#if x.p.resumo}<p class="pequeno">{x.p.resumo}</p>{/if}
        <div class="botoes">
          {#if x.familia && x.morador}<button class="botao pequeno" disabled={ocupado} onclick={() => confirmarObito(x.p, x.familia!.id, x.morador!)}>Confirmar óbito</button>{/if}
          <button class="botao secundario pequeno" disabled={ocupado} onclick={() => naoFaleceu(x.p)}>Está vivo(a)</button>
        </div>
      </div>
    {/each}
  </section>
{/if}

{#if r.gestantes.length}
  <section class="cartao">
    <h2>Gestante? confirmar ({r.gestantes.length})</h2>
    <p class="suave pequeno">Registro antigo de gestação. Ela está grávida agora?</p>
    {#each r.gestantes as x (x.p.id)}
      <div class="item">
        <p><strong>{x.p.nome}</strong> <span class="suave pequeno">{x.familia ? enderecoCurto(x.familia) : `${x.p.rua} ${x.p.casa}`}</span></p>
        <div class="botoes">
          <button class="botao pequeno" disabled={ocupado} onclick={() => eGestante(x.p, true)}>Está grávida</button>
          <button class="botao secundario pequeno" disabled={ocupado} onclick={() => eGestante(x.p, false)}>Não está</button>
        </div>
      </div>
    {/each}
  </section>
{/if}

{#if r.anotacoes.length}
  <section class="cartao">
    <h2>Anotado “a confirmar” ({r.anotacoes.length})</h2>
    {#each r.anotacoes as x (x.pendencia.chave)}
      <div class="item">
        <p><strong>{x.morador.nome}</strong> <span class="suave pequeno">{enderecoCurto(x.familia)}</span></p>
        <p class="pequeno">“{x.pendencia.frase}” <span class="suave">({formatarData(x.pendencia.data).slice(0, 5)})</span></p>
        <button class="botao secundario pequeno" disabled={ocupado} onclick={() => fazer(() => esconderDoAcompanhamento([...x.pendencia.chaves], 'Confirmado'), 'Confirmado ✓')}>✓ Já confirmei</button>
      </div>
    {/each}
  </section>
{/if}

{#if fichas}
  <button class="item-link pendencias" onclick={() => ir('revisar-fichas')}><span><strong>Condições achadas nas VDs</strong><br /><span class="suave pequeno">diabetes, acamado… para confirmar na ficha</span></span><span class="num-pend">{fichas}</span></button>
{/if}
{#if faltam}
  <button class="item-link pendencias" onclick={() => ir('pendencias')}><span><strong>O que falta completar</strong><br /><span class="suave pequeno">prontuário, data de nascimento, responsável</span></span><span class="num-pend">{faltam}</span></button>
{/if}

<style>
  .voltar {
    margin-bottom: 12px;
  }
  .item {
    border-top: 1px solid var(--borda);
    padding: 8px 0;
  }
  .item p {
    margin: 2px 0;
    overflow-wrap: anywhere;
  }
  .botoes {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: 6px;
  }
</style>
