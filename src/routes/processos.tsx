import { createFileRoute } from "@tanstack/react-router";
import { Cabecalho } from "@/components/ui-serventia/Cabecalho";
import { ListaProcessos } from "@/components/ui-serventia/ListaProcessos";
import { listarProcessos } from "@/lib/repositorio";

export const Route = createFileRoute("/processos")({
  head: () => ({
    meta: [
      { title: "Processos — Gestão da Vara Criminal" },
      {
        name: "description",
        content: "Acervo de processos da serventia da Vara Criminal de Coração de Maria/BA.",
      },
      { property: "og:title", content: "Processos — Gestão da Vara Criminal" },
      {
        property: "og:description",
        content: "Acervo de processos da serventia da Vara Criminal de Coração de Maria/BA.",
      },
    ],
  }),
  component: Pagina,
});

function Pagina() {
  const processos = listarProcessos();
  return (
    <div className="space-y-6">
      <Cabecalho
        titulo="Processos"
        subtitulo={`${processos.length} processos fictícios no acervo de demonstração`}
      />
      <ListaProcessos processos={processos} />
    </div>
  );
}
