<script lang="ts">
  // Acompanhamento da pessoa: o que o app leu do que o ACS já escreveu (remédios, medidas, pendências,
  // o que perguntar). Aparece na ficha, no cartão de prioritário e na tela da VD.
  import { NOMES_PENDENCIA, type Acompanhamento, type Pendencia, type Remedio } from '../lib/acompanhamento';
  import type { SugestaoDasVDs } from '../lib/anotacoes';
  import { formatarData } from '../lib/datas';
  import { aplicarSugestoesDasVDs, ensinarRemedios, esconderDoAcompanhamento, mostrarAviso } from '../lib/estado.svelte';
  import { NOMES_GRUPO } from '../lib/rotulos';
  import type { Morador } from '../lib/tipos';

  let { a, morador, modo = 'ficha' }: { a: Acompanhamento; morador: Morador; modo?: 'ficha' | 'cartao' | 'vd' } = $props();
  const nome = $derived(morador.nome.split(' ')[0]);
  const dia = (iso: string) => (iso ? formatarData(iso).slice(0, 5) : 'sem data');
  const curto = (t: string, max = 200) => (t.length > max ? `${t.slice(0, max).trimEnd()}…` : t);
  const oQue = (s: SugestaoDasVDs) =>
    s.sugestao.tipo === 'grupo' ? NOMES_GRUPO[s.sugestao.grupo] : s.sugestao.situacao === 'faleceu' ? 'Faleceu' : 'Mudou-se';
  let novoRemedio = $state('');
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
  const confirmar = (s: SugestaoDasVDs) => fazer(() => aplicarSugestoesDasVDs([$state.snapshot(s) as SugestaoDasVDs], []), `Ficha de ${nome} atualizada ✓`);
  const naoE = (s: SugestaoDasVDs) => fazer(() => esconderDoAcompanhamento([s.chave], 'Marcar “não é”'), 'Não aparece mais ✓');
  const resolver = (p: Pendencia) => fazer(() => esconderDoAcompanhamento([...p.chaves], 'Pendência resolvida'), 'Resolvida ✓');
  const tirar = (r: Remedio) => fazer(() => esconderDoAcompanhamento([r.chave], 'Tirar remédio'), `${r.nome} tirado ✓`);
  async function ensinar() {
    const n = novoRemedio.trim();
    if (n.length < 3) return;
    await fazer(() => ensinarRemedios(n), 'O app vai procurar esse nome ✓');
    novoRemedio = '';
  }
</script>

