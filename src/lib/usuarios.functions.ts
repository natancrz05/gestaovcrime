import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

type ClienteSupabase = SupabaseClient<Database>;
type ContextoAutenticado = { supabase: ClienteSupabase; userId: string };

const perfilSchema = z.enum(["administrador", "servidor", "consulta"]);
const perfilAprovacaoSchema = z.enum(["servidor", "consulta"]);
const SENHA_PADRAO_TEMPORARIA = "PrimeiroAcesso@Cdm67";

export const solicitarAcesso = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      nome: z.string().trim().min(3, "Informe seu nome completo.").max(120),
      email: z.string().trim().email("Informe um e-mail válido.").max(200),
      senha: z.string().min(6, "A senha deve ter pelo menos 6 caracteres.").max(72),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.trim().toLowerCase();
    const { data: criado, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.senha,
      email_confirm: true,
    });
    if (error || !criado.user) throw new Error(traduzirErro(error?.message));

    const id = criado.user.id;
    try {
      const { error: perfilError } = await supabaseAdmin.from("usuarios").insert({
        id,
        nome: data.nome.trim(),
        email,
        ativo: false,
        status_cadastro: "pendente",
        solicitado_em: new Date().toISOString(),
        aprovado_em: null,
        aprovado_por: null,
        recusado_em: null,
        recusado_por: null,
      });
      if (perfilError) throw perfilError;
    } catch (e) {
      await supabaseAdmin.auth.admin.deleteUser(id).catch(() => undefined);
      throw new Error(e instanceof Error ? e.message : "Não foi possível concluir a solicitação de acesso.");
    }
    return { ok: true };
  });

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

async function exigirAdmin(context: ContextoAutenticado) {
  const { data } = await context.supabase.rpc("eh_admin", { _user_id: context.userId });
  if (!data) throw new Error("Somente o Administrador pode gerenciar usuários.");
}

async function auditarUsuario(admin: ClienteSupabase, autorId: string, registroId: string, acao: string, descricao: string) {
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
    return (us ?? []).map((u) => ({
      id: u.id as string,
      nome: u.nome as string,
      email: u.email as string,
      ativo: u.ativo as boolean,
      criado_em: u.criado_em as string,
      status_cadastro: u.status_cadastro as "pendente" | "aprovado" | "recusado",
      solicitado_em: u.solicitado_em as string | null,
      aprovado_em: u.aprovado_em as string | null,
      recusado_em: u.recusado_em as string | null,
      troca_senha_obrigatoria: u.troca_senha_obrigatoria as boolean,
      senha_temporaria_em: u.senha_temporaria_em as string | null,
      perfil: ((roles ?? []).find((r) => r.user_id === u.id)?.role ?? null) as z.infer<typeof perfilSchema> | null,
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
      const r1 = await supabaseAdmin.from("usuarios").insert({
        id,
        nome: data.nome,
        email: data.email.toLowerCase(),
        ativo: true,
        status_cadastro: "aprovado",
        solicitado_em: new Date().toISOString(),
        aprovado_em: new Date().toISOString(),
        aprovado_por: context.userId,
      });
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

export const aprovarSolicitacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      perfil: perfilAprovacaoSchema,
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await exigirAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: usuario } = await supabaseAdmin
      .from("usuarios")
      .select("nome, email, status_cadastro")
      .eq("id", data.id)
      .maybeSingle();
    if (!usuario) throw new Error("Solicitação não encontrada.");

    const { data: roles } = await supabaseAdmin.from("user_roles").select("id").eq("user_id", data.id);
    if (roles?.length) {
      const { error } = await supabaseAdmin.from("user_roles").delete().eq("user_id", data.id);
      if (error) throw new Error(error.message);
    }
    const papel = await supabaseAdmin.from("user_roles").insert({ user_id: data.id, role: data.perfil });
    if (papel.error) throw new Error(papel.error.message);

    const agora = new Date().toISOString();
    const upd = await supabaseAdmin.from("usuarios").update({
      ativo: true,
      status_cadastro: "aprovado",
      aprovado_em: agora,
      aprovado_por: context.userId,
      recusado_em: null,
      recusado_por: null,
    }).eq("id", data.id);
    if (upd.error) throw new Error(upd.error.message);

    const authUpdate = await supabaseAdmin.auth.admin.updateUserById(data.id, { ban_duration: "none" });
    if (authUpdate.error) throw new Error("Não foi possível liberar o acesso na autenticação.");

    await auditarUsuario(
      supabaseAdmin,
      context.userId,
      data.id,
      "Alteração de status",
      `Solicitação de acesso de ${usuario.nome || usuario.email} aprovada como ${data.perfil}`,
    );
    return { ok: true };
  });

export const recusarSolicitacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirAdmin(context);
    if (data.id === context.userId) throw new Error("Você não pode recusar a sua própria conta.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: usuario } = await supabaseAdmin
      .from("usuarios")
      .select("nome, email")
      .eq("id", data.id)
      .maybeSingle();
    if (!usuario) throw new Error("Solicitação não encontrada.");

    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.id);
    const agora = new Date().toISOString();
    const upd = await supabaseAdmin.from("usuarios").update({
      ativo: false,
      status_cadastro: "recusado",
      recusado_em: agora,
      recusado_por: context.userId,
      aprovado_em: null,
      aprovado_por: null,
    }).eq("id", data.id);
    if (upd.error) throw new Error(upd.error.message);

    const authUpdate = await supabaseAdmin.auth.admin.updateUserById(data.id, { ban_duration: "876000h" });
    if (authUpdate.error) throw new Error("Não foi possível bloquear a solicitação recusada.");

    await auditarUsuario(
      supabaseAdmin,
      context.userId,
      data.id,
      "Alteração de status",
      `Solicitação de acesso de ${usuario.nome || usuario.email} recusada`,
    );
    return { ok: true };
  });

