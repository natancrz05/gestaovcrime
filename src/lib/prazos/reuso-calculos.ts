/** Regras puras de reaproveitamento. Nunca recebem IDs de conversas privadas. */
export const DIAS_REUSO_IA = 30;
export const UNIDADE_REUSO_IA = "VARA_CORACAO_DE_MARIA_BA";

export const TIPOS_REUSO_IA = [
  "prescricao", "prisao_provisoria", "manifestacoes",
  "excesso", "execucao", "suspensao",
] as const;
export type TipoReusoIA = (typeof TIPOS_REUSO_IA)[number];
export type ModalidadeReusoIA = "identificar" | "preventiva" | "temporaria" | "flagrante" | "outra";

const CNJ_GLOBAL = /\b\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\b/g;

/**
 * Triagem conservadora de sigilo no texto dos autos. Na dúvida, NÃO compartilhar.
 * Não substitui classificação judicial de sigilo ou controle por processo.
 */
export function documentoSinalizaSigilo(texto: string): boolean {
  const amostra = texto.slice(0, 30000).normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return /segredo\s+de\s+justica|tramit[a-z]*\s+em\s+segredo|autos\s+sigilosos?|processo\s+sigiloso|sigilo\s+total|sigilo\s+judicial|sigilo\s*:\s*(?:sim|total|[1-9])|grau\s+de\s+sigilo\s*:\s*[1-9]|classe\s+de\s+sigilo\s*:\s*[1-9]/.test(amostra);
}

/** Só usa o número do conteúdo extraído, jamais apenas o nome do arquivo. */
export function numeroUnicoDoPdf(texto: string): string | null {
  const candidatos = [...new Set(texto.slice(0, 4000).match(CNJ_GLOBAL) ?? [])];
  return candidatos.length === 1 ? candidatos[0]! : null;
}

export interface ReferenciaRelatorio {
  id: string;
  processo_numero: string;
  tipo_analise: string;
  modalidade_prisao: string | null;
  nome_reu: string | null;
  data_referencia: string;
  criado_em: string;
}

export function nomeComparavel(nome: string | null | undefined) {
  return (nome ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Reaproveitamento exige o mesmo processo, modalidade, subtipo de prisão e
 * referência temporal não posterior à nova consulta. Dados de réus distintos
 * nunca se confundem; em identificação incompleta, a UI exige conferência.
 */
export function elegivelParaReuso(
  registro: ReferenciaRelatorio,
  params: {
    numero: string;
    tipo: TipoReusoIA;
    modalidade?: ModalidadeReusoIA | null;
    nomeReu?: string | null;
    dataReferencia: string;
    agora: Date;
  },
): boolean {
  if (registro.processo_numero !== params.numero || registro.tipo_analise !== params.tipo) return false;
  if ((registro.modalidade_prisao ?? null) !== (params.tipo === "prisao_provisoria" ? (params.modalidade ?? "identificar") : null)) return false;
  if (registro.data_referencia > params.dataReferencia) return false;
  const dias = params.agora.getTime() - new Date(registro.criado_em).getTime();
  if (!Number.isFinite(dias) || dias < 0 || dias > DIAS_REUSO_IA * 86400000) return false;
  const antigo = nomeComparavel(registro.nome_reu);
  const atual = nomeComparavel(params.nomeReu);
  // Em feitos com mais de um réu, identidade ausente é ambígua. Falhe fechado.
  // A numeração do processo, isoladamente, NÃO autoriza reutilizar relatório de outra pessoa.
  if (!antigo || !atual || antigo !== atual) return false;
  return true;
}
