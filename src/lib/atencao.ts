// "Atenção": lembretes por grupo (gestante, acamado, hipertenso…), aniversários e idades que mudam o grupo.
// Função "pura": recebe famílias e visitas e devolve a lista de avisos (fácil de testar).
import { contaParaMeta } from './desfecho';
import { deISO, diferencaDias, formatarData, idade, somarDias } from './datas';
import type { Familia, Grupo, Morador, Visita } from './tipos';

export type TipoAtencao =
  | 'acompanhar' // gestante, puérpera, criança pequena sem VD há 30 dias
  | 'acamado' // acamado sem VD há 30 dias
  | 'pa' // hipertenso sem P.A. medida há 60 dias
  | 'glicemia' // diabético sem glicemia medida há 60 dias
  | 'virou_idoso' // 60 anos ou mais e fora do grupo Idoso
  | 'crianca_cresceu' // 2 anos ou mais e ainda em Criança pequena
  | 'crianca_fora' // menos de 2 anos e fora de Criança pequena
  | 'aniversario'; // faz aniversário nos próximos 7 dias

export interface AvisoAtencao {
  tipo: TipoAtencao;
  familia: Familia;
  morador: Morador;
  /** Texto curto para mostrar, ex.: "Gestante · última VD há 45 dias". */
  texto: string;
  /** Ação de um toque: incluir ou tirar um grupo. */
  acao?: { incluir?: Grupo; tirar?: Grupo; rotulo: string };
  /** Para ordenar (maior = mais urgente / mais perto). */
  peso: number;
}

export const NOMES_ATENCAO: Record<TipoAtencao, string> = {
  acompanhar: 'Gestantes, puérperas e crianças sem VD há 30 dias',
  acamado: 'Acamados sem VD há 30 dias',
  pa: 'Hipertensos sem P.A. há 60 dias',
  glicemia: 'Diabéticos sem glicemia há 60 dias',
  virou_idoso: 'Fizeram 60 anos (incluir em Idoso?)',
  crianca_cresceu: 'Já têm 2 anos (tirar de Criança pequena?)',
  crianca_fora: 'Menores de 2 anos fora de Criança pequena',
  aniversario: 'Aniversários nos próximos 7 dias',
};

export const ORDEM_ATENCAO: TipoAtencao[] = [
  'acompanhar', 'acamado', 'pa', 'glicemia', 'aniversario', 'virou_idoso', 'crianca_fora', 'crianca_cresceu',
];

export const DIAS_ACOMPANHAR = 30;
export const DIAS_SINAIS = 60;

const DIAS_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

function haQuanto(data: string | undefined, hoje: string): string {
  if (!data) return 'sem registro';
  const d = diferencaDias(data, hoje);
  return d === 1 ? 'há 1 dia' : `há ${d} dias`;
}

/** Próximo aniversário (aaaa-mm-dd) a partir de hoje, contando hoje. */
export function proximoAniversario(nascimento: string, hoje: string): string {
  const ano = Number(hoje.slice(0, 4));
  const md = nascimento.slice(5);
  // 29/02 em ano que não é bissexto: comemora em 28/02.
  const data = (a: number) => {
    const iso = `${a}-${md}`;
    return deISO(iso).getMonth() + 1 === Number(md.slice(0, 2)) ? iso : `${a}-02-28`;
  };
  const esteAno = data(ano);
  return esteAno >= hoje ? esteAno : data(ano + 1);
}

export function calcularAtencao(familias: Familia[], visitas: Visita[], hoje: string): AvisoAtencao[] {
  // Última VD que conta, por família; últimas P.A. e glicemia, por morador.
  const ultimaVD = new Map<string, string>();
  const ultimaPA = new Map<string, string>();
  const ultimaGlic = new Map<string, string>();
  const maior = (m: Map<string, string>, k: string, d: string) => {
    if ((m.get(k) ?? '') < d) m.set(k, d);
  };
  for (const v of visitas) {
    if (v.data > hoje) continue;
    if (contaParaMeta(v.desfecho)) maior(ultimaVD, v.familiaId, v.data);
    for (const [mid, s] of Object.entries(v.sinais ?? {})) {
      if (s.pa?.trim()) maior(ultimaPA, mid, v.data);
      if (s.glicemia?.trim()) maior(ultimaGlic, mid, v.data);
    }
  }
  const limiteVD = somarDias(hoje, -DIAS_ACOMPANHAR);
  const limiteSinais = somarDias(hoje, -DIAS_SINAIS);
  const fimSemana = somarDias(hoje, 6);
  const atraso = (d: string | undefined) => (d ? diferencaDias(d, hoje) : 9999);

  const avisos: AvisoAtencao[] = [];
  for (const f of familias) {
    if (f.situacaoCasa !== 'habitada') continue;
    const vd = ultimaVD.get(f.id);
    for (const m of f.moradores) {
      if (m.situacao !== 'mora') continue;
      const g = new Set(m.grupos);
      const anos = idade(m.nascimento, hoje);
      const add = (tipo: TipoAtencao, texto: string, peso: number, acao?: AvisoAtencao['acao']) =>
        avisos.push({ tipo, familia: f, morador: m, texto, peso, acao });

      const pequena = g.has('crianca') || (anos !== null && anos < 2);
      const acompanhar = g.has('gestante') || g.has('puerpera') || pequena;
      if (acompanhar && (!vd || vd < limiteVD)) {
        const qual = g.has('gestante') ? 'Gestante' : g.has('puerpera') ? 'Puérpera' : 'Criança pequena';
        add('acompanhar', `${qual} · última VD ${haQuanto(vd, hoje)}`, atraso(vd));
      }
      if (g.has('acamado') && (!vd || vd < limiteVD)) add('acamado', `Acamado · última VD ${haQuanto(vd, hoje)}`, atraso(vd));
      const pa = ultimaPA.get(m.id);
      if (g.has('hipertenso') && (!pa || pa < limiteSinais)) add('pa', `Última P.A. ${haQuanto(pa, hoje)}`, atraso(pa));
      const gl = ultimaGlic.get(m.id);
      if (g.has('diabetico') && (!gl || gl < limiteSinais)) add('glicemia', `Última glicemia ${haQuanto(gl, hoje)}`, atraso(gl));

      if (anos === null) continue;
      if (anos >= 60 && !g.has('idoso')) add('virou_idoso', `${anos} anos`, anos, { incluir: 'idoso', rotulo: 'Incluir em Idoso' });
      if (anos >= 2 && g.has('crianca')) add('crianca_cresceu', `${anos} anos`, anos, { tirar: 'crianca', rotulo: 'Tirar de Criança' });
      if (anos < 2 && !g.has('crianca')) {
        add('crianca_fora', anos === 0 ? 'Menos de 1 ano' : '1 ano', 2 - anos, { incluir: 'crianca', rotulo: 'Incluir em Criança' });
      }
      const aniv = proximoAniversario(m.nascimento, hoje);
      if (aniv <= fimSemana) {
        const faz = Number(aniv.slice(0, 4)) - Number(m.nascimento.slice(0, 4));
        const dia = aniv === hoje ? 'hoje' : aniv === somarDias(hoje, 1) ? 'amanhã' : DIAS_SEMANA[deISO(aniv).getDay()];
        add('aniversario', `Faz ${faz} ${faz === 1 ? 'ano' : 'anos'} ${dia} (${formatarData(aniv).slice(0, 5)})`, -diferencaDias(hoje, aniv));
      }
    }
  }
  return avisos.sort((a, b) => b.peso - a.peso);
}
