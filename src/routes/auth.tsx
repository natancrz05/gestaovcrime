import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { registrarAcesso, registrarFalhaLogin } from "@/lib/auditoria.functions";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Scale } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { solicitarAcesso, trocarSenhaObrigatoria } from "@/lib/usuarios.functions";
import { decidirAcessoAposLogin } from "@/lib/login-acesso";
import { CLASSE_CAMPO, Campo } from "@/components/processos/campos";
import FUNDO_LOGIN from "../assets/forum-login-data";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { aviso?: string } =>
    typeof s["aviso"] === "string" ? { aviso: s["aviso"] } : {},
  head: () => ({
    meta: [
      { title: "Entrar — Gestão da Vara Criminal" },
      { name: "description", content: "Acesso restrito aos servidores da Vara Criminal de Coração de Maria/BA." },
      { property: "og:title", content: "Entrar — Gestão da Vara Criminal" },
      { property: "og:description", content: "Acesso restrito aos servidores da Vara Criminal de Coração de Maria/BA." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Entrar,
});

function Entrar() {
  const { aviso } = Route.useSearch();
  const navigate = useNavigate();
  const solicitar = useServerFn(solicitarAcesso);
  const trocarSenha = useServerFn(trocarSenhaObrigatoria);

  const [modo, setModo] = useState<"entrar" | "solicitar" | "trocar">(
    aviso === "troca_senha" ? "trocar" : "entrar",
  );
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [capsLockAtivo, setCapsLockAtivo] = useState(false);
  const [lembrarEmail, setLembrarEmail] = useState(false);
  const [ajudaSenha, setAjudaSenha] = useState(false);
  const [erro, setErro] = useState(
    aviso === "inativo" ? "Seu usuário está inativo. Procure o Administrador." : "",
  );
  const [statusAcesso, setStatusAcesso] = useState<"pendente" | "recusado" | null>(
    aviso === "pendente" ? "pendente" : aviso === "recusado" ? "recusado" : null,
  );
  const [sucesso, setSucesso] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    try {
      const salvo = window.localStorage.getItem("gestao-varacrime-email");
      if (salvo) {
        setEmail(salvo);
        setLembrarEmail(true);
      }
    } catch {
      // O navegador pode bloquear o armazenamento local; o login continua normalmente.
    }
  }, []);

  const trocarModo = (novo: "entrar" | "solicitar") => {
    setModo(novo);
    setErro("");
    setStatusAcesso(null);
    setSucesso("");
    setAjudaSenha(false);
    setSenha("");
    setConfirmarSenha("");
    setMostrarSenha(false);
    setCapsLockAtivo(false);
  };

  const campoSenha = (
    valor: string,
    aoMudar: (valor: string) => void,
    autocomplete: "current-password" | "new-password",
  ) => (
    <div className="relative">
      <input
        type={mostrarSenha ? "text" : "password"}
        autoComplete={autocomplete}
        required
        minLength={autocomplete === "new-password" ? 6 : undefined}
        maxLength={72}
        className={`${CLASSE_CAMPO} pr-10`}
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        onKeyDown={(e) => setCapsLockAtivo(e.getModifierState("CapsLock"))}
        onKeyUp={(e) => setCapsLockAtivo(e.getModifierState("CapsLock"))}
        onBlur={() => setCapsLockAtivo(false)}
      />
      <button
        type="button"
        aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
        onClick={() => setMostrarSenha((v) => !v)}
      >
        {mostrarSenha ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
      {capsLockAtivo && !mostrarSenha ? (
        <p className="mt-1 text-xs font-medium text-atencao">Caps Lock ativado</p>
      ) : null}
    </div>
  );

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url("${FUNDO_LOGIN}")` }}
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-slate-950/55" aria-hidden="true" />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-8 sm:px-6 lg:justify-end lg:px-12 xl:px-20">
        <div className="w-full max-w-md rounded-xl border border-white/60 bg-white/95 p-6 text-slate-950 shadow-2xl backdrop-blur-sm sm:p-8">
          <div className="mb-6 text-center">
            <span className="mx-auto flex size-11 items-center justify-center rounded-lg bg-slate-900 shadow-sm">
              <Scale className="size-5 text-white" />
            </span>
            <h1 className="mt-3 text-xl font-semibold tracking-tight text-slate-950">Central de Gestão da Vara Criminal</h1>
            <p className="mt-1 text-sm font-medium text-slate-600">Fórum Juiz João Leal</p>
            <p className="mt-0.5 text-xs text-slate-500">Comarca de Coração de Maria/BA · Acesso interno</p>
          </div>

        {modo !== "trocar" ? (
          <div className="mb-5 grid grid-cols-2 rounded-md border border-border bg-muted/40 p-1 text-sm">
            <button
              type="button"
              className={`rounded px-3 py-2 font-medium ${modo === "entrar" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
              onClick={() => trocarModo("entrar")}
            >
              Entrar
            </button>
            <button
              type="button"
              className={`rounded px-3 py-2 font-medium ${modo === "solicitar" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
              onClick={() => trocarModo("solicitar")}
            >
              Solicitar acesso
            </button>
          </div>
        ) : null}

        {modo === "entrar" ? (
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setEnviando(true);
              setErro("");
              setStatusAcesso(null);
              setSucesso("");
              setAjudaSenha(false);

              const { data: login, error } = await supabase.auth.signInWithPassword({
                email: email.trim(),
                password: senha,
              });

              if (error) {
                setEnviando(false);
                setErro("E-mail ou senha incorretos.");
                registrarFalhaLogin({ data: { email: email.trim() } }).catch(() => {});
                return;
              }

              try {
                if (lembrarEmail) {
                  window.localStorage.setItem("gestao-varacrime-email", email.trim());
                } else {
                  window.localStorage.removeItem("gestao-varacrime-email");
                }
              } catch {
                // Se o armazenamento local estiver bloqueado, não impede o acesso.
              }

              const id = login.user?.id;
              const { data: usuario } = id
                ? await supabase
                    .from("usuarios")
                    .select("status_cadastro, ativo, troca_senha_obrigatoria")
                    .eq("id", id)
                    .maybeSingle()
                : { data: null };

              const decisao = decidirAcessoAposLogin(usuario);

              if (decisao === "pendente") {
                await supabase.auth.signOut();
                setEnviando(false);
                setStatusAcesso("pendente");
                return;
              }

              if (decisao === "recusado") {
                await supabase.auth.signOut();
                setEnviando(false);
                setStatusAcesso("recusado");
                return;
              }

              if (decisao === "inativo") {
                await supabase.auth.signOut();
                setEnviando(false);
                setErro("Seu usuário está inativo ou não possui acesso liberado. Procure um administrador da unidade.");
                return;
              }

              if (decisao === "trocar_senha") {
                setEnviando(false);
                setSenha("");
                setConfirmarSenha("");
                setModo("trocar");
                return;
              }

              setEnviando(false);
              await registrarAcesso({ data: { acao: "Login" } }).catch(() => {});
              navigate({ to: "/", replace: true });
            }}
          >
            <Campo rotulo="E-mail">
              <input
                type="email"
                autoComplete="email"
                required
                className={CLASSE_CAMPO}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Campo>

            <label className="-mt-2 flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={lembrarEmail}
                onChange={(e) => {
                  setLembrarEmail(e.target.checked);
                  if (!e.target.checked) {
                    try {
                      window.localStorage.removeItem("gestao-varacrime-email");
                    } catch {
                      // Sem impacto no login.
                    }
                  }
                }}
              />
              Lembrar meu e-mail neste dispositivo
            </label>

            <Campo rotulo="Senha">{campoSenha(senha, setSenha, "current-password")}</Campo>

            <div className="-mt-2 text-right">
              <button
                type="button"
                className="text-xs font-medium text-primary hover:underline"
                onClick={() => {
                  setAjudaSenha(true);
                  setErro("");
                  setStatusAcesso(null);
                }}
              >
                Esqueci minha senha
              </button>
            </div>

            {ajudaSenha ? (
              <div className="rounded-md border border-border bg-muted/40 p-3">
                <p className="text-sm font-semibold">Redefinição de senha</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Procure um administrador da unidade. Ele poderá redefinir sua conta para a senha padrão.
                  No próximo acesso, o sistema exigirá que você cadastre uma nova senha.
                </p>
              </div>
            ) : null}

            {statusAcesso === "pendente" ? (
              <div className="rounded-md border border-atencao/30 bg-atencao-suave p-3">
                <p className="text-sm font-semibold text-atencao">Aguardando aprovação</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Seu cadastro foi recebido, mas o acesso ainda precisa ser aprovado por um administrador da unidade.
                </p>
              </div>
            ) : null}

            {statusAcesso === "recusado" ? (
              <div className="rounded-md border border-urgente/30 bg-urgente-suave p-3">
                <p className="text-sm font-semibold text-urgente">Acesso não autorizado</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Sua solicitação de acesso foi recusada. Procure um administrador da unidade.
                </p>
              </div>
            ) : null}

            {erro ? <p className="text-sm text-urgente">{erro}</p> : null}

            <button
              disabled={enviando}
              className="inline-flex h-9 w-full items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {enviando ? "Entrando…" : "Entrar"}
            </button>
          </form>
        ) : modo === "solicitar" ? (
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setEnviando(true);
              setErro("");
              setSucesso("");

              try {
                if (senha !== confirmarSenha) {
                  setErro("As senhas não coincidem.");
                  return;
                }
                await solicitar({ data: { nome, email, senha } });
                setSucesso("Solicitação enviada. Seu acesso ficará disponível após a aprovação de um administrador.");
                setNome("");
                setEmail("");
                setSenha("");
                setConfirmarSenha("");
              } catch (e) {
                setErro((e as Error).message);
              } finally {
                setEnviando(false);
              }
            }}
          >
            <Campo rotulo="Nome completo">
              <input
                autoComplete="name"
                required
                minLength={3}
                className={CLASSE_CAMPO}
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
            </Campo>
            <Campo rotulo="E-mail">
              <input
                type="email"
                autoComplete="email"
                required
                className={CLASSE_CAMPO}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Campo>
            <Campo rotulo="Senha">{campoSenha(senha, setSenha, "new-password")}</Campo>
            <Campo rotulo="Confirmar senha">
              <input
                type={mostrarSenha ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={6}
                maxLength={72}
                className={CLASSE_CAMPO}
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
              />
            </Campo>
            {erro ? <p className="text-sm text-urgente">{erro}</p> : null}
            {sucesso ? (
              <p className="rounded-md border border-concluido/25 bg-concluido-suave p-3 text-sm text-concluido">
                {sucesso}
              </p>
            ) : null}
            <button
              disabled={enviando}
              className="inline-flex h-9 w-full items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {enviando ? "Enviando…" : "Enviar solicitação"}
            </button>
          </form>
        ) : (
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setErro("");

              if (senha !== confirmarSenha) {
                setErro("As senhas não coincidem.");
                return;
              }

              setEnviando(true);
              try {
                const { data: sessaoAtual } = await supabase.auth.getSession();
                const accessToken = sessaoAtual.session?.access_token;

                if (!accessToken) {
                  setErro("Sua sessão expirou. Entre novamente com a senha padrão.");
                  setModo("entrar");
                  return;
                }

                await trocarSenha({ data: { senha, accessToken } });

                // Reabre a sessão com a nova senha para não manter credencial
                // temporária ou token antigo após a redefinição.
                await supabase.auth.signOut();
                const { error: novoLoginErro } = await supabase.auth.signInWithPassword({
                  email: email.trim(),
                  password: senha,
                });

                if (novoLoginErro) {
                  setSucesso("Senha alterada com sucesso. Entre novamente usando a nova senha.");
                  setModo("entrar");
                  setSenha("");
                  setConfirmarSenha("");
                  return;
                }

                setSucesso("Senha alterada. Acesso liberado.");
                await registrarAcesso({ data: { acao: "Login" } }).catch(() => {});
                navigate({ to: "/", replace: true });
              } catch (e) {
                const mensagem = e instanceof Error ? e.message : "Não foi possível alterar a senha.";
                setErro(
                  /authorization header|unauthorized/i.test(mensagem)
                    ? "Não foi possível validar sua sessão. Entre novamente com a senha padrão."
                    : mensagem,
                );
              } finally {
                setEnviando(false);
              }
            }}
          >
            <div className="rounded-md border border-atencao/30 bg-atencao-suave p-3">
              <p className="text-sm font-semibold text-atencao">Crie uma nova senha</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Você entrou com a senha padrão definida pelo administrador. Antes de acessar o sistema,
                escolha uma nova senha pessoal.
              </p>
            </div>

            <Campo rotulo="Nova senha">{campoSenha(senha, setSenha, "new-password")}</Campo>
            <Campo rotulo="Confirmar nova senha">
              <input
                type={mostrarSenha ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={6}
                maxLength={72}
                className={CLASSE_CAMPO}
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
              />
            </Campo>

            {erro ? <p className="text-sm text-urgente">{erro}</p> : null}

            <button
              disabled={enviando}
              className="inline-flex h-9 w-full items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {enviando ? "Salvando…" : "Definir nova senha"}
            </button>
          </form>
        )}

          <p className="mt-6 border-t border-slate-200 pt-4 text-[11px] leading-relaxed text-slate-500">
            O cadastro não libera acesso automaticamente. Um administrador da unidade precisa aprovar a solicitação e definir o perfil.
          </p>
        </div>
      </div>
    </div>
  );
}
