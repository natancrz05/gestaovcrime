import { supabase } from "@/integrations/supabase/client";
import { listarConversasAssistente } from "./assistente-historico";
import { PREFIXO_HISTORICO_CALCULO, ehHistoricoCalculo } from "./prazos/historico-calculos";
export { PREFIXO_HISTORICO_CALCULO, ehHistoricoCalculo, historicosDoMesmoProcesso, numeroCandidatoPdf, tituloHistoricoCalculo } from "./prazos/historico-calculos";

/**
 * Usa as MESMAS tabelas privadas do Assistente, filtradas pelo usuário.
 * A RLS das tabelas assistente_conversas/assistente_mensagens continua aplicada.
 * O segundo lote recupera relatórios legados criados antes do prefixo.
 */
export async function listarHistoricoCalculos(usuarioId: string) {
  const [{ data, error }, recentes] = await Promise.all([
    supabase.from("assistente_conversas")
      .select("id,usuario_id,titulo,criado_em,atualizado_em")
      .eq("usuario_id", usuarioId)
      .like("titulo", PREFIXO_HISTORICO_CALCULO + "%")
      .order("atualizado_em", { ascending: false })
      .limit(100),
    listarConversasAssistente(usuarioId),
  ]);
  if (error) throw new Error("Não foi possível consultar o histórico pessoal dos cálculos.");
  const unicos = new Map<string, (typeof recentes)[number]>();
  for (const item of [...(data ?? []), ...recentes]) {
    if (item.usuario_id === usuarioId && ehHistoricoCalculo(item.titulo)) {
      unicos.set(item.id, item);
    }
  }
  return [...unicos.values()]
    .sort((a, b) => b.atualizado_em.localeCompare(a.atualizado_em) || b.id.localeCompare(a.id))
    .slice(0, 100);
}
