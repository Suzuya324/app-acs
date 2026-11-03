import { describe, expect, it } from 'vitest';
import modeloCsv from '../../exemplos/area-exemplo.csv?raw';
import {
  arrumarNome,
  consertarAcentos,
  decodificar,
  importarCSV,
  lerData,
  lerNumero,
  lerSexo,
  textoResumo,
} from './importar-csv';

const HOJE = '2026-11-03';
const CAB = 'Casa;Rua;Numero;Complemento;Bairro;Prontuario;Nome;Sexo;Data de nascimento';

describe('importador CSV: arquivo de exemplo fictício', () => {
  const bytes = new TextEncoder().encode(modeloCsv);
  const r = importarCSV(decodificar(bytes), HOJE);

  it('mostra o resumo certo', () => {
    expect(r.erros).toEqual([]);
    expect(textoResumo(r.resumo)).toBe('3 ruas, 12 famílias, 20 moradores');
    expect(r.resumo.ruas).toEqual([
      { rua: 'Rua das Acácias', familias: 5 },
      { rua: 'Rua dos Ipês Amarelos', familias: 4 },
      { rua: 'Travessa Beija-Flor', familias: 3 },
    ]);
  });

  it('junta os moradores da mesma Casa numa família, com o primeiro como responsável', () => {
    const c001 = r.familias[0];
    expect(c001.moradores.map((m) => m.nome)).toEqual(['Fulana de Tal Teste', 'Ciclano de Tal Teste']);
    expect(c001.responsavelId).toBe(c001.moradores[0].id);
    expect(c001.moradores[0].nascimento).toBe('1958-03-14');
    expect(c001.moradores[0].sexo).toBe('F');
  });

  it('aceita várias famílias no mesmo número, S/N, prontuário vazio e incompleto', () => {
    const no30 = r.familias.filter((f) => f.rua === 'Rua das Acácias' && f.numero === '30');
    expect(no30.map((f) => f.complemento)).toEqual(['', 'Fundos', 'Casa 2']);
    expect(no30.map((f) => f.prontuario)).toEqual(['00.0002', '', '00.']);
    expect(r.familias.some((f) => f.numero === 'S/N')).toBe(true);
  });

  it('data em branco fica em branco, sem aviso', () => {
    const m = r.familias[1].moradores.find((x) => x.nome.startsWith('Mariazinha'))!;
    expect(m.nascimento).toBe('');
    expect(r.avisos).toEqual([]);
  });
});

describe('importador CSV: tolerante a variações', () => {
  const linha = 'C001;Rua Teste;10;;Bairro;00.0001;José Conceição;M;01/02/1980';

  it('aceita vírgula e TAB como separador', () => {
    const virgula = importarCSV(`${CAB.replaceAll(';', ',')}\n${linha.replaceAll(';', ',')}`, HOJE);
    expect(virgula.familias[0].moradores[0].nome).toBe('José Conceição');
    const tab = importarCSV(`${CAB.replaceAll(';', '\t')}\n${linha.replaceAll(';', '\t')}`, HOJE);
    expect(tab.familias[0].rua).toBe('Rua Teste');
  });

  it('aceita colunas fora de ordem e cabeçalho sem acento/maiúsculas', () => {
    const r = importarCSV('NOME;SEXO;DATA NASCIMENTO;RUA;NÚMERO;CASA\nAna Teste;F;05/05/1990;Rua Um;5;C1', HOJE);
    expect(r.erros).toEqual([]);
    expect(r.familias[0].numero).toBe('5');
    expect(r.familias[0].moradores[0].nascimento).toBe('1990-05-05');
  });

  it('avisa quando falta coluna obrigatória', () => {
    const r = importarCSV('Casa;Rua;Sexo\nC1;Rua Um;F', HOJE);
    expect(r.erros[0]).toContain('Nome');
    expect(r.familias).toEqual([]);
  });

  it('decodifica arquivo do Excel antigo (Windows-1252)', () => {
    const latin1 = new Uint8Array([...`${CAB}\n${linha}`].map((c) => c.charCodeAt(0)));
    const r = importarCSV(decodificar(latin1), HOJE);
    expect(r.familias[0].moradores[0].nome).toBe('José Conceição');
  });

  it('conserta acentos quebrados ("JosÃ©" → "José")', () => {
    expect(consertarAcentos('JosÃ© ConceiÃ§Ã£o')).toBe('José Conceição');
    expect(consertarAcentos('José')).toBe('José');
  });

  it('tira o BOM do começo do arquivo', () => {
    const r = importarCSV(`﻿${CAB}\n${linha}`, HOJE);
    expect(r.erros).toEqual([]);
  });

  it('aceita campos entre aspas com ; dentro', () => {
    const r = importarCSV(`${CAB}\nC1;"Rua Um; Vila";10;"Casa 2";;;"Ana ""Teste""";F;`, HOJE);
    expect(r.familias[0].rua).toBe('Rua Um; Vila');
    expect(r.familias[0].moradores[0].nome).toBe('Ana "Teste"');
  });

  it('nome todo em MAIÚSCULAS vira nome normal', () => {
    expect(arrumarNome('MARIA DA SILVA DOS SANTOS')).toBe('Maria da Silva dos Santos');
    expect(arrumarNome('Maria da Silva')).toBe('Maria da Silva');
  });

  it('linhas em branco são ignoradas', () => {
    const r = importarCSV(`${CAB}\n\n${linha}\n;;;;;;;;\n`, HOJE);
    expect(r.resumo.moradores).toBe(1);
    expect(r.avisos).toEqual([]);
  });
});

