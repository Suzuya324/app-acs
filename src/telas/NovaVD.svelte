<script lang="ts">
  import { onDestroy, untrack } from 'svelte';
  import DicaDitado from '../componentes/DicaDitado.svelte';
  import Prioridade from '../componentes/Prioridade.svelte';
  import Icone from '../componentes/Icone.svelte';
  import { copiarTexto } from '../lib/copiar';
  import { idadeTexto } from '../lib/dados-ficticios';
  import { diferencaDias, formatarData, formatarDataLonga, hojeISO } from '../lib/datas';
  import { sugerirDesfecho } from '../lib/desfecho';
  import {
    app,
    compartilhadosRecentes,
    corrigirVisita,
    descartarRascunho,
    excluirVisitaParaLixeira,
    enderecoCurto,
    familiaPorId,
    guardarRascunho,
    mostrarAviso,
    ordemDaVisita,
    registrarGravacaoRascunho,
    salvarVisita,
  } from '../lib/estado.svelte';
  import { gerarRelato, juntarNomes, nomesCurtos, separarNomes } from '../lib/relato';
  import { sugestoesDaAnotacao, type Sugestao } from '../lib/anotacoes';
  import { acompanhamentoDaPessoa } from '../lib/acompanhamento';
  import { frases } from '../lib/anotacoes';
  import { frasesParaVD, juntarFrase } from '../lib/frases-prontas';
  import { motivoDaFrase, npvDoMotivo, tituloDoCaso, type MotivoCaso } from '../lib/casos-auto';
  import Acompanhamento from '../componentes/Acompanhamento.svelte';
  import { contextoAcompanhamento, salvarCaso, type AtualizacaoFicha } from '../lib/estado.svelte';
  import { NOMES_GRUPO, TEMAS_ORIENTACAO, textoRevisitaFeita } from '../lib/rotulos';
  import { ir, voltar } from '../lib/rotas.svelte';
  import type { Desfecho, RascunhoVD, SinaisVitais, Visita } from '../lib/tipos';

  /** visitaId preenchido = corrigir uma VD já salva. */
  let { familiaId, visitaId = '' }: { familiaId: string; visitaId?: string } = $props();
  /** O componente é recriado ao trocar de VD, então o valor inicial basta. */
  const vid = untrack(() => visitaId);
  const hoje = hojeISO();
  const familia = $derived(familiaPorId(familiaId));
  const ativos = $derived(familia?.moradores.filter((m) => m.situacao === 'mora') ?? []);

  // ---- Valores iniciais: rascunho guardado > VD sendo corrigida > VD nova ----
  const inicio = untrack(() => {
    const fam = familiaPorId(familiaId);
    const vazios: Record<string, SinaisVitais> = Object.fromEntries(
      (fam?.moradores ?? []).map((m) => [m.id, { pa: '', temperatura: '', peso: '', altura: '', glicemia: '' }]),
    );
    const original = vid ? app.visitas.find((v) => v.id === vid) : undefined;
    const r = app.rascunho;
    const rascunhoDestaVD = r && r.familiaId === familiaId && (r.visitaId ?? '') === vid ? r : null;
    if (rascunhoDestaVD) {
      return { ...rascunhoDestaVD, sinais: { ...vazios, ...rascunhoDestaVD.sinais }, original, restaurado: true };
    }
    if (original) {
      const conhecidos = separarNomes(original.orientacoes);
      return {
        data: original.data,
        presentes: [...original.presentes],
        conversou: original.conversouComFamilia,
        recusou: original.desfecho === 'recusa',
        desfechoManual: null as Desfecho | null,
        motivo: original.motivo,
        compartilhada: !!original.compartilhadaCom,
        compartilhadaCom: original.compartilhadaCom,
        sinais: { ...vazios, ...structuredClone($state.snapshot(original.sinais)) },
        temas: conhecidos.filter((t) => TEMAS_ORIENTACAO.includes(t)),
        outrosTemas: conhecidos.filter((t) => !TEMAS_ORIENTACAO.includes(t)).join(', '),
        relatoEditado: null as string | null,
        revisitasFeitas: [...(original.revisitasFeitas ?? [])],
        observacao: original.observacao ?? '',
        anotacoes: { ...(original.anotacoes ?? {}) } as Record<string, string>,
        original,
        restaurado: false,
      };
    }
    return {
      data: hoje,
      presentes: [] as string[],
      conversou: false,
      recusou: false,
      desfechoManual: null as Desfecho | null,
      motivo: app.config.motivoPadrao,
      compartilhada: false,
      compartilhadaCom: '',
      sinais: vazios,
      temas: [] as string[],
      outrosTemas: '',
      relatoEditado: null as string | null,
      revisitasFeitas: [] as string[],
      observacao: '',
      anotacoes: {} as Record<string, string>,
      original,
      restaurado: false,
    };
  });
  const original: Visita | undefined = inicio.original;
  const corrigindo = !!vid;
  /** Há outra VD pela metade (de outra família ou outra correção)? */
  const outroRascunho = untrack(() =>
    app.rascunho && !(app.rascunho.familiaId === familiaId && (app.rascunho.visitaId ?? '') === vid) ? app.rascunho : null,
  );

  let data = $state(inicio.data);
  let presentes = $state<string[]>(inicio.presentes);
  let conversou = $state(inicio.conversou);
  let recusou = $state(inicio.recusou);
  let desfechoManual = $state<Desfecho | null>(inicio.desfechoManual);
  let motivo = $state(inicio.motivo);
  let compartilhada = $state(inicio.compartilhada);
  let compartilhadaCom = $state(inicio.compartilhadaCom);
  /** Sinais vitais de cada morador (chave = id do morador). */
  let sinais = $state<Record<string, SinaisVitais>>(inicio.sinais);
  /** Assuntos tocados nos botões + texto livre. */
  let temas = $state<string[]>(inicio.temas);
  let outrosTemas = $state(inicio.outrosTemas);
  let relatoEditado = $state<string | null>(inicio.relatoEditado);
  /** O que foi conversado / observado (entra no relato). */
  let observacao = $state(inicio.observacao ?? '');
  /** Anotações sobre cada pessoa (vão para a ficha dela). */
  let anotacoes = $state<Record<string, string>>({ ...(inicio.anotacoes ?? {}) });
  /** Quem está com o campo de anotação aberto. */
  let anotando = $state<string[]>(Object.keys(inicio.anotacoes ?? {}).filter((k) => (inicio.anotacoes ?? {})[k]?.trim()));
  /** Sugestões que o ACS confirmou (chave: "morador|sugestão"). */
  let aceitas = $state<string[]>([]);
  /** Quem da casa tem algo para acompanhar (pendência, remédio, pergunta, condição a confirmar). */
  const acomps = $derived(
    familia
      ? ativos
          .map((m) => ({ m, a: acompanhamentoDaPessoa(m, familia, contextoAcompanhamento()) }))
          .filter((x) => x.a.perguntas.length || x.a.remedios.length || x.a.pendencias.length || x.a.achadas.length)
      : [],
  );
  const sugestoes = $derived(
    Object.fromEntries(ativos.map((m) => [m.id, sugestoesDaAnotacao(anotacoes[m.id] ?? '', m)])) as Record<string, Sugestao[]>,
  );
  function alternarSugestao(mid: string, sid: string) {
    const k = `${mid}|${sid}`;
    aceitas = aceitas.includes(k) ? aceitas.filter((x) => x !== k) : [...aceitas, k];
  }
  /**
   * Casos achados no que está sendo escrito agora (por pessoa e na observação da casa). Já vêm marcados para abrir;
   * o ACS toca para desmarcar. Um por assunto (urgente, eMulti, reunião).
   */
  interface CasoNaVD { chave: string; moradorId?: string; motivo: MotivoCaso; frases: string[] }
  const casosNaVD = $derived.by(() => {
    if (corrigindo) return [] as CasoNaVD[];
    const lista: CasoNaVD[] = [];
    const juntar = (moradorId: string | undefined, texto: string) => {
      for (const fr of frases(texto)) {
        const motivo = motivoDaFrase(fr);
        if (!motivo) continue;
        const chave = `${moradorId ?? 'casa'}|${motivo.categoria}|${motivo.emulti ?? ''}`;
        const ja = lista.find((x) => x.chave === chave);
        if (ja) ja.frases.push(fr);
        else lista.push({ chave, moradorId, motivo, frases: [fr] });
      }
    };
    for (const m of ativos) juntar(m.id, anotacoes[m.id] ?? '');
    juntar(undefined, observacao);
    return lista;
  });
  /** Frases prontas (as do ACS ou as padrão, mais as que ele mais escreve). */
  const prontas = $derived(frasesParaVD(app.config.frasesProntas, app.visitas));
  const escreverObs = (f: string) => (observacao = juntarFrase(observacao, f));
  const escreverSobre = (mid: string, f: string) => (anotacoes[mid] = juntarFrase(anotacoes[mid] ?? '', f));

  /** A última VD desta família (para "igual à última VD"). */
  const ultimaVD = $derived(
    corrigindo || !familia ? undefined : [...app.visitas].filter((v) => v.familiaId === familia.id && v.data <= data).sort((a, b) => b.data.localeCompare(a.data))[0],
  );
  /** Copia da última VD o que costuma se repetir: presentes, desfecho, motivo, compartilhada e orientações. */
  function igualAUltima() {
    const u = ultimaVD;
    if (!u) return;
    presentes = u.presentes.filter((id) => ativos.some((m) => m.id === id));
    conversou = u.conversouComFamilia;
    recusou = u.desfecho === 'recusa';
    desfechoManual = null;
    motivo = u.motivo || motivo;
    compartilhada = !!u.compartilhadaCom;
    compartilhadaCom = u.compartilhadaCom;
    const conhecidos = separarNomes(u.orientacoes);
    temas = conhecidos.filter((t) => TEMAS_ORIENTACAO.includes(t));
    outrosTemas = conhecidos.filter((t) => !TEMAS_ORIENTACAO.includes(t)).join(', ');
    mostrarAviso(`Copiado da VD de ${formatarData(u.data)}. Confira e mude o que for diferente.`, 4000);
  }

  /** Casos que o ACS desmarcou (os outros abrem ao salvar). */
  let casosRecusados = $state<string[]>([]);
  const alternarCaso = (k: string) => (casosRecusados = casosRecusados.includes(k) ? casosRecusados.filter((x) => x !== k) : [...casosRecusados, k]);
  const NOME_CAT = { urgente: 'urgente', importante: 'importante', social: 'social', npv: 'NPV' } as const;
  const rotuloCaso = (c: CasoNaVD) => `Abrir caso ${NOME_CAT[c.motivo.categoria]}${c.motivo.emulti ? ` · eMulti: ${c.motivo.emulti}` : ''}${c.motivo.reuniao ? ' · reunião' : ''}`;

  /** O que vai mudar na ficha ao salvar (só o que o ACS confirmou e ainda vale para o texto). */
  function atualizacoesConfirmadas(): AtualizacaoFicha[] {
    const lista: AtualizacaoFicha[] = [];
    for (const m of ativos) {
      const ok = (sugestoes[m.id] ?? []).filter((sg) => aceitas.includes(`${m.id}|${sg.id}`));
      if (!ok.length) continue;
      const situ = ok.find((sg) => sg.tipo === 'situacao');
      lista.push({
        moradorId: m.id,
        grupos: ok.flatMap((sg) => (sg.tipo === 'grupo' ? [sg.grupo] : [])),
        situacao: situ && situ.tipo === 'situacao' ? situ.situacao : undefined,
      });
    }
    return lista;
  }
  /** Anotações preenchidas (sem as vazias). */
  function anotacoesPreenchidas(): Record<string, string> | undefined {
    const r = Object.fromEntries(Object.entries(anotacoes).map(([k, v]) => [k, v.trim()]).filter(([k, v]) => v && ativos.some((m) => m.id === k)));
    return Object.keys(r).length ? r : undefined;
  }
  /** Observação + anotações de cada pessoa: é o que entra no relato. */
  const observacaoDoRelato = $derived(
    [
      observacao.trim(),
      ...ativos
        .filter((m) => anotacoes[m.id]?.trim())
        .map((m) => {
          const t = anotacoes[m.id].trim().replace(/[.;\s]+$/, '');
          return `sobre ${app.config.relatoNomeCompleto ? m.nome : m.nome.split(' ')[0]}: ${t.charAt(0).toLowerCase()}${t.slice(1)}`;
        }),
    ]
      .filter(Boolean)
      .join('; '),
  );
  /** VD anterior desta família (até 30 dias antes da data desta VD), para dar continuidade ao relato. */
  const anterior = $derived.by(() => {
    if (!data) return undefined;
    const lista = app.visitas
      .filter((v) => v.familiaId === familiaId && v.id !== vid && v.data < data && diferencaDias(v.data, data) <= 30)
      .sort((a, b) => b.data.localeCompare(a.data));
    return lista[0] ? { data: lista[0].data, desfecho: lista[0].desfecho } : undefined;
  });
  /** Revisitas marcadas resolvidas nesta VD. */
  let revisitasFeitas = $state<string[]>(inicio.revisitasFeitas ?? []);
  /** Revisitas desta família para mostrar: as abertas + as que esta VD (corrigida) já tinha resolvido. */
  const revisitasDaFamilia = $derived(
    app.revisitas.filter(
      (r) => r.familiaId === familiaId && !r.canceladaEm && (!r.feitaEm || (vid && r.visitaId === vid)),
    ),
  );
  function alternarRevisita(id: string) {
    revisitasFeitas = revisitasFeitas.includes(id) ? revisitasFeitas.filter((x) => x !== id) : [...revisitasFeitas, id];
  }
  let voltarParaFila = $state(!!original?.lancadaNoFast);
  const recentes = compartilhadosRecentes();

  const orientacoes = $derived(juntarNomes([...temas, ...(outrosTemas.trim() ? [outrosTemas.trim()] : [])]));
  const nomes = $derived(nomesCurtos(ativos));
  const comSinais = $derived(ativos.filter((m) => presentes.includes(m.id)));
  const contador = vid ? ordemDaVisita(vid) : untrack(() => app.visitas.length);

  const sugerido = $derived(
    sugerirDesfecho({
      totalMoradores: ativos.length,
      presentes: presentes.length,
      conversouComFamilia: conversou,
      recusou,
    }),
  );
  const desfecho = $derived(desfechoManual ?? sugerido);
  const atendida = $derived(desfecho === 'realizada' || desfecho === 'ausente_realizada');
  const feitosTexto = $derived(
    atendida ? revisitasDaFamilia.filter((r) => revisitasFeitas.includes(r.id)).map((r) => textoRevisitaFeita(r.motivo)) : [],
  );

  const relatoGerado = $derived(
    gerarRelato({
      desfecho,
      presentes: ativos.filter((m) => presentes.includes(m.id)),
      ausentes: ativos.filter((m) => !presentes.includes(m.id)),
      conversouComFamilia: conversou,
      sinais: sinaisPreenchidos(),
      orientacoes,
      compartilhadaCom: compartilhada ? compartilhadaCom : '',
      feitos: feitosTexto,
      motivo: motivo === app.config.motivoPadrao ? '' : motivo,
      observacao: observacaoDoRelato,
      anterior,
      nomeCompleto: app.config.relatoNomeCompleto,
      contador,
    }),
  );
  const relato = $derived(relatoEditado ?? relatoGerado);

  // Ao corrigir: mantém o desfecho e o relato que estavam salvos, se forem diferentes do automático.
  if (original && !inicio.restaurado) {
    untrack(() => {
      if (original.desfecho !== sugerido) desfechoManual = original.desfecho;
      if (original.relato.trim() !== relatoGerado.trim()) relatoEditado = original.relato;
    });
  }

  const ordem: Desfecho[] = ['realizada', 'ausente_realizada', 'ausencia_completa', 'recusa'];

  function alternar(id: string) {
    recusou = false;
    presentes = presentes.includes(id) ? presentes.filter((p) => p !== id) : [...presentes, id];
  }
  function todos() {
    recusou = false;
    presentes = ativos.map((m) => m.id);
  }
  function ninguem() {
    presentes = [];
    conversou = false;
    recusou = false;
    desfechoManual = null;
  }
  function marcarRecusa() {
    recusou = !recusou;
    desfechoManual = null;
  }
  function alternarTema(t: string) {
    temas = temas.includes(t) ? temas.filter((x) => x !== t) : [...temas, t];
  }
  function ligarCompartilhada() {
    if (compartilhada && !compartilhadaCom.trim() && recentes.length) compartilhadaCom = recentes[0];
  }
  /** Só os sinais de quem estava presente e com algum valor preenchido. */
  function sinaisPreenchidos(): Record<string, SinaisVitais> {
    const r: Record<string, SinaisVitais> = {};
    for (const id of presentes) {
      const s = sinais[id];
      if (s && Object.values(s).some((v) => (v ?? '').trim())) r[id] = { ...s };
    }
    return r;
  }

  // ---- Rascunho: guarda (criptografado) a cada mudança, para não perder a VD se o app trancar ----
  function montarRascunho(): RascunhoVD {
    return $state.snapshot({
      familiaId,
      visitaId: vid || undefined,
      salvoEm: new Date().toISOString(),
      data,
      presentes,
      conversou,
      recusou,
      desfechoManual,
      motivo,
      compartilhada,
      compartilhadaCom,
      sinais: sinaisPreenchidos(),
      temas,
      outrosTemas,
      relatoEditado,
      revisitasFeitas,
      observacao,
      anotacoes: anotacoesPreenchidas(),
    }) as RascunhoVD;
  }
  let mexeu = $state(inicio.restaurado);
  let terminou = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let primeiraLeitura = true;
  $effect(() => {
    // lê tudo o que o ACS pode mudar
    JSON.stringify([data, presentes, conversou, recusou, desfechoManual, motivo, compartilhada, compartilhadaCom, sinais, temas, outrosTemas, relatoEditado, revisitasFeitas, observacao, anotacoes]);
    if (primeiraLeitura) {
      primeiraLeitura = false;
      return;
    }
    mexeu = true;
    clearTimeout(timer);
    timer = setTimeout(() => untrack(() => void gravarAgora()), 600);
  });
  async function gravarAgora() {
    clearTimeout(timer);
    if (mexeu && !terminou) await guardarRascunho(montarRascunho());
  }
  registrarGravacaoRascunho(gravarAgora);
  onDestroy(() => {
    clearTimeout(timer);
    registrarGravacaoRascunho(null);
  });

  async function copiar() {
    const ok = await copiarTexto(relato);
    mostrarAviso(ok ? 'Relato copiado!' : 'Não consegui copiar. Segure o texto e copie à mão.');
  }

  async function cancelar() {
    if (mexeu && !confirm(corrigindo ? 'Descartar a correção?' : 'Descartar esta visita? O que foi preenchido será perdido.')) return;
    terminou = true;
    clearTimeout(timer);
    if (mexeu || inicio.restaurado) await descartarRascunho();
    voltar(`familia/${familiaId}`);
  }

  async function excluirVD() {
    if (!original || !confirm('Mandar esta VD para a lixeira? Dá para restaurar depois.')) return;
    terminou = true;
    clearTimeout(timer);
    if (app.rascunho?.visitaId === original.id) await descartarRascunho();
    await excluirVisitaParaLixeira(original.id);
    mostrarAviso('VD enviada para a lixeira');
    voltar(`familia/${familiaId}`);
  }

  async function salvar() {
    if (!familia) return;
    terminou = true;
    clearTimeout(timer);
    const v: Omit<Visita, 'id'> = {
      familiaId: familia.id,
      data,
      presentes: [...presentes],
      conversouComFamilia: conversou,
      desfecho,
      motivo,
      compartilhadaCom: compartilhada ? compartilhadaCom.trim() : '',
      sinais: sinaisPreenchidos(),
      orientacoes,
      relato,
      lancadaNoFast: false,
      revisitasFeitas: atendida ? revisitasFeitas.filter((id) => revisitasDaFamilia.some((r) => r.id === id)) : [],
      observacao: observacao.trim(),
      anotacoes: anotacoesPreenchidas(),
    };
    const atualizacoes = atualizacoesConfirmadas();
    if (corrigindo && original) {
      await corrigirVisita(original.id, v, voltarParaFila, atualizacoes);
      mostrarAviso(voltarParaFila ? 'Correção salva ✓ Voltou para a fila do Fast.' : 'Correção salva ✓', 3500);
    } else {
      await salvarVisita(v, atualizacoes);
      const abrir = casosNaVD.filter((c) => !casosRecusados.includes(c.chave));
      for (const c of abrir) {
        const m = ativos.find((x) => x.id === c.moradorId);
        const dia = data.split('-').reverse().slice(0, 2).join('/');
        await salvarCaso({
          familiaId: familia.id,
          categoria: c.motivo.categoria,
          titulo: tituloDoCaso(m, familia, data),
          texto: c.frases.map((fr) => `${dia}: ${fr}`).join('\n'),
          emulti: c.motivo.emulti,
          npv: npvDoMotivo(c.motivo),
        });
      }
      const partes = [atualizacoes.length && 'ficha atualizada', abrir.length && `${abrir.length} ${abrir.length === 1 ? 'caso aberto' : 'casos abertos'}`].filter(Boolean);
      mostrarAviso(partes.length ? `VD salva ✓ ${partes.join(', ')}.` : 'VD salva e colocada na fila do Fast ✓');
    }
    voltar(`familia/${familia.id}`);
  }
