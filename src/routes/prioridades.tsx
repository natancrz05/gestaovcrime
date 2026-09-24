import { createFileRoute } from "@tanstack/react-router";
import { Cabecalho } from "@/components/ui-serventia/Cabecalho";
import { ListaProcessos } from "@/components/ui-serventia/ListaProcessos";
import { listarProcessosPrioritarios } from "@/lib/repositorio";

export const Route = createFileRoute("/prioridades")({
  head: () => ({
    meta: [
      { title: "Prioridades — Gestão da Vara Criminal" },
      {
        name: "description",
        content: "Processos que exigem atenção imediata da serventia.",
      },
      { property: "og:title", content: "Prioridades — Gestão da Vara Criminal" },
      {
        property: "og:description",
        content: "Processos que exigem atenção imediata da serventia.",
      },
    ],
  }),
  component: Pagina,
});

function Pagina() {
  return (
    <div className="space-y-6">
      <Cabecalho
        titulo="Prioridades"
        subtitulo="Reunião dos processos urgentes e de atenção, ordenados por tempo sem movimentação"
      />
      <ListaProcessos processos={listarProcessosPrioritarios()} />
    </div>
  );
}
