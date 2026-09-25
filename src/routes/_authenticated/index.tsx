import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { EstadoVazio } from "@/components/ui-serventia/Cabecalho";
import { CartoesCategorias, ListaAtencao, contarCategorias } from "@/components/processos/Prioridades";
import { formatarData } from "@/lib/dominio";
import { listarPendenciasDe, proximasAcoes } from "@/lib/processos/pendencias";
import { processosQuery } from "@/lib/processos/repositorio";
import { CATEGORIAS, processosQueRequeremAtencao, type CategoriaPrioridade } from "@/lib/processos/prioridades";
import { cn } from "@/lib/utils";
import { comparecimentosQuery, preparar } from "@/lib/processos/comparecimentos";
import { listarCentral } from "@/lib/processos/central";
import { futuras, horaCurta, listarAudienciasDe } from "@/lib/processos/audiencias";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Gestão da Vara Criminal" },
      { name: "description", content: "Painel de prioridades da serventia da Vara Criminal de Coração de Maria/BA." },
      { property: "og:title", content: "Dashboard — Gestão da Vara Criminal" },
      { property: "og:description", content: "Painel de prioridades da serventia da Vara Criminal de Coração de Maria/BA." },
    ],
  }),
  loader: ({ context }) => Promise.all([context.queryClient.ensureQueryData(processosQuery()), context.queryClient.ensureQueryData(comparecimentosQuery())]),
  errorComponent: ({ error }) => <EstadoVazio titulo="Erro ao carregar o painel" descricao={error.message} />,
  component: Dashboard,
});

