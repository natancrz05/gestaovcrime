import { Link } from "@tanstack/react-router";
import { Scale } from "lucide-react";
import { useItensNav } from "./BarraLateral";
import { useSair } from "./Usuario";

export function TopoMobile() {
  const sair = useSair();
  const itens = useItensNav();
  return (
    <div className="sticky top-0 z-20 border-b border-sidebar-border bg-sidebar md:hidden">
      <div className="flex items-center gap-2 px-4 py-3">
        <Scale className="size-5 text-sidebar-accent-foreground" />
        <div className="leading-tight">
          <p className="text-sm font-semibold text-sidebar-foreground">Vara Criminal</p>
          <p className="text-[11px] text-sidebar-muted">Coração de Maria/BA</p>
        </div>
        <button onClick={sair} className="ml-auto rounded-md px-2 py-1 text-xs text-sidebar-muted hover:text-sidebar-foreground">Sair</button>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
        {itens.map(({ para, rotulo, exato }) => (
          <Link
            key={para}
            to={para}
            activeOptions={{ exact: exato }}
            className="whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs text-sidebar-muted transition-colors data-[status=active]:bg-sidebar-accent data-[status=active]:text-sidebar-accent-foreground"
          >
            {rotulo}
          </Link>
        ))}
      </nav>
    </div>
  );
}
