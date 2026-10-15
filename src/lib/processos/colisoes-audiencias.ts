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
 * Situações encerradas que não reservam mais o horário para novas audiências.
 * "Realizada" continua ocupando o horário por segurança histórica.
 */
export function audienciaOcupaHorario(situacao: string): boolean {
  const s = normalizar(situacao);
  return !/^(CANCELADA|NAO REALIZADA|CONVERTIDA EM DILIGENCIA)$/.test(s);
}

/**
 * Regra de segurança para a gravação da pauta:
 * - processos diferentes podem ter audiências no mesmo horário, inclusive da mesma finalidade;
 * - audiências canceladas, não realizadas ou convertidas em diligência não ocupam o horário;
 * - no mesmo processo, a mesma finalidade ativa é idempotente;
 * - no mesmo processo, outra finalidade ativa no mesmo horário exige conferência.
 *
 * Os tipos recebidos devem estar previamente convertidos para a finalidade canônica.
 */
export function avaliarColisaoHorarioPauta(
  ocupadas: Array<{ processo_id: string; tipo: string; situacao: string }>,
  processoId: string,
  tipoCanonico: string,
  situacaoNova: string,
): ResultadoColisaoHorarioPauta {
  if (!audienciaOcupaHorario(situacaoNova)) return "livre";

  const mesmoProcesso = ocupadas.filter(
    (a) => a.processo_id === processoId && audienciaOcupaHorario(a.situacao),
  );
  if (!mesmoProcesso.length) return "livre";

  const finalidade = normalizar(tipoCanonico);
  if (mesmoProcesso.some((a) => normalizar(a.tipo) === finalidade)) {
    return "ja-existente";
  }

  return "conflito-mesmo-processo";
}
