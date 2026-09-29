import { createFileRoute } from "@tanstack/react-router";
import { AssistenteChat } from "@/components/assistente/AssistenteChat";

export const Route = createFileRoute("/_authenticated/assistente")({
  head: () => ({
    meta: [
      { title: "Assistente da Vara — Gestão da Vara Criminal" },
      { name: "description", content: "Assistente interno para redação, consulta e apoio às atividades da serventia." },
    ],
  }),
  component: PaginaAssistente,
});

function PaginaAssistente() {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Ferramenta interna</p>
        <h1 className="mt-1 text-2xl font-semibold">Assistente da Vara</h1>
        <p className="mt-1 text-sm text-muted-foreground">Um espaço de apoio para as tarefas do dia a dia da serventia.</p>
      </div>
      <AssistenteChat />
    </div>
  );
}