describe('importador CSV: avisos', () => {
  it('data inválida, sexo desconhecido, sem nome e repetido geram aviso com a linha', () => {
    const r = importarCSV(
      [
        CAB,
        'C1;Rua Um;1;;;;Ana Teste;X;31/02/1990',
        'C1;Rua Um;1;;;;;F;01/01/1990',
        'C1;Rua Um;1;;;;Bia Teste;F;01/01/2099',
        'C1;Rua Um;1;;;;Bia Teste;F;01/01/2099',
      ].join('\n'),
      HOJE,
    );
    const textos = r.avisos.map((a) => `${a.linha}: ${a.texto}`);
    expect(textos.some((t) => t.startsWith('2:') && t.includes('sexo'))).toBe(true);
    expect(textos.some((t) => t.startsWith('2:') && t.includes('31/02/1990'))).toBe(true);
    expect(textos.some((t) => t.startsWith('3:') && t.includes('sem nome'))).toBe(true);
    expect(textos.some((t) => t.startsWith('4:') && t.includes('01/01/2099'))).toBe(true);
    expect(textos.some((t) => t.startsWith('5:') && t.includes('repetido'))).toBe(true);
    expect(r.resumo.moradores).toBe(2);
  });

  it('mesma Casa com endereço diferente gera aviso', () => {
    const r = importarCSV(`${CAB}\nC1;Rua Um;1;;;;Ana Teste;F;\nC1;Rua Dois;9;;;;Bia Teste;F;`, HOJE);
    expect(r.avisos[0].texto).toContain('endereço diferente');
    expect(r.resumo.familias).toBe(1);
  });
});

describe('leitura de valores', () => {
  it('datas', () => {
    expect(lerData('05/03/1980', HOJE)).toBe('1980-03-05');
    expect(lerData('5/3/1980', HOJE)).toBe('1980-03-05');
    expect(lerData('05-03-1980', HOJE)).toBe('1980-03-05');
    expect(lerData('1980-03-05', HOJE)).toBe('1980-03-05');
    expect(lerData('', HOJE)).toBe('');
    expect(lerData('29/02/2023', HOJE)).toBeNull();
    expect(lerData('05/03/80', HOJE)).toBeNull();
  });

  it('sexo', () => {
    expect(lerSexo('m')).toBe('M');
    expect(lerSexo('Feminino')).toBe('F');
    expect(lerSexo('')).toBe('');
    expect(lerSexo('?')).toBeNull();
  });

  it('número da casa', () => {
    expect(lerNumero('')).toBe('S/N');
    expect(lerNumero('s/n')).toBe('S/N');
    expect(lerNumero('SN')).toBe('S/N');
    expect(lerNumero(' 90 ')).toBe('90');
    expect(lerNumero('90-A')).toBe('90-A');
  });
});

