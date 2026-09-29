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

  const url = import.meta.env.VITE_SUPABASE_URL || "";
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
  if (!url || !key) throw new Error("Integração com o sistema não configurada.");

  const resposta = await fetch(`${url}/functions/v1/swift-task`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: key,
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ messages: mensagens.slice(-20) }),
  });

  const body = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new Error(body.error || "Não foi possível obter resposta do assistente.");
  return body as RespostaAssistente;
}