<div class="acomp {modo}">
  {#if a.achadas.length}
    <div class="bloco confirmar">
      <h3>Achei nas VDs · confirme</h3>
      {#each a.achadas as s (s.chave)}
        <div class="item">
          <p><strong>{oQue(s)}?</strong> <span class="suave pequeno">“{curto(s.provas[0]?.frase ?? '', 140)}” ({dia(s.provas[0]?.data ?? '')})</span></p>
          <div class="acoes">
            <button class="botao pequeno" disabled={ocupado} onclick={() => confirmar(s)}>✓ Confirmar</button>
            <button class="botao secundario pequeno" disabled={ocupado} onclick={() => naoE(s)}>Não é</button>
          </div>
        </div>
      {/each}
    </div>
  {/if}

  {#if a.perguntas.length}
    <div class="bloco">
      <h3>Perguntar na próxima VD</h3>
      <ul class="perguntas">
        {#each a.perguntas as p (p)}<li>{p}</li>{/each}
      </ul>
    </div>
  {/if}

  {#if a.remedios.length}
    <div class="bloco">
      <h3>Remédios</h3>
      <ul class="remedios">
        {#each a.remedios as r (r.chave)}
          <li class={r.situacao}>
            <span class="txt">
              {#if r.situacao === 'alergia'}⚠️ <strong>Alergia: {r.nome}</strong>
              {:else if r.situacao === 'parou'}<s>{r.nome}</s> <span class="suave">parou ou está sem</span>
              {:else}<strong>{r.nome}</strong>{r.dose ? ` ${r.dose}` : ''}{/if}
              <span class="suave pequeno"> · {r.data ? `citado em ${dia(r.data)}` : r.origem}</span>
            </span>
            {#if modo !== 'vd'}
              <button class="xis" title="Tirar: não é remédio de {nome}" aria-label="Tirar {r.nome}: não é remédio de {nome}" disabled={ocupado} onclick={() => tirar(r)}>✕</button>
            {/if}
          </li>
        {/each}
      </ul>
      {#if modo === 'ficha'}
        <details class="ensinar">
          <summary class="suave pequeno">Faltou um remédio?</summary>
          <p class="suave pequeno">O app procura os nomes que conhece. Digite o nome como você escreve nas VDs (só o nome do remédio).</p>
          <div class="linha-ensinar">
            <input type="text" bind:value={novoRemedio} placeholder="Ex.: nome do remédio" autocomplete="off" aria-label="Nome do remédio" />
            <button class="botao secundario pequeno" disabled={ocupado || novoRemedio.trim().length < 3} onclick={ensinar}>Ensinar</button>
          </div>
        </details>
      {/if}
    </div>
  {/if}

  {#if a.medidas.pa.length || a.medidas.glicemia.length}
    <div class="bloco">
      <h3>Medidas</h3>
      {#if a.medidas.pa.length}
        <p>P.A. <strong>{a.medidas.pa[0].valor}</strong> ({dia(a.medidas.pa[0].data)}){#if a.medidas.pa[1]}<span class="suave"> · antes {a.medidas.pa[1].valor} ({dia(a.medidas.pa[1].data)})</span>{/if}</p>
      {/if}
      {#if a.medidas.glicemia.length}
        <p>Glicemia <strong>{a.medidas.glicemia[0].valor}</strong> ({dia(a.medidas.glicemia[0].data)}){#if a.medidas.glicemia[1]}<span class="suave"> · antes {a.medidas.glicemia[1].valor} ({dia(a.medidas.glicemia[1].data)})</span>{/if}</p>
      {/if}
    </div>
  {/if}

  {#if a.pendencias.length}
    <div class="bloco">
      <h3>Pendências</h3>
      {#each a.pendencias as p (p.chave)}
        <div class="item pend">
          <p>
            <span class="tipo">{NOMES_PENDENCIA[p.tipo]}</span>{#if p.quando}<strong> dia {dia(p.quando)}</strong>{/if}
            <span class="frase">“{curto(p.frase)}”</span> <span class="suave pequeno">({dia(p.data)})</span>
          </p>
          <button class="botao secundario pequeno" disabled={ocupado} onclick={() => resolver(p)}>✓ Resolvida</button>
        </div>
      {/each}
    </div>
  {/if}

  {#if modo === 'cartao' && a.noticias.length}
    <div class="bloco">
      <h3>Últimas notícias</h3>
      {#each a.noticias as n, i (i)}
        <p class="noticia"><span class="suave pequeno">{dia(n.data)} · {n.origem}</span><br />{curto(n.texto, 240)}</p>
      {/each}
    </div>
  {/if}
</div>

<style>
  .acomp {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .bloco h3 {
    margin: 0 0 4px;
    font-size: 0.82rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: var(--texto-suave);
  }
  .bloco p {
    margin: 2px 0;
  }
  .confirmar {
    border-left: 4px solid var(--ausencia);
    padding-left: 10px;
  }
  .item {
    padding: 6px 0;
  }
  .item + .item {
    border-top: 1px solid var(--borda);
  }
  .acoes {
    display: flex;
    gap: 8px;
    margin-top: 6px;
  }
  .acoes .botao {
    flex: 1;
  }
  .perguntas {
    margin: 0;
    padding-left: 20px;
  }
  .perguntas li {
    margin: 4px 0;
  }
  .remedios {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .remedios li {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 3px 0;
  }
  .remedios .txt {
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .remedios .alergia {
    color: var(--perigo);
  }
  .xis {
    flex: none;
    width: 36px;
    height: 36px;
    border-radius: 10px;
    border: 1px solid var(--borda);
    background: transparent;
    color: var(--texto-suave);
    cursor: pointer;
  }
  .tipo {
    display: inline-block;
    font-size: 0.78rem;
    font-weight: 700;
    padding: 1px 8px;
    border-radius: 6px;
    background: var(--primaria-clara);
    color: var(--texto);
    margin-right: 4px;
  }
  .pend .botao {
    margin-top: 6px;
  }
  .frase {
    overflow-wrap: anywhere;
  }
  .noticia {
    padding: 4px 0;
    overflow-wrap: anywhere;
  }
  .ensinar {
    margin-top: 6px;
  }
  .linha-ensinar {
    display: flex;
    gap: 8px;
  }
  .linha-ensinar input {
    flex: 1;
    min-width: 0;
  }
</style>
