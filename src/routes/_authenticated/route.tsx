import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { carregarSessao } from "@/lib/sessao";
import { BarraLateral } from "@/components/layout/BarraLateral";
import { TopoMobile } from "@/components/layout/TopoMobile";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const sessao = await carregarSessao();
    if (!sessao) throw redirect({ to: "/auth" });
    if (!sessao.ativo || !sessao.perfil) {
      await supabase.auth.signOut();
      throw redirect({ to: "/auth", search: { aviso: "inativo" } });
    }
    return { sessao };
  },
  component: Layout,
});

function Layout() {
  return (
    <div className="min-h-screen md:flex">
      <BarraLateral />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopoMobile />
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-5 py-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
