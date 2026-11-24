<script lang="ts">
  import Icone from '../componentes/Icone.svelte';
  import { formatarData, hojeISO, somarDias } from '../lib/datas';
  import { listaParaApa, listaParaEnfermeira, listaParaMedica, NOMES_QUEM, PARA_QUEM, textoParaEquipe, type ItemEquipe, type Quem } from '../lib/equipe';
  import { app, enderecoCurto, mostrarAviso, registrarDevolutivaTecnica, registrarVisitaApa, salvarAgendaEquipe } from '../lib/estado.svelte';
  import { ir, rota, trocarPara, voltar } from '../lib/rotas.svelte';

  const hoje = hojeISO();
  const ABAS: Quem[] = ['enfermeira', 'medica', 'apa'];
  const quem = $derived<Quem>(ABAS.includes(rota.id as Quem) ? (rota.id as Quem) : 'enfermeira');

  const listas = $derived({
    enfermeira: listaParaEnfermeira(app.familias, app.visitas, app.casos, app.prioritarios, hoje, app.config.ruas),
    medica: listaParaMedica(app.familias, app.visitas, app.casos, app.prioritarios, hoje, app.config.ruas),
    apa: listaParaApa(app.familias, app.visitas, app.casos, hoje, app.config.ruas),
  });
  type Filtro = 'importantes' | 'todos' | 'dia';
  let filtro = $state<Filtro>('todos');
  const agenda = $derived(app.config.agendaEquipe?.[quem]);
  const naAgenda = (it: ItemEquipe) => !!agenda?.itens.includes(it.chave);
  const passa = (f: Filtro, it: ItemEquipe) => (f === 'todos' ? true : f === 'importantes' ? it.peso >= 50 : naAgenda(it));
  const lista = $derived(listas[quem].filter((it) => passa(filtro, it)));
  const conta = (f: Filtro) => listas[quem].filter((it) => passa(f, it)).length;

  // ---- Dia dela na área
  let dia = $state(somarDias(hojeISO(), 1));
  $effect(() => {
    dia = app.config.agendaEquipe?.[quem]?.data ?? somarDias(hojeISO(), 1);
  });
  function alternar(it: ItemEquipe) {
    const atuais = agenda?.itens ?? [];
    salvarAgendaEquipe(quem, { data: dia, itens: atuais.includes(it.chave) ? atuais.filter((x) => x !== it.chave) : [...atuais, it.chave] });
  }
  function mudarDia(d: string) {
    dia = d;
    if (agenda) salvarAgendaEquipe(quem, { ...agenda, data: d });
  }
  async function copiar(itens: ItemEquipe[], titulo?: string) {
    try {
      await navigator.clipboard.writeText(textoParaEquipe(quem, itens, hoje, (f) => `${enderecoCurto(f)}${f.referencia ? ` (${f.referencia})` : ''}`, titulo));
      app.desfazer = null;
      mostrarAviso('Lista copiada ✓ Cole no WhatsApp da equipe.');
    } catch {
      mostrarAviso('Não consegui copiar.');
    }
  }
  const copiarLista = () => copiar(lista);
  const copiarDia = () => copiar(listas[quem].filter(naAgenda), `Dia d${quem === 'apa' ? 'o APA' : quem === 'medica' ? 'a Dra.' : 'a enfermeira'} na área (${formatarData(dia)})`);

  // ---- "Foi" (devolutiva)
  let abrindo = $state<string | null>(null);
  let dv = $state({ data: hojeISO(), pa: '', glicemia: '', texto: '', junto: true });
  function abrir(chave: string) {
    abrindo = abrindo === chave ? null : chave;
    dv = { data: hojeISO(), pa: '', glicemia: '', texto: '', junto: true };
  }
  async function salvar(it: ItemEquipe) {
    if (quem === 'apa') {
      await registrarVisitaApa(it.familia.id, dv.data, dv.texto);
      mostrarAviso('APA anotado ✓ A casa sai da lista dele.', 3500);
    } else if (it.morador) {
      await registrarDevolutivaTecnica(it.familia.id, it.morador.id, { ...$state.snapshot(dv), quem: quem === 'medica' ? 'Médica' : 'Enfermeira' });
      mostrarAviso(dv.junto ? 'VD compartilhada salva ✓ Conta para a meta e foi para a fila do Fast.' : 'Devolutiva anotada ✓ Entrou na ficha.', 3500);
    }
    abrindo = null;
  }

  const TITULO: Record<Quem, string> = { enfermeira: 'Para a enfermeira', medica: 'Para a Dra.', apa: 'Para o APA' };
  const EXPLICA: Record<Quem, string> = {
    enfermeira: 'VD de enfermagem em casa (acamado, oxigênio), pós-alta, bebê e puérpera, P.A. ou glicemia muito altas, curativo e casos que pedem a enfermeira. A rotina de P.A. e glicemia fica na lista da técnica.',
    medica: 'Casos urgentes, P.A. ou glicemia muito altas, receita para renovar, pós-alta, acamado sem VD médica e casos que pedem avaliação médica.',
    apa: 'O que foi escrito sobre dengue, criadouro, lixo, esgoto, praga e animais nos últimos 90 dias, e casas fechadas, vazias ou em construção para conferir.',
  };
