<script lang="ts">
  import modeloCsv from '../../exemplos/area-exemplo.csv?raw';
  import Icone from '../componentes/Icone.svelte';
  import { entregarArquivo } from '../lib/arquivo';
  import { hojeISO } from '../lib/datas';
  import { app, importarArea, mostrarAviso } from '../lib/estado.svelte';
  import { importarTexto } from '../lib/importar';
  import { decodificar, textoResumo, type ResultadoImportacao } from '../lib/importar-csv';
  import { ir, voltar } from '../lib/rotas.svelte';

  const hoje = hojeISO();
  type Passo = 'escolher' | 'previa' | 'pronto';
  let passo = $state<Passo>('escolher');
  let colado = $state('');
  let resultado = $state<ResultadoImportacao | null>(null);
  let confirmaSubstituir = $state('');
  let salvando = $state(false);

  /** Já existe uma área de verdade (não é exemplo nem vazia)? */
  const temAreaReal = $derived(!app.config.usandoExemplo && app.familias.length > 0);

  async function lerArquivo(arquivo: File | undefined) {
    if (!arquivo) return;
    const bytes = new Uint8Array(await arquivo.arrayBuffer());
    analisar(decodificar(bytes));
  }

  function analisar(texto: string) {
    resultado = importarTexto(texto, hoje);
    passo = 'previa';
  }

  async function confirmar() {
    if (!resultado || resultado.erros.length) return;
    salvando = true;
    try {
      await importarArea($state.snapshot(resultado.familias) as ResultadoImportacao['familias']);
      passo = 'pronto';
      colado = '';
    } catch {
      mostrarAviso('Não consegui importar. Tente de novo.', 5000);
    } finally {
      salvando = false;
    }
  }

  async function baixarModelo() {
    await entregarArquivo('modelo-area-acs.csv', modeloCsv.startsWith('﻿') ? modeloCsv : `﻿${modeloCsv}`, 'text/csv');
  }

  const amostra = $derived(resultado?.familias.slice(0, 5) ?? []);
  const confere = $derived(
    resultado?.totalInformado
      ? resultado.totalInformado.familias === resultado.resumo.familias &&
          resultado.totalInformado.moradores === resultado.resumo.moradores
      : null,
  );
</script>

<button class="botao secundario pequeno voltar" onclick={() => voltar('ajustes')}><Icone nome="voltar" /> Voltar</button>

<h1>Importar minha área</h1>

