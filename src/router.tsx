import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { CarregandoPagina } from "@/components/ui-serventia/CarregandoPagina";

const LEITURA_STALE_TIME = 30_000;

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: LEITURA_STALE_TIME,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    defaultPendingComponent: CarregandoPagina,
    defaultPendingMs: 120,
    defaultPendingMinMs: 300,
  });

  return router;
};
