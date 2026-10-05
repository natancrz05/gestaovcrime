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
    try {
      const r1 = await supabaseAdmin.from("usuarios").insert({ id, nome: data.nome, email: data.email, ativo: true });
      if (r1.error) throw r1.error;

      const r2 = await supabaseAdmin.from("user_roles").insert({ user_id: id, role: data.perfil });
      if (r2.error) throw r2.error;
    } catch (e) {
      // Evita conta órfã no Auth quando o cadastro interno falha.
      await supabaseAdmin.auth.admin.deleteUser(id).catch(() => undefined);
      throw new Error(e instanceof Error ? e.message : "Não foi possível concluir o cadastro do usuário.");
    }
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
      supabaseAdmin.from("user_roles").select("id, role").eq("user_id", data.id),
    ]);
    const papeisAtuais = rolesAntes ?? [];
    const papelAtual = papeisAtuais[0] ?? null;
    const perfilAntes = papelAtual?.role ?? null;

    // Troca o perfil sem abrir uma janela em que o usuário fique sem papel.
    const papelDesejado = papeisAtuais.find((r: any) => r.role === data.perfil);
    if (papelDesejado) {
      const extras = papeisAtuais.filter((r: any) => r.id !== papelDesejado.id).map((r: any) => r.id);
      if (extras.length) {
        const limpeza = await supabaseAdmin.from("user_roles").delete().in("id", extras);
        if (limpeza.error) throw new Error(limpeza.error.message);
      }
    } else if (papelAtual) {
      const troca = await supabaseAdmin.from("user_roles").update({ role: data.perfil }).eq("id", papelAtual.id);
      if (troca.error) throw new Error(troca.error.message);
      const extras = papeisAtuais.slice(1).map((r: any) => r.id);
      if (extras.length) {
        const limpeza = await supabaseAdmin.from("user_roles").delete().in("id", extras);
        if (limpeza.error) throw new Error(limpeza.error.message);
      }
    } else {
      const novoPapel = await supabaseAdmin.from("user_roles").insert({ user_id: data.id, role: data.perfil });
      if (novoPapel.error) throw new Error(novoPapel.error.message);
    }

    const r1 = await supabaseAdmin.from("usuarios").update({ nome: data.nome, ativo: data.ativo }).eq("id", data.id);
    if (r1.error) throw new Error(r1.error.message);

    // Usuário inativo fica impedido de entrar no sistema.
    const authUpdate = await supabaseAdmin.auth.admin.updateUserById(data.id, { ban_duration: data.ativo ? "none" : "876000h" });
    if (authUpdate.error) {
      if (antes) await supabaseAdmin.from("usuarios").update({ ativo: antes.ativo }).eq("id", data.id);
      throw new Error("Não foi possível sincronizar o estado do usuário com a autenticação.");
    }
    if (antes && antes.ativo !== data.ativo)
      await auditarUsuario(supabaseAdmin, context.userId, data.id, "Alteração de status", `Usuário ${data.nome} ${data.ativo ? "ativado" : "inativado"}`);
    if (perfilAntes !== data.perfil)
      await auditarUsuario(supabaseAdmin, context.userId, data.id, "Alteração de status", `Perfil de ${data.nome}: ${perfilAntes ?? "—"} → ${data.perfil}`);
    if (antes && antes.nome !== data.nome)
      await auditarUsuario(supabaseAdmin, context.userId, data.id, "Editado", `Nome do usuário alterado: ${antes.nome} → ${data.nome}`);
    return { ok: true };
  });
