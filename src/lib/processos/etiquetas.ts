import { supabase } from "@/integrations/supabase/client";
import type { EtiquetaProcesso } from "./modelo";

export interface Etiqueta extends EtiquetaProcesso {}

export async function listarEtiquetas(): Promise<Etiqueta[]> {
  const { data, error } = await supabase.from("etiquetas").select("id,nome,cor,favorita").order("favorita", { ascending: false }).order("nome");
  if (error) throw error;
  return (data ?? []) as Etiqueta[];
}

export async function listarEtiquetasDoProcesso(processoId: string): Promise<Etiqueta[]> {
  const { data, error } = await supabase
    .from("processos_etiquetas")
    .select("etiquetas(id,nome,cor,favorita)")
    .eq("processo_id", processoId);
  if (error) throw error;
  return (data ?? []).map((x) => x.etiquetas).filter(Boolean) as Etiqueta[];
}

export async function criarEtiqueta(nome: string, cor = "default"): Promise<Etiqueta> {
  const limpo = nome.trim();
  if (!limpo) throw new Error("Informe o nome da etiqueta.");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sessão expirada. Entre novamente no sistema.");

  const { data, error } = await supabase
    .from("etiquetas")
    .insert({ nome: limpo, cor, criado_por: user.id })
    .select("id,nome,cor,favorita")
    .single();

  if (error) {
    if (error.code === "23505") throw new Error("Já existe uma etiqueta com este nome.");
    throw error;
  }
  return data as Etiqueta;
}

export async function vincularEtiqueta(processoId: string, etiquetaId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sessão expirada. Entre novamente no sistema.");

  const { error } = await supabase.from("processos_etiquetas").insert({
    processo_id: processoId,
    etiqueta_id: etiquetaId,
    criado_por: user.id,
  });
  if (error && error.code !== "23505") throw error;
}

export async function removerEtiquetaDoProcesso(processoId: string, etiquetaId: string) {
  const { error } = await supabase.from("processos_etiquetas").delete().eq("processo_id", processoId).eq("etiqueta_id", etiquetaId);
  if (error) throw error;
}