{#if passo === 'escolher'}
  {#if temAreaReal}
    <p class="alerta">
      Você já importou sua área. Importar de novo <strong>apaga as famílias, as visitas e o histórico atuais</strong>
      e põe o conteúdo do arquivo no lugar. Faça um backup antes. Para pequenas mudanças, edite direto no app.
    </p>
  {:else if app.config.usandoExemplo}
    <p class="alerta">A importação troca os <strong>dados de exemplo</strong> (inventados) pela sua área. As visitas de exemplo também somem.</p>
  {/if}

  <section class="cartao">
    <h2>Copiar e colar aqui</h2>
    <p>Pode ser uma <strong>tabela</strong> (copiada do Fast ou de uma planilha) ou uma <strong>lista em texto</strong>, assim:</p>
    <pre class="modelo-lista">RUA DAS ACÁCIAS
Acácias 12 FUNDOS (pront. 00.001)
   - Fulana de Tal (14/03/1958)
   - Ciclano de Tal (02/11/1955)</pre>
    <ol class="passos">
      <li>No <strong>celular</strong>, abra a lista (no Fast ou onde ela estiver). Numa tabela, selecione <strong>incluindo a linha dos títulos</strong>.</li>
      <li>Toque em <strong>Copiar</strong>, volte para cá, segure o dedo na caixa abaixo e toque em <strong>Colar</strong>.</li>
      <li>Toque em <strong>Conferir</strong>. Nada é salvo antes de você confirmar, e o texto não sai do celular.</li>
    </ol>
    <textarea rows="5" bind:value={colado} placeholder="Cole aqui a lista copiada"></textarea>
    <button class="botao largo" onclick={() => analisar(colado)} disabled={!colado.trim()}>Conferir o texto colado</button>
    <p class="suave pequeno dica">
      Na lista: título da rua, uma linha por casa e os moradores com “-” embaixo. Na tabela: colunas
      <strong>rua</strong> e <strong>nome</strong> são obrigatórias; sem a coluna “Casa”, o app junta os moradores
      pelo prontuário ou pelo endereço.
    </p>
  </section>

  <section class="cartao">
    <details>
      <summary>Ou importar um arquivo de planilha (CSV)</summary>
      <ol class="passos">
        <li>Numa planilha, faça <strong>uma linha por morador</strong>, com as colunas:<br />
          <code>Casa · Rua · Numero · Complemento · Bairro · Prontuario · Nome · Sexo · Data de nascimento</code></li>
        <li><strong>Casa</strong> (opcional) junta a família: C001, C002… O primeiro de cada casa vira o responsável.</li>
        <li><strong>Sexo</strong>: M ou F. <strong>Data</strong>: dd/mm/aaaa.</li>
        <li>Salve como <strong>CSV</strong> e escolha o arquivo abaixo.</li>
      </ol>
      <input type="file" accept=".csv,.txt,text/csv,text/plain" onchange={(e) => lerArquivo(e.currentTarget.files?.[0])} />
      <button class="botao secundario largo espaco" onclick={baixarModelo}>Baixar planilha modelo (dados inventados)</button>
    </details>
  </section>
{:else if passo === 'previa' && resultado}
  {#if resultado.erros.length}
    <section class="cartao">
      <h2>Não deu para importar</h2>
      {#each resultado.erros as e (e)}<p class="alerta">{e}</p>{/each}
      <button class="botao secundario largo" onclick={() => (passo = 'escolher')}>Escolher outro arquivo</button>
    </section>
  {:else}
    <section class="cartao">
      <h2>Confira antes de salvar</h2>
      <p class="resumo">{textoResumo(resultado.resumo)}</p>
      {#if resultado.totalInformado}
        {#if confere}
          <p class="confere">✓ Confere com o TOTAL escrito no texto.</p>
        {:else}
          <p class="alerta">
            O texto diz <strong>{resultado.totalInformado.familias} casas e {resultado.totalInformado.moradores} moradores</strong>.
            Veja os avisos abaixo para entender a diferença (ex.: recém-nascido listado mas ainda não contado).
          </p>
        {/if}
      {/if}
      <ul class="lista ruas">
        {#each resultado.resumo.ruas as r (r.rua)}<li><span>{r.rua || '(sem rua)'}</span><strong>{r.familias}</strong></li>{/each}
      </ul>
    </section>

    {#if resultado.avisos.length}
      <section class="cartao">
        <details>
          <summary>⚠️ {resultado.avisos.length} {resultado.avisos.length === 1 ? 'aviso' : 'avisos'} (toque para ver)</summary>
          <ul class="lista avisos">
            {#each resultado.avisos.slice(0, 100) as a, i (i)}<li>{#if a.linha > 0}<strong>Linha {a.linha}:&nbsp;</strong>{/if}{a.texto}</li>{/each}
          </ul>
          {#if resultado.avisos.length > 100}<p class="suave pequeno">…e mais {resultado.avisos.length - 100}.</p>{/if}
        </details>
        <p class="suave pequeno">Os avisos não impedem a importação. Dá para corrigir depois, no app.</p>
      </section>
    {/if}

    <section class="cartao">
      <h2>Primeiras famílias</h2>
      <p class="suave pequeno">Veja se os nomes e acentos estão certos.</p>
      {#each amostra as f (f.id)}
        <div class="amostra">
          <strong>{f.rua}, {f.numero}{f.complemento ? ` – ${f.complemento}` : ''}</strong>
          <span class="suave pequeno">Pront.: {f.prontuario || '—'}</span>
          <span>{f.moradores.map((m) => m.nome).join(', ')}</span>
        </div>
      {/each}
    </section>

    {#if temAreaReal}
      <label class="campo"><span>Para substituir a área atual, digite SUBSTITUIR</span>
        <input type="text" bind:value={confirmaSubstituir} autocapitalize="characters" autocomplete="off" /></label>
    {/if}
    <div class="linha-botoes">
      <button class="botao secundario" onclick={() => (passo = 'escolher')}>Voltar</button>
      <button class="botao" onclick={confirmar} disabled={salvando || (temAreaReal && confirmaSubstituir.trim().toUpperCase() !== 'SUBSTITUIR')}>
        {salvando ? 'Salvando…' : 'Confirmar e salvar'}
      </button>
    </div>
  {/if}
{:else}
  <section class="cartao">
    <h2 class="feito">✓ Área importada!</h2>
    <p>{resultado ? textoResumo(resultado.resumo) : ''}. Os dados agora estão criptografados no celular.</p>
  </section>
  <section class="cartao importante">
    <h2>Agora, duas coisas importantes</h2>
    <ol class="passos">
      <li><strong>Apague o arquivo CSV</strong> do celular, do computador e de onde ele passou (WhatsApp, e-mail, Drive). Ele <strong>não é protegido</strong>: qualquer pessoa consegue ler.</li>
      <li><strong>Faça um backup agora</strong>, para não precisar importar de novo se algo acontecer.</li>
    </ol>
    <button class="botao largo" onclick={() => ir('ajustes')}>Fazer backup agora</button>
    <button class="botao secundario largo espaco" onclick={() => ir('pendencias')}>Ver o que falta completar</button>
  </section>
{/if}

<style>
  .voltar {
    margin-bottom: 12px;
  }
  .passos li {
    margin-bottom: 8px;
  }
  code {
    font-size: 0.85rem;
    word-break: break-word;
  }
  .dica {
    margin-top: 10px;
  }
  .modelo-lista {
    background: var(--fundo);
    border: 1px dashed var(--borda);
    border-radius: 10px;
    padding: 8px 10px;
    font-size: 0.85rem;
    white-space: pre-wrap;
    overflow-x: auto;
  }
  .confere {
    color: var(--realizada);
    font-weight: 700;
  }
  textarea {
    margin-bottom: 10px;
  }
  .resumo {
    font-size: 1.3rem;
    font-weight: 700;
    color: var(--primaria);
  }
  .ruas li {
    display: flex;
    justify-content: space-between;
    padding: 6px 0;
    border-bottom: 1px solid var(--borda);
  }
  .avisos li {
    padding: 6px 0;
    border-bottom: 1px solid var(--borda);
    font-size: 0.95rem;
  }
  .amostra {
    display: flex;
    flex-direction: column;
    padding: 8px 0;
    border-bottom: 1px solid var(--borda);
  }
  .feito {
    color: var(--realizada);
  }
  .importante {
    border: 2px solid var(--ausencia);
  }
  .espaco {
    margin-top: 10px;
  }
</style>
