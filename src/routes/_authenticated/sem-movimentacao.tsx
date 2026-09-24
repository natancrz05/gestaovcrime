import { createFileRoute } from "@tanstack/react-router";
import { Cabecalho } from "@/components/ui-serventia/Cabecalho";
import { ListaProcessos } from "@/components/ui-serventia/ListaProcessos";
import { listarProcessos } from "@/lib/repositorio";

export const Route = createFileRoute("/_authenticated/sem-movimentacao")({
  head: () => ({
    meta: [
      { title: "Sem Movimentação — Gestão da Vara Criminal" },
      {
        name: "description",
        content: "Processos parados há mais de 100 dias no acervo da serventia.",
      },
      { property: "og:title", content: "Sem Movimentação — Gestão da Vara Criminal" },
      {
        property: "og:description",
        content: "Processos parados há mais de 100 dias no acervo da serventia.",
      },
    ],
  }),
  component: Pagina,
});

function Pagina() {
  const parados = listarProcessos()
    .filter((p) => p.diasSemMovimentacao > 100)
    .sort((a, b) => b.diasSemMovimentacao - a.diasSemMovimentacao);

  return (
    <div className="space-y-6">
      <Cabecalho
        titulo="Sem Movimentação"
        subtitulo="Processos com mais de 100 dias sem movimentação"
      />
      <ListaProcessos processos={parados} />
    </div>
  );
}
