import { z } from "zod";
import { calcularPrazoProcessual } from "./prazos/calculo";

/**
 * Esta ferramenta executa aritmética de PRAZOS PROCESSUAIS
 * validada pelo motor local. Não decide prescrição penal.
 */
export const FERRAMENTA_CALCULO_PRAZO = {
  type: "function",
  name: "calcular_prazo_processual",
  description: "Calcula prazo processual em dias para o TJBA/Coração de Maria, usando CPP art. 798/798-A, CPC art. 219/220 e Lei 9.099 art. 12-A. NÃO serve para prescrição penal ou prazo material. Exige data efetiva da publicação, prazo legal e classificação correta. Retorna vencimento auditável e alertas de calendário.",
  parameters: {
    type: "object",
    properties: {
      publicacao: { type: "string", description: "Data efetiva da publicação no formato AAAA-MM-DD; NÃO a disponibilização no diário." },
      prazoDias: { type: "integer", description: "Número de dias de prazo confirmado nos autos/lei." },
      materia: { type: "string", enum: ["civil", "penal", "jec_civil", "jec_criminal"] },
      excecaoRecesso: { type: "string", enum: ["nenhuma", "reu_preso", "maria_penha", "urgente"], description: "Exceção comprovada do art. 798-A CPP." },
    },
    required: ["publicacao", "prazoDias", "materia", "excecaoRecesso"],
    additionalProperties: false,
  },
} as const;

const Entrada = z.object({
  publicacao: z.string(),
  prazoDias: z.number().int().min(1).max(3650),
  materia: z.enum(["civil", "penal", "jec_civil", "jec_criminal"]),
  excecaoRecesso: z.enum(["nenhuma", "reu_preso", "maria_penha", "urgente"]),
});

export function executarCalculoPrazo(args: Record<string, unknown>) {
  const dados = Entrada.parse(args);
  return {
    natureza: "Cálculo processual, não prescrição penal",
    local: "Coração de Maria/BA — TJBA",
    ...calcularPrazoProcessual(dados),
  };
}
