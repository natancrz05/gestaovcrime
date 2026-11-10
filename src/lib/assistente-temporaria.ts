import { z } from "zod";
import { conferirPrazoTemporaria } from "./prazos/temporaria";

export const FERRAMENTA_PRAZO_TEMPORARIA = {
  type: "function",
  name: "conferir_prazo_temporaria",
  description: "Confere prazo de prisão temporária indicado em mandado ou decisão judicial. Conta o dia do cumprimento como primeiro dia (Lei 7.960/1989, art. 2º, § 8º). NÃO é a contagem (início, fim] usada em intervalos genéricos. Use somente quando a natureza TEMPORÁRIA e a efetivação do mandado estiverem comprovadas. Confira a data de libertação determinada no mandado e decisões posteriores de prorrogação/conversão. NÃO aplica art. 316 CPP ou prazo de 90 dias.",
  parameters: {
    type: "object",
    properties: {
      modalidadePrisao: {
        type: "string",
        enum: ["temporaria"],
        description: "A prisão efetivamente comprovada nos autos é TEMPORÁRIA.",
      },
      dataCumprimento: { type: "string", description: "Data de cumprimento efetivo do mandado, AAAA-MM-DD." },
      prazoDiasMandado: { type: "integer", description: "Número de dias constantes do mandado/decisão da medida analisada; não presumir prorrogação." },
      dataReferencia: { type: "string", description: "Data de referência da análise, AAAA-MM-DD." },
      dataLibertacaoMandado: { type: "string", description: "Data de libertação explicitamente constante no mandado, se disponível." },
    },
    required: ["modalidadePrisao", "dataCumprimento", "prazoDiasMandado", "dataReferencia"],
    additionalProperties: false,
  },
} as const;

const Data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Entrada = z.object({
  modalidadePrisao: z.literal("temporaria"),
  dataCumprimento: Data,
  prazoDiasMandado: z.number().int().min(1).max(120),
  dataReferencia: Data,
  dataLibertacaoMandado: Data.optional(),
});

export function executarPrazoTemporaria(argumentos: Record<string, unknown>) {
  const dados = Entrada.parse(argumentos);
  return conferirPrazoTemporaria({
    dataCumprimento: dados.dataCumprimento,
    prazoDiasMandado: dados.prazoDiasMandado,
    dataReferencia: dados.dataReferencia,
    ...(dados.dataLibertacaoMandado !== undefined ? { dataLibertacaoMandado: dados.dataLibertacaoMandado } : {}),
  });
}
