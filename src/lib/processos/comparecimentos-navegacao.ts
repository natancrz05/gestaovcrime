/** Escolhe a área correta para abrir o cadastro integral de comparecimento. */
export function rotaCadastroComparecimento(situacao: string) {
  return situacao === "Encerrado" ? "/comparecimentos/encerrados" as const : "/comparecimentos" as const;
}

/** Resolve deep links de encerrados sem jamais abrir o cadastro de outra situação. */
export function cadastroEncerradoPorId<T extends { id: string; situacao: string }>(
  registros: readonly T[],
  id: string,
): T | null {
  if (!id) return null;
  return registros.find((registro) => registro.id === id && registro.situacao === "Encerrado") ?? null;
}
