<script lang="ts">
  import Icone from '../componentes/Icone.svelte';
  import { compararComSbcd, lerArquivoSbcd, NOMES_MUDANCA, ORDEM_MUDANCA, type Comparacao, type Mudanca } from '../lib/atualizar-cadastro';
  import { formatarData, hojeISO } from '../lib/datas';
  import { app, atualizarCadastroSbcd, mostrarAviso } from '../lib/estado.svelte';
  import { novoId } from '../lib/ids';
  import { decodificar } from '../lib/importar-csv';
  import { ir, voltar } from '../lib/rotas.svelte';

  let colado = $state('');
  let erro = $state('');
  let nomeArquivo = $state('');
  let cmp = $state<Comparacao | null>(null);
  let marcadas = $state<Set<string>>(new Set());
  let salvando = $state(false);
  let pronto = $state(0);

  function conferir(texto: string) {
    erro = '';
    try {
      const r = compararComSbcd(lerArquivoSbcd(texto), $state.snapshot(app.familias), hojeISO(), novoId);
      cmp = r;
      marcadas = new Set(r.marcadasDeInicio);
      colado = '';
    } catch (e) {
      erro = e instanceof Error ? e.message : 'Não consegui ler o arquivo.';
    }
  }

  async function abrirArquivo(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const arq = input.files?.[0];
    input.value = '';
    if (!arq) return;
    nomeArquivo = arq.name;
    conferir(decodificar(new Uint8Array(await arq.arrayBuffer())));
  }

  const grupos = $derived(
    cmp ? ORDEM_MUDANCA.map((tipo) => ({ tipo, itens: cmp!.mudancas.filter((m) => m.tipo === tipo) })).filter((g) => g.itens.length) : [],
  );

  function alternar(id: string) {
    const s = new Set(marcadas);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    marcadas = s;
  }
  function todos(itens: Mudanca[], marcar: boolean) {
    const s = new Set(marcadas);
    for (const m of itens) {
      if (marcar) s.add(m.id);
      else s.delete(m.id);
    }
    marcadas = s;
  }

  const nasc = (iso: string) => (iso ? formatarData(iso) : 'vazio');
  const nomes = (l: { nome: string }[]) => l.map((m) => m.nome).join(', ');

  async function salvar() {
    if (!cmp || !marcadas.size) return;
    salvando = true;
    try {
      const n = marcadas.size;
      await atualizarCadastroSbcd($state.snapshot(cmp) as Comparacao, new Set(marcadas));
      pronto = n;
      cmp = null;
      mostrarAviso(`Cadastro atualizado: ${n} ${n === 1 ? 'mudança' : 'mudanças'} ✓`);
    } catch {
      mostrarAviso('Não consegui salvar. Tente de novo.', 5000);
    } finally {
      salvando = false;
    }
  }
</script>

<button class="botao secundario pequeno voltar" onclick={() => voltar('ajustes')}><Icone nome="voltar" /> Voltar</button>

<h1>Atualizar cadastro pelo SBCD</h1>

