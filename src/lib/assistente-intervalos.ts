import { z } from "zod";
import { medirIntervalo } from "./prazos/intervalos";

/** Aritmética somente leitura; a IA identifica e justifica os marcos jurídicos. */
export const FERRAMENTA_INTERVALO = {
  type: "function",
  name: "medir_intervalo_cronologico",
  description: "Mede dias corridos entre duas datas confirmadas, descontando somente suspensões comprovadas informadas pelo modelo. Consolida períodos sobrepostos. Opcionalmente calcula referência de 90 dias desde a última decisão de revisão da preventiva. NÃO calcula prescrição penal em anos e NÃO verifica juridicamente a validade dos marcos. Para prazo de intimação/manifestações use calcular_prazo_processual.",
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
        description: "Somente quando for revisão de preventiva e a data inicial for a última decisão de revisão válida ou a decretação, conforme os autos.",
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
});

export function executarMedicaoIntervalo(argumentos: Record<string, unknown>) {
  const dados = Entrada.parse(argumentos);
  return {
    natureza: "Aritmética cronológica de apoio; não é decisão jurídica.",
    ...medirIntervalo(dados.inicio, dados.fim, dados.suspensoes ?? [], dados.calcularMarco90 ?? false),
  };
}
