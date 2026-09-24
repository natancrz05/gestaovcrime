import { getRouteApi } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { pode, type Acao, type Perfil } from "./permissoes";

export interface Sessao {
  id: string;
  email: string;
  nome: string;
  perfil: Perfil | null;
  ativo: boolean;
}

export async function carregarSessao(): Promise<Sessao | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const id = data.user.id;
  const [{ data: u }, { data: roles }] = await Promise.all([
    supabase.from("usuarios").select("nome, email, ativo").eq("id", id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", id),
  ]);
  const lista = (roles ?? []).map((r) => r.role as Perfil);
  const perfil: Perfil | null = lista.includes("administrador")
    ? "administrador"
    : lista.includes("servidor")
      ? "servidor"
      : lista.includes("consulta")
        ? "consulta"
        : null;
  return { id, email: u?.email ?? data.user.email ?? "", nome: u?.nome ?? "", perfil, ativo: !!u?.ativo };
}

const rotaAutenticada = getRouteApi("/_authenticated");

export function useSessao() {
  return rotaAutenticada.useRouteContext().sessao;
}

export function usePode(acao: Acao) {
  return pode(useSessao().perfil, acao);
}
