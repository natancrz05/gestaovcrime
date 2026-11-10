export type OrigemCredencialOpenAI = "chatgpt_plan" | "api_key";

export interface CredencialOpenAI {
  token: string;
  origem: OrigemCredencialOpenAI;
}

const PREFERENCIA_MODELOS = [
  "gpt-6.1-sol",
  "gpt-6-astra",
  "gpt-5.6-sol",
  "gpt-5.6",
] as const;

/**
 * O Assistente não usa mais o gateway/créditos da Lovable.
 *
 * Prioridade:
 * 1. OAuth do plano ChatGPT (gratuito dentro da franquia autorizada do usuário).
 * 2. API key somente se o administrador habilitar explicitamente o fallback pago.
 *
 * OPENAI_CHATGPT_ACCESS_TOKEN é uma ponte temporária para testes e será
 * substituída pelo token OAuth por usuário quando o client ID do Sign in with
 * ChatGPT for aprovado pela OpenAI.
 */
export function credencialOpenAI(
  env: NodeJS.ProcessEnv = process.env,
): CredencialOpenAI {
  const chatgpt = env["OPENAI_CHATGPT_ACCESS_TOKEN"]?.trim();
  if (chatgpt) return { token: chatgpt, origem: "chatgpt_plan" };

  const apiKey = env["OPENAI_API_KEY"]?.trim();
  const permitirPago = env["OPENAI_ALLOW_PAID_API"] === "true";
  if (apiKey && permitirPago) return { token: apiKey, origem: "api_key" };

  throw new Error(
    "ChatGPT ainda não está conectado ao Assistente. O uso pela Lovable foi desativado para não consumir créditos. Conecte o plano ChatGPT quando o acesso OAuth do aplicativo estiver habilitado.",
  );
}

type ModeloCatalogo = {
  slug?: string;
  id?: string;
  display_name?: string;
  visibility?: string;
};

function modelosDoCatalogo(json: unknown): ModeloCatalogo[] {
  if (!json || typeof json !== "object") return [];
  const obj = json as { models?: unknown; data?: unknown };
  if (Array.isArray(obj.models)) return obj.models as ModeloCatalogo[];
  if (Array.isArray(obj.data)) return obj.data as ModeloCatalogo[];
  return [];
}

export async function resolverModeloOpenAI(
  credencial: CredencialOpenAI,
  env: NodeJS.ProcessEnv = process.env,
): Promise<string> {
  const configurado = env["OPENAI_MODEL"]?.trim();
  if (configurado) return configurado;

  const res = await fetch("https://api.openai.com/v1/models", {
    headers: { Authorization: `Bearer ${credencial.token}` },
  });
  if (!res.ok) {
    throw new Error(
      credencial.origem === "chatgpt_plan"
        ? "Não foi possível consultar os modelos disponíveis no seu plano ChatGPT."
        : "Não foi possível consultar os modelos disponíveis na OpenAI API.",
    );
  }

  const modelos = modelosDoCatalogo(await res.json());
  const visiveis = modelos.filter((m) => m.visibility === undefined || m.visibility === "list");
  const ids = visiveis
    .map((m) => m.slug ?? m.id)
    .filter((id): id is string => Boolean(id));

  for (const preferido of PREFERENCIA_MODELOS) {
    if (ids.includes(preferido)) return preferido;
  }

  const primeiro = ids[0];
  if (!primeiro) throw new Error("Nenhum modelo ChatGPT compatível foi disponibilizado para esta conta.");
  return primeiro;
}

export async function respostaOpenAI({
  token,
  model,
  instructions,
  input,
}: {
  token: string;
  model: string;
  instructions: string;
  input: Array<{ role: "user" | "assistant"; content: string }>;
}): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      model,
      instructions,
      input,
      reasoning: { effort: "low" },
      store: false,
      stream: true,
    }),
  });

  if (!res.ok || !res.body) {
    const corpo = await res.text().catch(() => "");
    console.error("OpenAI Responses", res.status, corpo);

    if (res.status === 429) {
      if (
        corpo.includes("subscription_sharing_usage_limit_exceeded") ||
        corpo.includes("subscription_sharing_usage_unavailable")
      ) {
        throw new Error("O limite de uso compartilhado do seu plano ChatGPT foi atingido ou está temporariamente indisponível.");
      }
      throw new Error("Limite da OpenAI atingido. Tente novamente mais tarde.");
    }
    if (res.status === 401 || res.status === 403) {
      throw new Error("A conexão com o ChatGPT expirou ou não possui permissão para usar o plano. Reconecte sua conta.");
    }
    throw new Error("O ChatGPT não respondeu. Tente novamente.");
  }

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let texto = "";
  let concluida = false;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const linhas = buf.split("\n");
    buf = linhas.pop() ?? "";

    for (const linha of linhas) {
      if (!linha.startsWith("data:")) continue;
      const dado = linha.slice(5).trim();
      if (!dado || dado === "[DONE]") continue;

      try {
        const evento = JSON.parse(dado) as {
          type?: string;
          delta?: string;
          response?: { error?: { code?: string; message?: string } };
          error?: { code?: string; message?: string };
        };

        if (evento.type === "response.output_text.delta") texto += evento.delta ?? "";
        if (evento.type === "response.completed") concluida = true;

        if (evento.type === "response.failed" || evento.type === "error") {
          const codigo = evento.response?.error?.code ?? evento.error?.code ?? "";
          if (
            codigo === "subscription_sharing_usage_limit_exceeded" ||
            codigo === "subscription_sharing_usage_unavailable"
          ) {
            throw new Error("O limite de uso compartilhado do seu plano ChatGPT foi atingido ou está temporariamente indisponível.");
          }
          throw new Error(evento.response?.error?.message ?? evento.error?.message ?? "Falha na resposta do ChatGPT.");
        }
      } catch (erro) {
        if (erro instanceof SyntaxError) continue;
        throw erro;
      }
    }
  }

  if (!concluida && !texto) throw new Error("A resposta do ChatGPT foi interrompida.");
  return texto || "Não foi possível obter uma resposta.";
}
