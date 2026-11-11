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

const CAMPOS_REU = /(?:^|[\n;]|\\b)(?:r[eé]u|acusad[oa]|denunciad[oa]|flagrantead[oa]|investigad[oa]|polo\s+passivo)\s*:\s*([^\n;]{0,130})/gim;
const NOME_PROPRIO = /^(?:(?:[A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ'-]+|[A-ZÀ-ÖØ-Þ]{2,}|da|de|do|das|dos)\s+){1,8}(?:[A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ'-]+|[A-ZÀ-ÖØ-Þ]{2,})/;
const NAO_NOME = new Set(["PODER", "JUSTIÇA", "TRIBUNAL", "ESTADO", "COMARCA", "PROCESSO", "AUTOS", "NÃO", "LOCALIZADO", "DESCONHECIDO", "IDENTIFICADO"]);

/**
 * Obtém o nome apenas de um campo explícito do PDF.
 * Não deduz a identidade de pessoas citadas na narrativa ou de testemunhas.
 * Como a extração do PDF pode agrupar linhas, o reconhecimento é conservador.
 */
export function nomeReuCandidatoPdf(textoPdf: string): string | null {
  const trecho = textoPdf.slice(0, 30_000);
  for (const achado of trecho.matchAll(CAMPOS_REU)) {
    const candidato = (achado[1] ?? "")
      .replace(/\s+(?:CPF|RG|NASCIMENTO|IDADE|PROCESSO|AUTOR|ADVOGADO|DEFENSOR|MINIST[EÉ]RIO|CLASSE|ASSUNTO|TRIBUNAL|DATA)\b.*$/i, "")
      .trim();
    const nome = candidato.match(NOME_PROPRIO)?.[0]?.trim();
    if (!nome) continue;
    const palavras = nome.split(/\s+/);
    const substantivas = palavras.filter((p) => !/^(?:da|de|do|das|dos)$/i.test(p));
    if (substantivas.length < 2 || substantivas.some((p) => NAO_NOME.has(p.toUpperCase()))) continue;
    return nome.replace(/\s+/g, " ").slice(0, 58);
  }
  return null;
}

/**
 * Os títulos novos privilegiam o número CNJ e o nome expresso do réu.
 * O tipo de análise continua no relatório; o prefixo é interno para separar
 * essas conversas das conversas comuns do Assistente.
 */
export function tituloHistoricoCalculo(
  tipo: string, nomeArquivo: string, numeroCandidato: string | null, nomeReu: string | null = null,
) {
  if (numeroCandidato) {
    const identificacao = numeroCandidato + (nomeReu ? " — " + nomeReu : "");
    return (PREFIXO_HISTORICO_CALCULO + identificacao).slice(0, 85);
  }
  const resumo = nomeArquivo.replace(/\.pdf$/i, "").slice(0, 36);
  return PREFIXO_HISTORICO_CALCULO + tipo + (resumo ? " · " + resumo : "");
}

/** Adapta títulos antigos para começarem pelo número do processo, se constar. */
export function tituloVisivelHistorico(titulo: string): string {
  const limpo = titulo.startsWith(PREFIXO_HISTORICO_CALCULO)
    ? titulo.slice(PREFIXO_HISTORICO_CALCULO.length)
    : titulo;
  const numero = limpo.match(NUMERO_CNJ)?.[0];
  if (!numero) return limpo;
  if (limpo.startsWith(numero)) return limpo;
  const tipoAntigo = limpo.slice(0, limpo.indexOf(numero)).replace(/[\s·—-]+$/g, "").trim();
  return numero + (tipoAntigo ? " · " + tipoAntigo : "");
}

export const TAMANHO_PAGINA_HISTORICO = 5;

export function paginarHistorico<T>(itens: readonly T[], pagina: number) {
  const totalPaginas = Math.max(1, Math.ceil(itens.length / TAMANHO_PAGINA_HISTORICO));
  const paginaAtual = Number.isFinite(pagina)
    ? Math.min(totalPaginas, Math.max(1, Math.trunc(pagina))) : 1;
  const inicio = (paginaAtual - 1) * TAMANHO_PAGINA_HISTORICO;
  return {
    registros: itens.slice(inicio, inicio + TAMANHO_PAGINA_HISTORICO),
    paginaAtual,
    totalPaginas,
    inicio: itens.length ? inicio + 1 : 0,
    fim: Math.min(inicio + TAMANHO_PAGINA_HISTORICO, itens.length),
    total: itens.length,
  };
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

