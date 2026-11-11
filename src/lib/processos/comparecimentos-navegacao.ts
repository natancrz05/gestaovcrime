/** Escolhe a área correta para abrir o cadastro integral de comparecimento. */
export function rotaCadastroComparecimento(situacao: string) {
  return situacao === "Encerrado" ? "/comparecimentos/encerrados" as const : "/comparecimentos" as const;
}
