<script lang="ts">
  import { EDICAO_BASICA } from '../lib/edicao';
  import { lerBloqueios, quandoFoi, textoDoBloqueio } from '../lib/bloqueios';
  import { entregarArquivo } from '../lib/arquivo';
  import { ArquivoInvalido, criarBackup, nomeArquivoBackup, SenhaBackupErrada } from '../lib/backup';
  import { FERIADOS_LOCAIS_SUGERIDOS, feriadosNacionais } from '../lib/calendario';
  import { problemaNoPin } from '../lib/cripto';
  import { textoResumoJuncao } from '../lib/juntar';
  import { diferencaDias, formatarData, formatarDataLonga, hojeISO } from '../lib/datas';
  import {
    apagarTudo,
    sincronizarAntesDeApagar,
    app,
    cofre,
    dadosParaBackup,
    juntarBackup,
    mostrarAviso,
    pedirPersistencia,
    registrarBackupFeito,
    restaurarSobre,
    salvarConfig,
    trocarPin,
  } from '../lib/estado.svelte';
  import { ir } from '../lib/rotas.svelte';
  import { FRASES_PADRAO, lerFrasesProprias } from '../lib/frases-prontas';
  import Sincronizacao from '../componentes/Sincronizacao.svelte';
  import type { Desfecho } from '../lib/tipos';

  const hoje = hojeISO();

  // ---- Backup ----
  let senhaB = $state('');
  let senhaB2 = $state('');
  let gerando = $state(false);
  async function fazerBackup(modo: 'compartilhar' | 'baixar' = 'baixar') {
    if (senhaB.length < 6) return mostrarAviso('A senha do backup precisa ter pelo menos 6 caracteres.', 4000);
    if (senhaB !== senhaB2) return mostrarAviso('As duas senhas não são iguais.', 4000);
    gerando = true;
    try {
      const texto = await criarBackup(dadosParaBackup(), senhaB);
      const ok = await entregarArquivo(nomeArquivoBackup(hoje), texto, 'application/json', modo);
      if (ok) {
        await registrarBackupFeito();
        senhaB = senhaB2 = '';
        mostrarAviso('Backup criado ✓ Guarde o arquivo e a senha em lugares diferentes.', 5000);
      }
    } finally {
      gerando = false;
    }
  }

  let arquivoR = $state<File | null>(null);
  let senhaR = $state('');
  let confirmaR = $state(false);
  async function restaurar() {
    if (!arquivoR) return mostrarAviso('Escolha o arquivo do backup.');
    try {
      await restaurarSobre(await arquivoR.text(), senhaR);
      senhaR = '';
      confirmaR = false;
      mostrarAviso('Backup restaurado ✓', 4000);
    } catch (e) {
      mostrarAviso(e instanceof SenhaBackupErrada || e instanceof ArquivoInvalido ? e.message : 'Não consegui restaurar.', 9000);
    }
  }

  let arquivoJ = $state<File | null>(null);
  let senhaJ = $state('');
  let juntando = $state(false);
  let resultadoJ = $state('');
  async function juntar() {
    if (!arquivoJ) return mostrarAviso('Escolha o arquivo do backup.');
    juntando = true;
    try {
      const r = await juntarBackup(await arquivoJ.text(), senhaJ);
      resultadoJ = textoResumoJuncao(r) + (r.semData ? ` (${r.semData} com alteração dos dois lados sem data: ficou a deste aparelho)` : '');
      senhaJ = '';
      mostrarAviso('Backup juntado ✓', 3500);
    } catch (e) {
      mostrarAviso(e instanceof SenhaBackupErrada || e instanceof ArquivoInvalido ? e.message : 'Não consegui juntar.', 9000);
    } finally {
      juntando = false;
    }
  }

  const diasSemBackup = $derived(app.config.ultimoBackup ? diferencaDias(app.config.ultimoBackup, hoje) : null);

  // ---- Dados do ACS ----
  let novaRua = $state('');
  function addRua() {
    const r = novaRua.trim();
    if (r && !app.config.ruas.includes(r)) app.config.ruas.push(r);
    novaRua = '';
  }
  async function salvar() {
    if (!(app.config.metaMensal > 0)) return mostrarAviso('A meta precisa ser maior que zero.');
    app.config.metaMensal = Math.round(app.config.metaMensal);
    const meses = Number(app.config.mesesReceita);
    app.config.mesesReceita = meses >= 1 && meses <= 24 ? Math.round(meses) : undefined;
    const descanso = app.config.diasDescanso == null ? NaN : Number(app.config.diasDescanso);
    app.config.diasDescanso = descanso >= 0 && descanso <= 30 ? Math.round(descanso) : undefined;
    const grave = app.config.diasDescansoGrave == null ? NaN : Number(app.config.diasDescansoGrave);
    app.config.diasDescansoGrave = grave >= 0 && grave <= 30 ? Math.round(grave) : undefined;
    await salvarConfig();
    mostrarAviso('Salvo ✓');
  }

  // ---- Nomes do Fast ----
  const ordem: Desfecho[] = ['realizada', 'ausente_realizada', 'ausencia_completa', 'recusa'];
  let motivosTexto = $state(app.config.motivos.join('\n'));
  async function salvarNomes() {
    const lista = motivosTexto.split('\n').map((m) => m.trim()).filter(Boolean);
    if (!lista.length) return mostrarAviso('Deixe pelo menos um motivo.');
    app.config.motivos = lista;
    if (!lista.includes(app.config.motivoPadrao)) app.config.motivoPadrao = lista[0];
    await salvar();
  }

  // ---- PIN ----
  let pinAtual = $state('');
  let pinNovo = $state('');
  let pinNovo2 = $state('');
  let trocando = $state(false);
  async function mudarPin() {
    const p = problemaNoPin(pinNovo);
    if (p) return mostrarAviso(p, 4000);
    if (pinNovo !== pinNovo2) return mostrarAviso('Os PINs novos não são iguais.', 4000);
    trocando = true;
    try {
      if (!(await cofre.conferirPin(pinAtual))) return mostrarAviso('O PIN atual está errado.', 4000);
      await trocarPin(pinNovo);
      pinAtual = pinNovo = pinNovo2 = '';
      mostrarAviso('PIN trocado ✓', 4000);
    } finally {
      trocando = false;
    }
  }

  // ---- Fast ----
  function salvarUrlFast() {
    const u = app.config.urlFast.trim();
    if (u && !/^https:\/\//i.test(u)) {
      mostrarAviso('O endereço precisa começar com https://');
      app.config.urlFast = '';
    } else app.config.urlFast = u;
    salvarConfig();
  }

  // ---- Calendário e meta ----
  const anoAtual = Number(hoje.slice(0, 4));
  const feriados = $derived(feriadosNacionais(anoAtual).filter((f) => f.data >= `${anoAtual}-01-01`));
  function alternarFeriado(data: string, trabalho: boolean) {
    const lista = app.config.feriadosIgnorados.filter((d) => d !== data);
    app.config.feriadosIgnorados = trabalho ? [...lista, data] : lista;
    salvarConfig();
  }
  let novoDia = $state('');
  let novoMotivo = $state('');
  function addDiaSemCampo(data = novoDia, motivo = novoMotivo) {
    if (!data) return mostrarAviso('Escolha a data.');
    if (app.config.diasSemCampo.some((d) => d.data === data)) return mostrarAviso('Esse dia já está na lista.');
    app.config.diasSemCampo = [...app.config.diasSemCampo, { data, motivo: motivo.trim() || 'Dia sem campo' }].sort((a, b) =>
      a.data.localeCompare(b.data),
    );
    novoDia = '';
    novoMotivo = '';
    salvarConfig();
  }
  function tirarDiaSemCampo(data: string) {
    app.config.diasSemCampo = app.config.diasSemCampo.filter((d) => d.data !== data);
    salvarConfig();
  }
  /** Próxima ocorrência (este ano ou o próximo) de um feriado local sugerido. */
  const locaisSugeridos = $derived(
    FERIADOS_LOCAIS_SUGERIDOS.map((f) => {
      const data = `${anoAtual}-${f.mmdd}` >= hoje ? `${anoAtual}-${f.mmdd}` : `${anoAtual + 1}-${f.mmdd}`;
      return { data, motivo: f.motivo };
    }).filter((f) => !app.config.diasSemCampo.some((d) => d.data === f.data)),
  );
  const diasFuturos = $derived(app.config.diasSemCampo.filter((d) => d.data >= hoje));

  // ---- Apagar ----
  let confirmaApagar = $state('');
  let apagando = $state(false);
  let apagarFalhou = $state(false);
  async function apagarAparelho(mesmoAssim: boolean) {
    if (!mesmoAssim) {
      apagando = true;
      const r = await sincronizarAntesDeApagar();
      apagando = false;
      if (r === 'falhou') {
        apagarFalhou = true;
        return;
      }
    }
    await apagarTudo();
  }
  const bloqueios = lerBloqueios();
  async function mudarVersao(basica: boolean) {
    app.config.versaoBasica = basica || undefined;
    await salvarConfig();
    mostrarAviso(basica ? 'Versão básica ✓ Só o essencial na tela.' : 'Versão completa ✓ Todas as funções à mostra.');
  }
