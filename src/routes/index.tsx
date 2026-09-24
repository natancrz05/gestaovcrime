import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Etiqueta } from "@/components/ui-serventia/Etiqueta";
import { EstadoVazio } from "@/components/ui-serventia/Cabecalho";
import { CartoesCategorias, ListaAtencao, contarCategorias } from "@/components/processos/Prioridades";
import { formatarData, SEVERIDADE_CLASSES } from "@/lib/dominio";
import { listarProximasAcoes } from "@/lib/repositorio";
import { processosQuery } from "@/lib/processos/repositorio";
import { CATEGORIAS, processosQueRequeremAtencao, type CategoriaPrioridade } from "@/lib/processos/prioridades";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Gestão da Vara Criminal" },
      { name: "description", content: "Painel de prioridades da serventia da Vara Criminal de Coração de Maria/BA." },
      { property: "og:title", content: "Dashboard — Gestão da Vara Criminal" },
      { property: "og:description", content: "Painel de prioridades da serventia da Vara Criminal de Coração de Maria/BA." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(processosQuery()),
  errorComponent: ({ error }) => <EstadoVazio titulo="Erro ao carregar o painel" descricao={error.message} />,
  component: Dashboard,
});

function Dashboard() {
  const { data: processos } = useSuspenseQuery(processosQuery());
  const [categoria, setCategoria] = useState<CategoriaPrioridade | null>(null);
  const atencao = useMemo(() => processosQueRequeremAtencao(processos), [processos]);
  const contagens = contarCategorias(atencao);
  const exibidos = categoria ? atencao.filter((x) => x.alertas.some((a) => a.categoria === categoria)) : atencao;
  const acoes = listarProximasAcoes();

  return (
    <div className="space-y-8">
      <header className="border-b border-border pb-5">
        <h1 className="text-2xl font-semibold text-foreground">Gestão da Vara Criminal</h1>
        <p className="mt-1 text-sm text-muted-foreground">Comarca de Coração de Maria/BA</p>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Quais processos precisam da atenção da serventia? Os indicadores são alertas de gestão e não
          representam conclusão jurídica.
        </p>
      </header>

      <section aria-label="Indicadores">
        <CartoesCategorias contagens={contagens} selecionada={categoria} onSelecionar={setCategoria} />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section aria-labelledby="requer-atencao" className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 id="requer-atencao" className="text-lg font-semibold text-foreground">Requer atenção</h2>
              <p className="text-sm text-muted-foreground">
                {categoria ? `Filtrado: ${CATEGORIAS.find((c) => c.chave === categoria)?.titulo}` : "Processos com ao menos um alerta de gestão"}
                {categoria ? (
                  <button className="ml-2 text-primary hover:underline" onClick={() => setCategoria(null)}>Mostrar todos</button>
                ) : null}
              </p>
            </div>
            <Link to="/prioridades" className="text-sm font-medium text-primary hover:underline">Gerenciar prioridades</Link>
          </div>
          <ListaAtencao itens={exibidos} />
        </section>

        <section aria-labelledby="proximas-acoes" className="space-y-3">
          <div>
            <h2 id="proximas-acoes" className="text-lg font-semibold text-foreground">Próximas ações</h2>
            <p className="text-sm text-muted-foreground">Exemplos fictícios (módulo futuro)</p>
          </div>
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card shadow-card">
            {acoes.map((a) => (
              <li key={a.id} className="flex items-start gap-3 px-4 py-3">
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full border", SEVERIDADE_CLASSES[a.severidade])} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{a.descricao}</p>
                  <p className="numero-processo mt-0.5 text-xs text-muted-foreground">{a.processoNumero}</p>
                </div>
                <Etiqueta severidade={a.severidade}>{formatarData(a.prazo)}</Etiqueta>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
