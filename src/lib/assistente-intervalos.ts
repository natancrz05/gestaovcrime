import { z } from "zod";
import { medirIntervalo } from "./prazos/intervalos";

/** Aritmética somente leitura; a IA identifica e justifica os marcos jurídicos. */
export const FERRAMENTA_INTERVALO = {
  type: "function",
  name: "medir_intervalo_cronologico",
  description: "Mede dias corridos entre duas datas confirmadas, descontando somente suspensões comprovadas informadas pelo modelo. Consolida períodos sobrepostos. O marco de 90 dias é EXCLUSIVO da prisão preventiva comprovada; não se aplica automaticamente a flagrante, temporária ou outras hipóteses. NÃO calcula prescrição penal em anos e NÃO verifica juridicamente a validade dos marcos. Para prazo de intimação/manifestações use calcular_prazo_processual.",
  parameters: {
    type: "object",
    properties: {
      inicio: { type: "string", description: "Data inicial comprovada, formato AAAA-MM-DD." },
      fim: { type: "string", description: "Data final ou data de referência comprovada, formato AAAA-MM-DD." },
      suspensoes: {
        type: "array",
        description: "Apenas períodos de suspensão comprovados, formato inclusive de início e fim; não confundir com marcos interruptivos.",
        items: {
          type: "object",
          properties: {
            inicio: { type: "string" },
            fim: { type: "string" },
          },
          required: ["inicio", "fim"],
          additionalProperties: false,
        },
      },
      calcularMarco90: {
        type: "boolean",
        description: "Use true EXCLUSIVAMENTE para preventiva comprovada, com data inicial correspondente à última decisão judicial fundamentada de revisão ou à decretação comprovada. Exige modalidadePrisao=preventiva.",
      },
      modalidadePrisao: {
        type: "string",
        enum: ["preventiva", "temporaria", "flagrante", "outra", "indefinida"],
        description: "Modalidade JURÍDICA comprovada nos autos, não apenas rótulo escolhido na interface; só preventiva permite marco de 90 dias.",
      },
    },
    required: ["inicio", "fim"],
    additionalProperties: false,
  },
} as const;

const Data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Entrada = z.object({
  inicio: Data,
  fim: Data,
  suspensoes: z.array(z.object({ inicio: Data, fim: Data })).max(50).optional(),
  calcularMarco90: z.boolean().optional(),
  modalidadePrisao: z.enum(["preventiva", "temporaria", "flagrante", "outra", "indefinida"]).optional(),
});

export function executarMedicaoIntervalo(argumentos: Record<string, unknown>) {
  const dados = Entrada.parse(argumentos);
  if (dados.calcularMarco90 && dados.modalidadePrisao !== "preventiva") {
    throw new Error("Referência de 90 dias exclusiva de prisão preventiva juridicamente confirmada (CPP art. 316). Para as demais hipóteses, informe calcularMarco90=false.");
  }
  return {
    natureza: "Aritmética cronológica de apoio; não é decisão jurídica.",
    ...medirIntervalo(dados.inicio, dados.fim, dados.suspensoes ?? [], dados.calcularMarco90 ?? false),
  };
}
