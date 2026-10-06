import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { EstadoVazio } from "@/components/ui-serventia/Cabecalho";
import { formatarData } from "@/lib/dominio";
import { listarPendenciasDe, proximasAcoes } from "@/lib/processos/pendencias";
import { etiquetasDosProcessosQuery, processosQuery, type EtiquetaDoProcesso } from "@/lib/processos/repositorio";
import { presosQuery } from "@/lib/processos/reus-presos";
import { cn } from "@/lib/utils";
import { comparecimentosQuery, preparar } from "@/lib/processos/comparecimentos";
import { listarCentral } from "@/lib/processos/central";
import { futuras, horaCurta, listarAudienciasDe } from "@/lib/processos/audiencias";
import { hojeISO } from "@/lib/processos/modelo";
import { agruparItensAtencaoBeta, contarGruposAtencaoBeta } from "@/lib/processos/agrupamento-alertas";
import {
  DADOS_VAZIOS_ALERTAS_BETA,
  alertasOcultosBetaQuery,
  chaveOcultacaoAlertaBeta,
  dadosAuxiliaresAlertasBetaQuery,
  montarItensAtencaoBeta,
  type NivelAtencaoBeta,
  type ReuPresoBeta,
} from "@/lib/processos/alertas-beta";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Gestão da Vara Criminal" },
      { name: "description", content: "Painel de prioridades da serventia da Vara Criminal de Coração de Maria/BA." },
      { property: "og:title", content: "Dashboard — Gestão da Vara Criminal" },
      { property: "og:description", content: "Painel de prioridades da serventia da Vara Criminal de Coração de Maria/BA." },
    ],
  }),
  loader: ({ context }) => Promise.all([context.queryClient.ensureQueryData(processosQuery()), context.queryClient.ensureQueryData(presosQuery()), context.queryClient.ensureQueryData(comparecimentosQuery())]),
  errorComponent: ({ error }) => <EstadoVazio titulo="Erro ao carregar o painel" descricao={error.message} />,
  component: Dashboard,
});

const NIVEIS_DASHBOARD: {
  valor: Exclude<NivelAtencaoBeta, "administrativo">;
  rotulo: string;
  texto: string;
  selo: string;
}[] = [
  { valor: "critico", rotulo: "Crítico", texto: "text-urgente", selo: "border-urgente/30 bg-urgente-suave text-urgente" },
  { valor: "urgente", rotulo: "Urgente", texto: "text-alerta", selo: "border-alerta/30 bg-alerta-suave text-alerta" },
  { valor: "atencao", rotulo: "Atenção", texto: "text-atencao", selo: "border-atencao/30 bg-atencao-suave text-atencao" },
  { valor: "conferir", rotulo: "Conferir", texto: "text-temporaria", selo: "border-temporaria/30 bg-temporaria-suave text-temporaria" },
  { valor: "informativo", rotulo: "Informativo", texto: "text-info", selo: "border-info/30 bg-info/10 text-info" },
];

