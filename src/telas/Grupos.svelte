<script lang="ts">
  import Icone from '../componentes/Icone.svelte';
  import { criancas } from '../lib/bloco4';
  import { formatarData, hojeISO } from '../lib/datas';
  import { app, contextoAcompanhamento, enderecoCurto, mostrarAviso, salvarMorador } from '../lib/estado.svelte';
  import { ABAS, CONSULTAS_MINIMAS, DIAS_SEM_VD, listaDoGrupo, listaPreNatal, PRENATAL_VAZIO, totais, type AbaGrupo } from '../lib/grupos';
  import { ir, rota, trocarPara, voltar } from '../lib/rotas.svelte';
  import type { Morador, PreNatal } from '../lib/tipos';

  const hoje = hojeISO();
  const aba = $derived<AbaGrupo>(ABAS.some((a) => a.id === rota.id) ? (rota.id as AbaGrupo) : 'prenatal');
  const ctx = $derived(contextoAcompanhamento());
  const prenatal = $derived(listaPreNatal(app.familias, ctx));
  const tot = $derived({
    criancas: totais('criancas', app.familias, ctx),
    idosos: totais('idosos', app.familias, ctx),
    hipertensos: totais('hipertensos', app.familias, ctx),
    diabeticos: totais('diabeticos', app.familias, ctx),
    acamados: totais('acamados', app.familias, ctx),
  });
  const lista = $derived(aba === 'prenatal' ? [] : listaDoGrupo(aba, app.familias, ctx));
  // Caderneta das crianças até 5 anos (o que já existia na tela de crianças).
  const cadernetas = $derived(new Map(criancas(app.familias, hoje).map((c) => [c.morador.id, c])));
  let ocupado = $state(false);

  const numeroDaAba = (id: AbaGrupo) => {
    if (id === 'prenatal') return { total: prenatal.length, avisos: prenatal.filter((g) => g.alerta || g.falta.length).length };
    return tot[id];
  };

  async function salvar(familiaId: string, m: Morador, mudar: Partial<Morador>, aviso: string) {
    if (ocupado) return;
    ocupado = true;
    try {
      await salvarMorador(familiaId, { ...($state.snapshot(m) as Morador), ...mudar });
      mostrarAviso(aviso);
    } finally {
      ocupado = false;
    }
  }
  const mudarPreNatal = (familiaId: string, m: Morador, mudar: Partial<PreNatal>) =>
    salvar(familiaId, m, { prenatal: { ...PRENATAL_VAZIO, ...(m.prenatal ?? {}), ...mudar } }, 'Pré-natal atualizado ✓');
  const naoEstaGravida = (familiaId: string, m: Morador) =>
    salvar(familiaId, m, { grupos: m.grupos.filter((g) => g !== 'gestante'), dpp: undefined }, 'Tirada do pré-natal ✓');
  const virouPuerpera = (familiaId: string, m: Morador) =>
    salvar(familiaId, m, { grupos: [...new Set([...m.grupos.filter((g) => g !== 'gestante'), 'puerpera' as const])] }, 'Marcada como puérpera ✓');

  const dicas: Record<AbaGrupo, string> = {
    prenatal: 'Quem está marcada como gestante. Marque o que já foi feito no pré-natal; a DPP (data provável do parto) pode ser anotada aqui ou o app estima pelo que você escreveu.',
    criancas: 'Crianças até 11 anos por faixa de idade. Até 5 anos o app lembra a caderneta de vacinas. Quem está há mais tempo sem VD vem primeiro.',
    idosos: 'Todos com 60 anos ou mais (pela data de nascimento). Quem está há mais tempo sem VD vem primeiro.',
    hipertensos: 'Quem está marcado como hipertenso. Avisa P.A. alta, sem P.A. há mais de 60 dias e receita vencendo.',
    diabeticos: 'Quem está marcado como diabético. Avisa glicemia alta ou baixa, sem glicemia há mais de 60 dias e receita vencendo.',
    acamados: 'Quem está marcado como acamado. Avisa quando passa de 15 dias sem VD.',
  };
</script>

<button class="botao secundario pequeno voltar" onclick={() => voltar('')}><Icone nome="voltar" /> Voltar</button>

<h1>Grupos</h1>

