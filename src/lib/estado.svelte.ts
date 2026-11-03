// Estado do protótipo: tudo fica só na memória. Recarregou a página, volta ao início.
import { gerarDadosFicticios } from './dados-ficticios';
import { hojeISO } from './datas';
import { CONFIG_PADRAO } from './rotulos';
import type { Familia, Visita } from './tipos';

const dados = gerarDadosFicticios(hojeISO());

export const app = $state({
  config: structuredClone(CONFIG_PADRAO),
  familias: dados.familias as Familia[],
  visitas: dados.visitas as Visita[],
  /** Número de VDs já feitas: usado para variar o modelo do relato. */
  contadorRelato: dados.visitas.length,
  aviso: '' as string,
  /** Texto da busca (fica guardado ao voltar para a tela). */
  busca: '',
});

let timerAviso: ReturnType<typeof setTimeout> | undefined;
export function mostrarAviso(texto: string) {
  app.aviso = texto;
  clearTimeout(timerAviso);
  timerAviso = setTimeout(() => (app.aviso = ''), 2600);
}

export function familiaPorId(id: string): Familia | undefined {
  return app.familias.find((f) => f.id === id);
}

export function salvarVisita(v: Omit<Visita, 'id'>) {
  app.visitas.push({ ...v, id: `v${Date.now()}` });
  app.contadorRelato++;
}

export function marcarLancada(id: string, lancada: boolean) {
  const v = app.visitas.find((x) => x.id === id);
  if (v) v.lancadaNoFast = lancada;
}

export function enderecoCurto(f: Familia): string {
  const comp = f.complemento ? ` – ${f.complemento}` : '';
  return `${f.rua}, ${f.numero}${comp}`;
}

export function responsavel(f: Familia): string {
  return f.moradores.find((m) => m.situacao === 'mora')?.nome ?? '(sem morador)';
}
