<script lang="ts">
  import Icone from '../componentes/Icone.svelte';
  import { formatarData } from '../lib/datas';
  import { app, enderecoCurto, marcarGruposEmLote, mostrarAviso } from '../lib/estado.svelte';
  import { casarComMoradores, gruposQueFaltam, lerArquivoGrupos, type Casamento } from '../lib/importar-grupos';
  import { decodificar } from '../lib/importar-csv';
  import { NOMES_GRUPO } from '../lib/rotulos';
  import { ir, voltar } from '../lib/rotas.svelte';
  import type { Grupo } from '../lib/tipos';

  const OPCOES: { valor: Grupo | ''; rotulo: string }[] = [
    { valor: '', rotulo: 'Cada linha diz (HAS, DM, acamado…)' },
    { valor: 'hipertenso', rotulo: 'Hipertensos' },
    { valor: 'diabetico', rotulo: 'Diabéticos' },
    { valor: 'acamado', rotulo: 'Acamados' },
    { valor: 'gestante', rotulo: 'Gestantes' },
    { valor: 'puerpera', rotulo: 'Puérperas' },
    { valor: 'crianca', rotulo: 'Crianças pequenas' },
    { valor: 'idoso', rotulo: 'Idosos' },
    { valor: 'deficiencia', rotulo: 'Pessoas com deficiência' },
    { valor: 'saude_mental', rotulo: 'Saúde mental' },
  ];

  let grupo = $state<Grupo | ''>('');
  let colado = $state('');
  let casamentos = $state<Casamento[] | null>(null);
  /** Escolha para "parecido" e "vários": índice do candidato, ou -1 = nenhum. */
  let escolha = $state<Record<number, number>>({});
  let salvando = $state(false);

  let semCondicao = $state(0);
  let nomeArquivo = $state('');

  function conferir(texto = colado) {
    const r = lerArquivoGrupos(texto, grupo || null);
    semCondicao = r.semCondicao;
    casamentos = casarComMoradores(r.linhas, app.familias);
    escolha = {};
  }

  async function abrirArquivo(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const arq = input.files?.[0];
    input.value = '';
    if (!arq) return;
    nomeArquivo = arq.name;
    conferir(decodificar(new Uint8Array(await arq.arrayBuffer())));
  }

  const nomeGrupos = (gs: Grupo[]) => gs.map((g) => NOMES_GRUPO[g]).join(', ');
  const idx = (c: Casamento) => casamentos!.indexOf(c);

  /** Quem vai receber o(s) grupo(s), sem repetir pessoa. */
  const aMarcar = $derived.by(() => {
    if (!casamentos) return [];
    const mapa = new Map<string, { familiaId: string; moradorId: string; grupos: Grupo[]; nome: string }>();
    casamentos.forEach((c, i) => {
      const k = c.situacao === 'achado' ? 0 : (escolha[i] ?? -1);
      const cand = c.candidatos[k];
      if (!cand || k < 0) return;
      const faltam = gruposQueFaltam(cand.morador, c.linha.grupos);
      if (!faltam.length) return;
      const chave = cand.morador.id;
      const ja = mapa.get(chave);
      mapa.set(chave, {
        familiaId: cand.familia.id,
        moradorId: cand.morador.id,
        nome: cand.morador.nome,
        grupos: [...new Set([...(ja?.grupos ?? []), ...faltam])],
      });
    });
    return [...mapa.values()];
  });
  const de = (s: Casamento['situacao']) => (casamentos ?? []).filter((c) => c.situacao === s);
  const jaTinham = $derived(de('achado').filter((c) => !gruposQueFaltam(c.candidatos[0].morador, c.linha.grupos).length));

  async function salvar() {
    if (!aMarcar.length) return;
    salvando = true;
    try {
      const n = aMarcar.length;
      await marcarGruposEmLote(aMarcar.map(({ familiaId, moradorId, grupos }) => ({ familiaId, moradorId, grupos })));
      mostrarAviso(`Grupos marcados em ${n} ${n === 1 ? 'pessoa' : 'pessoas'} ✓`);
      casamentos = null;
      colado = '';
    } finally {
      salvando = false;
    }
  }
</script>

<button class="botao secundario pequeno voltar" onclick={() => voltar('ajustes')}><Icone nome="voltar" /> Voltar</button>

<h1>Marcar grupos colando uma lista</h1>
<p class="suave">
  No Fast, copie a lista de hipertensos, diabéticos, acamados… e cole aqui. O app acha cada pessoa na sua área e
  mostra o que vai marcar antes de salvar. Nada sai do celular.
</p>

