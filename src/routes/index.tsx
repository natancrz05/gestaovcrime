import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { Etiqueta } from "@/components/ui-serventia/Etiqueta";
import { CartaoProcesso } from "@/components/ui-serventia/ListaProcessos";
import { formatarData } from "@/lib/dominio";
import { SEVERIDADE_CLASSES } from "@/lib/dominio";
import {
  listarProcessosPrioritarios,
  listarProximasAcoes,
  obterIndicadores,
} from "@/lib/repositorio";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Gestão da Vara Criminal" },
      {
        name: "description",
        content:
          "Painel interno da serventia da Vara Criminal de Coração de Maria/BA: prioridades, prazos, audiências e próximas ações.",
      },
      { property: "og:title", content: "Dashboard — Gestão da Vara Criminal" },
      {
        property: "og:description",
        content:
          "Painel interno da serventia da Vara Criminal de Coração de Maria/BA: prioridades, prazos, audiências e próximas ações.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const indicadores = obterIndicadores();
  const prioritarios = listarProcessosPrioritarios().slice(0, 4);
  const acoes = listarProximasAcoes();

  return (
    <div className="space-y-8">
      <header className="border-b border-border pb-5">
        <h1 className="text-2xl font-semibold text-foreground">Gestão da Vara Criminal</h1>
        <p className="mt-1 text-sm text-muted-foreground">Comarca de Coração de Maria/BA</p>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          O que precisa da atenção da serventia hoje? Os números abaixo são fictícios e servem
          apenas para demonstração da interface.
        </p>
      </header>

      <section aria-labelledby="indicadores">
        <h2 id="indicadores" className="sr-only">
          Indicadores
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {indicadores.map((i) => (
            <Link
              key={i.chave}
              to={i.para}
              className="group rounded-lg border border-border bg-card p-4 text-left shadow-card transition-shadow hover:shadow-card-hover"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {i.titulo}
                </p>
                <ArrowUpRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
              <p
                className={cn(
                  "mt-3 text-3xl font-semibold tabular-nums",
                  i.severidade === "urgente" && "text-urgente",
                  i.severidade === "atencao" && "text-atencao",
                  i.severidade === "alerta" && "text-alerta",
                  i.severidade === "info" && "text-info",
                )}
              >
                {i.valor}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{i.descricao}</p>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section aria-labelledby="requer-atencao" className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 id="requer-atencao" className="text-lg font-semibold text-foreground">
                Requer atenção
              </h2>
              <p className="text-sm text-muted-foreground">
                Processos com prioridade identificada pela serventia
              </p>
            </div>
            <Link
              to="/prioridades"
              className="text-sm font-medium text-primary hover:underline"
            >
              Ver todos
            </Link>
          </div>
          {prioritarios.map((p) => (
            <CartaoProcesso key={p.id} processo={p} />
          ))}
        </section>

        <section aria-labelledby="proximas-acoes" className="space-y-3">
          <div>
            <h2 id="proximas-acoes" className="text-lg font-semibold text-foreground">
              Próximas ações
            </h2>
            <p className="text-sm text-muted-foreground">O que a serventia precisa fazer</p>
          </div>
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card shadow-card">
            {acoes.map((a) => (
              <li key={a.id} className="flex items-start gap-3 px-4 py-3">
                <span
                  className={cn(
                    "mt-1.5 size-2 shrink-0 rounded-full border",
                    SEVERIDADE_CLASSES[a.severidade],
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{a.descricao}</p>
                  <p className="numero-processo mt-0.5 text-xs text-muted-foreground">
                    {a.processoNumero}
                  </p>
                </div>
                <Etiqueta severidade={a.severidade}>{formatarData(a.prazo)}</Etiqueta>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
