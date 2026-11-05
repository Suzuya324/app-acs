<script lang="ts">
  import Icone from '../componentes/Icone.svelte';
  import { calcularAtencao, NOMES_ATENCAO, ORDEM_ATENCAO, type AvisoAtencao } from '../lib/atencao';
  import { hojeISO } from '../lib/datas';
  import { app, enderecoCurto, mostrarAviso, salvarMorador } from '../lib/estado.svelte';
  import { ir, voltar } from '../lib/rotas.svelte';
  import type { Morador } from '../lib/tipos';

  const hoje = hojeISO();
  const avisos = $derived(calcularAtencao(app.familias, app.visitas, hoje));
  const grupos = $derived(ORDEM_ATENCAO.map((t) => ({ tipo: t, itens: avisos.filter((a) => a.tipo === t) })).filter((g) => g.itens.length));

  async function fazer(a: AvisoAtencao) {
    const acao = a.acao;
    if (!acao) return;
    const m = $state.snapshot(a.morador) as Morador;
    const grupos = acao.incluir ? [...new Set([...m.grupos, acao.incluir])] : m.grupos.filter((g) => g !== acao.tirar);
    await salvarMorador(a.familia.id, { ...m, grupos });
    mostrarAviso(`${m.nome.split(' ')[0]}: ${acao.rotulo.toLowerCase()} ✓`);
  }
</script>

<button class="botao secundario pequeno voltar" onclick={() => voltar('')}><Icone nome="voltar" /> Voltar</button>

<h1>Atenção</h1>
<p class="suave">Quem precisa de visita ou cuidado e quem mudou de idade. Toque no nome para abrir a família.</p>
<button class="botao secundario largo colar" onclick={() => ir('importar-grupos')}>Marcar grupos colando uma lista do Fast</button>

{#if avisos.length === 0}
  <p class="cartao ok">✓ Nada para olhar agora.</p>
{/if}

{#each grupos as g (g.tipo)}
  <section class="cartao">
    <details open={g.itens.length <= 15}>
      <summary>{NOMES_ATENCAO[g.tipo]} ({g.itens.length})</summary>
      <ul class="lista">
        {#each g.itens as a (`${a.morador.id}-${a.tipo}`)}
          <li class="linha">
            <button class="item" onclick={() => ir(`familia/${a.familia.id}`)}>
              <strong>{a.morador.nome}</strong>
              <span class="pequeno">{a.texto}</span>
              <span class="suave pequeno">{enderecoCurto(a.familia)}</span>
            </button>
            {#if a.acao}
              <button class="botao secundario pequeno acao" onclick={() => fazer(a)}>{a.acao.rotulo}</button>
            {/if}
          </li>
        {/each}
      </ul>
    </details>
  </section>
{/each}

<p class="suave pequeno">
  Regras: gestante, puérpera, criança menor de 2 anos e acamado sem VD que conte há 30 dias; hipertenso sem P.A. e diabético
  sem glicemia (nos sinais vitais da VD) há 60 dias. As idades usam a data de nascimento do cadastro.
</p>

<style>
  .voltar {
    margin-bottom: 12px;
  }
  .colar {
    margin-bottom: 12px;
  }
  .ok {
    color: var(--realizada);
    font-weight: 700;
  }
  .linha {
    display: flex;
    align-items: center;
    gap: 8px;
    border-bottom: 1px solid var(--borda);
  }
  .item {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    flex: 1;
    text-align: left;
    background: none;
    border: 0;
    padding: 10px 0;
    min-height: 52px;
    cursor: pointer;
    color: inherit;
  }
  .acao {
    flex-shrink: 0;
    max-width: 45%;
  }
</style>
