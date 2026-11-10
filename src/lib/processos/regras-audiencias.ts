const normalizar = (situacao: string) =>
  situacao
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();

export function situacaoAudienciaPendente(situacao: string): boolean {
  return /^(AGENDADA|DESIGNADA|REDESIGNADA)$/.test(normalizar(situacao));
}

export function situacaoAudienciaFinalCanonica(situacao: string): boolean {
  return /^(REALIZADA|CANCELADA|NAO REALIZADA|CONVERTIDA EM DILIGENCIA)$/.test(
    normalizar(situacao),
  );
}

export function mesmaSituacaoAudiencia(a: string, b: string): boolean {
  return normalizar(a) === normalizar(b);
}
