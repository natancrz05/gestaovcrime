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
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
              Ferramenta interna
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              Ambiente protegido
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Assistente da Vara</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Um espaço de apoio para redação, consultas e tarefas do dia a dia da serventia, com revisão humana antes do uso oficial.
          </p>
        </div>
        <div className="hidden rounded-xl border border-border/70 bg-card px-3.5 py-2.5 text-right shadow-sm lg:block">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Modo de uso</p>
          <p className="mt-0.5 text-xs font-medium">Apoio à atividade cartorária</p>
        </div>
      </div>

      <AssistenteChat />
    </div>
  );
}
