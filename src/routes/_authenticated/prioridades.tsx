import { createFileRoute } from "@tanstack/react-router";
import { EstadoVazio } from "@/components/ui-serventia/Cabecalho";
import { PrioridadesAlertas } from "@/components/processos/PrioridadesAlertasBeta";
import { processosQuery } from "@/lib/processos/repositorio";

export const Route = createFileRoute("/_authenticated/prioridades")({
  head: () => ({
    meta: [
      { title: "Prioridades e Alertas — Gestão da Vara Criminal" },
      { name: "description", content: "Central unificada de prioridades e alertas de gestão da serventia." },
      { property: "og:title", content: "Prioridades e Alertas — Gestão da Vara Criminal" },
      { property: "og:description", content: "Central unificada de prioridades e alertas de gestão da serventia." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(processosQuery()),
  errorComponent: ({ error }) => <EstadoVazio titulo="Erro ao carregar prioridades e alertas" descricao={error.message} />,
  component: PrioridadesAlertas,
});