<div class="chips" role="tablist">
  {#each ABAS as a (a.id)}
    {@const n = numeroDaAba(a.id)}
    <button class="chip" class:ativo={aba === a.id} role="tab" aria-selected={aba === a.id} onclick={() => trocarPara(`grupos/${a.id}`)}>
      <span>{a.nome}</span>
      <span class="num">{n.total}{n.avisos ? ` · ${n.avisos} ⚠` : ''}</span>
    </button>
  {/each}
</div>

<p class="suave pequeno">{dicas[aba]}</p>

{#if aba === 'prenatal'}
  {#if !prenatal.length}<p class="cartao suave">Nenhuma gestante marcada.</p>{/if}
  <ul class="lista">
    {#each prenatal as g (g.morador.id)}
      <li class="cartao item" class:alerta-item={!!g.alerta || g.falta.length > 0}>
        <button class="quem" onclick={() => ir(`pessoa/${g.familia.id}/${g.morador.id}`)}><strong>{g.morador.nome}</strong><span class="suave pequeno">{enderecoCurto(g.familia)}</span></button>
        {#if g.dpp}
          <p>DPP <strong>{formatarData(g.dpp)}</strong>{g.semanas !== null && g.semanas > 0 && g.semanas <= 42 ? ` · ${g.semanas} semanas` : ''}{g.deOnde === 'estimada' ? ' (estimada pelo que você escreveu)' : ''}</p>
        {/if}
        <p class="pequeno suave">{g.ultimaVd ? `Última VD: ${formatarData(g.ultimaVd)} (há ${g.diasSemVd} dias)` : 'Sem VD registrada'}</p>
        {#if g.alerta}<p class="aviso">⚠ {g.alerta}</p>{/if}
        <div class="acoes-gestante">
          <span class="pequeno"><strong>Ainda está grávida?</strong></span>
          <button class="botao pequeno" disabled={ocupado} onclick={() => virouPuerpera(g.familia.id, g.morador)}>Já ganhou: marcar puérpera</button>
          <button class="botao secundario pequeno" disabled={ocupado} onclick={() => naoEstaGravida(g.familia.id, g.morador)}>Não está grávida: tirar daqui</button>
        </div>
        <label class="campo dpp">
          <span class="pequeno">Anotar a DPP</span>
          <input type="date" value={g.morador.dpp ?? ''} onchange={(e) => salvar(g.familia.id, g.morador, { dpp: (e.currentTarget as HTMLInputElement).value || undefined }, 'DPP anotada ✓')} />
        </label>

        {#if !(g.dpp && g.dpp <= hoje)}
        <div class="checklist">
          <strong class="pequeno">Pré-natal</strong>
          <div class="consultas">
            <span>Consultas: <strong>{g.prenatal.consultas}</strong> de {CONSULTAS_MINIMAS}</span>
            <button class="botao secundario pequeno" disabled={ocupado || g.prenatal.consultas <= 0} aria-label="Tirar uma consulta" onclick={() => mudarPreNatal(g.familia.id, g.morador, { consultas: Math.max(0, g.prenatal.consultas - 1) })}>−</button>
            <button class="botao secundario pequeno" disabled={ocupado} aria-label="Somar uma consulta" onclick={() => mudarPreNatal(g.familia.id, g.morador, { consultas: g.prenatal.consultas + 1 })}>+</button>
          </div>
          <label class="marca"><input type="checkbox" checked={!!g.prenatal.exames} disabled={ocupado} onchange={(e) => mudarPreNatal(g.familia.id, g.morador, { exames: (e.currentTarget as HTMLInputElement).checked })} /> Exames do pré-natal feitos</label>
          <label class="marca"><input type="checkbox" checked={!!g.prenatal.testeRapido} disabled={ocupado} onchange={(e) => mudarPreNatal(g.familia.id, g.morador, { testeRapido: (e.currentTarget as HTMLInputElement).checked })} /> Testes rápidos (HIV, sífilis, hepatites)</label>
          <label class="marca"><input type="checkbox" checked={!!g.prenatal.dtpa} disabled={ocupado} onchange={(e) => mudarPreNatal(g.familia.id, g.morador, { dtpa: (e.currentTarget as HTMLInputElement).checked })} /> Vacina dTpa</label>
          <label class="marca"><input type="checkbox" checked={!!g.prenatal.odonto} disabled={ocupado} onchange={(e) => mudarPreNatal(g.familia.id, g.morador, { odonto: (e.currentTarget as HTMLInputElement).checked })} /> Consulta odontológica</label>
          {#if g.falta.length}<p class="pequeno falta">Falta: {g.falta.join(' · ')}</p>{:else}<p class="pequeno ok">Pré-natal em dia ✓</p>{/if}
        </div>
        {/if}
      </li>
    {/each}
  </ul>
{:else}
  {#if !lista.length}<p class="cartao suave">Ninguém nesse grupo ainda.</p>{/if}
  {#each lista as g (g.faixa.id)}
    <h2 class="faixa">{g.faixa.nome} <span class="suave pequeno">({g.pessoas.length})</span></h2>
    <ul class="lista">
      {#each g.pessoas as p (p.morador.id)}
        {@const c = cadernetas.get(p.morador.id)}
        <li class="cartao item" class:alerta-item={p.alertas.length > 0}>
          <button class="quem" onclick={() => ir(`pessoa/${p.familia.id}/${p.morador.id}`)}>
            <strong>{p.morador.nome}</strong>
            <span class="suave pequeno">{p.anos === null ? 'sem data de nascimento' : p.anos === 0 ? 'menos de 1 ano' : p.anos === 1 ? '1 ano' : `${p.anos} anos`} · {enderecoCurto(p.familia)}</span>
          </button>
          <p class="pequeno" class:atrasada={p.diasSemVd === null || p.diasSemVd >= DIAS_SEM_VD[aba]}>
            {p.ultimaVd ? `Última VD: ${formatarData(p.ultimaVd)} (há ${p.diasSemVd} dias)` : 'Sem VD registrada'}
          </p>
          {#if p.pa || p.glicemia}
            <p class="pequeno">
              {#if p.pa}P.A. <strong>{p.pa.valor}</strong> ({formatarData(p.pa.data).slice(0, 5)}){/if}{#if p.pa && p.glicemia} · {/if}{#if p.glicemia}Glicemia <strong>{p.glicemia.valor}</strong> ({formatarData(p.glicemia.data).slice(0, 5)}){/if}
            </p>
          {/if}
          {#if p.alertas.some((x) => !x.startsWith('Sem VD'))}
            <p class="avisos">{#each p.alertas.filter((x) => !x.startsWith('Sem VD')) as a (a)}<span class="selo">⚠ {a}</span>{/each}</p>
          {/if}
          {#if aba === 'criancas' && c}
            {#if c.conferir}<p class="aviso">⚠ Conferir a caderneta: {c.conferir.texto} (completou em {formatarData(c.conferir.dia)})</p>{/if}
            {#if c.proximo}<p class="pequeno">Próximo: {c.proximo.texto} em <strong>{formatarData(c.proximo.dia)}</strong></p>{/if}
            {#if p.morador.cadernetaEm}<p class="suave pequeno">Caderneta conferida em {formatarData(p.morador.cadernetaEm)}</p>{/if}
            {#if c.conferir}
              <button class="botao pequeno" disabled={ocupado} onclick={() => salvar(p.familia.id, p.morador, { cadernetaEm: hoje }, 'Caderneta conferida ✓')}>✓ Conferi a caderneta</button>
            {/if}
          {/if}
        </li>
      {/each}
    </ul>
  {/each}
{/if}

<style>
  .voltar {
    margin-bottom: 12px;
  }
  .chips {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin: 8px 0;
  }
  .chip {
    min-height: 56px;
    padding: 6px 4px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    line-height: 1.2;
    font-size: 0.95rem;
    border-radius: 14px;
    border: 2px solid var(--borda);
    background: var(--cartao);
    color: var(--texto);
    font-weight: 700;
    cursor: pointer;
  }
  .num {
    font-size: 0.8rem;
    font-weight: 600;
    opacity: 0.85;
  }
  .chip.ativo {
    border-color: var(--primaria);
    background: var(--primaria-clara);
  }
  .faixa {
    margin: 18px 0 8px;
    font-size: 1.05rem;
  }
  .lista {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .item {
    margin: 0;
    border-left: 6px solid var(--borda);
  }
  .item p {
    margin: 4px 0;
  }
  .alerta-item {
    border-left-color: var(--ausencia);
  }
  .atrasada {
    color: var(--aviso-texto);
    font-weight: 700;
  }
  .aviso {
    color: var(--aviso-texto);
    background: var(--aviso-fundo);
    padding: 4px 8px;
    border-radius: 8px;
  }
  .avisos {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .selo {
    color: var(--aviso-texto);
    background: var(--aviso-fundo);
    padding: 2px 8px;
    border-radius: 999px;
    font-size: 0.85rem;
    font-weight: 700;
  }
  .quem {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    background: none;
    border: 0;
    padding: 0;
    text-align: left;
    color: var(--texto);
    font: inherit;
    cursor: pointer;
  }
  .dpp {
    margin: 6px 0;
  }
  .acoes-gestante {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 8px 0;
  }
  .checklist {
    margin: 10px 0;
    padding: 8px 10px;
    border: 1px solid var(--borda);
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .consultas {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .consultas span {
    flex: 1;
  }
  .marca {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 36px;
  }
  .marca input {
    width: 22px;
    height: 22px;
  }
  .falta {
    color: var(--aviso-texto);
  }
  .ok {
    color: var(--ok, var(--texto));
    font-weight: 700;
  }
</style>