function Dashboard() {
  const { data: processos } = useSuspenseQuery(processosQuery());
  const [categoria, setCategoria] = useState<CategoriaPrioridade | null>(null);
  const atencao = useMemo(() => processosQueRequeremAtencao(processos), [processos]);
  const contagens = contarCategorias(atencao);
  const exibidos = categoria ? atencao.filter((x) => x.alertas.some((a) => a.categoria === categoria)) : atencao;
  const pendencias = listarPendenciasDe(processos);
  const pendAbertas = pendencias.filter((p) => !p.concluidaFlag).length;
  const acoes = proximasAcoes(pendencias).slice(0, 8);
  const audFuturas = futuras(listarAudienciasDe(processos));
  const { data: compData } = useSuspenseQuery(comparecimentosQuery());
  const comps = preparar(compData).filter((c) => c.situacao !== "Encerrado");
  const aguardando = listarCentral(processos).length;
  const aud7 = audFuturas.filter((a) => a.dias <= 7).length;
  const audExtensas = audFuturas.filter((a) => a.prazoExtenso).length;

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

      <section aria-labelledby="painel-audiencias" className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_2fr]">
        <h2 id="painel-audiencias" className="sr-only">Audiências</h2>
        <Link to="/audiencias" className="rounded-lg border border-border bg-card p-4 shadow-card hover:shadow-card-hover">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Audiências nos próximos 7 dias</p>
          <p className="mt-3 text-3xl font-semibold tabular-nums text-info">{aud7}</p>
          <p className="mt-1 text-xs text-muted-foreground" data-testid="aguardando-marcacao"><span className="font-semibold text-foreground">{aguardando}</span> aguardando marcação</p>
        </Link>
        <Link to="/audiencias" className="rounded-lg border border-border bg-card p-4 shadow-card hover:shadow-card-hover">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Audiências com prazo extenso</p>
          <p className="mt-3 text-3xl font-semibold tabular-nums text-atencao">{audExtensas}</p>
          <p className="mt-1 text-xs text-muted-foreground">Critério administrativo de acompanhamento</p>
        </Link>
        <Link to="/pendencias" className="rounded-lg border border-border bg-card p-4 shadow-card hover:shadow-card-hover">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Pendências</p>
          <p className="mt-3 text-3xl font-semibold tabular-nums text-foreground">{pendAbertas}</p>
          <p className="mt-1 text-xs text-muted-foreground">Ainda não concluídas</p>
        </Link>
        <div className="rounded-lg border border-border bg-card p-4 shadow-card">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Próximas audiências</p>
          <ul className="mt-2 space-y-1.5 text-sm">
            {audFuturas.slice(0, 4).map((a) => (
              <li key={a.id} className="flex flex-wrap justify-between gap-2">
                <span><span className={cn("font-medium", a.dias === 0 && "text-urgente")}>{a.dias === 0 ? "Hoje" : formatarData(a.data)} {horaCurta(a.horario)}</span> · {a.tipo}</span>
                <Link to="/processos/$id" params={{ id: a.processo_id }} className="numero-processo text-xs text-primary hover:underline">{a.numero}</Link>
              </li>
            ))}
            {audFuturas.length === 0 ? <li className="text-muted-foreground">Nenhuma audiência futura.</li> : null}
          </ul>
        </div>
      </section>

      <section aria-labelledby="painel-comp" className="grid gap-3 md:grid-cols-[1fr_1fr_3fr]">
        <h2 id="painel-comp" className="sr-only">Comparecimentos</h2>
        <Link to="/comparecimentos" search={{ situacao: "vencido", id: "" }} className="rounded-lg border border-border bg-card p-4 shadow-card hover:shadow-card-hover">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Comparecimentos vencidos</p>
          <p className="mt-3 text-3xl font-semibold tabular-nums text-urgente">{comps.filter((c) => c.status === "vencido").length}</p>
        </Link>
        <Link to="/comparecimentos" search={{ situacao: "vencendo", id: "" }} className="rounded-lg border border-border bg-card p-4 shadow-card hover:shadow-card-hover">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Vencendo em 7 dias</p>
          <p className="mt-3 text-3xl font-semibold tabular-nums text-alerta">{comps.filter((c) => c.status === "vencendo").length}</p>
        </Link>
        <div className="rounded-lg border border-border bg-card p-4 shadow-card">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Próximos comparecimentos</p>
          <ul className="mt-2 space-y-1 text-sm">
            {comps.filter((c) => c.status !== "vencido").slice(0, 4).map((c) => (
              <li key={c.id}><Link to="/comparecimentos" search={{ situacao: "", id: c.id }} className="hover:underline"><span className="font-medium">{formatarData(c.proximo)}</span> · {c.pessoa} · <span className="numero-processo text-muted-foreground">{c.numero}</span></Link></li>
            ))}
            {comps.every((c) => c.status === "vencido") ? <li className="text-muted-foreground">Nenhum comparecimento futuro.</li> : null}
          </ul>
        </div>
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
            <p className="text-sm text-muted-foreground">Atrasadas, alta prioridade e prazo próximo</p>
          </div>
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card shadow-card">
            {acoes.map((a) => (
              <li key={a.id} className="flex items-start gap-3 px-4 py-3">
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", a.atrasada ? "bg-urgente" : a.prioridade === "alta" ? "bg-atencao" : "bg-info")} />
                <div className="min-w-0 flex-1">
                  <Link to="/pendencias" className="text-sm font-medium text-foreground hover:underline">{a.titulo || a.descricao}</Link>
                  <p className="mt-0.5 text-xs text-muted-foreground"><Link to="/processos/$id" params={{ id: a.processo_id }} className="numero-processo hover:underline">{a.numero}</Link>{a.responsavel ? ` · ${a.responsavel}` : ""}</p>
                </div>
                <span className={cn("shrink-0 text-xs tabular-nums", a.atrasada ? "font-medium text-urgente" : "text-muted-foreground")}>{a.atrasada ? "Atrasada · " : ""}{formatarData(a.prazo)}</span>
              </li>
            ))}
            {acoes.length === 0 ? <li className="px-4 py-3 text-sm text-muted-foreground">Nenhuma ação pendente.</li> : null}
          </ul>
        </section>
      </div>
    </div>
  );
}
