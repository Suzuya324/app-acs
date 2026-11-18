<script lang="ts">
  import Icone from '../componentes/Icone.svelte';
  import { formatarData, hojeISO, somarDias } from '../lib/datas';
  import { app, devolutivaViraVD, devolutivasSoNaFicha, enderecoCurto, mostrarAviso, registrarDevolutivaTecnica, salvarAgendaTecnica } from '../lib/estado.svelte';
  import { ir, voltar } from '../lib/rotas.svelte';
  import { listaParaTecnica, textoParaTecnica, type TipoTecnica } from '../lib/tecnica';

  const hoje = hojeISO();
  const todos = $derived(listaParaTecnica(app.familias, app.visitas, app.casos, app.prioritarios, hoje, app.config.ruas));
  type Filtro = 'todos' | 'importantes' | 'agenda' | TipoTecnica;
  let filtro = $state<Filtro>('importantes');
  const FILTROS: [Filtro, string][] = [
    ['importantes', 'Mais importantes'],
    ['todos', 'Todos'],
    ['agenda', 'Dia da técnica'],
    ['pa', 'P.A.'],
    ['glicemia', 'Glicemia'],
    ['curativo', 'Curativo'],
    ['outro', 'Outros'],
  ];
  const passa = (f: Filtro) => (it: (typeof todos)[number]) =>
    f === 'todos' ? true : f === 'importantes' ? it.peso >= 50 : f === 'agenda' ? naAgenda(it.morador.id) : it.pedidos.some((p) => p.tipo === f);
  const lista = $derived(
    todos.filter(passa(filtro)).map((it) => ({ ...it, pedidos: ['todos', 'importantes', 'agenda'].includes(filtro) ? it.pedidos : it.pedidos.filter((p) => p.tipo === filtro) })),
  );

  // ---- Dia da técnica na área
  const agenda = $derived(app.config.agendaTecnica);
  const naAgenda = (id: string) => !!agenda?.moradores.includes(id);
  let diaTecnica = $state(app.config.agendaTecnica?.data ?? somarDias(hojeISO(), 1));
  function alternarAgenda(id: string) {
    const atuais = agenda?.moradores ?? [];
    salvarAgendaTecnica({ data: diaTecnica, moradores: atuais.includes(id) ? atuais.filter((x) => x !== id) : [...atuais, id] });
  }
  function mudarDia(d: string) {
    diaTecnica = d;
    if (agenda) salvarAgendaTecnica({ ...agenda, data: d });
  }
  async function copiarAgenda() {
    const itens = todos.filter((it) => naAgenda(it.morador.id));
    const texto = textoParaTecnica(itens, hoje, (f) => `${enderecoCurto(f)}${f.referencia ? ` (${f.referencia})` : ''}`).replace(/^Para a técnica de enfermagem \([^)]*\)/, `Dia da técnica na área (${formatarData(diaTecnica)})`);
    try {
      await navigator.clipboard.writeText(texto);
      app.desfazer = null;
      mostrarAviso('Roteiro da técnica copiado ✓');
    } catch {
      mostrarAviso('Não consegui copiar.');
    }
  }

  // ---- Devolutiva (o que a técnica fez)
  let devolvendo = $state<string | null>(null);
  let dv = $state({ data: hojeISO(), pa: '', glicemia: '', texto: '', junto: true });
  function abrirDevolutiva(id: string) {
    devolvendo = devolvendo === id ? null : id;
    dv = { data: hojeISO(), pa: '', glicemia: '', texto: '', junto: true };
  }
  async function salvarDevolutiva(familiaId: string, moradorId: string) {
    await registrarDevolutivaTecnica(familiaId, moradorId, $state.snapshot(dv));
    const junto = dv.junto;
    devolvendo = null;
    mostrarAviso(junto ? 'VD com a técnica salva ✓ Conta para a meta e foi para a fila do Fast.' : 'Devolutiva anotada ✓ Entrou na ficha.', 3500);
  }
  // Devolutivas anotadas antes "só na ficha": se o ACS foi junto, viram VD.
  const soNaFicha = $derived(app.familias && devolutivasSoNaFicha(hoje));
  let convertendo = $state(false);
  async function virarVD(familiaId: string, relatoId: string) {
    convertendo = true;
    try {
      await devolutivaViraVD(familiaId, relatoId);
      mostrarAviso('Virou VD ✓ Conta para a meta e foi para a fila do Fast.', 3500);
    } finally {
      convertendo = false;
    }
  }
  async function virarTodas() {
    convertendo = true;
    try {
      const itens = soNaFicha.filter((x) => x.morador).map((x) => [x.familia.id, x.relatoId] as const);
      for (const [fid, rid] of itens) await devolutivaViraVD(fid, rid);
      app.desfazer = null;
      mostrarAviso(`${itens.length} ${itens.length === 1 ? 'virou VD' : 'viraram VD'} ✓ Contam para a meta e foram para a fila do Fast.`, 4000);
    } finally {
      convertendo = false;
    }
  }
  const conta = (f: Filtro) => todos.filter(passa(f)).length;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(textoParaTecnica(lista, hoje, enderecoCurto));
      app.desfazer = null;
      mostrarAviso('Lista copiada ✓ Cole no WhatsApp da técnica.');
    } catch {
      mostrarAviso('Não consegui copiar.');
    }
  }
