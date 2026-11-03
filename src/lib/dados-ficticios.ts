// DADOS 100% FICTÍCIOS, gerados por sorteio, só para o protótipo.
// Ruas, nomes, datas e prontuários são inventados. Nenhum dado real.

import { ehDiaUtil, idade, mesDe, paraISO, somarDias, deISO } from './datas';
import { sugerirDesfecho } from './desfecho';
import { gerarRelato } from './relato';
import type { Desfecho, Familia, Grupo, Morador, SituacaoCasa, Visita } from './tipos';

/** Sorteio "repetível": sempre gera os mesmos dados a partir da mesma semente. */
function criarSorteio(semente: number) {
  let s = semente >>> 0;
  const proximo = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    numero: proximo,
    entre: (min: number, max: number) => min + Math.floor(proximo() * (max - min + 1)),
    chance: (p: number) => proximo() < p,
    um: <T>(lista: readonly T[]): T => lista[Math.floor(proximo() * lista.length)],
  };
}

export const RUAS_FICTICIAS = ['Rua das Acácias', 'Rua dos Ipês Amarelos', 'Travessa Beija-Flor'];

const NOMES_F = [
  'Ana', 'Beatriz', 'Carla', 'Daniela', 'Elaine', 'Fernanda', 'Gabriela', 'Helena', 'Irene',
  'Joana', 'Karina', 'Lúcia', 'Marta', 'Natália', 'Olívia', 'Patrícia', 'Rita', 'Sônia',
  'Tereza', 'Vera', 'Yasmin', 'Zélia', 'Alice', 'Cecília', 'Laura', 'Sofia', 'Valentina',
];
const NOMES_M = [
  'André', 'Bruno', 'Carlos', 'Diego', 'Eduardo', 'Fábio', 'Gustavo', 'Henrique', 'Igor',
  'João', 'Lucas', 'Marcos', 'Nelson', 'Otávio', 'Paulo', 'Renato', 'Sérgio', 'Tiago',
  'Vítor', 'Wagner', 'Arthur', 'Davi', 'Enzo', 'Heitor', 'Miguel', 'Pedro', 'Rafael',
];
const SOBRENOMES = [
  'Almeida', 'Barbosa', 'Cardoso', 'Dias', 'Esteves', 'Farias', 'Gomes', 'Holanda', 'Lacerda',
  'Machado', 'Nogueira', 'Pacheco', 'Queiroz', 'Rezende', 'Siqueira', 'Teixeira', 'Valente',
  'Xavier', 'Moura', 'Prado', 'Fontes', 'Campos', 'Brandão', 'Ribeiro',
];

export interface DadosFicticios {
  familias: Familia[];
  visitas: Visita[];
}

