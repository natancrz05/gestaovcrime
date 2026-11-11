export const PREFIXO_HISTORICO_CALCULO = "Cálculo IA — ";

const TITULOS_ANTIGOS = [
  "Prescrição penal",
  "Revisão da prisão preventiva",
  "Revisão de prisão provisória",
  "Prazos de manifestações",
  "Excesso de prazo",
  "Execução penal",
  "Suspensão processual",
] as const;

const NUMERO_CNJ = /\b\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\b/;

/**
 * Número apenas INDICATIVO, extraído do nome do arquivo ou do cabeçalho do PDF.
 * Nunca autoriza busca automática de processos nem comprova a identidade dos autos.
 */
export function numeroCandidatoPdf(nomeArquivo: string, textoPdf: string): string | null {
  return nomeArquivo.match(NUMERO_CNJ)?.[0] ??
    textoPdf.slice(0, 4_000).match(NUMERO_CNJ)?.[0] ??
    null;
}

export function tituloHistoricoCalculo(tipo: string, nomeArquivo: string, numeroCandidato: string | null) {
  const resumo = numeroCandidato ?? nomeArquivo.replace(/\.pdf$/i, "").slice(0, 36);
  return PREFIXO_HISTORICO_CALCULO + tipo + (resumo ? " · " + resumo : "");
}

export function ehHistoricoCalculo(titulo: string): boolean {
  return titulo.startsWith(PREFIXO_HISTORICO_CALCULO) ||
    TITULOS_ANTIGOS.some((nome) => titulo === nome || titulo.startsWith(nome + " — "));
}

export function historicosDoMesmoProcesso(
  historicos: ReadonlyArray<{ titulo: string }>,
  numeroCandidato: string | null,
): number {
  if (!numeroCandidato) return 0;
  return historicos.filter((item) => ehHistoricoCalculo(item.titulo) &&
    item.titulo.includes(numeroCandidato)).length;
}