</script>

<button class="botao secundario pequeno voltar" onclick={() => voltar('casos')}><Icone nome="voltar" /> Voltar</button>

<h1>Para a técnica de enfermagem</h1>
<p class="suave">
  Quem precisa de P.A., glicemia, curativo ou outro cuidado, pelo que está no app. Quando a técnica fizer, toque em
  “✓ Técnica foi”: com você junto, vira VD compartilhada (conta para a meta). A pessoa sai da lista sozinha.
</p>

<div class="chips" role="tablist" aria-label="Filtrar">
  {#each FILTROS as [f, nome] (f)}
    <button class="chip" class:ativo={filtro === f} role="tab" aria-selected={filtro === f} onclick={() => (filtro = f)}>{nome} <span class="n">{conta(f)}</span></button>
  {/each}
</div>

{#if soNaFicha.length}
  <section class="cartao so-ficha">
    <h2>Anotadas só na ficha ({soNaFicha.length})</h2>
    <p class="suave pequeno">Visitas da técnica anotadas sem contar para a meta. Se você foi junto, transforme em VD: conta para a meta e vai para a fila do Fast.</p>
    <ul>
      {#each soNaFicha as d (d.relatoId)}
        <li>
          <span><strong>{formatarData(d.data).slice(0, 5)}</strong> · {enderecoCurto(d.familia)}<br /><span class="pequeno">{d.texto}</span></span>
          {#if d.morador}<button class="botao secundario pequeno" disabled={convertendo} onclick={() => virarVD(d.familia.id, d.relatoId)}>Virar VD</button>{/if}
        </li>
      {/each}
    </ul>
    {#if soNaFicha.filter((x) => x.morador).length > 1}<button class="botao largo" disabled={convertendo} onclick={virarTodas}>Fui junto em todas: virar VD ({soNaFicha.filter((x) => x.morador).length})</button>{/if}
  </section>
{/if}

<section class="cartao dia-tecnica">
  <h2>Dia da técnica na área</h2>
  <label class="campo"><span class="pequeno">Quando ela vem</span><input type="date" value={diaTecnica} onchange={(e) => mudarDia((e.currentTarget as HTMLInputElement).value)} /></label>
  <p class="pequeno">
    {agenda?.moradores.length ? `${agenda.moradores.length} ${agenda.moradores.length === 1 ? 'pessoa marcada' : 'pessoas marcadas'} para ${formatarData(agenda.data)}.` : 'Marque “Levar no dia dela” nas pessoas abaixo.'}
  </p>
  {#if agenda?.moradores.length}
    <div class="botoes">
      <button class="botao pequeno" onclick={copiarAgenda}><Icone nome="copiar" tamanho={18} /> Copiar o roteiro dela</button>
      <button class="botao secundario pequeno" onclick={() => (filtro = 'agenda')}>Ver só o dia dela</button>
      <button class="botao secundario pequeno" onclick={() => salvarAgendaTecnica(undefined)}>Limpar</button>
    </div>
  {/if}
</section>

{#if lista.length}
  <button class="botao largo" onclick={copiar}><Icone nome="copiar" tamanho={20} /> Copiar a lista ({lista.length})</button>
{:else}
  <p class="cartao suave">Ninguém aqui. 👍</p>
{/if}

<ul class="lista">
  {#each lista as it (it.morador.id)}
    <li class="cartao item" class:alto={it.peso >= 70}>
      <button class="nome" onclick={() => ir(`pessoa/${it.familia.id}/${it.morador.id}`)}>
        <strong>{it.morador.nome}</strong>
        <span class="suave pequeno">{enderecoCurto(it.familia)}</span>
      </button>
      <ul class="pedidos">
        {#each it.pedidos as p, i (i)}<li class={p.tipo}>{p.texto}</li>{/each}
      </ul>
      <div class="acoes">
        <label class="opcao pequeno"><input type="checkbox" checked={naAgenda(it.morador.id)} onchange={() => alternarAgenda(it.morador.id)} /> Levar no dia dela</label>
        <button class="botao secundario pequeno" onclick={() => abrirDevolutiva(it.morador.id)}>✓ Técnica foi</button>
      </div>
      {#if devolvendo === it.morador.id}
        <div class="devolutiva">
          <label class="opcao pequeno junto"><input type="checkbox" bind:checked={dv.junto} /> <span><strong>Fui junto</strong>: vira VD compartilhada com a técnica, conta para a meta e vai para a fila do Fast</span></label>
          {#if !dv.junto}<p class="suave pequeno">Ela foi sozinha: fica só anotado na ficha (não conta para a meta nem vai para o Fast).</p>{/if}
          <div class="duas">
            <label class="campo"><span class="pequeno">Dia</span><input type="date" bind:value={dv.data} max={hoje} /></label>
            <label class="campo"><span class="pequeno">P.A.</span><input type="text" inputmode="numeric" bind:value={dv.pa} placeholder="130x80" /></label>
            <label class="campo"><span class="pequeno">Glicemia</span><input type="text" inputmode="numeric" bind:value={dv.glicemia} placeholder="110" /></label>
          </div>
          <label class="campo"><span class="pequeno">O que mais ela fez</span><input type="text" bind:value={dv.texto} placeholder="Ex.: curativo feito; orientou a insulina" /></label>
          <button class="botao pequeno" onclick={() => salvarDevolutiva(it.familia.id, it.morador.id)}>{dv.junto ? 'Salvar VD com a técnica' : 'Salvar devolutiva'}</button>
        </div>
      {/if}
    </li>
  {/each}
</ul>

<style>
  .voltar {
    margin-bottom: 12px;
  }
  .chips {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding-bottom: 6px;
    margin: 10px 0;
  }
  .chip {
    flex: 0 0 auto;
    min-height: 44px;
    padding: 6px 12px;
    border-radius: 999px;
    border: 2px solid var(--borda);
    background: var(--cartao);
    color: var(--texto);
    font-weight: 700;
    cursor: pointer;
  }
  .chip.ativo {
    border-color: var(--primaria);
    background: var(--primaria-clara);
  }
  .n {
    font-weight: 400;
    opacity: 0.8;
  }
  .lista {
    list-style: none;
    padding: 0;
    margin: 12px 0 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .item {
    margin: 0;
    border-left: 6px solid var(--borda);
  }
  .item.alto {
    border-left-color: var(--perigo);
  }
  .nome {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    width: 100%;
    background: none;
    border: 0;
    padding: 0;
    text-align: left;
    color: var(--texto);
    cursor: pointer;
    font: inherit;
  }
  .pedidos {
    margin: 6px 0 0;
    padding-left: 18px;
  }
  .pedidos li {
    margin: 3px 0;
    overflow-wrap: anywhere;
  }
  .so-ficha {
    border-left: 6px solid var(--aviso-texto);
    margin-bottom: 10px;
  }
  .so-ficha h2 {
    margin: 0 0 6px;
  }
  .so-ficha ul {
    list-style: none;
    padding: 0;
    margin: 8px 0;
  }
  .so-ficha li {
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
    border-top: 1px solid var(--borda);
    padding: 6px 0;
    overflow-wrap: anywhere;
  }
  .dia-tecnica {
    border-left: 6px solid var(--primaria);
    margin-bottom: 10px;
  }
  .dia-tecnica h2 {
    margin: 0 0 6px;
  }
  .botoes,
  .acoes {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-top: 6px;
  }
  .acoes .opcao {
    display: flex;
    gap: 6px;
    align-items: center;
    flex: 1;
  }
  .acoes input[type='checkbox'] {
    width: 22px;
    height: 22px;
  }
  .junto {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    margin-bottom: 6px;
  }
  .junto input {
    width: 22px;
    height: 22px;
    flex: 0 0 auto;
  }
  .devolutiva {
    border-top: 1px solid var(--borda);
    margin-top: 8px;
    padding-top: 8px;
  }
  .duas {
    display: grid;
    grid-template-columns: 1.3fr 1fr 1fr;
    gap: 6px;
  }
</style>
