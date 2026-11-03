// Ponto único de importação: decide se o texto é uma planilha (CSV/tabela) ou uma lista em texto.
// Depois, para quem veio sem sexo, sugere pelo primeiro nome (marcado "a conferir").
import { importarCSV, type ResultadoImportacao } from './importar-csv';
import { importarListaTexto, pareceListaEmTexto } from './importar-texto';
import { sugerirSexoNasFamilias } from './sexo-por-nome';

export function importarTexto(texto: string, hoje: string): ResultadoImportacao {
  const r = pareceListaEmTexto(texto) ? importarListaTexto(texto, hoje) : importarCSV(texto, hoje);
  r.sexoSugerido = sugerirSexoNasFamilias(r.familias);
  return r;
}
