import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, KeyRound, Scale } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CLASSE_CAMPO, Campo } from "@/components/processos/campos";

export const Route = createFileRoute("/redefinir-senha")({
  head: () => ({
    meta: [
      { title: "Redefinir senha — Gestão da Vara Criminal" },
      { name: "description", content: "Redefinição segura de senha de acesso." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RedefinirSenha,
});

function RedefinirSenha() {
  const [validando, setValidando] = useState(true);
  const [autorizado, setAutorizado] = useState(false);
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [concluido, setConcluido] = useState(false);

  useEffect(() => {
    let ativo = true;

    const conferir = async () => {
      const { data } = await supabase.auth.getSession();
      if (!ativo) return;
      setAutorizado(!!data.session);
      setValidando(false);
    };

    void conferir();

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!ativo) return;
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setAutorizado(!!session);
        setValidando(false);
      }
    });

    return () => {
      ativo = false;
      data.subscription.unsubscribe();
    };
  }, []);

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

        {validando ? (
          <div className="py-6 text-center text-sm text-muted-foreground">Validando link de recuperação…</div>
        ) : concluido ? (
          <div className="space-y-4">
            <div className="rounded-md border border-concluido/25 bg-concluido-suave p-4">
              <p className="font-semibold text-concluido">Senha alterada</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Sua nova senha foi salva. Você já pode entrar normalmente.
              </p>
            </div>
            <Link
              to="/auth"
              className="inline-flex h-9 w-full items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Voltar ao login
            </Link>
          </div>
        ) : !autorizado ? (
          <div className="space-y-4">
            <div className="rounded-md border border-urgente/30 bg-urgente-suave p-4">
              <p className="font-semibold text-urgente">Link inválido ou expirado</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Solicite um novo link de recuperação pela tela de login.
              </p>
            </div>
            <Link
              to="/auth"
              className="inline-flex h-9 w-full items-center justify-center rounded-md border border-border bg-background text-sm font-medium hover:bg-muted"
            >
              Voltar ao login
            </Link>
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setErro("");

              if (senha !== confirmar) {
                setErro("As senhas não coincidem.");
                return;
              }

              setEnviando(true);
              const { error } = await supabase.auth.updateUser({ password: senha });
              setEnviando(false);

              if (error) {
                setErro("Não foi possível alterar a senha. Solicite um novo link e tente novamente.");
                return;
              }

              await supabase.auth.signOut();
              setConcluido(true);
            }}
          >
            <div className="mb-1">
              <div className="flex items-center gap-2">
                <KeyRound className="size-4 text-primary" />
                <h2 className="text-base font-semibold">Defina uma nova senha</h2>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Use pelo menos 6 caracteres.</p>
            </div>

            <Campo rotulo="Nova senha">
              <div className="relative">
                <input
                  type={mostrar ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={6}
                  maxLength={72}
                  className={`${CLASSE_CAMPO} pr-10`}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                />
                <button
                  type="button"
                  aria-label={mostrar ? "Ocultar senha" : "Mostrar senha"}
                  className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
                  onClick={() => setMostrar((v) => !v)}
                >
                  {mostrar ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </Campo>

            <Campo rotulo="Confirmar nova senha">
              <input
                type={mostrar ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={6}
                maxLength={72}
                className={CLASSE_CAMPO}
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
              />
            </Campo>

            {erro ? <p className="text-sm text-urgente">{erro}</p> : null}

            <button
              disabled={enviando}
              className="inline-flex h-9 w-full items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {enviando ? "Salvando…" : "Salvar nova senha"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
