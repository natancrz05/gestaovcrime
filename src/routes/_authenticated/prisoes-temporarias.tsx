import { createFileRoute, redirect } from "@tanstack/react-router";

// Módulo unificado em Réus Presos: o endereço antigo apenas redireciona.
export const Route = createFileRoute("/_authenticated/prisoes-temporarias")({
  beforeLoad: () => { throw redirect({ to: "/reus-presos" }); },
});
