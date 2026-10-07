import { Link } from "@tanstack/react-router";
import { BlocoUsuario } from "./Usuario";
import { useSessao } from "@/lib/sessao";
import { pode } from "@/lib/permissoes";

export function useItensNav() {
  const { perfil } = useSessao();
  return ITENS_NAV.filter((i) =>
    (i.para !== "/relatorios" || pode(perfil, "relatorios")) &&
    (i.para !== "/assistente" || pode(perfil, "usar-assistente")),
  );
}
import {
  LayoutDashboard,
  FolderOpen,
  Lock,
  CalendarDays,
  Bell,
  FileBarChart2,
  Settings,
  Scale,
  UserCheck,
  MessageSquareWarning,
  Sparkles,
  FileText,
} from "lucide-react";

export const ITENS_NAV = [
  { para: "/", rotulo: "Dashboard", icone: LayoutDashboard, exato: true },
  { para: "/processos", rotulo: "Processos", icone: FolderOpen, exato: false },
  { para: "/assistente", rotulo: "Assistente da Vara", icone: Sparkles, exato: false },
  { para: "/reus-presos", rotulo: "Presos Provisórios", icone: Lock, exato: false },
  { para: "/audiencias", rotulo: "Audiências", icone: CalendarDays, exato: false },
  { para: "/comparecimentos", rotulo: "Comparecimentos", icone: UserCheck, exato: false },
  { para: "/oficios", rotulo: "Ofícios", icone: FileText, exato: false },
  { para: "/prioridades", rotulo: "Prioridades e Alertas", icone: Bell, exato: false },
  { para: "/sugestoes", rotulo: "Problemas e Sugestões", icone: MessageSquareWarning, exato: false },
  { para: "/relatorios", rotulo: "Relatórios", icone: FileBarChart2, exato: false },
  { para: "/configuracoes", rotulo: "Configurações", icone: Settings, exato: false },
] as const;

const GRUPOS: { titulo: string; rotas: string[] }[] = [
  { titulo: "Visão geral", rotas: ["/", "/processos", "/assistente"] },
  { titulo: "Acompanhamento", rotas: ["/reus-presos", "/audiencias", "/comparecimentos", "/oficios", "/prioridades"] },
  { titulo: "Administração", rotas: ["/relatorios", "/sugestoes", "/configuracoes"] },
];

export function BarraLateral() {
  const itens = useItensNav();
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex lg:w-72">
      <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-5">
        <span className="flex size-10 items-center justify-center rounded-lg bg-sidebar-accent ring-1 ring-sidebar-border">
          <Scale className="size-5 text-sidebar-accent-foreground" />
        </span>
        <div className="leading-tight">
          <p className="text-[11px] font-medium uppercase tracking-wider text-sidebar-muted">Central de gestão</p>
          <p className="text-sm font-semibold text-sidebar-foreground">Vara Criminal</p>
          <p className="text-xs text-sidebar-muted">Coração de Maria/BA</p>
        </div>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-5">
        {GRUPOS.map((g) => {
          const doGrupo = itens.filter((i) => g.rotas.includes(i.para));
          if (!doGrupo.length) return null;
          return (
            <div key={g.titulo}>
              <p className="px-3 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-sidebar-muted/80">{g.titulo}</p>
              <ul className="space-y-0.5">
                {doGrupo.map(({ para, rotulo, icone: Icone, exato }) => (
                  <li key={para}>
                    <Link
                      to={para}
                      activeOptions={{ exact: exato }}
                      className="group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-muted transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground data-[status=active]:bg-sidebar-accent data-[status=active]:font-medium data-[status=active]:text-sidebar-accent-foreground before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[3px] before:rounded-r before:bg-transparent data-[status=active]:before:bg-sidebar-foreground"
                    >
                      <Icone className="size-[18px] shrink-0" strokeWidth={1.75} />
                      {rotulo}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>

      <BlocoUsuario />
      <div className="border-t border-sidebar-border px-5 py-4">
        <p className="text-[11px] leading-relaxed text-sidebar-muted">
          Ferramenta de organização interna. Não substitui a análise do servidor ou do
          magistrado.
        </p>
      </div>
    </aside>
  );
}
