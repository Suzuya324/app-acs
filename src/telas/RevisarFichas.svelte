<script lang="ts">
  import Icone from '../componentes/Icone.svelte';
  import { sugestoesDasVDs, type SugestaoDasVDs } from '../lib/anotacoes';
  import { formatarData } from '../lib/datas';
  import { aplicarSugestoesDasVDs, app, enderecoCurto, mostrarAviso, mostrarSugestoesEscondidas } from '../lib/estado.svelte';
  import { ir, voltar } from '../lib/rotas.svelte';
  import type { Familia } from '../lib/tipos';

  const lista = $derived(sugestoesDasVDs(app.familias, app.visitas, app.casos, app.config.sugestoesEscondidas ?? []));
  /** O que o ACS tocou em cada sugestão: atualizar a ficha ou "não é". */
  let decisao = $state<Record<string, 'sim' | 'nao'>>({});
  let salvando = $state(false);

  const porCasa = $derived.by(() => {
    const mapa = new Map<string, { familia: Familia; itens: SugestaoDasVDs[] }>();
    for (const s of lista) {
      const c = mapa.get(s.familia.id) ?? { familia: s.familia, itens: [] };
      c.itens.push(s);
      mapa.set(s.familia.id, c);
    }
    return [...mapa.values()].sort((a, b) => enderecoCurto(a.familia).localeCompare(enderecoCurto(b.familia), 'pt-BR', { numeric: true }));
  });
  const confirmadas = $derived(lista.filter((s) => decisao[s.chave] === 'sim'));
  const naoE = $derived(lista.filter((s) => decisao[s.chave] === 'nao').map((s) => s.chave));
  const escondidas = $derived((app.config.sugestoesEscondidas ?? []).filter((k) => !/\|[prc]-/.test(k)).length);

  function tocar(chave: string, valor: 'sim' | 'nao') {
    if (decisao[chave] === valor) delete decisao[chave];
    else decisao[chave] = valor;
  }

  async function salvar() {
    if (!confirmadas.length && !naoE.length) return;
    salvando = true;
    try {
      const n = new Set(confirmadas.map((s) => s.morador.id)).size;
      await aplicarSugestoesDasVDs($state.snapshot(confirmadas) as SugestaoDasVDs[], naoE);
      mostrarAviso(n ? `${n} ${n === 1 ? 'ficha atualizada' : 'fichas atualizadas'} ✓` : 'Pronto ✓');
      decisao = {};
    } finally {
      salvando = false;
    }
  }

  const curto = (t: string, max = 220) => (t.length > max ? `${t.slice(0, max).trimEnd()}…` : t);
</script>

<button class="botao secundario pequeno voltar" onclick={() => voltar('ajustes')}><Icone nome="voltar" /> Voltar</button>

<h1>Atualizar fichas pelas VDs já feitas</h1>
<p class="suave">
  Li o que você já escreveu: as VDs (os relatos trazidos do Sistema de Visitas e as observações das VDs do app), os relatos
  antigos e os casos. Abaixo está o que daria para atualizar na ficha de cada pessoa. <strong>Nada muda sem você tocar em
  “Atualizar”.</strong>
</p>

{#if !lista.length}
  <section class="cartao destaque">
    <p><strong>Nada novo para atualizar.</strong> As fichas já estão de acordo com o que foi escrito nas VDs.</p>
  </section>
{:else}
  <section class="cartao destaque">
    <p><strong>{lista.length}</strong> {lista.length === 1 ? 'atualização encontrada' : 'atualizações encontradas'} em {porCasa.length} {porCasa.length === 1 ? 'casa' : 'casas'}.</p>
    <p class="suave pequeno">
      Toque em <strong>Atualizar</strong> no que estiver certo e em <strong>Não é</strong> no que estiver errado (não aparece mais).
      O que você não tocar fica para depois.
    </p>
  </section>

  {#each porCasa as casa (casa.familia.id)}
    <section class="cartao">
      <button class="item-link casa" onclick={() => ir(`familia/${casa.familia.id}`)}>{enderecoCurto(casa.familia)}</button>
      {#each casa.itens as s (s.chave)}
        <div class="sugestao" class:sim={decisao[s.chave] === 'sim'} class:nao={decisao[s.chave] === 'nao'}>
          <p class="titulo"><strong>{s.sugestao.texto}</strong></p>
          {#each s.provas.slice(0, 2) as p (p.frase)}
            <div class="prova">
              <span class="suave pequeno">{p.origem}{p.data && !p.origem.includes(formatarData(p.data).slice(0, 5)) ? ` · ${formatarData(p.data)}` : ''}</span>
              <p>“{curto(p.frase)}”</p>
              {#if p.trecho.length > p.frase.length + 10}
                <details><summary class="suave pequeno">Ver o texto todo</summary><p class="pequeno">{p.trecho}</p></details>
              {/if}
            </div>
          {/each}
          {#if s.provas.length > 2}<p class="suave pequeno">e em mais {s.provas.length - 2} {s.provas.length - 2 === 1 ? 'texto' : 'textos'}</p>{/if}
          <div class="linha-botoes">
            <button class="botao pequeno" class:secundario={decisao[s.chave] !== 'sim'} aria-pressed={decisao[s.chave] === 'sim'} onclick={() => tocar(s.chave, 'sim')}>
              {decisao[s.chave] === 'sim' ? '✓ ' : ''}Atualizar
            </button>
            <button class="botao pequeno" class:secundario={decisao[s.chave] !== 'nao'} aria-pressed={decisao[s.chave] === 'nao'} onclick={() => tocar(s.chave, 'nao')}>
              {decisao[s.chave] === 'nao' ? '✕ ' : ''}Não é
            </button>
          </div>
        </div>
      {/each}
    </section>
  {/each}

  <div class="rodape">
    <button class="botao largo" disabled={salvando || (!confirmadas.length && !naoE.length)} onclick={salvar}>
      {#if confirmadas.length || naoE.length}
        Salvar ({confirmadas.length} {confirmadas.length === 1 ? 'atualização' : 'atualizações'}{naoE.length ? `, ${naoE.length} “não é”` : ''})
      {:else}
        Toque em Atualizar ou Não é
      {/if}
    </button>
  </div>
{/if}

{#if escondidas}
  <p class="suave pequeno centro">
    {escondidas} {escondidas === 1 ? 'sugestão marcada' : 'sugestões marcadas'} como “não é”.
    <button class="item-link inline" onclick={() => mostrarSugestoesEscondidas()}>Mostrar de novo</button>
  </p>
{/if}

<style>
  .voltar {
    margin-bottom: 12px;
  }
  .casa {
    font-weight: 700;
    margin-bottom: 8px;
  }
  .sugestao {
    border-top: 1px solid var(--borda);
    padding: 12px 0 4px;
  }
  .sugestao.sim .titulo {
    color: var(--realizada);
  }
  .sugestao.nao {
    opacity: 0.55;
  }
  .titulo {
    margin: 0 0 6px;
  }
  .prova {
    border-left: 3px solid var(--borda);
    padding-left: 10px;
    margin: 6px 0;
  }
  .prova p {
    margin: 2px 0;
  }
  .linha-botoes {
    display: flex;
    gap: 8px;
    margin-top: 8px;
  }
  .linha-botoes .botao {
    flex: 1;
  }
  .rodape {
    position: sticky;
    bottom: calc(56px + env(safe-area-inset-bottom));
    padding: 8px 0 22px;
    background: var(--fundo);
  }
  .inline {
    display: inline;
    padding: 0;
    text-decoration: underline;
  }
</style>
