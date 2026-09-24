import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { rotuloPerfil } from "@/lib/permissoes";
import { useSessao } from "@/lib/sessao";

export function useSair() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };
}

export function BlocoUsuario() {
  const s = useSessao();
  const sair = useSair();
  return (
    <div className="flex items-center justify-between gap-2 border-t border-sidebar-border px-5 py-3">
      <div className="min-w-0 leading-tight">
        <p className="truncate text-sm font-medium text-sidebar-foreground">{s.nome || s.email}</p>
        <p className="text-[11px] text-sidebar-muted">{rotuloPerfil(s.perfil)}</p>
      </div>
      <button onClick={sair} aria-label="Sair do sistema" className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-sidebar-muted hover:bg-sidebar-accent/60 hover:text-sidebar-foreground">
        <LogOut className="size-4" /> Sair
      </button>
    </div>
  );
}
