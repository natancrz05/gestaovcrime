import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Registra login/logout do próprio usuário autenticado. */
export const registrarAcesso = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ acao: z.enum(["Login", "Logout"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u } = await supabaseAdmin.from("usuarios").select("nome").eq("id", context.userId).maybeSingle();
    await supabaseAdmin.from("auditoria").insert({
      usuario_id: context.userId,
      usuario_nome: u?.nome ?? "",
      acao: data.acao,
      modulo: "Acesso",
      descricao: data.acao === "Login" ? "Login realizado" : "Logout realizado",
    });
    return { ok: true };
  });

/**
 * Registra tentativa de login malsucedida. Só grava quando o e-mail pertence a
 * um usuário cadastrado; nunca recebe nem armazena a senha.
 */
export const registrarFalhaLogin = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ email: z.string().trim().toLowerCase().email().max(200) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u } = await supabaseAdmin.from("usuarios").select("id, nome").ilike("email", data.email).maybeSingle();
    if (u) {
      await supabaseAdmin.from("auditoria").insert({
        usuario_id: u.id,
        usuario_nome: u.nome,
        acao: "Login malsucedido",
        modulo: "Acesso",
        descricao: "Tentativa de login malsucedida",
      });
    }
    return { ok: true };
  });
