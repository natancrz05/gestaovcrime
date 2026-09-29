import { perguntarAssistente } from "./assistente.functions";

export interface MensagemAssistente {
  role: "user" | "assistant";
  content: string;
}

export interface RespostaAssistente {
  resposta: string;
}

export async function perguntarAoAssistente(
  mensagens: MensagemAssistente[],
): Promise<RespostaAssistente> {
  return perguntarAssistente({ data: { messages: mensagens.slice(-20) } });
}