export function gerarDadosFicticios(hoje: string, semente = 2026): DadosFicticios {
  const r = criarSorteio(semente);
  const anoHoje = deISO(hoje).getFullYear();
  let seqMorador = 0;
  let seqPront = 1;

  const nascimentoComIdade = (anos: number): string => {
    const d = new Date(anoHoje - anos, r.entre(0, 11), r.entre(1, 28));
    return paraISO(d);
  };

  const novoMorador = (sexo: 'M' | 'F', anos: number, sobrenome: string): Morador => {
    const nome = `${r.um(sexo === 'F' ? NOMES_F : NOMES_M)} ${r.um(SOBRENOMES)} ${sobrenome}`;
    const nascimento = r.chance(0.03) ? '' : nascimentoComIdade(anos);
    const grupos: Grupo[] = [];
    if (anos >= 60) grupos.push('idoso');
    if (anos <= 2) grupos.push('crianca');
    if (anos >= 30 && r.chance(anos >= 50 ? 0.45 : 0.15)) grupos.push('hipertenso');
    if (anos >= 35 && r.chance(0.12)) grupos.push('diabetico');
    if (sexo === 'F' && anos >= 18 && anos <= 40 && r.chance(0.06)) grupos.push('gestante');
    if (anos >= 75 && r.chance(0.12)) grupos.push('acamado');
    if (r.chance(0.03)) grupos.push('deficiencia');
    if (anos >= 15 && r.chance(0.04)) grupos.push('saude_mental');
    const situacao = r.chance(0.02) ? 'mudou' : 'mora';
    return { id: `m${++seqMorador}`, nome, sexo, nascimento, situacao, situacaoDesde: '', grupos, obs: '' };
  };

  const familias: Familia[] = [];
  const casasPorRua = [92, 78, 28];

  RUAS_FICTICIAS.forEach((rua, iRua) => {
    let numero = r.entre(2, 12);
    for (let i = 0; i < casasPorRua[iRua]; i++) {
      // Às vezes várias famílias no mesmo número (com ou sem complemento).
      const repetir = r.chance(0.12);
      if (!repetir) numero += r.entre(2, 14);
      const semNumero = r.chance(0.02);
      const complemento = repetir ? r.um(['Fundos', 'Casa 2', 'Casa 3', 'Sobrado', '']) : r.chance(0.08) ? 'Fundos' : '';

      const sobrenome = r.um(SOBRENOMES);
      const moradores: Morador[] = [];
      const tipo = r.numero();
      const idadeResp = r.entre(22, 88);
      const sexoResp = r.chance(0.6) ? 'F' : 'M';
      const resp = novoMorador(sexoResp, idadeResp, sobrenome);
      resp.situacao = 'mora'; // o responsável sempre mora na casa
      moradores.push(resp);
      if (tipo > 0.25) moradores.push(novoMorador(sexoResp === 'F' ? 'M' : 'F', Math.max(20, idadeResp + r.entre(-6, 6)), sobrenome));
      if (tipo > 0.45 && idadeResp < 60) {
        const filhos = r.entre(1, 3);
        for (let k = 0; k < filhos; k++) {
          moradores.push(novoMorador(r.chance(0.5) ? 'F' : 'M', r.entre(0, Math.max(1, Math.min(idadeResp - 18, 30))), sobrenome));
        }
      }
      if (tipo > 0.9) moradores.push(novoMorador(r.chance(0.6) ? 'F' : 'M', r.entre(65, 90), sobrenome));

      // Prontuário: alguns vazios ou incompletos, como acontece de verdade.
      let prontuario = `00.${String(seqPront++).padStart(4, '0')}`;
      if (r.chance(0.08)) prontuario = '';
      else if (r.chance(0.04)) prontuario = '00.';

      let situacaoCasa: SituacaoCasa = 'habitada';
      const sc = r.numero();
      if (sc < 0.02) situacaoCasa = 'fechada';
      else if (sc < 0.035) situacaoCasa = 'comercio';
      else if (sc < 0.045) situacaoCasa = 'vazia';

      familias.push({
        id: `f${familias.length + 1}`,
        rua,
        numero: semNumero ? 'S/N' : String(numero),
        complemento,
        bairro: 'Bairro Exemplo',
        colmeia: String(r.entre(1, 250)),
        prontuario,
        situacaoCasa,
        obs: '',
        responsavelId: situacaoCasa === 'habitada' || situacaoCasa === 'comercio' ? resp.id : '',
        moradores: situacaoCasa === 'habitada' || situacaoCasa === 'comercio' ? moradores : [],
      });
    }
  });

  // ---- Visitas fictícias: mês passado quase todo, e o mês atual até hoje ----
  const visitas: Visita[] = [];
  const habitadas = familias.filter((f) => f.situacaoCasa === 'habitada');
  let contador = 0;

  const registrar = (f: Familia, data: string, lancada: boolean) => {
    const ativos = f.moradores.filter((m) => m.situacao === 'mora');
    const sorte = r.numero();
    let presentes: Morador[];
    let recusou = false;
    if (sorte < 0.06) presentes = [];
    else if (sorte < 0.08) {
      presentes = [];
      recusou = true;
    } else if (sorte < 0.55) presentes = ativos;
    else presentes = ativos.filter((_, i) => i === 0 || r.chance(0.4));

    const desfecho: Desfecho = sugerirDesfecho({
      totalMoradores: ativos.length,
      presentes: presentes.length,
      conversouComFamilia: false,
      recusou,
    });
    const hipertenso = presentes.find((m) => m.grupos.includes('hipertenso'));
    const sinais: Record<string, { pa: string }> =
      hipertenso && r.chance(0.5) ? { [hipertenso.id]: { pa: `${r.entre(11, 15)}0x${r.entre(7, 9)}0` } } : {};
    const orientacoes = desfecho === 'realizada' || desfecho === 'ausente_realizada'
      ? r.um(['consultas e saúde', 'consultas e dengue', 'vacinas', 'medicações', 'consultas, dengue e vacinas', ''])
      : '';
    const presentesIds = presentes.map((m) => m.id);
    const relato = gerarRelato({
      desfecho,
      presentes,
      ausentes: ativos.filter((m) => !presentesIds.includes(m.id)),
      conversouComFamilia: false,
      sinais,
      orientacoes,
      compartilhadaCom: '',
      contador: contador++,
    });
    visitas.push({
      id: `v${visitas.length + 1}`,
      familiaId: f.id,
      data,
      presentes: presentesIds,
      conversouComFamilia: false,
      desfecho,
      motivo: 'Outros',
      compartilhadaCom: '',
      sinais,
      orientacoes,
      relato,
      lancadaNoFast: lancada,
    });
  };

  // Mês passado: cerca de 92% das famílias, espalhadas nos dias úteis.
  const inicioMes = `${mesDe(hoje)}-01`;
  const inicioMesPassado = `${mesDe(somarDias(inicioMes, -1))}-01`;
  const diasMesPassado: string[] = [];
  for (let d = inicioMesPassado; d < inicioMes; d = somarDias(d, 1)) if (ehDiaUtil(d)) diasMesPassado.push(d);
  for (const f of habitadas) {
    if (r.chance(0.92)) registrar(f, r.um(diasMesPassado), true);
  }
  visitas.sort((a, b) => a.data.localeCompare(b.data));

  // Mês atual: cerca de 9 famílias por dia útil antes de hoje, e 3 hoje.
  const naFila = [...habitadas].sort(() => r.numero() - 0.5);
  let idx = 0;
  for (let d = inicioMes; d <= hoje; d = somarDias(d, 1)) {
    if (!ehDiaUtil(d)) continue;
    const qtd = d === hoje ? 3 : r.entre(7, 11);
    for (let k = 0; k < qtd && idx < naFila.length; k++) {
      // VDs de hoje e de ontem ainda não foram lançadas no Fast.
      const lancada = d < somarDias(hoje, -1);
      registrar(naFila[idx++], d, lancada);
    }
  }

  return { familias, visitas };
}

/** Garante que só calculamos idade quando há data. */
export function idadeTexto(m: Morador, hoje: string): string {
  const i = idade(m.nascimento, hoje);
  if (i === null) return 'sem data de nascimento';
  if (i === 0) return 'menos de 1 ano';
  return i === 1 ? '1 ano' : `${i} anos`;
}
