// Sugere o sexo pelo PRIMEIRO nome (ex.: "Maria" = F, "José" = M).
// É só uma sugestão: o morador fica marcado como "a conferir" até o ACS confirmar.
// Quando não dá para saber (nome raro ou que serve para os dois), devolve '' (fica em branco).

import type { Familia, Sexo } from './tipos';

/** Nomes femininos comuns que as regras de terminação errariam (ou que vale a pena garantir). */
const FEMININOS = new Set(
  `alice beatriz isabel raquel mabel rachel ester esther ruth rute judite judith inês ines ingrid astrid
  iris íris lais laís thais thaís tais taís carmen ellen karen kathleen kathlen evelyn evellyn
  jennifer jenifer jeniffer nicole simone denise elise ione irene gisele gisele jaqueline michele michelle
  daiane dayane viviane josiane liliane cristiane rosane rosilene marlene darlene eliane elaine aline
  adriane alessandra cleide neide aparecida socorro consuelo rosário rosario lourdes mercedes dolores
  nair yasmin yasmim jasmim miriam mirian marlei sueli suely shirley kelly emilly emily nicoly sthephany
  stefany tiffany madalena madalene clarice beatrice berenice eunice janice lucilene solange angele
  isabele isabelle gabriele gabrielle daniele danielle rafaele rafaelle manuele joyce rayane
  thayane tayane ariane mariane luane cibele rebeca sarah sara hanna hannah deborah débora debora
  noemi noemy zuleide edileuza ivone yvone ivete elizete elisete marinete claudete bernadete
  anete jussara maraisa abigail lilian lílian vivian rosemary rosemeire rosimeire leonor eleonor`
    .split(/\s+/)
    .filter(Boolean),
);

/** Nomes masculinos comuns que as regras de terminação errariam (ou que vale a pena garantir). */
const MASCULINOS = new Set(
  `josé jose andré andre alexandre jorge felipe filipe henrique guilherme vicente clemente dante
  wellington washington davi david levi henri ravi ruy rui luca luka joshua noé noe kauê kaue
  rafael daniel samuel gabriel manoel manuel ezequiel miguel joel abel natanael emanuel israel
  ismael misael uriel nathaniel luis luís luiz denis moisés moises aires luan ruan ivan allan alan
  kevin jonathan jhonatan wesley harley charles james thomas tomás tomas nicolas nícolas elias jonas
  lucas matias tobias jeremias isaías isaias josias messias walter valter peter roger eliezer
  lázaro lazaro ademir valdemir jair edir osmar omar baltazar artur arthur ivo caio cauã cauan
  benjamin benjamim joaquim ian yan juan iuri yuri igor heitor vitor victor otávio otavio`
    .split(/\s+/)
    .filter(Boolean),
);

function limpar(t: string): string {
  return t
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

const FEM_LIMPOS = new Set([...FEMININOS].map(limpar));
const MASC_LIMPOS = new Set([...MASCULINOS].map(limpar));

/** Terminações típicas (da mais específica para a mais geral). */
const REGRAS: [RegExp, Sexo][] = [
  [/(iane|ane|ene|ine|ise|ele|elle|ice|ete|ette|ilde|eide|euza|ilda)$/, 'F'],
  [/(ique|ge|pe|rme|dre|nte|nde|rte)$/, 'M'],
  [/ey$/, 'M'],
  [/y$/, 'F'],
  [/(ah|th)$/, 'F'],
  [/a$/, 'F'],
  [/o$/, 'M'],
  [/(son|ton|on|or|os|us|as|el|il|ir|ur|ar|an|in|im|um|eu|au)$/, 'M'],
];

/** Sexo sugerido pelo primeiro nome, ou '' quando não dá para saber. */
export function sugerirSexo(nomeCompleto: string): Sexo {
  const primeiro = limpar(nomeCompleto.trim().split(/\s+/)[0] ?? '');
  if (primeiro.length < 2) return '';
  if (FEM_LIMPOS.has(primeiro)) return 'F';
  if (MASC_LIMPOS.has(primeiro)) return 'M';
  for (const [regra, sexo] of REGRAS) if (regra.test(primeiro)) return sexo;
  return '';
}

/** Preenche o sexo em branco pelo primeiro nome, marcando "a conferir". Devolve quantos foram sugeridos. */
export function sugerirSexoNasFamilias(familias: Familia[]): number {
  let n = 0;
  for (const f of familias) {
    for (const m of f.moradores) {
      if (m.sexo) continue;
      const s = sugerirSexo(m.nome);
      if (s) {
        m.sexo = s;
        m.sexoAConferir = true;
        n++;
      }
    }
  }
  return n;
}
