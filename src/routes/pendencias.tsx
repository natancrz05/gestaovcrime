import { createFileRoute } from "@tanstack/react-router";
import { Cabecalho } from "@/components/ui-serventia/Cabecalho";
import { Etiqueta } from "@/components/ui-serventia/Etiqueta";
import { formatarData } from "@/lib/dominio";
import { listarPendencias } from "@/lib/repositorio";

export const Route = createFileRoute("/pendencias")({
  head: () => ({
    meta: [
      { title: "Pendências — Gestão da Vara Criminal" },
      { name: "description", content: "Itens em aberto na serventia da Vara Criminal." },
      { property: "og:title", content: "Pendências — Gestão da Vara Criminal" },
      {
        property: "og:description",
        content: "Itens em aberto na serventia da Vara Criminal.",
      },
    ],
  }),
  component: Pagina,
});

function Pagina() {
  const pendencias = listarPendencias();
  return (
    <div className="space-y-6">
      <Cabecalho
        titulo="Pendências"
        subtitulo="Itens em aberto que dependem de providência da serventia"
      />
      <ul className="space-y-3">
        {pendencias.map((p) => (
          <li
            key={p.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4 shadow-card"
          >
            <div>
              <p className="text-sm font-medium text-foreground">{p.descricao}</p>
              <p className="numero-processo mt-1 text-xs text-muted-foreground">
                {p.processoNumero}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                Prazo: {formatarData(p.prazo)}
              </span>
              <Etiqueta severidade={p.severidade}>
                {p.severidade === "urgente" ? "Urgente" : "Atenção"}
              </Etiqueta>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
