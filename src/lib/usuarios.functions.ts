import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const perfilSchema = z.enum(["administrador", "servidor", "consulta"]);

async function exigirAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("eh_admin", { _user_id: context.userId });
  if (!data) throw new Error("Somente o Administrador pode gerenciar usuários.");
}

export const listarUsuarios = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirAdmin(context);
    const [{ data: us, error }, { data: roles }] = await Promise.all([
      context.supabase.from("usuarios").select("*").order("nome"),
      context.supabase.from("user_roles").select("user_id, role"),
    ]);
    if (error) throw new Error(error.message);
    return (us ?? []).map((u: any) => ({
      id: u.id as string,
      nome: u.nome as string,
      email: u.email as string,
      ativo: u.ativo as boolean,
      criado_em: u.criado_em as string,
      perfil: ((roles ?? []).find((r: any) => r.user_id === u.id)?.role ?? null) as z.infer<typeof perfilSchema> | null,
    }));
  });

export const criarUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      nome: z.string().trim().min(1).max(120),
      email: z.string().trim().email().max(200),
      senha: z.string().min(8).max(72),
      perfil: perfilSchema,
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await exigirAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: criado, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.senha,
      email_confirm: true,
    });
    if (error || !criado.user) throw new Error(error?.message ?? "Falha ao criar usuário.");
    const id = criado.user.id;
    const r1 = await supabaseAdmin.from("usuarios").insert({ id, nome: data.nome, email: data.email, ativo: true });
    const r2 = await supabaseAdmin.from("user_roles").insert({ user_id: id, role: data.perfil });
    if (r1.error || r2.error) throw new Error((r1.error ?? r2.error)!.message);
    return { id };
  });

export const atualizarUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      nome: z.string().trim().min(1).max(120),
      perfil: perfilSchema,
      ativo: z.boolean(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await exigirAdmin(context);
    if (data.id === context.userId && (!data.ativo || data.perfil !== "administrador"))
      throw new Error("Você não pode inativar nem retirar o perfil de Administrador da sua própria conta.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const r1 = await supabaseAdmin.from("usuarios").update({ nome: data.nome, ativo: data.ativo }).eq("id", data.id);
    if (r1.error) throw new Error(r1.error.message);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.id);
    const r2 = await supabaseAdmin.from("user_roles").insert({ user_id: data.id, role: data.perfil });
    if (r2.error) throw new Error(r2.error.message);
    // Usuário inativo fica impedido de entrar no sistema.
    await supabaseAdmin.auth.admin.updateUserById(data.id, { ban_duration: data.ativo ? "none" : "876000h" });
    return { ok: true };
  });
