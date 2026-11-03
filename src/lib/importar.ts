// Ponto único de importação: decide se o texto é uma planilha (CSV/tabela) ou uma lista em texto.
import { importarCSV, type ResultadoImportacao } from './importar-csv';
import { importarListaTexto, pareceListaEmTexto } from './importar-texto';

export function importarTexto(texto: string, hoje: string): ResultadoImportacao {
  return pareceListaEmTexto(texto) ? importarListaTexto(texto, hoje) : importarCSV(texto, hoje);
}
