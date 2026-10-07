export type ResultadoColisaoHorarioPauta =
  | "livre"
  | "ja-existente"
  | "conflito-mesmo-processo";

const normalizar = (valor: string) =>
  valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();

/**
 * Regra de segurança para a gravação da pauta:
 * - processos diferentes podem ter audiências no mesmo horário, inclusive da mesma finalidade;
 * - no mesmo processo, a mesma finalidade é idempotente;
 * - no mesmo processo, outra finalidade no mesmo horário exige conferência.
 *
 * Os tipos recebidos devem estar previamente convertidos para a finalidade canônica.
 */
export function avaliarColisaoHorarioPauta(
  ocupadas: Array<{ processo_id: string; tipo: string }>,
  processoId: string,
  tipoCanonico: string,
): ResultadoColisaoHorarioPauta {
  const mesmoProcesso = ocupadas.filter((a) => a.processo_id === processoId);
  if (!mesmoProcesso.length) return "livre";

  const finalidade = normalizar(tipoCanonico);
  if (mesmoProcesso.some((a) => normalizar(a.tipo) === finalidade)) {
    return "ja-existente";
  }

  return "conflito-mesmo-processo";
}
