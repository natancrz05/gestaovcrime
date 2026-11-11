import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  DIAS_REUSO_IA, TIPOS_REUSO_IA, UNIDADE_REUSO_IA, elegivelParaReuso,
  type ReferenciaRelatorio,
} from "./prazos/reuso-calculos";

const Cnj = z.string().regex(/^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$/);
const Data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Consulta = z.object({
  numero: Cnj,
  tipo: z.enum(TIPOS_REUSO_IA),
  modalidade: z.enum(["identificar", "preventiva", "temporaria", "flagrante", "outra"]).nullable().optional(),
  nomeReu: z.string().max(160).nullable().optional(),
  dataReferencia: Data,
});
const Abertura = Consulta.extend({ id: z.string().uuid() });

async function conferirAcesso(sb: SupabaseClient<Database>, usuarioId: string) {
  const [pessoa, papeis] = await Promise.all([
    sb.from("usuarios").select("ativo,status_cadastro").eq("id", usuarioId).maybeSingle(),
    sb.from("user_roles").select("role").eq("user_id", usuarioId),
  ]);
  if (pessoa.error || papeis.error || !pessoa.data?.ativo ||
      pessoa.data.status_cadastro !== "aprovado" ||
      !(papeis.data ?? []).some((p) => p.role === "servidor" || p.role === "administrador")) {
    throw new Error("Consulta compartilhada não autorizada para este servidor.");
  }
}

export const consultarAnalisesRecentes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Consulta.parse(d))
  .handler(async ({ data, context }) => {
    await conferirAcesso(context.supabase, context.userId);
    const corte = new Date(Date.now() - DIAS_REUSO_IA * 86400000).toISOString();
    const { data: encontrados, error } = await context.supabase
      .from("calculos_ia_relatorios")
      .select("id,processo_numero,tipo_analise,modalidade_prisao,nome_reu,data_referencia,criado_em")
      .eq("unidade", UNIDADE_REUSO_IA)
      .eq("processo_numero", data.numero)
      .eq("tipo_analise", data.tipo)
      .gte("criado_em", corte)
      .lte("data_referencia", data.dataReferencia)
      .order("criado_em", { ascending: false })
      .limit(30);
    if (error) throw new Error("Não foi possível verificar avaliações anteriores. Nenhuma consulta à IA foi iniciada.");
    return (encontrados ?? [])
      .filter((relatorio) => elegivelParaReuso(relatorio as ReferenciaRelatorio, {
        numero: data.numero,
        tipo: data.tipo,
        modalidade: data.modalidade ?? null,
        nomeReu: data.nomeReu ?? null,
        dataReferencia: data.dataReferencia,
        agora: new Date(),
      }))
      .slice(0, 3);
  });

export const abrirAnaliseCompartilhada = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Abertura.parse(d))
  .handler(async ({ data, context }) => {
    await conferirAcesso(context.supabase, context.userId);
    // Não há JOIN, consulta ou referência a assistente_mensagens/conversas.
    const { data: relatorio, error } = await context.supabase
      .from("calculos_ia_relatorios")
      .select("id,processo_numero,tipo_analise,modalidade_prisao,nome_reu,data_referencia,criado_em,relatorio")
      .eq("id", data.id)
      .eq("unidade", UNIDADE_REUSO_IA)
      .eq("processo_numero", data.numero)
      .eq("tipo_analise", data.tipo)
      .maybeSingle();
    if (error || !relatorio) throw new Error("Relatório indisponível ou sem permissão.");
    if (!elegivelParaReuso(relatorio, {
      numero: data.numero, tipo: data.tipo, modalidade: data.modalidade ?? null,
      nomeReu: data.nomeReu ?? null, dataReferencia: data.dataReferencia, agora: new Date(),
    })) throw new Error("A análise deixou de atender aos critérios de reaproveitamento.");
    return {
      id: relatorio.id,
      processo: relatorio.processo_numero,
      tipo: relatorio.tipo_analise,
      nomeReu: relatorio.nome_reu,
      dataReferencia: relatorio.data_referencia,
      criadoEm: relatorio.criado_em,
      texto: relatorio.relatorio,
      origem: "Relatório institucional, sem acesso ao chat do autor" as const,
    };
  });
