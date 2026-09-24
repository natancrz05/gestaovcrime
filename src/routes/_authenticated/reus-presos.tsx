import { createFileRoute } from "@tanstack/react-router";
import { Cabecalho } from "@/components/ui-serventia/Cabecalho";
import { ListaProcessos } from "@/components/ui-serventia/ListaProcessos";
import { listarProcessosPor } from "@/lib/repositorio";

export const Route = createFileRoute("/_authenticated/reus-presos")({
  head: () => ({
    meta: [
      { title: "Réus Presos — Gestão da Vara Criminal" },
      { name: "description", content: "Processos com réu custodiado na Vara Criminal." },
      { property: "og:title", content: "Réus Presos — Gestão da Vara Criminal" },
      {
        property: "og:description",
        content: "Processos com réu custodiado na Vara Criminal.",
      },
    ],
  }),
  component: Pagina,
});

function Pagina() {
  return (
    <div className="space-y-6">
      <Cabecalho
        titulo="Réus Presos"
        subtitulo="Processos com réu custodiado — prioridade máxima de tramitação"
      />
      <ListaProcessos processos={listarProcessosPor("reu-preso")} />
    </div>
  );
}