function Dashboard() {
  const { data: processos } = useSuspenseQuery(processosQuery());
  const { data: presos } = useSuspenseQuery(presosQuery());
  const { data: compData } = useSuspenseQuery(comparecimentosQuery());
  const hoje = hojeISO();

  const processoIds = useMemo(() => processos.map((p) => p.id), [processos]);
  const reuIds = useMemo(() => presos.map((p) => p.id), [presos]);
  const etiquetas = useQuery(etiquetasDosProcessosQuery(processoIds));
  const auxiliares = useQuery(dadosAuxiliaresAlertasBetaQuery(reuIds));
  const ocultos = useQuery(alertasOcultosBetaQuery());
  const [nivelSelecionado, setNivelSelecionado] = useState<Exclude<NivelAtencaoBeta, "administrativo"> | null>(null);

  const alertasCarregando = etiquetas.isLoading || auxiliares.isLoading || ocultos.isLoading;
  const itensAlertas = useMemo(() => {
    if (alertasCarregando) return [];
    return montarItensAtencaoBeta({
      processos,
      presos: presos as unknown as ReuPresoBeta[],
      comparecimentos: compData,
      etiquetasPorProcesso: etiquetas.data ?? {},
      auxiliares: auxiliares.data ?? DADOS_VAZIOS_ALERTAS_BETA,
      hoje,
    });
  }, [alertasCarregando, processos, presos, compData, etiquetas.data, auxiliares.data, hoje]);

  const chavesOcultas = useMemo(() => new Set(ocultos.data ?? []), [ocultos.data]);
  const alertasVisiveis = useMemo(
    () =>
      agruparItensAtencaoBeta(
        itensAlertas.filter(
          (item) =>
            item.nivel !== "administrativo" &&
            !chavesOcultas.has(chaveOcultacaoAlertaBeta(item)),
        ),
      ),
    [itensAlertas, chavesOcultas],
  );

  const contagensAlertas = useMemo(() => contarGruposAtencaoBeta(alertasVisiveis), [alertasVisiveis]);

  const alertasExibidos = nivelSelecionado
    ? alertasVisiveis.filter((item) => item.nivel === nivelSelecionado)
    : alertasVisiveis;

  const pendencias = listarPendenciasDe(processos);
  const pendAbertas = pendencias.filter((p) => !p.concluidaFlag).length;
  const acoes = proximasAcoes(pendencias).slice(0, 8);
  const audFuturas = futuras(listarAudienciasDe(processos));
  const comps = preparar(compData, hoje).filter((c) => c.situacao !== "Encerrado");
  const aguardando = listarCentral(processos).length;
  const aud7 = audFuturas.filter((a) => a.dias <= 7).length;
  const audExtensas = audFuturas.filter((a) => a.prazoExtenso).length;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Central de gestão da Vara Criminal</p>
          <h1 className="mt-1 text-2xl font-semibold text-foreground sm:text-3xl">Painel da serventia</h1>
          <p className="mt-1 text-sm text-muted-foreground">Comarca de Coração de Maria/BA</p>
        </div>
        <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
          Os indicadores são alertas de gestão e não representam conclusão jurídica.
        </p>
      </header>

      <section aria-labelledby="indicadores" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="indicadores" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Prioridades e alertas</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Cada processo conta uma vez, no nível mais alto, como na Central de Prioridades e Alertas.
            </p>
          </div>
          <Link to="/prioridades" className="text-xs font-medium text-primary hover:underline">Abrir central</Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {NIVEIS_DASHBOARD.map((nivel) => {
            const ativo = nivelSelecionado === nivel.valor;
            return (
              <button
                key={nivel.valor}
                type="button"
                aria-pressed={ativo}
                onClick={() => setNivelSelecionado(ativo ? null : nivel.valor)}
                className={cn(
                  "rounded-lg border bg-card p-4 text-left shadow-card transition-colors hover:border-primary/40",
                  ativo ? "border-primary ring-1 ring-primary/30" : "border-border",
                )}
              >
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{nivel.rotulo}</p>
                <p className={cn("mt-2 text-3xl font-semibold leading-none tabular-nums", nivel.texto)}>
                  {alertasCarregando ? "—" : contagensAlertas[nivel.valor] ?? 0}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      <h2 className="-mb-5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Agenda e acompanhamento</h2>

      <section aria-labelledby="painel-audiencias" className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_1fr_2fr]">
        <h2 id="painel-audiencias" className="sr-only">Audiências</h2>
        <Link to="/reus-presos" className="rounded-lg border border-border bg-card p-4 shadow-card hover:shadow-card-hover">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Presos provisórios</p>
          <p className="mt-2 text-3xl font-semibold leading-none tracking-tight tabular-nums text-urgente">{presos.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">Pessoas atualmente custodiadas</p>
        </Link>
        <Link to="/audiencias" className="rounded-lg border border-border bg-card p-4 shadow-card hover:shadow-card-hover">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Audiências nos próximos 7 dias</p>
          <p className="mt-2 text-3xl font-semibold leading-none tracking-tight tabular-nums text-info">{aud7}</p>
          <p className="mt-1 text-xs text-muted-foreground" data-testid="aguardando-marcacao"><span className="font-semibold text-foreground">{aguardando}</span> aguardando marcação</p>
        </Link>
        <Link to="/audiencias" className="rounded-lg border border-border bg-card p-4 shadow-card hover:shadow-card-hover">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Audiências com prazo extenso</p>
          <p className="mt-2 text-3xl font-semibold leading-none tracking-tight tabular-nums text-atencao">{audExtensas}</p>
          <p className="mt-1 text-xs text-muted-foreground">Critério administrativo de acompanhamento</p>
        </Link>
        <Link to="/prioridades" className="rounded-lg border border-border bg-card p-4 shadow-card hover:shadow-card-hover">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Pendências em acompanhamento</p>
          <p className="mt-2 text-3xl font-semibold leading-none tracking-tight tabular-nums text-foreground">{pendAbertas}</p>
          <p className="mt-1 text-xs text-muted-foreground">Ainda não concluídas</p>
        </Link>
        <div className="rounded-lg border border-border bg-card p-4 shadow-card">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Próximas audiências</p>
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

      <section aria-labelledby="painel-comp" className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_3fr]">
        <h2 id="painel-comp" className="sr-only">Comparecimentos</h2>
        <Link to="/comparecimentos" search={{ situacao: "vencido", id: "" }} className="rounded-lg border border-border bg-card p-4 shadow-card hover:shadow-card-hover">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Comparecimentos vencidos</p>
          <p className="mt-2 text-3xl font-semibold leading-none tracking-tight tabular-nums text-urgente">{comps.filter((c) => c.status === "vencido").length}</p>
        </Link>
        <Link to="/comparecimentos" search={{ situacao: "vencendo", id: "" }} className="rounded-lg border border-border bg-card p-4 shadow-card hover:shadow-card-hover">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Vencendo em 7 dias</p>
          <p className="mt-2 text-3xl font-semibold leading-none tracking-tight tabular-nums text-alerta">{comps.filter((c) => c.status === "vencendo").length}</p>
        </Link>
        <Link to="/comparecimentos" search={{ situacao: "regular", id: "" }} className="rounded-lg border border-border bg-card p-4 shadow-card hover:shadow-card-hover">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Comparecimentos regulares</p>
          <p className="mt-2 text-3xl font-semibold leading-none tracking-tight tabular-nums text-concluido">{comps.filter((c) => c.status === "regular").length}</p>
        </Link>
        <div className="rounded-lg border border-border bg-card p-4 shadow-card">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Próximos comparecimentos</p>
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
                {nivelSelecionado
                  ? `Filtrado: ${NIVEIS_DASHBOARD.find((n) => n.valor === nivelSelecionado)?.rotulo}`
                  : "Ocorrências ativas da Central de Prioridades e Alertas"}
                {nivelSelecionado ? (
                  <button className="ml-2 text-primary hover:underline" onClick={() => setNivelSelecionado(null)}>Mostrar todos</button>
                ) : null}
              </p>
            </div>
            <Link to="/prioridades" className="text-sm font-medium text-primary hover:underline">Abrir central</Link>
          </div>

          {alertasCarregando ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Atualizando prioridades e alertas…
            </div>
          ) : alertasExibidos.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Nenhum alerta ativo neste nível.
            </div>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card shadow-card">
              {alertasExibidos.slice(0, 8).map((item) => {
                const nivel = NIVEIS_DASHBOARD.find((n) => n.valor === item.nivel);
                return (
                  <li key={item.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {nivel ? (
                          <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium", nivel.selo)}>
                            {nivel.rotulo}
                          </span>
                        ) : null}
                        <span className="text-[11px] text-muted-foreground">
                          {[...new Set(item.motivos.map((m) => m.origem))].join(" · ")} ·{" "}
                          {[...new Set(item.motivos.map((m) => m.modulo))].join(" · ")}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-medium text-foreground">{item.titulo}</p>
                      {item.motivos.length > 1 ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {item.motivos.length} motivos ativos ·{" "}
                          {item.motivos.slice(1).map((m) => m.titulo).join("; ")}
                        </p>
                      ) : null}
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {item.processoId && item.processoNumero ? (
                          <Link to="/processos/$id" params={{ id: item.processoId }} className="numero-processo text-primary hover:underline">
                            {item.processoNumero}
                          </Link>
                        ) : item.pessoa ?? "Sem processo vinculado"}
                        {item.pessoa && item.processoNumero ? ` · ${item.pessoa}` : ""}
                      </p>
                    </div>
                    <div className="shrink-0 text-right text-xs text-muted-foreground">
                      {item.dataLimite ? <div>{formatarData(item.dataLimite)}</div> : null}
                      {item.diasRestantes !== null ? (
                        <div className={cn(item.diasRestantes <= 0 && "font-medium text-urgente")}>
                          {item.diasRestantes < 0
                            ? `${Math.abs(item.diasRestantes)}d vencido`
                            : item.diasRestantes === 0
                              ? "Hoje"
                              : `Faltam ${item.diasRestantes}d`}
                        </div>
                      ) : null}
                    </div>
                  </li>
                );
              })}
              {alertasExibidos.length > 8 ? (
                <li className="px-4 py-2.5 text-center text-xs text-muted-foreground">
                  +{alertasExibidos.length - 8} ocorrência(s) na Central
                </li>
              ) : null}
            </ul>
          )}
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
                  <Link to="/processos/$id" params={{ id: a.processo_id }} className="text-sm font-medium text-foreground hover:underline">{a.titulo || a.descricao}</Link>
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
