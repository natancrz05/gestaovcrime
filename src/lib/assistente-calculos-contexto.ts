import type { SupabaseClient } from "@supabase/supabase-js";

const AVISO =
  "Dados administrativos da plataforma Vara Crime, sujeitos a desatualização, incompletude e inconsistência. " +
  "IDs internos não são automaticamente IDs de documentos do PJe. " +
  "Registros de reavaliação no cadastro não comprovam, por si, decisão fundamentada do art. 316 do CPP. " +
  "O PDF e as decisões judiciais devem ser conferidos; não deduza que ato ausente no cadastro não existiu.";

export async function consultarContextoCalculo(
  sb: SupabaseClient,
  numero: string,
) {
  const { data: processo, error } = await sb
    .from("processos")
    .select("id,numero,classe,assunto,status,fase,data_distribuicao,pje_situacao,pje_ultima_mov_data,pje_ultima_mov_descricao")
    .eq("numero", numero)
    .maybeSingle();
  if (error) throw new Error("Não foi possível consultar o processo no acervo.");
  if (!processo) {
    return { encontrado: false, numero, aviso: "Processo não localizado no acervo administrativo. Analise somente os documentos efetivamente fornecidos; não presuma inexistência do processo." };
  }

  const id = processo.id;
  const [movimentacoes, reus, audiencias, pendencias] = await Promise.all([
    sb.from("movimentacoes")
      .select("id,id_externo,data,descricao,tipo,origem")
      .eq("processo_id", id).order("data", { ascending: false }).limit(100),
    sb.from("reus")
      .select("id,nome,preso,tipo_prisao,especie_cautelar,data_prisao,situacao")
      .eq("processo_id", id).order("ordem").limit(50),
    sb.from("audiencias")
      .select("id,data,data_realizacao,situacao,tipo,observacao")
      .eq("processo_id", id).order("data", { ascending: false }).limit(50),
    sb.from("pendencias")
      .select("id,titulo,tipo,prazo,status,concluida")
      .eq("processo_id", id).limit(50),
  ]);
  for (const resposta of [movimentacoes, reus, audiencias, pendencias]) {
    if (resposta.error) throw new Error("Uma das consultas do acervo falhou; evite análise com contexto incompleto.");
  }

  const idsReus = (reus.data ?? []).map((r) => r.id);
  let reavaliacoes: Array<{
    id: string; reu_id: string; data_reavaliacao: string;
    proxima_data: string | null; observacao: string;
  }> = [];
  if (idsReus.length) {
    const resposta = await sb.from("reu_reavaliacoes")
      .select("id,reu_id,data_reavaliacao,proxima_data,observacao")
      .in("reu_id", idsReus)
      .order("data_reavaliacao", { ascending: false }).limit(80);
    if (resposta.error) throw new Error("Não foi possível consultar as reavaliações dos réus.");
    reavaliacoes = resposta.data ?? [];
  }

  return {
    encontrado: true,
    fonte: "Acervo administrativo Vara Crime, acesso condicionado à sessão e RLS",
    aviso: AVISO,
    processo: {
      ...processo,
      pje_ultima_mov_descricao: processo.pje_ultima_mov_descricao?.slice(0, 300) ?? null,
    },
    reus: reus.data ?? [],
    reavaliacoes: reavaliacoes.map((item) => ({
      ...item, observacao: item.observacao.slice(0, 240),
    })),
    movimentacoes: (movimentacoes.data ?? []).map((item) => ({
      ...item, descricao: item.descricao.slice(0, 320),
    })),
    audiencias: (audiencias.data ?? []).map((item) => ({
      ...item, observacao: item.observacao.slice(0, 220),
    })),
    pendencias: (pendencias.data ?? []).map((item) => ({
      ...item, titulo: item.titulo.slice(0, 160),
    })),
    limites: {
      movimentacoes: 100,
      reus: 50,
      reavaliacoes: 80,
      audiencias: 50,
      pendencias: 50,
      possivelTruncamento:
        (movimentacoes.data?.length ?? 0) >= 100 ||
        (reus.data?.length ?? 0) >= 50 ||
        reavaliacoes.length >= 80 ||
        (audiencias.data?.length ?? 0) >= 50 ||
        (pendencias.data?.length ?? 0) >= 50,
    },
  };
}
