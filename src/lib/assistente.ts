import { perguntarAssistente } from "./assistente.functions";
import type { ModalidadePrisao } from "./prazos/revisao-prisao";

export interface MensagemAssistente {
  role: "user" | "assistant";
  content: string;
}

export interface ArquivoAssistente {
  nome: string;
  tipo: string;
  texto: string;
  paginas?: number;
  paginasLidas?: number;
  paginasSemTexto?: number[];
  truncado?: boolean;
}

export interface ContextoCalculoAssistente {
  tipoAnalise: "prescricao" | "preventiva" | "prisao_provisoria" | "manifestacoes" | "excesso" | "execucao" | "suspensao";
  modalidadePrisao?: ModalidadePrisao;
  numeroProcesso?: string;
  dataReferencia: string;
}

export interface RespostaAssistente {
  resposta: string;
  persistida: boolean;
}

export async function perguntarAoAssistente(
  mensagens: MensagemAssistente[],
  arquivos: ArquivoAssistente[] = [],
  destino?: { conversaId: string; respostaId: string },
  contextoCalculo?: ContextoCalculoAssistente,
): Promise<RespostaAssistente> {
  return perguntarAssistente({
    data: {
      messages: mensagens.slice(-20),
      arquivos: arquivos.slice(0, 2),
      ...(destino ? { conversaId: destino.conversaId, respostaId: destino.respostaId } : {}),
      ...(contextoCalculo ? { tipoAnalise: contextoCalculo.tipoAnalise, dataReferencia: contextoCalculo.dataReferencia, ...(contextoCalculo.numeroProcesso ? { numeroProcesso: contextoCalculo.numeroProcesso } : {}), ...(contextoCalculo.modalidadePrisao ? { modalidadePrisao: contextoCalculo.modalidadePrisao } : {}) } : {}),
    },
  });
}
