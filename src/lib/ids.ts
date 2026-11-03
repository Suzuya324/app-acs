/** Gera um identificador único (para famílias, moradores, visitas, histórico). */
export function novoId(prefixo = ''): string {
  const aleatorio = crypto.getRandomValues(new Uint32Array(2));
  return `${prefixo}${Date.now().toString(36)}${aleatorio[0].toString(36)}${aleatorio[1].toString(36)}`;
}