describe('lista copiada do Fast e colada no app', () => {
  it('aceita os títulos "Nome da rua", "Número da casa", "Nome do paciente" sem coluna Casa', () => {
    const texto = [
      'Nome da rua\tNúmero da casa\tNome do paciente',
      'RUA DAS ACÁCIAS\t12\tFULANA DE TAL TESTE',
      'RUA DAS ACÁCIAS\t12\tCICLANO DE TAL TESTE',
      'RUA DAS ACÁCIAS\t30\tBELTRANA EXEMPLO',
      'RUA DOS IPÊS\t7\tANA EXEMPLO',
    ].join('\n');
    const r = importarCSV(texto, HOJE);
    expect(r.erros).toEqual([]);
    expect(r.agrupamento).toBe('automatico');
    expect(textoResumo(r.resumo)).toBe('2 ruas, 3 famílias, 4 moradores');
    expect(r.familias[0].rua).toBe('Rua das Acácias');
    expect(r.familias[0].moradores.map((m) => m.nome)).toEqual(['Fulana de Tal Teste', 'Ciclano de Tal Teste']);
    expect(r.avisos[0].texto).toContain('Sem a coluna Casa');
  });

  it('sem Casa: junta pelo prontuário; prontuário incompleto junta pelo endereço', () => {
    const texto = [
      'Rua;Número;Complemento;Prontuário;Nome',
      'Rua Um;10;;00.0001;Ana Teste',
      'Rua Um;10;Fundos;00.0002;Bia Teste',
      'Rua Um;10;;00.0001;Caio Teste',
      'Rua Um;20;;00.;Davi Teste',
      'Rua Um;20;;00.;Eva Teste',
      'Rua Um;20;Casa 2;;Fábio Teste',
    ].join('\n');
    const r = importarCSV(texto, HOJE);
    const familias = r.familias.map((f) => f.moradores.map((m) => m.nome.split(' ')[0]).join('+'));
    expect(familias).toEqual(['Ana+Caio', 'Bia', 'Davi+Eva', 'Fábio']);
  });

  it('avisa quando junta muita gente numa família só', () => {
    const linhas = ['Rua;Numero;Nome', ...Array.from({ length: 8 }, (_, i) => `Rua Um;5;Pessoa Teste ${i}`)];
    const r = importarCSV(linhas.join('\n'), HOJE);
    expect(r.avisos.some((a) => a.texto.includes('8 moradores juntos'))).toBe(true);
  });

  it('ignora o cabeçalho repetido (copiou várias páginas)', () => {
    const r = importarCSV('Rua;Numero;Nome\nRua Um;1;Ana Teste\nRua;Numero;Nome\nRua Um;2;Bia Teste', HOJE);
    expect(r.resumo.moradores).toBe(2);
    expect(r.avisos.filter((a) => a.linha > 0)).toEqual([]);
  });

  it('entende texto com uma informação por linha', () => {
    const texto = ['Nome da rua', 'Número da casa', 'Nome do paciente', 'Rua Um', '10', 'Ana Teste', 'Rua Um', '10', 'Bia Teste', 'Rua Dois', 'S/N', 'Caio Teste'].join('\n');
    const r = importarCSV(texto, HOJE);
    expect(r.erros).toEqual([]);
    expect(textoResumo(r.resumo)).toBe('2 ruas, 2 famílias, 3 moradores');
    expect(r.familias[1].numero).toBe('S/N');
  });

  it('uma informação por linha, com títulos repetidos no meio', () => {
    const texto = ['Rua', 'Nome', 'Rua Um', 'Ana Teste', 'Rua', 'Nome', 'Rua Um', 'Bia Teste'].join('\n');
    expect(importarCSV(texto, HOJE).resumo.moradores).toBe(2);
  });

  it('uma informação por linha desalinhada: erro claro em vez de dados trocados', () => {
    const texto = ['Rua', 'Número', 'Nome', 'Rua Um', '10', 'Ana Teste', 'Rua Um', 'Bia Teste'].join('\n');
    const r = importarCSV(texto, HOJE);
    expect(r.erros[0]).toContain('desalinhadas');
    expect(r.familias).toEqual([]);
  });

  it('texto sem títulos de coluna: erro pedindo para copiar com os títulos', () => {
    const r = importarCSV('Rua Um\n10\nAna Teste', HOJE);
    expect(r.erros[0]).toContain('títulos das colunas');
  });

  it('com a coluna Casa continua juntando pela Casa', () => {
    const r = importarCSV('Casa;Rua;Numero;Nome\nC1;Rua Um;1;Ana Teste\nC1;Rua Um;1;Bia Teste', HOJE);
    expect(r.agrupamento).toBe('casa');
    expect(r.resumo.familias).toBe(1);
    expect(r.avisos).toEqual([]);
  });
});
