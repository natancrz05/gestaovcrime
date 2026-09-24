import { createFileRoute } from "@tanstack/react-router";
import { Cabecalho } from "@/components/ui-serventia/Cabecalho";
import { ListaProcessos } from "@/components/ui-serventia/ListaProcessos";
import { listarProcessosPor } from "@/lib/repositorio";

export const Route = createFileRoute("/_authenticated/prisoes-temporarias")({
  head: () => ({
    meta: [
      { title: "Prisões Temporárias — Gestão da Vara Criminal" },
      {
        name: "description",
        content: "Controle de prazos de prisões temporárias em curso.",
      },
      { property: "og:title", content: "Prisões Temporárias — Gestão da Vara Criminal" },
      {
        property: "og:description",
        content: "Controle de prazos de prisões temporárias em curso.",
      },
    ],
  }),
  component: Pagina,
});

function Pagina() {
  return (
    <div className="space-y-6">
      <Cabecalho
        titulo="Prisões Temporárias"
        subtitulo="Controle de prazos — verificar vencimento e necessidade de providência"
      />
      <ListaProcessos processos={listarProcessosPor("prisao-temporaria")} />
    </div>
  );
}
