// Monta os textos do histórico ("o que mudou"), comparando antes e depois.
import { formatarData } from './datas';
import { novoId } from './ids';
import { NOMES_GRUPO, NOMES_SITUACAO_CASA, NOMES_SITUACAO_MORADOR } from './rotulos';
import type { Alteracao, Familia, Morador, Visita } from './tipos';

const vazio = (t: string) => (t.trim() ? t.trim() : '(vazio)');
const sexoTxt = (s: string) => (s === 'F' ? 'Feminino' : s === 'M' ? 'Masculino' : '(vazio)');
const dataTxt = (d: string) => (d ? formatarData(d) : '(vazio)');

export function enderecoTexto(f: Pick<Familia, 'rua' | 'numero' | 'complemento'>): string {
  return `${f.rua}, ${f.numero}${f.complemento ? ` – ${f.complemento}` : ''}`;
}

export function mudancasFamilia(antes: Familia | null, depois: Familia): string[] {
  if (!antes) return [`Família cadastrada: ${enderecoTexto(depois)}`];
  const m: string[] = [];
  const campo = (rotulo: string, a: string, d: string) => {
    if (a.trim() !== d.trim()) m.push(`${rotulo}: ${vazio(a)} → ${vazio(d)}`);
  };
  campo('Rua', antes.rua, depois.rua);
  campo('Número', antes.numero, depois.numero);
  campo('Complemento', antes.complemento, depois.complemento);
  campo('Bairro', antes.bairro, depois.bairro);
  campo('Colmeia', antes.colmeia, depois.colmeia);
  campo('Prontuário', antes.prontuario, depois.prontuario);
  if (antes.situacaoCasa !== depois.situacaoCasa) {
    m.push(`Situação da casa: ${NOMES_SITUACAO_CASA[antes.situacaoCasa]} → ${NOMES_SITUACAO_CASA[depois.situacaoCasa]}`);
  }
  campo('Observações', antes.obs, depois.obs);
  if (antes.responsavelId !== depois.responsavelId) {
    const nome = (id: string) => depois.moradores.find((x) => x.id === id)?.nome ?? '(ninguém)';
    m.push(`Responsável: ${nome(antes.responsavelId)} → ${nome(depois.responsavelId)}`);
  }
  return m;
}

export function mudancasMorador(antes: Morador | null, depois: Morador): string[] {
  const quem = depois.nome;
  if (!antes) {
    const desde = depois.situacaoDesde ? ` (desde ${formatarData(depois.situacaoDesde)})` : '';
    return [`${quem}: morador incluído${desde}`];
  }
  const m: string[] = [];
  if (antes.nome.trim() !== depois.nome.trim()) m.push(`Nome: ${antes.nome} → ${depois.nome}`);
  if (antes.sexo !== depois.sexo) m.push(`${quem}: sexo ${sexoTxt(antes.sexo)} → ${sexoTxt(depois.sexo)}`);
  if (antes.nascimento !== depois.nascimento) {
    m.push(`${quem}: nascimento ${dataTxt(antes.nascimento)} → ${dataTxt(depois.nascimento)}`);
  }
  if (antes.situacao !== depois.situacao) {
    const desde = depois.situacaoDesde ? ` (desde ${formatarData(depois.situacaoDesde)})` : '';
    m.push(`${quem}: ${NOMES_SITUACAO_MORADOR[antes.situacao]} → ${NOMES_SITUACAO_MORADOR[depois.situacao]}${desde}`);
  } else if (antes.situacaoDesde !== depois.situacaoDesde) {
    m.push(`${quem}: data da situação ${dataTxt(antes.situacaoDesde)} → ${dataTxt(depois.situacaoDesde)}`);
  }
  const entrou = depois.grupos.filter((g) => !antes.grupos.includes(g));
  const saiu = antes.grupos.filter((g) => !depois.grupos.includes(g));
  if (entrou.length) m.push(`${quem}: incluído em ${entrou.map((g) => NOMES_GRUPO[g]).join(', ')}`);
  if (saiu.length) m.push(`${quem}: retirado de ${saiu.map((g) => NOMES_GRUPO[g]).join(', ')}`);
  if (antes.obs.trim() !== depois.obs.trim()) m.push(`${quem}: observações ${vazio(antes.obs)} → ${vazio(depois.obs)}`);
  return m;
}

export function criarAlteracoes(familiaId: string, textos: string[], moradorId?: string, quando = new Date()): Alteracao[] {
  return textos.map((texto) => ({ id: novoId('h'), quando: quando.toISOString(), familiaId, moradorId, texto }));
}

/** O que mudou numa VD corrigida. `nome` dá o nome de cada morador pelo id. */
export function mudancasVisita(
  antes: Visita,
  depois: Visita,
  nome: (id: string) => string,
  nomeDesfecho: (d: Visita['desfecho']) => string,
): string[] {
  const m: string[] = [];
  if (antes.data !== depois.data) m.push(`data ${formatarData(antes.data)} → ${formatarData(depois.data)}`);
  if (antes.desfecho !== depois.desfecho) m.push(`desfecho ${nomeDesfecho(antes.desfecho)} → ${nomeDesfecho(depois.desfecho)}`);
  const entrou = depois.presentes.filter((p) => !antes.presentes.includes(p)).map(nome);
  const saiu = antes.presentes.filter((p) => !depois.presentes.includes(p)).map(nome);
  if (entrou.length) m.push(`presentes + ${entrou.join(', ')}`);
  if (saiu.length) m.push(`presentes − ${saiu.join(', ')}`);
  if (antes.motivo !== depois.motivo) m.push(`motivo ${antes.motivo} → ${depois.motivo}`);
  if (antes.compartilhadaCom.trim() !== depois.compartilhadaCom.trim()) {
    m.push(`compartilhada ${vazio(antes.compartilhadaCom)} → ${vazio(depois.compartilhadaCom)}`);
  }
  if (antes.orientacoes.trim() !== depois.orientacoes.trim()) m.push('orientações alteradas');
  if (JSON.stringify(antes.sinais) !== JSON.stringify(depois.sinais)) m.push('sinais vitais alterados');
  if (antes.relato.trim() !== depois.relato.trim()) m.push('relato alterado');
  return m.length ? [`VD de ${formatarData(antes.data)} corrigida: ${m.join('; ')}`] : [];
}
