// Navegação simples pelo endereço (#/busca, #/familia/f12, #/morador/f12/m3 ...).
// O botão "voltar" do celular funciona.
function lerRota() {
  const partes = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  return { tela: partes[0] ?? 'inicio', id: partes[1] ?? '', sub: partes[2] ?? '' };
}

export const rota = $state(lerRota());

window.addEventListener('hashchange', () => {
  const r = lerRota();
  rota.tela = r.tela;
  rota.id = r.id;
  rota.sub = r.sub;
  window.scrollTo(0, 0);
});

export function ir(caminho: string) {
  location.hash = `#/${caminho}`;
}

/** Vai para outra tela sem deixar a atual no "voltar" (usado depois de salvar um formulário). */
export function trocarPara(caminho: string) {
  location.replace(`#/${caminho}`);
}

export function voltar(padrao = '') {
  if (history.length > 1) history.back();
  else ir(padrao);
}
