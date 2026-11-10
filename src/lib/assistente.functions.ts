import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { credencialOpenAI, resolverModeloOpenAI, respostaOpenAI } from "./assistente-openai";

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
    const credencial = credencialOpenAI();
    const modelo = await resolverModeloOpenAI(credencial);
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

    const texto = await respostaOpenAI({
      token: credencial.token,
      model: modelo,
      instructions: instr,
      input: data.messages,
    });

    return { resposta: texto };
  });
