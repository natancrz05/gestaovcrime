import type { SupabaseClient } from "@supabase/supabase-js";

export const FERRAMENTAS_ACERVO = [
  {
    type: "function",
    name: "buscar_processo",
    description: "Busca processos no acervo interno por número CNJ ou por termo textual. Use antes de afirmar dados de um processo que não estejam em arquivo anexado.",
    parameters: {
      type: "object",
      properties: {
        termo: { type: "string", description: "Número CNJ completo ou termo de busca." },
      },
      required: ["termo"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "detalhar_processo",
    description: "Obtém a ficha completa de um processo do acervo, incluindo partes, réus, movimentações, audiências, pendências, prioridades, observações internas e etiquetas. É somente leitura.",
    parameters: {
      type: "object",
      properties: {
        numero: { type: "string", description: "Número CNJ do processo." },
      },
      required: ["numero"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "buscar_reu",
    description: "Busca réus pelo nome no acervo e informa os processos relacionados e situação prisional cadastrada.",
    parameters: {
      type: "object",
      properties: {
        nome: { type: "string", description: "Nome ou parte do nome do réu." },
      },
      required: ["nome"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "listar_presos",
    description: "Lista os réus atualmente marcados como presos no acervo, com tipo e data da prisão e processo principal.",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
] as const;

function termoSeguro(valor: string) {
  return valor.trim().replace(/[,%()]/g, " ").replace(/\s+/g, " ").slice(0, 120);
}

function falha(error: { message?: string } | null) {
  if (error) throw new Error(error.message || "Falha ao consultar o acervo.");
}

export async function executarFerramentaAcervo(
  sb: SupabaseClient,
  nome: string,
  argumentos: Record<string, unknown>,
): Promise<unknown> {
  if (nome === "buscar_processo") {
    const termo = termoSeguro(String(argumentos["termo"] ?? ""));
    if (!termo) return { processos: [] };

    const numeroCnj = termo.match(/\b\d{7}-\d{2}\.\d{4}\.\d{1,2}\.\d{2}\.\d{4}\b/)?.[0];
    let consulta = sb
      .from("processos")
      .select("id,numero,classe,assunto,status,fase,responsavel,data_distribuicao,pje_situacao,pje_tarefas,pje_ultima_mov_data,pje_ultima_mov_descricao,pje_reu,pje_localizacao")
      .limit(12);

    consulta = numeroCnj
      ? consulta.eq("numero", numeroCnj)
      : consulta.or(
          `numero.ilike.%${termo}%,classe.ilike.%${termo}%,assunto.ilike.%${termo}%,pje_reu.ilike.%${termo}%,responsavel.ilike.%${termo}%`,
        );

    const { data, error } = await consulta.order("numero");
    falha(error);
    return { processos: data ?? [], total_retornado: data?.length ?? 0 };
  }

  if (nome === "detalhar_processo") {
    const numero = termoSeguro(String(argumentos["numero"] ?? ""));
    if (!numero) return { encontrado: false };

    const { data: processo, error } = await sb
      .from("processos")
      .select("*")
      .eq("numero", numero)
      .maybeSingle();
    falha(error);
    if (!processo) return { encontrado: false, numero };

    const id = processo.id;
    const [partes, reus, movimentacoes, audiencias, pendencias, prioridades, observacoes, etiquetas] =
      await Promise.all([
        sb.from("partes").select("*").eq("processo_id", id).order("nome"),
        sb.from("reus").select("*").eq("processo_id", id).order("ordem"),
        sb.from("movimentacoes").select("*").eq("processo_id", id).order("data", { ascending: false }).limit(250),
        sb.from("audiencias").select("*").eq("processo_id", id).order("data", { ascending: false }).limit(100),
        sb.from("pendencias").select("*").eq("processo_id", id).limit(100),
        sb.from("prioridades").select("*").eq("processo_id", id).limit(100),
        sb.from("observacoes_internas").select("*").eq("processo_id", id).order("criado_em", { ascending: false }).limit(100),
        sb.from("processos_etiquetas").select("etiquetas(id,nome,cor,favorita)").eq("processo_id", id),
      ]);

    for (const resposta of [partes, reus, movimentacoes, audiencias, pendencias, prioridades, observacoes, etiquetas]) {
      falha(resposta.error);
    }

    return {
      encontrado: true,
      processo,
      partes: partes.data ?? [],
      reus: reus.data ?? [],
      movimentacoes: movimentacoes.data ?? [],
      movimentacoes_limitadas_a: 250,
      audiencias: audiencias.data ?? [],
      pendencias: pendencias.data ?? [],
      prioridades: prioridades.data ?? [],
      observacoes_internas: observacoes.data ?? [],
      etiquetas: etiquetas.data ?? [],
    };
  }

  if (nome === "buscar_reu") {
    const nomeBusca = termoSeguro(String(argumentos["nome"] ?? ""));
    if (!nomeBusca) return { reus: [] };

    const { data, error } = await sb
      .from("reus")
      .select("id,nome,situacao,preso,tipo_prisao,data_prisao,especie_cautelar,observacoes,processos(id,numero,classe,status,fase)")
      .ilike("nome", `%${nomeBusca}%`)
      .order("nome")
      .limit(30);
    falha(error);
    return { reus: data ?? [], total_retornado: data?.length ?? 0 };
  }

  if (nome === "listar_presos") {
    const { data, error, count } = await sb
      .from("reus")
      .select("id,nome,situacao,tipo_prisao,especie_cautelar,data_prisao,processos(id,numero,classe,status,fase)", { count: "exact" })
      .eq("preso", true)
      .order("nome")
      .limit(150);
    falha(error);
    return { presos: data ?? [], total: count ?? data?.length ?? 0, limite: 150 };
  }

  throw new Error(`Ferramenta de acervo não autorizada: ${nome}`);
}
