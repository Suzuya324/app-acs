/**
 * Entrega um arquivo ao usuário: no celular abre o menu "Compartilhar"
 * (salvar no Drive, enviar para si mesmo etc.); no computador, baixa o arquivo.
 * Retorna false se o usuário cancelou.
 */
export async function entregarArquivo(nome: string, texto: string, tipo = 'application/json'): Promise<boolean> {
  const arquivo = new File([texto], nome, { type: tipo });
  if (navigator.canShare?.({ files: [arquivo] })) {
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