</script>

<button class="botao secundario pequeno voltar" onclick={() => voltar('casos')}><Icone nome="voltar" /> Voltar</button>

<h1>Listas da equipe</h1>
<div class="chips" role="tablist" aria-label="Para quem">
  {#each ABAS as a (a)}
    <button class="chip" class:ativo={quem === a} role="tab" aria-selected={quem === a} onclick={() => { filtro = 'todos'; trocarPara(`equipe/${a}`); }}>{NOMES_QUEM[a]} <span class="n">{listas[a].length}</span></button>
  {/each}
  <button class="chip" role="tab" aria-selected="false" onclick={() => ir('tecnica')}>Técnica de enfermagem</button>
</div>

<h2 class="titulo">{TITULO[quem]}</h2>
<p class="suave">{EXPLICA[quem]}</p>

<div class="chips" role="tablist" aria-label="Filtrar">
  <button class="chip" class:ativo={filtro === 'todos'} role="tab" aria-selected={filtro === 'todos'} onclick={() => (filtro = 'todos')}>Todos <span class="n">{conta('todos')}</span></button>
  <button class="chip" class:ativo={filtro === 'importantes'} role="tab" aria-selected={filtro === 'importantes'} onclick={() => (filtro = 'importantes')}>Mais importantes <span class="n">{conta('importantes')}</span></button>
  <button class="chip" class:ativo={filtro === 'dia'} role="tab" aria-selected={filtro === 'dia'} onclick={() => (filtro = 'dia')}>Dia dela <span class="n">{conta('dia')}</span></button>
</div>

<section class="cartao dia-equipe">
  <h2>Dia d{quem === 'apa' ? 'o APA' : quem === 'medica' ? 'a Dra.' : 'a enfermeira'} na área</h2>
  <label class="campo"><span class="pequeno">Quando vem</span><input type="date" value={dia} onchange={(e) => mudarDia((e.currentTarget as HTMLInputElement).value)} /></label>
  <p class="pequeno">
    {agenda?.itens.length ? `${agenda.itens.length} ${agenda.itens.length === 1 ? 'item marcado' : 'itens marcados'} para ${formatarData(agenda.data)}.` : 'Marque “Levar no dia” nos itens abaixo.'}
  </p>
  {#if agenda?.itens.length}
    <div class="botoes">
      <button class="botao pequeno" onclick={copiarDia}><Icone nome="copiar" tamanho={18} /> Copiar o roteiro do dia</button>
      <button class="botao secundario pequeno" onclick={() => (filtro = 'dia')}>Ver só o dia</button>
      <button class="botao secundario pequeno" onclick={() => salvarAgendaEquipe(quem, undefined)}>Limpar</button>
    </div>
  {/if}
</section>

{#if lista.length}
  <button class="botao largo" onclick={copiarLista}><Icone nome="copiar" tamanho={20} /> Copiar a lista ({lista.length})</button>
{:else}
  <p class="cartao suave">Ninguém aqui. 👍</p>
{/if}

<ul class="lista">
  {#each lista as it (it.chave)}
    <li class="cartao item" class:alto={it.peso >= 70}>
      <button class="nome" onclick={() => ir(it.morador ? `pessoa/${it.familia.id}/${it.morador.id}` : `familia/${it.familia.id}`)}>
        <strong>{it.morador ? it.morador.nome : enderecoCurto(it.familia)}</strong>
        <span class="suave pequeno">{it.morador ? enderecoCurto(it.familia) : 'casa toda'}</span>
      </button>
      <ul class="pedidos">
        {#each it.motivos as m, i (i)}<li>{m.texto}</li>{/each}
      </ul>
      <div class="acoes">
        <label class="opcao pequeno"><input type="checkbox" checked={naAgenda(it)} onchange={() => alternar(it)} /> Levar no dia</label>
        {#if quem === 'apa' || it.morador}
          <button class="botao secundario pequeno" onclick={() => abrir(it.chave)}>{quem === 'apa' ? '✓ APA foi' : `✓ ${quem === 'medica' ? 'Dra.' : 'Enfermeira'} foi`}</button>
        {/if}
      </div>
      {#if abrindo === it.chave}
        <div class="devolutiva">
          {#if quem !== 'apa'}
            <label class="opcao pequeno junto"><input type="checkbox" bind:checked={dv.junto} /> <span><strong>Fui junto</strong>: vira VD compartilhada, conta para a meta e vai para a fila do Fast</span></label>
            {#if !dv.junto}<p class="suave pequeno">Foi sem você: fica só anotado na ficha (não conta para a meta nem vai para o Fast).</p>{/if}
          {:else}
            <p class="suave pequeno">Fica anotado na ficha da casa (não conta como VD). A casa sai da lista do APA até aparecer algo novo.</p>
          {/if}
          <div class="duas" class:uma={quem === 'apa'}>
            <label class="campo"><span class="pequeno">Dia</span><input type="date" bind:value={dv.data} max={hoje} /></label>
            {#if quem !== 'apa'}
              <label class="campo"><span class="pequeno">P.A.</span><input type="text" inputmode="numeric" bind:value={dv.pa} placeholder="130x80" /></label>
              <label class="campo"><span class="pequeno">Glicemia</span><input type="text" inputmode="numeric" bind:value={dv.glicemia} placeholder="110" /></label>
            {/if}
          </div>
          <label class="campo"><span class="pequeno">O que foi feito / combinado</span><input type="text" bind:value={dv.texto} placeholder={quem === 'apa' ? 'Ex.: removeu pneus do quintal; voltar em 15 dias' : quem === 'medica' ? 'Ex.: receita renovada; pediu exame' : 'Ex.: curativo feito; orientou a insulina'} /></label>
          <button class="botao pequeno" onclick={() => salvar(it)}>{quem === 'apa' ? 'Salvar: APA foi' : dv.junto ? 'Salvar VD compartilhada' : 'Salvar devolutiva'}</button>
        </div>
      {/if}
    </li>
  {/each}
</ul>

<style>
  .voltar {
    margin-bottom: 12px;
  }
  .titulo {
    margin: 4px 0;
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
  .dia-equipe {
    border-left: 6px solid var(--primaria);
    margin-bottom: 10px;
  }
  .dia-equipe h2 {
    margin: 0 0 6px;
  }
  .lista {
    list-style: none;
    padding: 0;
    margin: 10px 0 0;
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
    font: inherit;
    cursor: pointer;
  }
  .pedidos {
    margin: 6px 0;
    padding-left: 18px;
  }
  .pedidos li {
    margin: 2px 0;
    overflow-wrap: anywhere;
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
  .acoes input[type='checkbox'],
  .junto input {
    width: 22px;
    height: 22px;
    flex: 0 0 auto;
  }
  .junto {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    margin-bottom: 6px;
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
  .duas.uma {
    grid-template-columns: 1fr;
  }
</style>