</script>

<h1>Ajustes</h1>

<button class="botao secundario largo como-usar" onclick={() => ir('como-usar')}>Como usar o app (passo a passo)</button>

{#if !EDICAO_BASICA}
<section class="cartao versao">
  <h2>Versão do app</h2>
  <label class="opcao-versao">
    <input type="radio" name="versao" checked={!!app.config.versaoBasica} onchange={() => mudarVersao(true)} />
    <span><strong>Básica</strong><br /><span class="suave pequeno">Só o essencial: meta, buscar, roteiro de hoje com as casas que faltam, VD com relato e fila do Fast.</span></span>
  </label>
  <label class="opcao-versao">
    <input type="radio" name="versao" checked={!app.config.versaoBasica} onchange={() => mudarVersao(false)} />
    <span><strong>Completa</strong><br /><span class="suave pequeno">Tudo: prioritários, casos, técnica, grupos, sincronização entre aparelhos, conferência com o Fast…</span></span>
  </label>
  <p class="suave pequeno">Trocar não apaga nada: só mostra ou esconde funções.</p>
</section>
{/if}

<section class="cartao">
  <h2>Minha área</h2>
  <p class="suave pequeno">
    {app.config.usandoExemplo ? 'Usando dados de exemplo (inventados).' : `${app.familias.length} famílias cadastradas.`}
  </p>
  <button class="botao secundario largo" onclick={() => ir('atualizar-cadastro')}>Atualizar cadastro pelo SBCD (sem apagar nada)</button>
  <button class="botao secundario largo" onclick={() => ir('importar')}>Importar minha área (CSV)</button>
  <button class="botao secundario largo" onclick={() => ir('importar-vds-texto')}>Trazer VDs já feitas (colar o texto do SBCD ou arquivo .txt)</button>
  {#if !app.config.versaoBasica}
    <button class="botao secundario largo" onclick={() => ir('importar-sv')}>Trazer do Sistema de Visitas (VDs, relatos, casos…)</button>
    <button class="botao secundario largo" onclick={() => ir('importar-grupos')}>Marcar grupos colando uma lista (hipertensos, diabéticos, acamados…)</button>
    <button class="botao secundario largo" onclick={() => ir('revisar-fichas')}>Atualizar fichas pelas VDs já feitas</button>
  {/if}
  <button class="botao secundario largo" onclick={() => ir('minhas-vds')}>Minhas VDs: relatório com nomes (dia a dia)</button>
  <button class="botao secundario largo" onclick={() => ir('exportar-visitas')}>Exportar minhas visitas (planilha)</button>
  <button class="botao secundario largo espaco-b" onclick={() => ir('lixeira')}>
    Lixeira ({app.lixeira.filter((i) => !i.restauradoEm).length})
  </button>
</section>

<!-- VD MAIS RÁPIDA -->
<section class="cartao">
  <h2>VD mais rápida</h2>
  <label class="opcao modo-rua">
    <input type="checkbox" checked={!!app.config.modoRua} onchange={(e) => { app.config.modoRua = (e.currentTarget as HTMLInputElement).checked; salvarConfig(); }} />
    <span><strong>Modo rua</strong>: letra maior e mais contraste, para ler no sol (também no botão “A+” lá em cima)</span>
  </label>
  <details>
    <summary><strong>Frases prontas</strong> <span class="suave pequeno">({(app.config.frasesProntas?.length ? app.config.frasesProntas : FRASES_PADRAO).length})</span></summary>
    <p class="suave pequeno">Aparecem como botões na VD: um toque escreve a frase. Uma por linha. O app também mostra as frases que você mais escreve.</p>
    <textarea rows="8" value={(app.config.frasesProntas?.length ? app.config.frasesProntas : FRASES_PADRAO).join('\n')} onchange={(e) => { const l = lerFrasesProprias((e.currentTarget as HTMLTextAreaElement).value); app.config.frasesProntas = l.length ? l : undefined; salvarConfig(); }}></textarea>
    <button class="link-simples" onclick={() => { app.config.frasesProntas = undefined; salvarConfig(); }}>Voltar às frases padrão</button>
  </details>
</section>

<!-- BACKUP -->
{#if !app.config.versaoBasica || app.sinc.estado !== 'desligada'}<Sincronizacao />{/if}

<section class="cartao" id="backup">
  <h2>Backup</h2>
  <p>
    Último backup:
    <strong>{app.config.ultimoBackup ? `${formatarData(app.config.ultimoBackup)} (${diasSemBackup === 0 ? 'hoje' : `há ${diasSemBackup} dia${diasSemBackup === 1 ? '' : 's'}`})` : 'nunca'}</strong>
  </p>
  <p class="suave pequeno">
    O backup é um arquivo com todos os seus dados, embaralhado com uma senha. Salve no Google Drive, mande para
    você mesmo no WhatsApp etc. <strong>Nunca mande a senha junto com o arquivo.</strong> Se esquecer a senha, o
    backup não abre.
  </p>
  <label class="campo"><span>Senha do backup</span><input type="password" bind:value={senhaB} autocomplete="new-password" /></label>
  <label class="campo"><span>Repita a senha</span><input type="password" bind:value={senhaB2} autocomplete="new-password" /></label>
  <p class="suave pequeno">Dica: use uma frase longa, com letras e números (ex.: uma frase só sua). Pode ser diferente do PIN.</p>
  <button class="botao largo" onclick={() => fazerBackup('baixar')} disabled={gerando}>{gerando ? 'Gerando…' : 'Fazer backup agora (salvar no celular)'}</button>
  <button class="botao secundario largo espaco-b" onclick={() => fazerBackup('compartilhar')} disabled={gerando}>Fazer backup e compartilhar (Drive…)</button>
  <p class="suave pequeno">“Salvar no celular” grava na pasta <strong>Downloads</strong> (abra pelo app <em>Arquivos</em>).</p>

  <details class="restaurar">
    <summary>Juntar com um backup (celular ↔ computador)</summary>
    <p class="suave pequeno">
      Soma o que está no backup com o que está aqui, <strong>sem apagar nada</strong>. VDs e famílias novas entram; se a
      mesma coisa mudou dos dois lados, fica a alteração mais recente; VD lançada num lado fica lançada nos dois.
      Seus ajustes e o PIN deste aparelho não mudam.
    </p>
    <label class="campo">
      <span>Arquivo do backup do outro aparelho</span>
      <input type="file" onchange={(e) => (arquivoJ = e.currentTarget.files?.[0] ?? null)} />
    </label>
    <label class="campo"><span>Senha do backup</span><input type="password" bind:value={senhaJ} autocomplete="off" /></label>
    <button class="botao largo" onclick={juntar} disabled={juntando}>{juntando ? 'Juntando…' : 'Juntar'}</button>
    {#if resultadoJ}<p class="ok">✓ {resultadoJ}.</p>{/if}
  </details>

  <details class="restaurar">
    <summary>Restaurar um backup (substitui tudo)</summary>
    <p class="alerta">Isso <strong>substitui todos os dados atuais</strong> pelos do backup.</p>
    <label class="campo">
      <span>Arquivo do backup</span>
      <input type="file" onchange={(e) => (arquivoR = e.currentTarget.files?.[0] ?? null)} />
    </label>
    <label class="campo"><span>Senha do backup</span><input type="password" bind:value={senhaR} autocomplete="off" /></label>
    <label class="opcao"><input type="checkbox" bind:checked={confirmaR} /> <span>Entendi que os dados atuais serão substituídos</span></label>
    <button class="botao secundario largo" onclick={restaurar} disabled={!confirmaR}>Restaurar</button>
  </details>
</section>

<!-- DADOS -->
<section class="cartao">
  <h2>Seus dados</h2>
  <label class="campo"><span>Seu nome</span><input type="text" bind:value={app.config.nomeAcs} /></label>
  <label class="campo"><span>Micro / equipe</span><input type="text" bind:value={app.config.micro} /></label>
  <label class="campo"><span>Meta de famílias por mês</span><input type="number" inputmode="numeric" min="1" bind:value={app.config.metaMensal} /></label>
  <label class="campo"><span>A receita de uso contínuo vale quantos meses</span><input type="number" inputmode="numeric" min="1" max="24" placeholder="6" bind:value={app.config.mesesReceita} /></label>
  <label class="campo">
    <span>Dias de descanso da casa (depois de uma VD ou tentativa, ela só volta ao roteiro depois disso)</span>
    <input type="number" inputmode="numeric" min="0" max="30" placeholder="5" bind:value={app.config.diasDescanso} />
  </label>
  <label class="campo">
    <span>Descanso dos casos graves (caso urgente, alta do hospital, acamado, oxigênio): voltam mais cedo</span>
    <input type="number" inputmode="numeric" min="0" max="30" placeholder="2" bind:value={app.config.diasDescansoGrave} />
  </label>
  <h3>Ruas da área</h3>
  <ul class="lista">
    {#each app.config.ruas as r, i (r)}
      <li class="rua"><span>{r}</span><button class="botao secundario pequeno" onclick={() => app.config.ruas.splice(i, 1)}>Tirar</button></li>
    {/each}
  </ul>
  <div class="nova-rua">
    <input type="text" bind:value={novaRua} placeholder="Nome da rua" onkeydown={(e) => e.key === 'Enter' && addRua()} />
    <button class="botao pequeno" onclick={addRua}>Adicionar</button>
  </div>
  <button class="botao largo salvar" onclick={salvar}>Salvar</button>
</section>

<!-- FAST -->
<section class="cartao">
  <h2>Fast</h2>
  <label class="opcao">
    <input type="checkbox" bind:checked={app.config.relatoNomeCompleto} onchange={salvarConfig} />
    <span>Relato com <strong>nome completo</strong> dos moradores<br /><span class="suave pequeno">Desligado: só o primeiro nome (“presentes Ana e João”).</span></span>
  </label>
  <label class="campo">
    <span>Endereço do Fast (para o botão “Abrir o Fast”)</span>
    <input type="url" inputmode="url" bind:value={app.config.urlFast} placeholder="https://…" autocomplete="off" onchange={salvarUrlFast} />
  </label>
  <p class="suave pequeno">O botão só abre o site no navegador. O app não envia nada para o Fast.</p>
</section>

<!-- CALENDÁRIO E META -->
<section class="cartao">
  <h2>Calendário e meta</h2>
  <label class="campo">
    <span>Reunião de equipe (para o lembrete dos casos)</span>
    <select bind:value={app.config.diaReuniao} onchange={salvarConfig}>
      {#each ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'] as nome, i (i)}
        <option value={i}>toda {nome}</option>
      {/each}
      <option value={-1}>sem reunião fixa</option>
    </select>
  </label>
  <label class="campo">
    <span>A meta da unidade fecha</span>
    <select bind:value={app.config.diaInicioPeriodo} onchange={salvarConfig}>
      <option value={0}>no último dia útil do mês</option>
      <option value={1}>no último dia do mês (do dia 1 ao último dia)</option>
      {#each Array.from({ length: 27 }, (_, i) => i + 2) as d (d)}
        <option value={d}>do dia {d} ao dia {d - 1} do mês seguinte</option>
      {/each}
    </select>
  </label>

  <details>
    <summary>Feriados nacionais de {anoAtual} ({feriados.length})</summary>
    <p class="suave pequeno">Não contam como dia de campo. Se você trabalha num deles, marque “trabalho”.</p>
    <ul class="lista">
      {#each feriados as f (f.data)}
        {@const trabalho = app.config.feriadosIgnorados.includes(f.data)}
        <li class="feriado">
          <span><strong>{formatarData(f.data)}</strong> · {f.motivo}</span>
          <label class="trabalho"><input type="checkbox" checked={trabalho} onchange={(e) => alternarFeriado(f.data, e.currentTarget.checked)} /> trabalho</label>
        </li>
      {/each}
    </ul>
  </details>

  <h3 class="sub">Meus dias sem campo</h3>
  <p class="suave pequeno">Folga, férias, capacitação, reunião o dia todo, feriado da cidade…</p>
  {#if diasFuturos.length}
    <ul class="lista">
      {#each diasFuturos as d (d.data)}
        <li class="feriado">
          <span><strong>{formatarDataLonga(d.data, true)}</strong><br /><span class="suave pequeno">{d.motivo}</span></span>
          <button class="botao secundario pequeno" onclick={() => tirarDiaSemCampo(d.data)}>Tirar</button>
        </li>
      {/each}
    </ul>
  {/if}
  <div class="dupla">
    <label class="campo"><span>Data</span><input type="date" bind:value={novoDia} min={hoje} /></label>
    <label class="campo"><span>Motivo</span><input type="text" bind:value={novoMotivo} placeholder="Ex.: férias" /></label>
  </div>
  <button class="botao secundario largo" onclick={() => addDiaSemCampo()}>Adicionar dia sem campo</button>
  {#if locaisSugeridos.length}
    <div class="chips-locais">
      {#each locaisSugeridos as f (f.data)}
        <button class="botao secundario pequeno" onclick={() => addDiaSemCampo(f.data, f.motivo)}>+ {f.motivo} ({formatarData(f.data)})</button>
      {/each}
    </div>
  {/if}
</section>

<!-- SEGURANÇA -->
<section class="cartao">
  <h2>Bloqueio automático</h2>
  <label class="campo">
    <span>Trancar depois de ficar parado no app por</span>
    <select bind:value={app.config.minutosParado} onchange={salvarConfig}>
      {#each [1, 2, 3, 5, 10, 15, 20, 30] as m (m)}<option value={m}>{m} minuto{m > 1 ? 's' : ''}</option>{/each}
    </select>
  </label>
  <label class="campo">
    <span>Trancar ao sair do app (outro app ou tela apagada) por mais de</span>
    <select bind:value={app.config.minutosFora} onchange={salvarConfig}>
      <option value={0}>na hora (mais seguro)</option>
      {#each [1, 2, 3, 5, 10, 15] as m (m)}<option value={m}>{m} minuto{m > 1 ? 's' : ''}</option>{/each}
    </select>
  </label>
  <p class="suave pequeno">
    Digitar e ditar por voz contam como uso (o app não tranca no meio do relato). Tempo maior é mais prático na rua,
    mas deixa o app aberto por mais tempo se o celular ficar largado.
  </p>
  <details class="bloqueios">
    <summary>Por que o app trancou (últimas vezes)</summary>
    {#if bloqueios.length}
      <ul class="pequeno">
        {#each bloqueios as b, i (i)}<li><strong>{quandoFoi(b.em)}</strong> · {textoDoBloqueio(b, app.config)}</li>{/each}
      </ul>
    {:else}
      <p class="suave pequeno">Nenhum bloqueio guardado ainda.</p>
    {/if}
    <p class="suave pequeno">
      Se aparecer muito “o app foi fechado”, é o Android fechando o app para economizar bateria. Para evitar: no
      celular, abra <strong>Configurações → Apps → Chrome → Bateria</strong> e escolha <strong>Sem restrições</strong>
      (os nomes podem mudar um pouco conforme o celular).
    </p>
  </details>
</section>

<section class="cartao">
  <details>
    <summary>Trocar o PIN</summary>
    <label class="campo"><span>PIN atual</span><input type="password" inputmode="numeric" bind:value={pinAtual} autocomplete="off" /></label>
    <label class="campo"><span>PIN novo (6 números ou mais)</span><input type="password" inputmode="numeric" bind:value={pinNovo} autocomplete="off" /></label>
    <label class="campo"><span>Repita o PIN novo</span><input type="password" inputmode="numeric" bind:value={pinNovo2} autocomplete="off" /></label>
    <button class="botao largo" onclick={mudarPin} disabled={trocando}>{trocando ? 'Trocando…' : 'Trocar PIN'}</button>
  </details>
</section>

<!-- NOMES DO FAST -->
<section class="cartao">
  <details>
    <summary>Nomes iguais aos do Fast</summary>
    <p class="suave pequeno">Ajuste para ficar igual ao Fast da sua unidade.</p>
    <h3>Desfechos</h3>
    {#each ordem as d (d)}
      <label class="campo"><span class="suave pequeno">{d === 'realizada' ? 'Todos/conversou' : d === 'ausente_realizada' ? 'Só alguns em casa' : d === 'ausencia_completa' ? 'Ninguém em casa' : 'Não quis receber'}</span>
        <input type="text" bind:value={app.config.nomesDesfecho[d]} /></label>
    {/each}
    <h3>Motivos (um por linha)</h3>
    <textarea rows="6" bind:value={motivosTexto}></textarea>
    <label class="campo motivo-padrao">
      <span>Motivo que já vem marcado</span>
      <select bind:value={app.config.motivoPadrao}>
        {#each motivosTexto.split('\n').map((m) => m.trim()).filter(Boolean) as m (m)}<option value={m}>{m}</option>{/each}
      </select>
    </label>
    <button class="botao largo" onclick={salvarNomes}>Salvar nomes</button>
  </details>
</section>

<!-- ARMAZENAMENTO -->
<section class="cartao">
  <h2>Proteção dos dados no celular</h2>
  {#if app.armazenamentoPersistente}
    <p class="ok">✓ O navegador prometeu não apagar os dados sozinho.</p>
  {:else}
    <p class="alerta">O navegador ainda pode apagar os dados se o celular ficar sem espaço ou (no iPhone) se o app ficar dias sem uso.</p>
    <p class="pequeno">
      <strong>Instale o app na tela inicial:</strong><br />
      Android (Chrome): menu ⋮ → <em>Instalar app</em> ou <em>Adicionar à tela inicial</em>.<br />
      iPhone (Safari): botão Compartilhar → <em>Adicionar à Tela de Início</em>.
    </p>
    <button class="botao secundario largo" onclick={pedirPersistencia}>Pedir proteção de novo</button>
  {/if}
  <p class="suave pequeno">Mesmo assim, faça backup toda semana.</p>
</section>

<!-- APAGAR -->
<section class="cartao perigo-zona">
  <details>
    <summary>Apagar tudo deste aparelho (ex.: devolver o tablet)</summary>
    <p>Apaga deste aparelho todos os dados, o PIN e a conexão da sincronização. <strong>Não tem volta</strong> aqui.</p>
    {#if app.sinc.estado === 'desligada'}
      <p class="alerta">A sincronização está desligada neste aparelho: o que estiver só aqui se perde. Faça um backup antes (acima).</p>
    {:else}
      <p class="suave pequeno">Antes de apagar, o app manda tudo para a nuvem e confere. Os seus outros aparelhos continuam com tudo.</p>
    {/if}
    {#if app.rascunho}<p class="alerta">Tem uma VD pela metade: termine ou descarte antes (ela não vai para a nuvem).</p>{/if}
    <label class="campo"><span>Digite APAGAR para confirmar</span><input type="text" bind:value={confirmaApagar} autocapitalize="characters" /></label>
    {#if apagarFalhou}
      <p class="alerta">Não consegui mandar tudo para a nuvem ({app.sinc.mensagem || 'sem internet?'}). <strong>Nada foi apagado.</strong> Conecte na internet e tente de novo.</p>
      <button class="botao secundario largo" disabled={apagando} onclick={() => apagarAparelho(false)}>Tentar de novo</button>
      <button class="botao perigo largo" disabled={apagando || confirmaApagar.trim().toUpperCase() !== 'APAGAR'} onclick={() => apagarAparelho(true)}>Apagar mesmo assim (perde o que só está aqui)</button>
    {:else}
      <button class="botao perigo largo" disabled={apagando || confirmaApagar.trim().toUpperCase() !== 'APAGAR'} onclick={() => apagarAparelho(false)}>
        {apagando ? 'Sincronizando…' : app.sinc.estado === 'desligada' ? 'Apagar tudo' : 'Sincronizar e apagar'}
      </button>
    {/if}
    <p class="suave pequeno">Depois, para usar de novo neste aparelho: abra o app e conecte a sincronização (ou restaure um backup).</p>
  </details>
</section>

<p class="suave pequeno centro versao">Versão do app: {__VERSAO__}</p>

<style>
  .versao {
    border-left: 6px solid var(--primaria);
  }
  .opcao-versao {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    margin: 8px 0;
  }
  .opcao-versao input {
    width: 22px;
    height: 22px;
    flex: 0 0 auto;
    margin-top: 2px;
  }
  .como-usar {
    margin-bottom: 14px;
  }
  .espaco-b {
    margin-top: 8px;
  }
  .restaurar {
    margin-top: 16px;
  }
  .rua {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    padding: 6px 0;
    border-bottom: 1px solid var(--borda);
  }
  .nova-rua {
    display: flex;
    gap: 8px;
    margin-top: 10px;
  }
  .salvar {
    margin-top: 14px;
  }
  .opcao {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 52px;
    margin-bottom: 8px;
  }
  .opcao input {
    width: 26px;
    height: 26px;
    flex: 0 0 26px;
    accent-color: var(--primaria);
  }
  .motivo-padrao {
    margin-top: 12px;
  }
  .ok {
    color: var(--realizada);
    font-weight: 700;
  }
  .feriado {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    padding: 8px 0;
    border-bottom: 1px solid var(--borda);
  }
  .trabalho {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
    font-size: 0.9rem;
    white-space: nowrap;
  }
  .trabalho input {
    width: 22px;
    height: 22px;
    accent-color: var(--primaria);
  }
  .sub {
    margin-top: 16px;
  }
  .dupla {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0 10px;
    margin-top: 8px;
  }
  .chips-locais {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 10px;
  }
  .perigo-zona summary {
    color: var(--perigo);
  }
</style>
