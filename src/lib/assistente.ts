import { supabase } from "@/integrations/supabase/client";

export interface MensagemAssistente {
  role: "user" | "assistant";
  content: string;
}

export interface RespostaAssistente {
  resposta: string;
  contextoEncontrado?: string[];
}

export async function perguntarAoAssistente(
  mensagens: MensagemAssistente[],
): Promise<RespostaAssistente> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Sessão expirada. Entre novamente no sistema.");

  const { data, error } = await supabase.functions.invoke("assistente", {
    body: { messages: mensagens.slice(-20) },
  });

  if (error) {
    let detalhe = error.message || "Não foi possível obter resposta do assistente.";
    const contextoErro = (error as { context?: Response }).context;
    if (contextoErro) {
      const body = await contextoErro.clone().json().catch(() => null) as { error?: string } | null;
      if (body?.error) detalhe = body.error;
    }
    throw new Error(detalhe);
  }

  return data as RespostaAssistente;
}
