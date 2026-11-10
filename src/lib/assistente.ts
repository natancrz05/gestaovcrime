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
  persistida: boolean;
}

export async function perguntarAoAssistente(
  mensagens: MensagemAssistente[],
  arquivos: ArquivoAssistente[] = [],
  destino?: { conversaId: string; respostaId: string },
): Promise<RespostaAssistente> {
  return perguntarAssistente({
    data: {
      messages: mensagens.slice(-20),
      arquivos: arquivos.slice(0, 2),
      ...(destino ? { conversaId: destino.conversaId, respostaId: destino.respostaId } : {}),
    },
  });
}
