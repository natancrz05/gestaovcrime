import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const INSTRUCOES = `Você é o Assistente da Vara, assistente interno de apoio à serventia de uma Vara Criminal brasileira.
Funções: responder perguntas gerais; explicar conceitos jurídicos de forma prática; melhorar, revisar e estruturar minutas, certidões, despachos administrativos e comunicações; resumir textos; quando houver dados do acervo no contexto, responder com base neles.
Regras: não invente dados de processos, nomes, datas ou atos; não trate sugestão de redação como decisão judicial; não substitua a análise do servidor ou do magistrado; use linguagem formal e objetiva; se pedirem só para melhorar um texto, entregue diretamente a versão melhorada. Responda em até 600 palavras.`;

const Entrada = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(12000) }))
    .min(1)
    .max(20),
});

export const perguntarAssistente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Entrada.parse(d))
  .handler(async ({ data, context }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("A IA não está configurada no servidor.");
    const sb = context.supabase;
    const pergunta = data.messages[data.messages.length - 1]?.content ?? "";
    const ctx: string[] = [];

    const numero = pergunta.match(/\b\d{7}-\d{2}\.\d{4}\.\d{1,2}\.\d{2}\.\d{4}\b/)?.[0];
    if (numero) {
      const { data: p } = await sb.from("processos")
        .select("id, numero, classe, assunto, status, fase, responsavel, data_distribuicao")
        .eq("numero", numero).maybeSingle();
      if (p) {
        const [r, m, a] = await Promise.all([
          sb.from("reus").select("nome, situacao, preso, tipo_prisao, data_prisao").eq("processo_id", p.id),
          sb.from("movimentacoes").select("data, descricao").eq("processo_id", p.id).order("data", { ascending: false }).limit(15),
          sb.from("audiencias").select("tipo, data, horario, situacao").eq("processo_id", p.id).order("data", { ascending: false }).limit(10),
        ]);
        ctx.push(JSON.stringify({ processo: p, reus: r.data, movimentacoes: m.data, audiencias: a.data }));
      } else ctx.push(`Processo ${numero} não encontrado no acervo.`);
    }
    if (/pres[oa]s?\b|custodiad/i.test(pergunta)) {
      const { data: presos, count } = await sb.from("reus")
        .select("nome, tipo_prisao, data_prisao, processos(numero)", { count: "exact" })
        .eq("preso", true).order("nome").limit(60);
      ctx.push(JSON.stringify({ total_presos: count, presos }));
    }

    const instr = INSTRUCOES + (ctx.length
      ? "\n\nDADOS DO ACERVO (fonte factual):\n" + ctx.join("\n")
      : "\n\nNenhum dado do acervo foi consultado. Não invente dados.");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
        Authorization: `Bearer ${key}`,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        instructions: instr,
        input: data.messages,
        reasoning: { effort: "low" },
        store: false,
        stream: true,
      }),
    });

    if (!res.ok || !res.body) {
      const t = await res.text().catch(() => "");
      console.error("AI gateway", res.status, t);
      if (res.status === 429) throw new Error("Muitas solicitações. Aguarde um instante e tente novamente.");
      if (res.status === 402) throw new Error("Créditos de IA esgotados. Adicione créditos no workspace.");
      throw new Error("O serviço de IA não respondeu. Tente novamente.");
    }

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "", texto = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const linhas = buf.split("\n");
      buf = linhas.pop() ?? "";
      for (const l of linhas) {
        if (!l.startsWith("data:")) continue;
        const s = l.slice(5).trim();
        if (!s || s === "[DONE]") continue;
        try {
          const ev = JSON.parse(s);
          if (ev.type === "response.output_text.delta") texto += ev.delta ?? "";
          if (ev.type === "error" || ev.type === "response.failed") throw new Error("Falha na resposta da IA.");
        } catch (e) {
          if (e instanceof Error && e.message.startsWith("Falha")) throw e;
        }
      }
    }
    return { resposta: texto || "Não foi possível obter uma resposta." };
  });
