import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const perfilSchema = z.enum(["administrador", "servidor", "consulta"]);

function traduzirErro(msg?: string) {
  if (!msg) return "Falha ao criar usuário.";
  if (/already.*(registered|exists)/i.test(msg)) return "Já existe um usuário com este e-mail.";
  if (/password/i.test(msg) && /(6|short|least)/i.test(msg)) return "A senha deve ter pelo menos 6 caracteres.";
  if (/(weak|pwned|leaked|compromised)/i.test(msg)) return "Esta senha não foi aceita. Escolha outra senha.";
  if (/password/i.test(msg)) return "Senha inválida. Escolha outra senha.";
  if (/email/i.test(msg)) return "E-mail inválido.";
  return "Falha ao criar usuário.";
}

export const excluirUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirAdmin(context);
    if (data.id === context.userId) throw new Error("Você não pode excluir a sua própria conta.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u } = await supabaseAdmin.from("usuarios").select("nome, email").eq("id", data.id).maybeSingle();
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.id);
    if (error) throw new Error("Não foi possível excluir o usuário.");
    await auditarUsuario(supabaseAdmin, context.userId, data.id, "Excluído", `Usuário ${u?.nome ?? u?.email ?? ""} excluído`);
    return { ok: true };
  });

async function exigirAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("eh_admin", { _user_id: context.userId });
  if (!data) throw new Error("Somente o Administrador pode gerenciar usuários.");
}

async function auditarUsuario(admin: any, autorId: string, registroId: string, acao: string, descricao: string) {
  const { data: u } = await admin.from("usuarios").select("nome").eq("id", autorId).maybeSingle();
  await admin.from("auditoria").insert({
    usuario_id: autorId,
    usuario_nome: u?.nome ?? "",
    acao,
    modulo: "Usuários",
    registro_id: registroId,
    descricao,
  });
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
      senha: z.string().min(6, "A senha deve ter pelo menos 6 caracteres.").max(72, "A senha deve ter no máximo 72 caracteres."),
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
    if (error || !criado.user) throw new Error(traduzirErro(error?.message));
    const id = criado.user.id;
    const r1 = await supabaseAdmin.from("usuarios").insert({ id, nome: data.nome, email: data.email, ativo: true });
    const r2 = await supabaseAdmin.from("user_roles").insert({ user_id: id, role: data.perfil });
    if (r1.error || r2.error) throw new Error((r1.error ?? r2.error)!.message);
    await auditarUsuario(supabaseAdmin, context.userId, id, "Criado", `Usuário ${data.nome} criado com perfil ${data.perfil}`);
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
    const [{ data: antes }, { data: rolesAntes }] = await Promise.all([
      supabaseAdmin.from("usuarios").select("nome, ativo").eq("id", data.id).maybeSingle(),
      supabaseAdmin.from("user_roles").select("role").eq("user_id", data.id),
    ]);
    const perfilAntes = rolesAntes?.[0]?.role ?? null;
    const r1 = await supabaseAdmin.from("usuarios").update({ nome: data.nome, ativo: data.ativo }).eq("id", data.id);
    if (r1.error) throw new Error(r1.error.message);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.id);
    const r2 = await supabaseAdmin.from("user_roles").insert({ user_id: data.id, role: data.perfil });
    if (r2.error) throw new Error(r2.error.message);
    // Usuário inativo fica impedido de entrar no sistema.
    await supabaseAdmin.auth.admin.updateUserById(data.id, { ban_duration: data.ativo ? "none" : "876000h" });
    if (antes && antes.ativo !== data.ativo)
      await auditarUsuario(supabaseAdmin, context.userId, data.id, "Alteração de status", `Usuário ${data.nome} ${data.ativo ? "ativado" : "inativado"}`);
    if (perfilAntes !== data.perfil)
      await auditarUsuario(supabaseAdmin, context.userId, data.id, "Alteração de status", `Perfil de ${data.nome}: ${perfilAntes ?? "—"} → ${data.perfil}`);
    if (antes && antes.nome !== data.nome)
      await auditarUsuario(supabaseAdmin, context.userId, data.id, "Editado", `Nome do usuário alterado: ${antes.nome} → ${data.nome}`);
    return { ok: true };
  });
