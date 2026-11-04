/**
 * Entrega um arquivo ao usuário.
 * - "compartilhar": no celular abre o menu Compartilhar (Drive etc.); sem esse menu, baixa.
 * - "baixar": grava direto na pasta Downloads, sem menu.
 * Retorna false se o usuário cancelou.
 */
export async function entregarArquivo(
  nome: string,
  texto: string,
  tipo = 'application/json',
  modo: 'compartilhar' | 'baixar' = 'compartilhar',
): Promise<boolean> {
  const arquivo = new File([texto], nome, { type: tipo });
  if (modo === 'compartilhar' && navigator.canShare?.({ files: [arquivo] })) {
    try {
      await navigator.share({ files: [arquivo], title: nome });
      return true;
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return false;
      // se o compartilhamento falhar, tenta baixar
    }
  }
  const url = URL.createObjectURL(arquivo);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return true;
}
