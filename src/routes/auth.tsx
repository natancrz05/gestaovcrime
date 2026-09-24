import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Scale } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CLASSE_CAMPO, Campo } from "@/components/processos/campos";

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
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState(aviso === "inativo" ? "Seu usuário está inativo. Procure o Administrador." : "");
  const [enviando, setEnviando] = useState(false);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-card">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-md bg-primary">
            <Scale className="size-5 text-primary-foreground" />
          </span>
          <div className="leading-tight">
            <h1 className="text-base font-semibold text-foreground">Vara Criminal</h1>
            <p className="text-xs text-muted-foreground">Coração de Maria/BA · Acesso interno</p>
          </div>
        </div>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setEnviando(true);
            setErro("");
            const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
            setEnviando(false);
            if (error) {
              setErro(/banned/i.test(error.message) ? "Seu usuário está inativo. Procure o Administrador." : "E-mail ou senha incorretos.");
              registrarFalhaLogin({ data: { email: email.trim() } }).catch(() => {});
              return;
            }
            await registrarAcesso({ data: { acao: "Login" } }).catch(() => {});
            navigate({ to: "/", replace: true });
          }}
        >
          <Campo rotulo="E-mail"><input type="email" autoComplete="email" required className={CLASSE_CAMPO} value={email} onChange={(e) => setEmail(e.target.value)} /></Campo>
          <Campo rotulo="Senha"><input type="password" autoComplete="current-password" required className={CLASSE_CAMPO} value={senha} onChange={(e) => setSenha(e.target.value)} /></Campo>
          {erro ? <p className="text-sm text-urgente">{erro}</p> : null}
          <button disabled={enviando} className="inline-flex h-9 w-full items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
            {enviando ? "Entrando…" : "Entrar"}
          </button>
        </form>
        <p className="mt-5 text-[11px] leading-relaxed text-muted-foreground">
          Os acessos são criados pelo Administrador da unidade.
        </p>
      </div>
    </div>
  );
}
