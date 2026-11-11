<script lang="ts">
  import Icone from '../componentes/Icone.svelte';
  import { criancas, gestantes } from '../lib/bloco4';
  import { formatarData, hojeISO } from '../lib/datas';
  import { idadeTexto } from '../lib/dados-ficticios';
  import { app, enderecoCurto, mostrarAviso, salvarMorador } from '../lib/estado.svelte';
  import type { Morador } from '../lib/tipos';
  import { ir, voltar } from '../lib/rotas.svelte';

  const hoje = hojeISO();
  let aba = $state<'gestantes' | 'criancas'>('gestantes');
  const gs = $derived(gestantes(app.familias, app.visitas, hoje));
  const cs = $derived(criancas(app.familias, hoje));
  const alertasG = $derived(gs.filter((g) => g.alerta).length);
  const alertasC = $derived(cs.filter((c) => c.conferir).length);
  let ocupado = $state(false);

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
  const virouPuerpera = (familiaId: string, m: Morador) =>
    salvar(familiaId, m, { grupos: [...new Set([...m.grupos.filter((g) => g !== 'gestante'), 'puerpera' as const])] }, 'Marcada como puérpera ✓');
</script>

<button class="botao secundario pequeno voltar" onclick={() => voltar('')}><Icone nome="voltar" /> Voltar</button>

<h1>Gestantes e crianças</h1>

<div class="chips" role="tablist">
  <button class="chip" class:ativo={aba === 'gestantes'} role="tab" aria-selected={aba === 'gestantes'} onclick={() => (aba = 'gestantes')}>Gestantes {gs.length}{alertasG ? ` · ${alertasG} ⚠` : ''}</button>
  <button class="chip" class:ativo={aba === 'criancas'} role="tab" aria-selected={aba === 'criancas'} onclick={() => (aba = 'criancas')}>Crianças até 5 anos {cs.length}{alertasC ? ` · ${alertasC} ⚠` : ''}</button>
</div>

{#if aba === 'gestantes'}
  <p class="suave pequeno">Quem está marcada como gestante. A DPP (data provável do parto) pode ser anotada aqui, ou o app estima pelo que você escreveu (“DPP 20/03”, “28 semanas”).</p>
  {#if !gs.length}<p class="cartao suave">Nenhuma gestante marcada.</p>{/if}
  <ul class="lista">
    {#each gs as g (g.morador.id)}
      <li class="cartao item" class:alerta-item={!!g.alerta}>
        <button class="quem" onclick={() => ir(`pessoa/${g.familia.id}/${g.morador.id}`)}><strong>{g.morador.nome}</strong><span class="suave pequeno">{enderecoCurto(g.familia)}</span></button>
        {#if g.dpp}
          <p>DPP <strong>{formatarData(g.dpp)}</strong>{g.semanas !== null && g.semanas > 0 && g.semanas <= 42 ? ` · ${g.semanas} semanas` : ''}{g.deOnde === 'estimada' ? ' (estimada pelo que você escreveu)' : ''}</p>
        {/if}
        {#if g.alerta}<p class="aviso">⚠ {g.alerta}</p>{/if}
        <label class="campo dpp">
          <span class="pequeno">Anotar a DPP</span>
          <input type="date" value={g.morador.dpp ?? ''} onchange={(e) => salvar(g.familia.id, g.morador, { dpp: (e.currentTarget as HTMLInputElement).value || undefined }, 'DPP anotada ✓')} />
        </label>
        {#if g.dpp && g.dpp <= hoje}
          <button class="botao pequeno" disabled={ocupado} onclick={() => virouPuerpera(g.familia.id, g.morador)}>Já ganhou: marcar puérpera</button>
        {/if}
      </li>
    {/each}
  </ul>
{:else}
  <p class="suave pequeno">O app lembra das vacinas e consultas pela idade. Na VD, peça a caderneta e toque em “Conferi a caderneta”.</p>
  {#if !cs.length}<p class="cartao suave">Nenhuma criança até 5 anos com data de nascimento.</p>{/if}
  <ul class="lista">
    {#each cs as c (c.morador.id)}
      <li class="cartao item" class:alerta-item={!!c.conferir}>
        <button class="quem" onclick={() => ir(`pessoa/${c.familia.id}/${c.morador.id}`)}><strong>{c.morador.nome}</strong><span class="suave pequeno">{idadeTexto(c.morador, hoje)} · {enderecoCurto(c.familia)}</span></button>
        {#if c.conferir}<p class="aviso">⚠ Conferir a caderneta: {c.conferir.texto} (completou em {formatarData(c.conferir.dia)})</p>{/if}
        {#if c.proximo}<p class="pequeno">Próximo: {c.proximo.texto} em <strong>{formatarData(c.proximo.dia)}</strong></p>{/if}
        {#if c.morador.cadernetaEm}<p class="suave pequeno">Caderneta conferida em {formatarData(c.morador.cadernetaEm)}</p>{/if}
        {#if c.conferir}
          <button class="botao pequeno" disabled={ocupado} onclick={() => salvar(c.familia.id, c.morador, { cadernetaEm: hoje }, 'Caderneta conferida ✓')}>✓ Conferi a caderneta</button>
        {/if}
      </li>
    {/each}
  </ul>
{/if}

<style>
  .voltar {
    margin-bottom: 12px;
  }
  .chips {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin: 8px 0;
  }
  .chip {
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
  .aviso {
    color: var(--aviso-texto);
    background: var(--aviso-fundo);
    padding: 4px 8px;
    border-radius: 8px;
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
</style>