</script>

<button class="botao secundario pequeno voltar" onclick={cancelar}><Icone nome="voltar" /> Cancelar</button>

{#if !familia || (corrigindo && !original)}
  <p>{familia ? 'Visita não encontrada.' : 'Família não encontrada.'}</p>
{:else}
  <h1>{corrigindo ? 'Corrigir visita' : 'Nova visita'}</h1>
  <p class="suave endereco">{enderecoCurto(familia)}</p>
  {#if familia.atencao}<p class="alerta"><strong>Atenção:</strong> {familia.atencao}</p>{/if}
  {#if !corrigindo}<Prioridade {familia} aberto />{/if}

  <!-- ACOMPANHAMENTO: o que o app leu do que já foi escrito sobre cada pessoa da casa -->
  {#if !corrigindo && acomps.length}
    <section class="cartao acompanhar">
      <h2>Acompanhar nesta casa</h2>
      <p class="suave pequeno">O que o app leu do que você já escreveu. Toque no nome para ver.</p>
      {#each acomps as x (x.m.id)}
        <details open={acomps.length <= 2}>
          <summary>
            <strong>{x.m.nome.split(' ')[0]}</strong>
            <span class="suave pequeno">
              {[x.a.pendencias.length && `${x.a.pendencias.length} ${x.a.pendencias.length === 1 ? 'pendência' : 'pendências'}`,
                x.a.remedios.length && `${x.a.remedios.length} ${x.a.remedios.length === 1 ? 'remédio' : 'remédios'}`,
                x.a.achadas.length && `${x.a.achadas.length} a confirmar`].filter(Boolean).join(' · ')}
            </span>
          </summary>
          <Acompanhamento a={x.a} morador={x.m} modo="vd" />
        </details>
      {/each}
    </section>
  {/if}
  {#if inicio.restaurado}
    <p class="alerta">Você tinha começado esta visita: ela foi recuperada do jeito que estava.</p>
  {/if}
  {#if outroRascunho}
    {@const outraFamilia = familiaPorId(outroRascunho.familiaId)}
    <p class="alerta">
      Há outra visita pela metade{outraFamilia ? ` (${enderecoCurto(outraFamilia)})` : ''}. Se você preencher esta, aquela será descartada.
      {#if outraFamilia}<button class="link" onclick={() => ir(outroRascunho.visitaId ? `vd/${outroRascunho.familiaId}/${outroRascunho.visitaId}` : `vd/${outroRascunho.familiaId}`)}>Abrir a outra</button>{/if}
    </p>
  {/if}
  {#if corrigindo && original}
    <p class="suave pequeno">Corrigindo a VD de {formatarData(original.data)}. A correção fica registrada no histórico da família.</p>
  {/if}

  <!-- DATA: sempre visível e editável -->
  <section class="cartao">
    <label class="campo">
      <span>Data da visita</span>
      <input type="date" bind:value={data} max={hoje} required />
    </label>
    <p class="data-longa"><strong>{data ? formatarDataLonga(data, true) : 'Escolha a data'}</strong></p>
    {#if data && data !== hoje}
      <p class="alerta">Atenção: a data não é hoje.</p>
    {/if}
  </section>

  <!-- QUEM ESTAVA EM CASA -->
  {#if ultimaVD}
    <button class="botao secundario largo igual" onclick={igualAUltima}>↺ Igual à última VD ({formatarData(ultimaVD.data).slice(0, 5)}): presentes, orientações, motivo</button>
  {/if}

  <section class="cartao">
    <h2>Quem estava em casa?</h2>
    <p class="suave pequeno">Toque nos moradores presentes.</p>
    <ul class="lista pessoas">
      {#each ativos as m (m.id)}
        {@const marcado = presentes.includes(m.id)}
        <li>
          <button class="pessoa" class:marcado onclick={() => alternar(m.id)} aria-pressed={marcado}>
            <span class="caixa">{#if marcado}<Icone nome="ok" tamanho={22} />{/if}</span>
            <span>
              <strong>{m.nome}</strong><br />
              <span class="suave pequeno">{idadeTexto(m, data || hoje)}</span>
              {#if m.grupos.length}
                <span class="grupos-pessoa">{#each m.grupos as g (g)}<span class="grupo">{NOMES_GRUPO[g]}</span>{/each}</span>
              {/if}
            </span>
          </button>
        </li>
      {/each}
    </ul>
    <div class="linha-botoes">
      <button class="botao secundario pequeno" onclick={todos}>Todos presentes</button>
      <button class="botao secundario pequeno" onclick={ninguem}>Ninguém em casa</button>
    </div>
    <label class="opcao">
      <input type="checkbox" bind:checked={conversou} onchange={() => (desfechoManual = null)} />
      <span>Conversei com a família (alguém respondeu por todos)</span>
    </label>
    <label class="opcao">
      <input type="checkbox" checked={recusou} onchange={marcarRecusa} />
      <span>A família não quis receber a visita</span>
    </label>
  </section>

  <!-- DESFECHO -->
  <section class="cartao">
    <h2>Desfecho</h2>
    <div class="desfechos" role="radiogroup" aria-label="Desfecho">
      {#each ordem as d (d)}
        <button
          class="opcao-desfecho d-{d}"
          class:escolhido={desfecho === d}
          role="radio"
          aria-checked={desfecho === d}
          onclick={() => (desfechoManual = d === sugerido ? null : d)}
        >
          <span>{app.config.nomesDesfecho[d]}</span>
          {#if d === sugerido}<span class="auto">automático</span>{/if}
        </button>
      {/each}
    </div>
    {#if desfechoManual}
      <p class="pequeno">Você trocou o desfecho. <button class="link" onclick={() => (desfechoManual = null)}>Voltar ao automático</button></p>
    {/if}
    {#if desfecho === 'ausencia_completa'}
      <p class="suave pequeno">Vai para a lista “Revisitar”. Não conta para a meta.</p>
    {/if}

    <label class="campo motivo">
      <span>Motivo</span>
      <select bind:value={motivo}>
        {#each app.config.motivos as m (m)}<option value={m}>{m}</option>{/each}
      </select>
    </label>
  </section>

  <!-- DETALHES OPCIONAIS -->
  <section class="cartao">
    <details>
      <summary>Sinais vitais (opcional)</summary>
      <p class="suave pequeno">Entram só no texto do relato, com o nome da pessoa.</p>
      {#if comSinais.length === 0}
        <p class="alerta">Marque primeiro quem estava em casa.</p>
      {/if}
      {#each comSinais as m (m.id)}
        <fieldset class="sinais-pessoa">
          <legend>{nomes.get(m.id)}</legend>
          <div class="grade">
            <label class="campo"><span>P.A.</span><input type="text" inputmode="numeric" placeholder="120/80" bind:value={sinais[m.id].pa} /></label>
            <label class="campo"><span>Glicemia</span><input type="text" inputmode="numeric" placeholder="mg/dL" bind:value={sinais[m.id].glicemia} /></label>
            <label class="campo"><span>Temp. (°C)</span><input type="text" inputmode="decimal" placeholder="36,5" bind:value={sinais[m.id].temperatura} /></label>
            <label class="campo"><span>Peso (kg)</span><input type="text" inputmode="decimal" bind:value={sinais[m.id].peso} /></label>
            <label class="campo"><span>Altura (m)</span><input type="text" inputmode="decimal" placeholder="1,65" bind:value={sinais[m.id].altura} /></label>
          </div>
        </fieldset>
      {/each}
    </details>
  </section>

  <section class="cartao">
    <h2>Orientações</h2>
    <p class="suave pequeno">Toque nos assuntos conversados.</p>
    <div class="chips">
      {#each TEMAS_ORIENTACAO as t (t)}
        {@const marcado = temas.includes(t)}
        <button class="chip" class:marcado aria-pressed={marcado} onclick={() => alternarTema(t)}>
          {#if marcado}<Icone nome="ok" tamanho={18} />{/if}{t}
        </button>
      {/each}
    </div>
    <label class="campo">
      <span>Outros assuntos</span>
      <input type="text" bind:value={outrosTemas} placeholder="Ex.: cartão SUS" />
    </label>
  </section>

  <section class="cartao">
    <label class="campo">
      <span>O que foi conversado / observado (opcional)</span>
      <textarea rows="3" bind:value={observacao} placeholder="Ex.: refere dor nas costas, aguarda resultado de exame"></textarea>
    </label>
    <div class="prontas" aria-label="Frases prontas">
      {#each prontas as f (f)}<button class="pronta" onclick={() => escreverObs(f)}>＋ {f}</button>{/each}
    </div>
    {#each casosNaVD.filter((c) => !c.moradorId) as c (c.chave)}
      {@const ok = !casosRecusados.includes(c.chave)}
      <div class="sugs">
        <button class="sug caso {c.motivo.categoria}" class:ok aria-pressed={ok} onclick={() => alternarCaso(c.chave)}>{ok ? '✓' : '＋'} {rotuloCaso(c)}</button>
      </div>
    {/each}
    <p class="suave pequeno">Entra no relato.</p>
    <DicaDitado />
    {#if anterior}
      <p class="suave pequeno">O relato vai citar a VD anterior de {formatarData(anterior.data)}.</p>
    {/if}
  </section>

  <!-- ANOTAÇÕES POR PESSOA (vão para a ficha) -->
  <section class="cartao anotacoes">
    <h2>Sobre cada pessoa</h2>
    <p class="suave pequeno">O que você anotar aqui vai para a <strong>ficha da pessoa</strong> e entra no relato.</p>
    {#each [...ativos].sort((a, b) => Number(presentes.includes(b.id)) - Number(presentes.includes(a.id))) as m (m.id)}
      {@const aberto = anotando.includes(m.id)}
      <div class="anot">
        {#if !aberto}
          <button class="link-simples anotar" onclick={() => (anotando = [...anotando, m.id])}>＋ Anotar sobre {m.nome.split(' ')[0]}</button>
        {:else}
          <label class="campo">
            <span>Sobre {m.nome}</span>
            <textarea rows="2" bind:value={anotacoes[m.id]} placeholder="Ex.: começou insulina, refere tontura, consulta de cardio dia 20"></textarea>
          </label>
          <div class="prontas" aria-label="Frases prontas">
            {#each prontas.slice(0, 8) as f (f)}<button class="pronta" onclick={() => escreverSobre(m.id, f)}>＋ {f}</button>{/each}
          </div>
          {#if sugestoes[m.id]?.length}
            <div class="sugs">
              <span class="suave pequeno">Atualizar a ficha?</span>
              {#each sugestoes[m.id] as sg (sg.id)}
                {@const ok = aceitas.includes(`${m.id}|${sg.id}`)}
                <button class="sug" class:ok aria-pressed={ok} onclick={() => alternarSugestao(m.id, sg.id)}>{ok ? '✓' : '＋'} {sg.texto}</button>
              {/each}
            </div>
          {/if}
          {#each casosNaVD.filter((c) => c.moradorId === m.id) as c (c.chave)}
            {@const ok = !casosRecusados.includes(c.chave)}
            <div class="sugs">
              <button class="sug caso {c.motivo.categoria}" class:ok aria-pressed={ok} onclick={() => alternarCaso(c.chave)}>{ok ? '✓' : '＋'} {rotuloCaso(c)}</button>
            </div>
          {/each}
        {/if}
      </div>
    {/each}
  </section>

  <section class="cartao">
    <label class="opcao">
      <input type="checkbox" bind:checked={compartilhada} onchange={ligarCompartilhada} />
      <span>Visita compartilhada com outro profissional</span>
    </label>
    {#if compartilhada}
      <label class="campo">
        <span>Nome e função</span>
        <input type="text" bind:value={compartilhadaCom} placeholder="Ex.: técnica de enfermagem Rosa" list="compartilhados" />
        <datalist id="compartilhados">{#each recentes as q (q)}<option value={q}></option>{/each}</datalist>
      </label>
      {#if recentes.length > 1}
        <div class="chips">
          {#each recentes as q (q)}
            <button class="chip" class:marcado={compartilhadaCom === q} onclick={() => (compartilhadaCom = q)}>{q}</button>
          {/each}
        </div>
      {/if}
    {/if}
  </section>

  {#if revisitasDaFamilia.length}
    <section class="cartao revisitas">
      <h2>Revisitas marcadas</h2>
      {#each revisitasDaFamilia as r (r.id)}
        <label class="opcao">
          <input type="checkbox" checked={revisitasFeitas.includes(r.id)} onchange={() => alternarRevisita(r.id)} disabled={!atendida} />
          <span><strong>{r.motivo}</strong> · feito nesta visita<br /><span class="suave pequeno">{r.ate < hoje ? 'atrasada, ' : ''}até {formatarData(r.ate)}</span></span>
        </label>
      {/each}
      {#if !atendida}<p class="suave pequeno">Só dá para marcar como feita quando a visita foi atendida.</p>{/if}
    </section>
  {/if}

  <!-- RELATO -->
  <section class="cartao">
    <h2>Relato</h2>
    <textarea class="relato" rows="6" value={relato} oninput={(e) => (relatoEditado = e.currentTarget.value)} aria-label="Texto do relato"></textarea>
    {#if relatoEditado !== null}
      <p class="pequeno">Você editou o texto. <button class="link" onclick={() => (relatoEditado = null)}>Refazer automático</button></p>
    {/if}
    <button class="botao secundario largo" onclick={copiar}><Icone nome="copiar" /> Copiar relato</button>
  </section>

  {#if corrigindo && original?.lancadaNoFast}
    <section class="cartao">
      <label class="opcao">
        <input type="checkbox" bind:checked={voltarParaFila} />
        <span>Esta VD já foi lançada no Fast. Colocar de novo na fila, para corrigir lá também</span>
      </label>
    </section>
  {/if}

  {#if corrigindo && original}
    <section class="cartao excluir-vd">
      <p class="pequeno"><strong>Registrou esta VD por engano?</strong> Ela vai para a lixeira e dá para restaurar.</p>
      <button class="botao perigo secundario largo" onclick={excluirVD}>Excluir esta VD (vai para a lixeira)</button>
    </section>
  {/if}

  <div class="rodape-salvar">
    <button class="botao largo" onclick={salvar} disabled={!data}><Icone nome="ok" /> {corrigindo ? 'Salvar correção' : 'Salvar VD'}</button>
  </div>
  <div class="espaco" aria-hidden="true"></div>
{/if}

<style>
  .anot {
    border-bottom: 1px solid var(--borda);
    padding: 4px 0;
  }
  .anot:last-child {
    border-bottom: 0;
  }
  .anotar {
    width: 100%;
    min-height: 44px;
    text-align: left;
    padding: 10px 0;
    border: 0;
    background: none;
    color: var(--primaria);
    font-weight: 700;
    font-size: 1rem;
    cursor: pointer;
  }
  .anot textarea {
    width: 100%;
  }
  .sugs {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
    margin: 4px 0 8px;
  }
  .sug {
    min-height: 40px;
    padding: 4px 12px;
    border-radius: 999px;
    border: 2px dashed var(--primaria);
    background: var(--cartao);
    color: var(--primaria);
    font-weight: 700;
    cursor: pointer;
  }
  .sug.ok {
    border-style: solid;
    background: var(--primaria);
    color: var(--primaria-texto);
  }
  .sug.caso.urgente {
    border-color: var(--perigo);
    color: var(--perigo);
  }
  .sug.caso.urgente.ok {
    background: var(--perigo);
    color: var(--cartao);
  }
  .voltar {
    margin-bottom: 12px;
  }
  .endereco {
    font-weight: 600;
    margin-bottom: 12px;
  }
  .data-longa {
    margin: -4px 0 4px;
  }
  .pessoas li {
    margin-bottom: 8px;
  }
  .excluir-vd {
    border-color: var(--perigo);
  }
  .revisitas {
    border: 2px solid var(--primaria);
  }
  .grupos-pessoa {
    display: block;
    margin-top: 2px;
  }
  .pessoa {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: 60px;
    padding: 10px 12px;
    text-align: left;
    border-radius: 12px;
    border: 2px solid var(--borda);
    background: var(--cartao);
    cursor: pointer;
  }
  .pessoa.marcado {
    border-color: var(--primaria);
    background: var(--primaria-clara);
  }
  .caixa {
    flex: 0 0 32px;
    height: 32px;
    border-radius: 8px;
    border: 2px solid var(--primaria);
    display: grid;
    place-items: center;
    color: var(--primaria);
  }
  .marcado .caixa {
    background: var(--primaria);
    color: var(--primaria-texto);
  }
  .opcao {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 52px;
    margin-top: 6px;
    cursor: pointer;
  }
  .opcao input {
    width: 26px;
    height: 26px;
    flex: 0 0 26px;
    accent-color: var(--primaria);
  }
  .desfechos {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .opcao-desfecho {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    min-height: 64px;
    padding: 8px 10px;
    text-align: left;
    border-radius: 12px;
    border: 2px solid var(--borda);
    background: var(--cartao);
    font-weight: 700;
    font-size: 0.95rem;
    cursor: pointer;
  }
  .opcao-desfecho.escolhido {
    border-color: currentColor;
    border-width: 3px;
    background: var(--fundo);
  }
  .opcao-desfecho:not(.escolhido) {
    color: var(--texto-suave);
  }
  .auto {
    font-size: 0.75rem;
    font-weight: 600;
    opacity: 0.85;
  }
  .motivo {
    margin-top: 14px;
  }
  .grade {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0 10px;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 8px 0 10px;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    border: 2px solid var(--borda);
    background: var(--cartao);
    border-radius: 999px;
    padding: 6px 16px;
    font-weight: 600;
    cursor: pointer;
    min-height: 48px;
  }
  .chip.marcado {
    border-color: var(--primaria);
    background: var(--primaria-clara);
  }
  .sinais-pessoa {
    border: 1px solid var(--borda);
    border-radius: 12px;
    margin: 8px 0 12px;
    padding: 8px 12px 0;
  }
  .sinais-pessoa legend {
    font-weight: 700;
    padding: 0 6px;
  }
  .link {
    background: none;
    border: 0;
    color: var(--primaria);
    font-weight: 700;
    text-decoration: underline;
    padding: 6px 0;
    cursor: pointer;
  }
  textarea.relato {
    margin-bottom: 10px;
    line-height: 1.4;
  }
  .espaco {
    height: 70px;
  }
  .rodape-salvar {
    position: fixed;
    left: 0;
    right: 0;
    bottom: calc(64px + env(safe-area-inset-bottom));
    z-index: 6;
    padding: 10px 16px;
    background: linear-gradient(to top, var(--fundo) 70%, transparent);
  }
  .rodape-salvar .botao {
    max-width: 608px;
    margin: 0 auto;
    display: flex;
    min-height: 60px;
    font-size: 1.15rem;
  }
  .acompanhar details {
    border-top: 1px solid var(--borda);
    padding: 8px 0;
  }
  .acompanhar summary {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 8px;
    cursor: pointer;
    padding: 6px 0;
  }
  .igual {
    margin-bottom: 12px;
  }
  .prontas {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    padding: 6px 0;
    scrollbar-width: thin;
  }
  .pronta {
    flex: 0 0 auto;
    min-height: 40px;
    padding: 4px 12px;
    border-radius: 999px;
    border: 1px solid var(--borda);
    background: var(--fundo);
    color: var(--texto);
    font-size: 0.9rem;
    cursor: pointer;
    white-space: nowrap;
  }
</style>
