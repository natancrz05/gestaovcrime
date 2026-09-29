import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Message = { role: "user" | "assistant"; content: string };

const INSTRUCOES = `
Você é o Assistente da Vara, um assistente interno de apoio à serventia de uma Vara Criminal brasileira.

Funções:
- responder perguntas gerais;
- explicar conceitos jurídicos de forma prática;
- melhorar, revisar, reescrever e estruturar minutas, certidões, despachos administrativos, relatórios e comunicações;
- resumir e organizar textos fornecidos pelo usuário;
- quando houver dados do acervo fornecidos no contexto, responder com base neles e deixar claro quando a informação não estiver disponível.

Regras:
1. Não invente dados de processos, nomes, datas, IDs ou atos.
2. Quando a pergunta envolver o acervo, dê preferência aos dados encontrados no sistema.
3. Não trate uma sugestão de redação como decisão judicial.
4. Não substitua a análise do servidor ou do magistrado.
5. Em matéria jurídica, diferencie texto legal, entendimento e sugestão prática quando isso for relevante.
6. Para uma minuta, preserve o sentido e prefira linguagem objetiva, formal e adequada à rotina cartorária.
7. Se o usuário apenas pedir para melhorar um texto, entregue diretamente a versão melhorada.
`;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

async function buscarContexto(supabase: ReturnType<typeof createClient>, pergunta: string) {
  const numero = pergunta.match(/\b\d{7}-\d{2}\.\d{4}\.\d{1,2}\.\d{2}\.\d{4}\b/)?.[0];
  const encontrados: string[] = [];

  if (numero) {
    const { data: processo } = await supabase
      .from("processos")
      .select("id, numero, classe, assunto, status, fase, responsavel, data_distribuicao, pje_reu")
      .eq("numero", numero)
      .maybeSingle();

    if (processo) {
      const { data: reus } = await supabase
        .from("reus")
        .select("nome, situacao, preso, tipo_prisao, data_prisao, especie_cautelar, observacoes")
        .eq("processo_id", processo.id);

      const { data: movimentos } = await supabase
        .from("movimentacoes")
        .select("data, descricao, tipo")
        .eq("processo_id", processo.id)
        .order("data", { ascending: false })
        .limit(20);

      const { data: audiencias } = await supabase
        .from("audiencias")
        .select("tipo, data, horario, modalidade, local, situacao, observacao")
        .eq("processo_id", processo.id)
        .order("data", { ascending: false })
        .limit(20);

      encontrados.push(JSON.stringify({
        processo,
        reus: reus ?? [],
        movimentacoes: movimentos ?? [],
        audiencias: audiencias ?? [],
      }));
    }
  }

  if (/réu preso|réus presos|preso|custodiad/i.test(pergunta)) {
    const { data: presos, count } = await supabase
      .from("reus")
      .select("nome, processo_id, situacao, tipo_prisao, data_prisao, especie_cautelar, processos(numero)", { count: "exact" })
      .eq("preso", true)
      .order("nome")
      .limit(60);
    encontrados.push(JSON.stringify({ total: count ?? presos?.length ?? 0, reus_presos: presos ?? [] }));
  }

  if (/audiência|audiencia/i.test(pergunta)) {
    const { data: audiencias } = await supabase
      .from("audiencias")
      .select("tipo, data, horario, situacao, modalidade, local, processos(numero)")
      .order("data")
      .limit(60);
    encontrados.push(JSON.stringify({ audiencias: audiencias ?? [] }));
  }

  if (/comparecimento/i.test(pergunta)) {
    const { data: comparecimentos } = await supabase
      .from("comparecimentos")
      .select("pessoa, proximo, situacao, periodicidade, processos(numero)")
      .order("proximo")
      .limit(60);
    encontrados.push(JSON.stringify({ comparecimentos: comparecimentos ?? [] }));
  }

  return encontrados;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return json({ error: "Não autenticado." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!supabaseUrl || !supabaseAnonKey) return json({ error: "Integração Supabase não configurada." }, 500);
  if (!openaiKey) return json({ error: "A chave da IA ainda não foi configurada no servidor." }, 500);

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: auth } },
  });

  const { data: usuario, error: authError } = await supabase.auth.getUser();
  if (authError || !usuario.user) return json({ error: "Sessão inválida ou expirada." }, 401);

  const body = await req.json().catch(() => null);
  const mensagens = Array.isArray(body?.messages) ? body.messages : [];
  const validas = mensagens
    .filter((m: Message) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-20)
    .map((m: Message) => ({ role: m.role, content: m.content.slice(0, 12000) }));

  if (!validas.length) return json({ error: "Envie uma pergunta." }, 400);

  const ultima = validas[validas.length - 1];
  const contexto = await buscarContexto(supabase, ultima.content);

  const contextoTexto = contexto.length
    ? "\n\nDADOS ENCONTRADOS NO ACERVO DA VARA — use somente como fonte factual:\n" + contexto.join("\n")
    : "\n\nNenhum dado específico do acervo foi localizado para esta pergunta. Não invente dados.";

  const resposta = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: Deno.env.get("OPENAI_MODEL") || "gpt-5.6-luna",
      instructions: INSTRUCOES + contextoTexto,
      input: validas,
      max_output_tokens: 3000,
      store: false,
    }),
  });

  if (!resposta.ok) {
    const erro = await resposta.text();
    console.error("OpenAI:", erro);
    return json({ error: "O serviço de IA não respondeu. Tente novamente." }, 502);
  }

  const dados = await resposta.json();
  const texto = dados.output_text ||
    dados.output?.flatMap((item: { type?: string; content?: { type?: string; text?: string }[] }) =>
      item.type === "message" ? (item.content ?? []).filter((c) => c.type === "output_text").map((c) => c.text ?? "") : []
    ).join("\n") ||
    "Não foi possível obter uma resposta.";

  return json({ resposta: texto, contextoEncontrado: contexto.length ? ["Dados do acervo consultados"] : [] });
});