export const redefinirSenhaPadrao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirAdmin(context);
    if (data.id === context.userId) throw new Error("Use a troca normal de senha para a sua própria conta.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: usuario } = await supabaseAdmin
      .from("usuarios")
      .select("nome, email, ativo, status_cadastro")
      .eq("id", data.id)
      .maybeSingle();

    if (!usuario) throw new Error("Usuário não encontrado.");
    if (usuario.status_cadastro !== "aprovado") throw new Error("A senha padrão só pode ser aplicada a usuários aprovados.");
    if (!usuario.ativo) throw new Error("Ative o usuário antes de redefinir a senha.");

    const agora = new Date().toISOString();
    const marca = await supabaseAdmin.from("usuarios").update({
      troca_senha_obrigatoria: true,
      senha_temporaria_em: agora,
      senha_temporaria_por: context.userId,
    }).eq("id", data.id);
    if (marca.error) throw new Error(marca.error.message);

    const authUpdate = await supabaseAdmin.auth.admin.updateUserById(data.id, {
      password: SENHA_PADRAO_TEMPORARIA,
    });
    if (authUpdate.error) {
      await supabaseAdmin.from("usuarios").update({
        troca_senha_obrigatoria: false,
        senha_temporaria_em: null,
        senha_temporaria_por: null,
      }).eq("id", data.id);
      throw new Error("Não foi possível redefinir a senha do usuário.");
    }

    await auditarUsuario(
      supabaseAdmin,
      context.userId,
      data.id,
      "Alteração de status",
      `Senha de ${usuario.nome || usuario.email} redefinida para a senha padrão; troca obrigatória no próximo acesso`,
    );

    return { ok: true, senhaPadrao: SENHA_PADRAO_TEMPORARIA };
  });

export const trocarSenhaObrigatoria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      senha: z.string().min(6, "A nova senha deve ter pelo menos 6 caracteres.").max(72),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    if (data.senha === SENHA_PADRAO_TEMPORARIA) {
      throw new Error("Escolha uma senha diferente da senha padrão.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: usuario } = await supabaseAdmin
      .from("usuarios")
      .select("nome, ativo, status_cadastro, troca_senha_obrigatoria")
      .eq("id", context.userId)
      .maybeSingle();

    if (!usuario) throw new Error("Usuário não encontrado.");
    if (!usuario.ativo || usuario.status_cadastro !== "aprovado") {
      throw new Error("Seu acesso não está liberado.");
    }
    if (!usuario.troca_senha_obrigatoria) {
      throw new Error("Não há troca obrigatória de senha pendente.");
    }

    const authUpdate = await supabaseAdmin.auth.admin.updateUserById(context.userId, {
      password: data.senha,
    });
    if (authUpdate.error) throw new Error(traduzirErro(authUpdate.error.message));

    const atualiza = await supabaseAdmin.from("usuarios").update({
      troca_senha_obrigatoria: false,
      senha_temporaria_em: null,
      senha_temporaria_por: null,
    }).eq("id", context.userId);
    if (atualiza.error) throw new Error("A senha foi alterada, mas não foi possível concluir a liberação. Tente novamente.");

    await auditarUsuario(
      supabaseAdmin,
      context.userId,
      context.userId,
      "Alteração de status",
      `Senha obrigatória alterada por ${usuario.nome}`,
    );

    return { ok: true };
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
    const papelDesejado = papeisAtuais.find((r) => r.role === data.perfil);
    if (papelDesejado) {
      const extras = papeisAtuais.filter((r) => r.id !== papelDesejado.id).map((r) => r.id);
      if (extras.length) {
        const limpeza = await supabaseAdmin.from("user_roles").delete().in("id", extras);
        if (limpeza.error) throw new Error(limpeza.error.message);
      }
    } else if (papelAtual) {
      const troca = await supabaseAdmin.from("user_roles").update({ role: data.perfil }).eq("id", papelAtual.id);
      if (troca.error) throw new Error(troca.error.message);
      const extras = papeisAtuais.slice(1).map((r) => r.id);
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