{#if pronto}
  <section class="cartao destaque">
    <p><strong>Pronto!</strong> {pronto} {pronto === 1 ? 'mudança salva' : 'mudanças salvas'}. Tudo ficou no histórico de cada casa.</p>
    <p class="suave pequeno">Errou alguma coisa? Toque em <strong>Desfazer</strong> no aviso de baixo (logo depois de salvar), ou corrija na ficha da casa.</p>
    <div class="linha-botoes">
      <button class="botao secundario" onclick={() => (pronto = 0)}>Abrir outro arquivo</button>
      <button class="botao" onclick={() => ir('busca')}>Ir para a busca</button>
    </div>
  </section>
{:else if !cmp}
  <p class="suave">
    Escolha o arquivo do cadastro do SBCD (o JSON que o Claude monta). O app compara com o que você tem e mostra só as
    diferenças. <strong>Nada é apagado</strong> e nada muda sem você marcar. As VDs, as fichas e o que você editou à mão ficam.
  </p>
  <section class="cartao">
    <label class="botao largo arquivo">
      <input type="file" onchange={abrirArquivo} />
      Escolher o arquivo do SBCD
    </label>
    <p class="suave pequeno centro">ou</p>
    <label class="campo">
      <span>Cole o conteúdo do arquivo</span>
      <textarea rows="4" bind:value={colado} placeholder="Cole aqui o texto do arquivo (começa com uma chave)"></textarea>
    </label>
    <button class="botao secundario largo" disabled={!colado.trim()} onclick={() => conferir(colado)}>Conferir</button>
    {#if erro}<p class="alerta">{erro}</p>{/if}
  </section>
{:else}
  <section class="cartao destaque">
    {#if nomeArquivo}<p class="suave pequeno">Arquivo: {nomeArquivo}</p>{/if}
    <p>
      O arquivo{cmp.geradoEm ? ` de ${formatarData(cmp.geradoEm)}` : ''} tem <strong>{cmp.casasNoArquivo}</strong> casas e
      <strong>{cmp.pessoasNoArquivo}</strong> pessoas.
    </p>
    <p>
      <strong>{cmp.mudancas.length}</strong> {cmp.mudancas.length === 1 ? 'diferença' : 'diferenças'} com o app{cmp.iguais ? ` · ${cmp.iguais} casas já iguais` : ''}.
    </p>
    <p class="suave pequeno">
      As marcadas são as seguras. Confira as outras (data diferente, nome parecido, óbito, casa que não veio) antes de marcar.
    </p>
  </section>

  {#each grupos as g (g.tipo)}
    {@const n = g.itens.filter((m) => marcadas.has(m.id)).length}
    <section class="cartao">
      <details open={g.itens.length <= 12}>
        <summary><strong>{NOMES_MUDANCA[g.tipo]}</strong> <span class="suave">({n} de {g.itens.length} marcadas)</span></summary>
        {#if g.tipo === 'tirar'}
          <p class="suave pequeno">Estão no app, mas não vieram do SBCD. Só marque se a casa não é mesmo da sua área: ela vai para a Lixeira (dá para restaurar).</p>
        {:else if g.tipo === 'obito'}
          <p class="suave pequeno">O arquivo pede para dar baixa por óbito. Confirme antes de marcar.</p>
        {:else if g.tipo === 'nascimento'}
          <p class="suave pequeno">Data vazia no app vem marcada. Data diferente fica desmarcada: pode ser que você tenha corrigido à mão.</p>
        {/if}
        <div class="todos">
          <button class="link-simples" onclick={() => todos(g.itens, true)}>Marcar todas</button>
          <button class="link-simples" onclick={() => todos(g.itens, false)}>Desmarcar todas</button>
        </div>
        <ul class="itens">
          {#each g.itens as m (m.id)}
            <li>
              <label class="opcao">
                <input type="checkbox" checked={marcadas.has(m.id)} onchange={() => alternar(m.id)} />
                <span>
                  {#if m.tipo === 'prontuario'}
                    <strong>{m.rotulo}</strong><br />{m.de || 'sem prontuário'} → <strong>{m.para}</strong>
                  {:else if m.tipo === 'endereco'}
                    <strong>{m.de}</strong> → <strong>{m.rotulo}</strong>
                  {:else if m.tipo === 'pessoa'}
                    <strong>{m.morador.nome}</strong>{m.morador.nascimento ? ` · ${formatarData(m.morador.nascimento)}` : ''}<br />
                    <span class="suave pequeno">em {m.rotulo}</span>
                    {#if m.mover}<br /><span class="pequeno">Estava no app em {m.mover.de}: muda de casa e leva a ficha junto.</span>{/if}
                    {#if m.parecido}<br /><span class="aviso-p pequeno">Parecido com {m.parecido}, na mesma casa: pode ser o mesmo nome escrito diferente.</span>{/if}
                  {:else if m.tipo === 'casa'}
                    <strong>{m.rotulo}</strong>{m.familia.prontuario ? ` · ${m.familia.prontuario}` : ''}<br />
                    <span class="suave pequeno">{nomes(m.familia.moradores)}</span>
                    {#if m.mover.length}<br /><span class="pequeno">{m.mover.length === 1 ? 'Uma pessoa estava' : `${m.mover.length} pessoas estavam`} no app em {[...new Set(m.mover.map((x) => x.de))].join(', ')}: {m.mover.length === 1 ? 'muda' : 'mudam'} para esta casa e {m.mover.length === 1 ? 'leva' : 'levam'} a ficha junto.</span>{/if}
                  {:else if m.tipo === 'nascimento'}
                    <strong>{m.nome}</strong> <span class="suave pequeno">({m.rotulo})</span><br />{nasc(m.de)} → <strong>{nasc(m.para)}</strong>
                  {:else if m.tipo === 'sexo'}
                    <strong>{m.nome}</strong> <span class="suave pequeno">({m.rotulo})</span> → {m.para === 'F' ? 'Feminino' : 'Masculino'}
                  {:else if m.tipo === 'obito'}
                    <strong>{m.nome}</strong> <span class="suave pequeno">({m.rotulo})</span>: marcar como faleceu
                  {:else if m.tipo === 'tirar'}
                    <strong>{m.rotulo}</strong><br /><span class="suave pequeno">{m.motivo}</span>
                  {/if}
                </span>
              </label>
            </li>
          {/each}
        </ul>
      </details>
    </section>
  {/each}

  {#if cmp.conferir.pessoasQueNaoVieram.length || cmp.conferir.situacaoDiferente.length || cmp.conferir.casasEmDuplicidade.length}
    <section class="cartao">
      <details>
        <summary><strong>Para conferir</strong> <span class="suave">(nada muda sozinho)</span></summary>
        {#if cmp.conferir.pessoasQueNaoVieram.length}
          <p class="pequeno"><strong>Moram no app, mas não vieram na casa no SBCD</strong> (mudou-se? faleceu? cadastro atrasado?):</p>
          <ul class="info">{#each cmp.conferir.pessoasQueNaoVieram as x, i (i)}<li><button class="item-link" onclick={() => ir(`familia/${x.familiaId}`)}>{x.nome} · {x.rotulo}</button></li>{/each}</ul>
        {/if}
        {#if cmp.conferir.situacaoDiferente.length}
          <p class="pequeno"><strong>No SBCD ainda moram na casa, mas no app não:</strong></p>
          <ul class="info">{#each cmp.conferir.situacaoDiferente as x, i (i)}<li>{x.nome} · {x.rotulo} (no app: {x.noApp})</li>{/each}</ul>
        {/if}
        {#if cmp.conferir.casasEmDuplicidade.length}
          <p class="pequeno"><strong>Não consegui separar estas casas:</strong> {cmp.conferir.casasEmDuplicidade.join(', ')}</p>
        {/if}
      </details>
    </section>
  {/if}

  {#if cmp.pendencias.length}
    <section class="cartao">
      <details>
        <summary><strong>Pendências do cadastro no SBCD</strong> <span class="suave">({cmp.pendencias.length})</span></summary>
        <p class="suave pequeno">Para resolver no SBCD. O app não muda nada por causa delas (o óbito, se tiver, está acima).</p>
        <ul class="info">
          {#each cmp.pendencias as p, i (i)}
            <li><strong>{p.tipo}</strong>{p.nome ? ` · ${p.nome}` : ''}{p.rua || p.casa ? ` · ${[p.rua, p.casa].filter(Boolean).join(' ')}` : ''}</li>
          {/each}
        </ul>
      </details>
    </section>
  {/if}

  <div class="rodape linha-botoes">
    <button class="botao secundario" onclick={() => (cmp = null)}>Cancelar</button>
    <button class="botao" disabled={salvando || !marcadas.size} onclick={salvar}>Salvar {marcadas.size} {marcadas.size === 1 ? 'mudança' : 'mudanças'}</button>
  </div>
{/if}

<style>
  .voltar {
    margin-bottom: 12px;
  }
  .arquivo {
    position: relative;
    overflow: hidden;
  }
  .arquivo input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }
  summary {
    cursor: pointer;
    padding: 4px 0;
  }
  .todos {
    display: flex;
    gap: 16px;
    margin: 8px 0;
  }
  .todos button {
    background: none;
    border: 0;
    padding: 6px 0;
    color: var(--primaria);
    font: inherit;
    font-weight: 700;
    text-decoration: underline;
    cursor: pointer;
  }
  .itens,
  .info {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .itens li {
    border-top: 1px solid var(--borda);
    padding: 6px 0;
  }
  .info li {
    padding: 3px 0;
  }
  .opcao {
    display: flex;
    gap: 10px;
    align-items: flex-start;
  }
  .opcao input {
    width: 22px;
    height: 22px;
    flex: none;
    margin-top: 2px;
  }
  .opcao span {
    overflow-wrap: anywhere;
  }
  .aviso-p {
    color: var(--aviso-texto);
    background: var(--aviso-fundo);
    padding: 1px 6px;
    border-radius: 6px;
  }
  .rodape {
    position: sticky;
    bottom: calc(56px + env(safe-area-inset-bottom));
    padding: 8px 0 22px;
    background: var(--fundo);
  }
  .linha-botoes {
    display: flex;
    gap: 8px;
  }
  .linha-botoes .botao {
    flex: 1;
  }
</style>
