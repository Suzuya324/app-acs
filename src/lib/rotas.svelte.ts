// Navegação simples pelo endereço (#/busca, #/familia/f12 ...). O botão "voltar" do celular funciona.
function lerRota() {
  const partes = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  return { tela: partes[0] ?? 'inicio', id: partes[1] ?? '' };
}

export const rota = $state(lerRota());

window.addEventListener('hashchange', () => {
  const r = lerRota();
  rota.tela = r.tela;
  rota.id = r.id;
  window.scrollTo(0, 0);
});

export function ir(caminho: string) {
  location.hash = `#/${caminho}`;
}

export function voltar(padrao = '') {
  if (history.length > 1) history.back();
  else ir(padrao);
}
