import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type ConversaAssistente = Tables<"assistente_conversas">;
export type MensagemSalvaAssistente = Tables<"assistente_mensagens">;

export function tituloInicialDaConversa(pergunta: string) {
  const texto = pergunta.replace(/\s+/g, " ").trim();
  if (!texto) return "Análise de documento";
  return texto.length > 86 ? texto.slice(0, 85).trimEnd() + "…" : texto;
}

function erroHistorico(error: { message: string } | null) {
  if (error) throw new Error("Histórico do Assistente: " + error.message);
}

export async function listarConversasAssistente(usuarioId: string) {
  const { data, error } = await supabase
    .from("assistente_conversas")
    .select("id,usuario_id,titulo,criado_em,atualizado_em")
    .eq("usuario_id", usuarioId)
    .order("atualizado_em", { ascending: false })
    .order("id", { ascending: false })
    .limit(100);
  erroHistorico(error);
  return data ?? [];
}

export async function listarMensagensAssistente(conversaId: string, usuarioId: string) {
  const todos: MensagemSalvaAssistente[] = [];
  const pagina = 200;
  for (let inicio = 0; ; inicio += pagina) {
    const { data, error } = await supabase
      .from("assistente_mensagens")
      .select("id,conversa_id,usuario_id,papel,conteudo,anexos,criado_em")
      .eq("conversa_id", conversaId)
      .eq("usuario_id", usuarioId)
      .order("criado_em", { ascending: true })
      .order("id", { ascending: true })
      .range(inicio, inicio + pagina - 1);
    erroHistorico(error);
    todos.push(...(data ?? []));
    if ((data ?? []).length < pagina) break;
  }
  return todos;
}

export async function criarConversaAssistente(usuarioId: string, titulo: string) {
  const { data, error } = await supabase
    .from("assistente_conversas")
    .insert({ usuario_id: usuarioId, titulo: tituloInicialDaConversa(titulo) })
    .select("id,usuario_id,titulo,criado_em,atualizado_em")
    .single();
  erroHistorico(error);
  if (!data) throw new Error("Não foi possível criar a conversa.");
  return data;
}

export async function salvarMensagemUsuario({
  id, conversaId, usuarioId, conteudo, anexos,
}: {
  id: string;
  conversaId: string;
  usuarioId: string;
  conteudo: string;
  anexos: string[];
}) {
  const { error } = await supabase
    .from("assistente_mensagens")
    .insert({
      id,
      conversa_id: conversaId,
      usuario_id: usuarioId,
      papel: "user",
      conteudo,
      anexos: anexos.slice(0, 2),
    });
  erroHistorico(error);
}

export async function salvarRespostaAssistenteLocal({
  id, conversaId, usuarioId, conteudo,
}: {
  id: string;
  conversaId: string;
  usuarioId: string;
  conteudo: string;
}) {
  const { error } = await supabase
    .from("assistente_mensagens")
    .upsert({
      id,
      conversa_id: conversaId,
      usuario_id: usuarioId,
      papel: "assistant",
      conteudo,
      anexos: [],
    }, { onConflict: "id", ignoreDuplicates: true });
  erroHistorico(error);
}

export async function renomearConversaAssistente(conversaId: string, usuarioId: string, titulo: string) {
  const nome = titulo.trim().replace(/\s+/g, " ").slice(0, 120);
  if (!nome) throw new Error("Informe um título para a conversa.");
  const { error } = await supabase
    .from("assistente_conversas")
    .update({ titulo: nome })
    .eq("id", conversaId)
    .eq("usuario_id", usuarioId);
  erroHistorico(error);
}

export async function excluirConversaAssistente(conversaId: string, usuarioId: string) {
  const { error } = await supabase
    .from("assistente_conversas")
    .delete()
    .eq("id", conversaId)
    .eq("usuario_id", usuarioId);
  erroHistorico(error);
}

export function visualizarMensagemSalva(m: MensagemSalvaAssistente) {
  return {
    id: m.id,
    role: m.papel as "user" | "assistant",
    content: m.conteudo,
    hora: new Date(m.criado_em).getTime(),
    ...(m.anexos.length ? { anexos: m.anexos } : {}),
  };
}
