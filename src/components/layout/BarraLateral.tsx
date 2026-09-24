import { Link } from "@tanstack/react-router";
import {
  LayoutDashboard,
  FolderOpen,
  AlertTriangle,
  Lock,
  Timer,
  PauseCircle,
  CalendarDays,
  ClipboardList,
  FileBarChart2,
  Settings,
  Scale,
} from "lucide-react";

const ITENS = [
  { para: "/", rotulo: "Dashboard", icone: LayoutDashboard, exato: true },
  { para: "/processos", rotulo: "Processos", icone: FolderOpen },
  { para: "/prioridades", rotulo: "Prioridades", icone: AlertTriangle },
  { para: "/reus-presos", rotulo: "Réus Presos", icone: Lock },
  { para: "/prisoes-temporarias", rotulo: "Prisões Temporárias", icone: Timer },
  { para: "/sem-movimentacao", rotulo: "Sem Movimentação", icone: PauseCircle },
  { para: "/audiencias", rotulo: "Audiências", icone: CalendarDays },
  { para: "/pendencias", rotulo: "Pendências", icone: ClipboardList },
  { para: "/relatorios", rotulo: "Relatórios", icone: FileBarChart2 },
  { para: "/configuracoes", rotulo: "Configurações", icone: Settings },
] as const;

export function BarraLateral() {
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex lg:w-72">
      <div className="flex items-start gap-3 border-b border-sidebar-border px-5 py-5">
        <span className="mt-0.5 flex size-9 items-center justify-center rounded-md bg-sidebar-accent">
          <Scale className="size-5 text-sidebar-accent-foreground" />
        </span>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-sidebar-foreground">Vara Criminal</p>
          <p className="text-xs text-sidebar-muted">Coração de Maria/BA</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted">
          Gestão da serventia
        </p>
        <ul className="space-y-0.5">
          {ITENS.map(({ para, rotulo, icone: Icone, ...resto }) => (
            <li key={para}>
              <Link
                to={para}
                activeOptions={{ exact: "exato" in resto }}
                className="flex items-center gap-3 rounded-md px-2.5 py-2 text-sm text-sidebar-muted transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground data-[status=active]:bg-sidebar-accent data-[status=active]:font-medium data-[status=active]:text-sidebar-accent-foreground"
              >
                <Icone className="size-4 shrink-0" />
                {rotulo}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="border-t border-sidebar-border px-5 py-4">
        <p className="text-[11px] leading-relaxed text-sidebar-muted">
          Ferramenta de organização interna. Não substitui a análise do servidor ou do
          magistrado.
        </p>
      </div>
    </aside>
  );
}