{#if !casamentos}
  <section class="cartao">
    <label class="campo">
      <span>Esta lista é de:</span>
      <select bind:value={grupo}>
        {#each OPCOES as o (o.valor)}<option value={o.valor}>{o.rotulo}</option>{/each}
      </select>
    </label>
    <label class="botao largo arquivo">
      <input type="file" onchange={abrirArquivo} />
      Escolher arquivo (JSON, CSV ou TXT)
    </label>
    <p class="suave pequeno centro">ou</p>
    <label class="campo">
      <span>Cole a lista (uma pessoa por linha; com a data de nascimento fica mais certo)</span>
      <textarea rows="8" bind:value={colado} placeholder="Ex.: JOANA TESTE DA SILVA   10/03/1950   HAS"></textarea>
    </label>
    <button class="botao secundario largo" disabled={!colado.trim()} onclick={() => conferir()}>Conferir a lista colada</button>
    <p class="suave pequeno">O arquivo é lido só no celular. Se ele já diz a condição de cada pessoa (HAS, DM, acamado, gestante…), escolha “Cada linha diz”.</p>
  </section>
{:else}
  {@const achados = de('achado')}
  {@const parecidos = de('parecido')}
  {@const varios = de('varios')}
  {@const nao = de('nao_achado')}
  <section class="cartao destaque">
    {#if nomeArquivo}<p class="suave pequeno">Arquivo: {nomeArquivo}</p>{/if}
    <p><strong>{casamentos.length}</strong> {casamentos.length === 1 ? 'pessoa lida' : 'pessoas lidas'} na lista.</p>
    <ul class="resumo">
      <li><strong>{achados.length}</strong> {achados.length === 1 ? 'reconhecida' : 'reconhecidas'}{jaTinham.length ? ` (${jaTinham.length} sem nada novo para marcar)` : ''}</li>
      {#if parecidos.length}<li><strong>{parecidos.length}</strong> com nome parecido: confira abaixo</li>{/if}
      {#if varios.length}<li><strong>{varios.length}</strong> com mais de uma pessoa possível: escolha abaixo</li>{/if}
      {#if semCondicao}<li><strong>{semCondicao}</strong> sem condição reconhecida ({semCondicao === 1 ? 'ignorada' : 'ignoradas'}). Se a lista toda é de um grupo, escolha o grupo em “Esta lista é de”.</li>{/if}
      {#if nao.length}<li><strong>{nao.length}</strong> não {nao.length === 1 ? 'encontrada' : 'encontradas'} na sua área</li>{/if}
    </ul>
    {#if casamentos.length === 0}
      <p class="alerta">Não achei nomes na lista. Confira se escolheu o grupo certo e se cada pessoa está numa linha.</p>
    {/if}
  </section>

  {#if parecidos.length || varios.length}
    <section class="cartao">
      <h2>Confira</h2>
      <p class="suave pequeno">Toque na pessoa certa. Se não for nenhuma, deixe em “Nenhuma”.</p>
      {#each [...varios, ...parecidos] as c (idx(c))}
        {@const i = idx(c)}
        <fieldset class="confere">
          <legend>
            <strong>Na lista:</strong> {c.linha.nome.toUpperCase()}{c.linha.nascimento ? ` · ${formatarData(c.linha.nascimento)}` : ''}
            <span class="suave pequeno"> ({nomeGrupos(c.linha.grupos)})</span>
          </legend>
          {#each c.candidatos as cand, k (cand.morador.id)}
            <label class="opcao">
              <input type="radio" name="c{i}" checked={escolha[i] === k} onchange={() => (escolha[i] = k)} />
              <span>{cand.morador.nome}{cand.morador.nascimento ? ` · ${formatarData(cand.morador.nascimento)}` : ''}<br /><span class="suave pequeno">{enderecoCurto(cand.familia)}</span></span>
            </label>
          {/each}
          <label class="opcao">
            <input type="radio" name="c{i}" checked={(escolha[i] ?? -1) === -1} onchange={() => (escolha[i] = -1)} />
            <span>Nenhuma</span>
          </label>
        </fieldset>
      {/each}
    </section>
  {/if}

  <section class="cartao">
    <details open={aMarcar.length <= 20}>
      <summary>Vai marcar ({aMarcar.length})</summary>
      <ul class="lista">
        {#each aMarcar as m (m.moradorId)}
          <li class="linha"><button class="item-link" onclick={() => ir(`familia/${m.familiaId}`)}>{m.nome}<br /><span class="suave pequeno">+ {nomeGrupos(m.grupos)}</span></button></li>
        {/each}
      </ul>
    </details>
  </section>

  {#if nao.length}
    <section class="cartao">
      <details>
        <summary>Não encontradas ({nao.length})</summary>
        <p class="suave pequeno">Podem ser de outra área, ou o nome está diferente no app. Dá para marcar à mão no morador (Editar → Condições).</p>
        <ul class="nao">
          {#each nao as c (idx(c))}<li>{c.linha.nome.toUpperCase()}{c.linha.nascimento ? ` · ${formatarData(c.linha.nascimento)}` : ''}</li>{/each}
        </ul>
      </details>
    </section>
  {/if}

  <div class="linha-botoes">
    <button class="botao secundario" onclick={() => { casamentos = null; nomeArquivo = ''; }}>Voltar</button>
    <button class="botao" disabled={!aMarcar.length || salvando} onclick={salvar}>Marcar {aMarcar.length} {aMarcar.length === 1 ? 'pessoa' : 'pessoas'}</button>
  </div>
{/if}

<style>
  .voltar {
    margin-bottom: 12px;
  }
  .arquivo {
    position: relative;
    cursor: pointer;
  }
  .arquivo input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }
  .centro {
    text-align: center;
    margin: 6px 0;
  }
  textarea {
    width: 100%;
    font-size: 1rem;
  }
  .destaque {
    border: 2px solid var(--primaria);
  }
  .resumo {
    margin: 4px 0 0;
    padding-left: 20px;
  }
  .confere {
    border: 1px solid var(--borda);
    border-radius: 12px;
    padding: 8px 12px;
    margin: 0 0 12px;
  }
  .opcao {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 48px;
    cursor: pointer;
  }
  .opcao input {
    width: 22px;
    height: 22px;
    flex-shrink: 0;
    accent-color: var(--primaria);
  }
  .nao {
    padding-left: 20px;
  }
</style>
