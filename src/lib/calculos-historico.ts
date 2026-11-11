import { supabase } from "@/integrations/supabase/client";
import { listarConversasAssistente, type ConversaAssistente } from "./assistente-historico";

export const PREFIXO_HISTORICO_CALCULO = "Cálculo IA — ";

const TITULOS_ANTIGOS = [
  "Prescrição penal",
  "Revisão da prisão preventiva",
  "Revisão de prisão provisória",
  "Prazos de manifestações",
  "Excesso de prazo",
  "Execução penal",
  "Suspensão processual",
] as const;

const NUMERO_CNJ = /\b\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\b/;

/**
 * Número apenas INDICATIVO, extraído do nome do arquivo ou do cabeçalho do PDF.
 * Nunca autoriza busca automática de processos nem comprova a identidade dos autos.
 */
export function numeroCandidatoPdf(nomeArquivo: string, textoPdf: string): string | null {
  return nomeArquivo.match(NUMERO_CNJ)?.[0] ??
    textoPdf.slice(0, 4_000).match(NUMERO_CNJ)?.[0] ??
    null;
}

export function tituloHistoricoCalculo(tipo: string, nomeArquivo: string, numeroCandidato: string | null) {
  const resumo = numeroCandidato ?? nomeArquivo.replace(/\.pdf$/i, "").slice(0, 36);
  return PREFIXO_HISTORICO_CALCULO + tipo + (resumo ? " · " + resumo : "");
}

export function ehHistoricoCalculo(titulo: string): boolean {
  return titulo.startsWith(PREFIXO_HISTORICO_CALCULO) ||
    TITULOS_ANTIGOS.some((nome) => titulo === nome || titulo.startsWith(nome + " — "));
}

export function historicosDoMesmoProcesso(
  historicos: ReadonlyArray<Pick<ConversaAssistente, "titulo">>,
  numeroCandidato: string | null,
): number {
  if (!numeroCandidato) return 0;
  return historicos.filter((item) => ehHistoricoCalculo(item.titulo) &&
    item.titulo.includes(numeroCandidato)).length;
}

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
