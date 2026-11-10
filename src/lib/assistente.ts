import { perguntarAssistente } from "./assistente.functions";

export interface MensagemAssistente {
  role: "user" | "assistant";
  content: string;
}

export interface ArquivoAssistente {
  nome: string;
  tipo: string;
  texto: string;
  paginas?: number;
  truncado?: boolean;
}

export interface RespostaAssistente {
  resposta: string;
}

export async function perguntarAoAssistente(
  mensagens: MensagemAssistente[],
  arquivos: ArquivoAssistente[] = [],
): Promise<RespostaAssistente> {
  return perguntarAssistente({
    data: {
      messages: mensagens.slice(-20),
      arquivos: arquivos.slice(0, 2),
    },
  });
}
