import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { usePode } from "@/lib/sessao";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { FileSpreadsheet, Plus, Search, X } from "lucide-react";
import { EtiquetaAlerta } from "@/components/processos/Prioridades";
import { EtiquetaProcesso } from "@/components/processos/EtiquetaProcesso";
import { alertasDoProcesso } from "@/lib/processos/prioridades";
import { Cabecalho, EstadoVazio } from "@/components/ui-serventia/Cabecalho";
import { Etiqueta } from "@/components/ui-serventia/Etiqueta";
import { CLASSE_CAMPO, Opcoes } from "@/components/processos/campos";
import { formatarData } from "@/lib/dominio";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  STATUS_PROCESSO,
  TIPOS_PRISAO,
  diasSemMovimentacao,
  estadoContagem100Dias,
  rotuloFluxo,
  hojeISO,
  pendenciasAbertas,
  proximaAudiencia,
  reuPrincipal,
  ultimaMovimentacao,
} from "@/lib/processos/modelo";
import { etiquetasDosProcessosQuery, etiquetasQuery, processosResumoQuery } from "@/lib/processos/repositorio";

export const Route = createFileRoute("/_authenticated/processos/")({
  head: () => ({
    meta: [
      { title: "Processos — Gestão da Vara Criminal" },
      { name: "description", content: "Acervo de processos da serventia da Vara Criminal de Coração de Maria/BA." },
      { property: "og:title", content: "Processos — Gestão da Vara Criminal" },
      { property: "og:description", content: "Acervo de processos da serventia da Vara Criminal de Coração de Maria/BA." },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): BuscaProcessos => {
    const r: BuscaProcessos = {};
    for (const k of CHAVES) if (typeof s[k] === "string" && s[k]) r[k] = s[k] as string;
    return r;
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(processosResumoQuery()),
  errorComponent: ({ error }) => <EstadoVazio titulo="Erro ao carregar processos" descricao={error.message} />,
  component: Pagina,
});

const CHAVES = ["q", "status", "classe", "preso", "tipoPrisao", "movimentacao", "audienciaStatus", "gestaoPrioridade", "gestaoPendencia", "etiqueta", "contagem100", "fluxo", "ordem", "pagina"] as const;
type Chave = (typeof CHAVES)[number];
type BuscaProcessos = Partial<Record<Chave, string>>;

const ORDENS = [
  { v: "processo", r: "Número do processo" },
  { v: "distribuicao", r: "Data de distribuição (recente)" },
  { v: "movimentacao", r: "Última movimentação (recente)" },
  { v: "dias", r: "Dias sem movimentação (maior)" },
  { v: "prioridade", r: "Prioridade (mais alertas)" },
];

const TEMPO_SEM_MOVIMENTACAO = [
  { v: "", r: "Tempo s/ mov.: qualquer" },
  { v: "30+", r: "Mais de 30 dias" },
  { v: "60+", r: "Mais de 60 dias" },
  { v: "90+", r: "Mais de 90 dias" },
  { v: "100+", r: "Mais de 100 dias" },
  { v: "sem", r: "Sem movimentação registrada" },
];

const PROCESSOS_POR_PAGINA = 30;

function Pagina() {
  const { data: processos } = useSuspenseQuery(processosResumoQuery());
  const qc = useQueryClient();
  const navigate = useNavigate();
  const sp = Route.useSearch();
  const podeEditar = usePode("editar");
  const { data: etiquetas = [] } = useQuery(etiquetasQuery());
  const processoIds = useMemo(() => processos.map((p) => p.id), [processos]);
  const { data: etiquetasPorProcesso = {} } = useQuery(etiquetasDosProcessosQuery(processoIds));
  const busca = sp.q ?? "", status = sp.status ?? "", classe = sp.classe ?? "", preso = sp.preso ?? "";
  const tipoPrisao = sp.tipoPrisao ?? "", movimentacao = sp.movimentacao ?? "", audienciaStatus = sp.audienciaStatus ?? "", gestaoPrioridade = sp.gestaoPrioridade ?? "", gestaoPendencia = sp.gestaoPendencia ?? "", etiqueta = sp.etiqueta ?? "", contagem100 = sp.contagem100 ?? "", fluxo = sp.fluxo ?? "", ordem = sp.ordem ?? "processo";
  const set = (k: Chave, v: string) =>
    navigate({
      to: "/processos",
      search: (prev: BuscaProcessos) => {
        const n = { ...prev };
        if (v) n[k] = v; else delete n[k];
        if (k !== "pagina") delete n.pagina;
        return n;
      },
      replace: true,
    });
  const algumFiltro = CHAVES.some((k) => k !== "ordem" && k !== "pagina" && sp[k]);
  const hoje = hojeISO();
  const dadosPorProcesso = useMemo(
    () =>
      new Map(
        processos.map((p) => {
          const ultima = ultimaMovimentacao(p);
          const dias = diasSemMovimentacao(p, hoje);
          const estado100 = estadoContagem100Dias(p);
          const proxima = proximaAudiencia(p, hoje);
          const pendencias = pendenciasAbertas(p).length;
          const fluxoAtual = rotuloFluxo(p);
          const alvoBusca = [
            p.numero,
            p.numero.replace(/\D/g, ""),
            p.classe,
            p.assunto,
            p.status,
            ...p.partes.map((x) => x.nome),
            ...p.reus.map((x) => x.nome),
          ]
            .join(" ")
            .toLowerCase();

          return [
            p.id,
            { ultima, dias, estado100, proxima, pendencias, fluxoAtual, alvoBusca },
          ] as const;
        }),
      ),
    [processos, hoje],
  );
  const alertasPorProcesso = useMemo(
    () =>
      Object.fromEntries(
        processos.map((p) => [p.id, alertasDoProcesso(p, hoje, etiquetasPorProcesso)]),
      ),
    [processos, hoje, etiquetasPorProcesso],
  );

  const marcarConferencia = async (id: string, conferir: boolean) => {
    const { error } = await supabase.from("processos").update({ conferir }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(conferir ? "Aviso de conferência reaberto" : "Aviso de conferência removido");
    await qc.invalidateQueries({ queryKey: ["processos"] });
  };

  const classes = useMemo(() => {
    const classesPorChave = new Map<string, string>();
    for (const processo of processos) {
      const valor = processo.classe?.trim();
      if (!valor) continue;
      const chave = valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").toUpperCase();
      if (!classesPorChave.has(chave)) classesPorChave.set(chave, valor);
    }
    return [...classesPorChave.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [processos]);

  const fluxos = useMemo(
    () =>
      [...new Set([...dadosPorProcesso.values()].map((x) => x.fluxoAtual).filter((x) => x && x !== "—"))].sort(
        (a, b) => a.localeCompare(b, "pt-BR"),
      ),
    [dadosPorProcesso],
  );

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    const lista = processos.filter((p) => {
      const dados = dadosPorProcesso.get(p.id);
      if (!dados) return false;
      if (t && !dados.alvoBusca.includes(t)) return false;
      if (status && p.status !== status) return false;
      if (classe && p.classe !== classe) return false;
      if (fluxo && dados.fluxoAtual !== fluxo) return false;
      if (contagem100 === "ativa" && dados.estado100.pausada) return false;
      if (contagem100 === "pausada" && !dados.estado100.pausada) return false;
      if (etiqueta && !(etiquetasPorProcesso[p.id] ?? []).some((e) => e.id === etiqueta)) return false;
      if (preso === "sim" && !p.reus.some((r) => r.preso)) return false;
      if (preso === "nao" && p.reus.some((r) => r.preso)) return false;
      if (tipoPrisao && !p.reus.some((r) => r.tipo_prisao === tipoPrisao)) return false;
      if (gestaoPrioridade === "com" && (alertasPorProcesso[p.id] ?? []).length === 0) return false;
      if (gestaoPrioridade === "sem" && (alertasPorProcesso[p.id] ?? []).length > 0) return false;
      if (gestaoPendencia === "com" && dados.pendencias === 0) return false;
      if (gestaoPendencia === "sem" && dados.pendencias > 0) return false;
      if (movimentacao) {
        const d = dados.dias;
        if (movimentacao === "sem" && d !== null) return false;
        if (movimentacao === "30+" && (d === null || d <= 30)) return false;
        if (movimentacao === "60+" && (d === null || d <= 60)) return false;
        if (movimentacao === "90+" && (d === null || d <= 90)) return false;
        if (movimentacao === "100+" && (d === null || d <= 100)) return false;
      }
      if (audienciaStatus) {
        if (audienciaStatus === "sem" && p.audiencias.length > 0) return false;
        if (audienciaStatus === "agendada" && !p.audiencias.some((a) => a.situacao === "Agendada")) return false;
        if (audienciaStatus === "redesignada" && !p.audiencias.some((a) => a.situacao === "Redesignada")) return false;
        if (audienciaStatus === "realizada" && !p.audiencias.some((a) => a.situacao === "Realizada")) return false;
        if (audienciaStatus === "cancelada" && !p.audiencias.some((a) => a.situacao === "Cancelada")) return false;
        if (audienciaStatus === "aguardando" && !p.audiencias.some((a) => a.aguardando_nova_data)) return false;
        if (audienciaStatus === "nao-aguardando" && !p.audiencias.some((a) => !a.aguardando_nova_data && a.situacao !== "Realizada" && a.situacao !== "Cancelada")) return false;
      }
      return true;
    });
    const dias = (p: (typeof processos)[number]) => dadosPorProcesso.get(p.id)?.dias ?? -1;
    const ORD: Record<string, (a: (typeof processos)[number], b: (typeof processos)[number]) => number> = {
      processo: (a, b) => a.numero.localeCompare(b.numero),
      distribuicao: (a, b) => (b.data_distribuicao ?? "").localeCompare(a.data_distribuicao ?? ""),
      movimentacao: (a, b) =>
        (dadosPorProcesso.get(b.id)?.ultima?.data ?? "").localeCompare(
          dadosPorProcesso.get(a.id)?.ultima?.data ?? "",
        ),
      dias: (a, b) => dias(b) - dias(a),
      prioridade: (a, b) => (alertasPorProcesso[b.id] ?? []).length - (alertasPorProcesso[a.id] ?? []).length || a.numero.localeCompare(b.numero),
    };
    return [...lista].sort(ORD[ordem] ?? ORD["processo"]);
  }, [processos, sp, alertasPorProcesso, etiquetasPorProcesso, dadosPorProcesso]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / PROCESSOS_POR_PAGINA));
  const paginaSolicitada = Math.max(1, Number.parseInt(sp.pagina ?? "1", 10) || 1);
  const paginaAtual = Math.min(paginaSolicitada, totalPaginas);
  const inicioPagina = (paginaAtual - 1) * PROCESSOS_POR_PAGINA;
  const processosDaPagina = filtrados.slice(inicioPagina, inicioPagina + PROCESSOS_POR_PAGINA);

  const irParaPagina = (pagina: number) => {
    const destino = Math.min(Math.max(1, pagina), totalPaginas);
    set("pagina", destino === 1 ? "" : String(destino));
  };

  const paginasVisiveis = (() => {
    if (totalPaginas <= 7) return Array.from({ length: totalPaginas }, (_, i) => i + 1);
    const conjunto = new Set([1, totalPaginas, paginaAtual - 1, paginaAtual, paginaAtual + 1]);
    return [...conjunto].filter((p) => p >= 1 && p <= totalPaginas).sort((a, b) => a - b);
  })();

  return (
    <div className="space-y-6">
      <Cabecalho
        titulo="Processos"
        subtitulo={`${filtrados.length} de ${processos.length} processos`}
        acao={podeEditar ? (
          <div className="flex flex-wrap gap-2">
            <Link
              to="/processos/importar"
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-muted"
            >
              <FileSpreadsheet className="size-4" /> Importar / Atualizar em lote
            </Link>
            <Link
              to="/processos/novo"
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="size-4" /> Novo Processo
            </Link>
          </div>
        ) : undefined}
      />

      <details open className="rounded-lg border border-border bg-card shadow-card">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-foreground">Filtros avançados {Object.keys(sp).filter((k) => k !== "ordem" && k !== "pagina").length ? <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">{Object.keys(sp).filter((k) => k !== "ordem" && k !== "pagina").length} ativos</span> : null}</summary>
        <div className="grid gap-3 border-t border-border p-4 md:grid-cols-3 lg:grid-cols-6">
          <div className="relative md:col-span-3 lg:col-span-6">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <input
              className={`${CLASSE_CAMPO} pl-9`}
              placeholder="Pesquisar por número, réu, parte, classe, assunto ou status"
              value={busca}
              onChange={(e) => set("q", e.target.value)}
              aria-label="Pesquisar processos"
            />
          </div>
          <select className={CLASSE_CAMPO} value={status} onChange={(e) => set("status", e.target.value)} aria-label="Status">
            <option value="">Status: todos</option>
            <Opcoes valores={STATUS_PROCESSO} />
          </select>

          <select className={`${CLASSE_CAMPO} lg:col-span-2`} value={classe} onChange={(e) => set("classe", e.target.value)} aria-label="Classe">
            <option value="">Classe: todas</option>
            <Opcoes valores={classes} />
          </select>

          <select className={`${CLASSE_CAMPO} lg:col-span-2`} value={fluxo} onChange={(e) => set("fluxo", e.target.value)} aria-label="Fluxo atual">
            <option value="">Fluxo atual: todos</option>
            <Opcoes valores={fluxos} />
          </select>

          <select className={CLASSE_CAMPO} value={contagem100} onChange={(e) => set("contagem100", e.target.value)} aria-label="Controle dos 100 dias">
            <option value="">Controle 100 dias: todos</option>
            <option value="ativa">Controle 100 dias: em contagem</option>
            <option value="pausada">Controle 100 dias: pausada</option>
          </select>

          <select className={CLASSE_CAMPO} value={movimentacao} onChange={(e) => set("movimentacao", e.target.value)} aria-label="Tempo sem movimentação">
            {TEMPO_SEM_MOVIMENTACAO.map((p) => <option key={p.v} value={p.v}>{p.r}</option>)}
          </select>

          <select className={CLASSE_CAMPO} value={etiqueta} onChange={(e) => set("etiqueta", e.target.value)} aria-label="Etiqueta">
            <option value="">Etiqueta: todas</option>
            {etiquetas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>

          <select className={CLASSE_CAMPO} value={preso} onChange={(e) => set("preso", e.target.value)} aria-label="Réu preso">
            <option value="">Réu preso: todos</option>
            <option value="sim">Com réu preso</option>
            <option value="nao">Sem réu preso</option>
          </select>

          <select className={CLASSE_CAMPO} value={tipoPrisao} onChange={(e) => set("tipoPrisao", e.target.value)} aria-label="Tipo de prisão">
            <option value="">Prisão: qualquer</option>
            <option value="Prisão preventiva">Preventiva</option>
            <option value="Prisão temporária">Temporária</option>
            <option value="Prisão em flagrante">Em flagrante</option>
            <option value="Outra">Outras</option>
          </select>

          <select className={CLASSE_CAMPO} value={audienciaStatus} onChange={(e) => set("audienciaStatus", e.target.value)} aria-label="Audiência">
            <option value="">Audiência: qualquer</option>
            <option value="aguardando">Aguardando nova data</option>
            <option value="nao-aguardando">Pendente com data</option>
            <option value="agendada">Agendada</option>
            <option value="redesignada">Redesignada</option>
            <option value="realizada">Realizada</option>
            <option value="cancelada">Cancelada</option>
            <option value="sem">Sem audiência</option>
          </select>

          <select className={CLASSE_CAMPO} value={gestaoPrioridade} onChange={(e) => set("gestaoPrioridade", e.target.value)} aria-label="Prioridade">
            <option value="">Prioridade: qualquer</option>
            <option value="com">Com prioridade</option>
            <option value="sem">Sem prioridade</option>
          </select>

          <select className={CLASSE_CAMPO} value={gestaoPendencia} onChange={(e) => set("gestaoPendencia", e.target.value)} aria-label="Pendência">
            <option value="">Pendência: qualquer</option>
            <option value="com">Com pendência</option>
            <option value="sem">Sem pendência</option>
          </select>

          <div className="flex flex-wrap items-center justify-end gap-2 md:col-span-3 lg:col-span-6">
            <label className="text-xs text-muted-foreground" htmlFor="ordem">Ordenar por</label>
            <select id="ordem" className={`${CLASSE_CAMPO} w-auto`} value={ordem} onChange={(e) => set("ordem", e.target.value === "processo" ? "" : e.target.value)}>
              {ORDENS.map((o) => <option key={o.v} value={o.v}>{o.r}</option>)}
            </select>
            <button
              type="button"
              disabled={!algumFiltro}
              onClick={() => navigate({ to: "/processos", search: ordem === "processo" ? {} : { ordem }, replace: true })}
              className="inline-flex h-9 items-center gap-1 rounded-md border border-border px-3 text-sm text-foreground hover:bg-muted disabled:opacity-50"
            >
              <X className="size-4" /> Limpar filtros
            </button>
          </div>
        </div>
      </details>

      {filtrados.length === 0 ? (
        <EstadoVazio titulo="Nenhum processo encontrado" descricao="Ajuste a pesquisa ou os filtros." />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-card">
          <table className="w-full table-fixed text-xs">
            <colgroup>
              <col className="w-[14%]" />
              <col className="w-[13%]" />
              <col className="w-[10%]" />
              <col className="w-[7%]" />
              <col className="w-[12%]" />
              <col className="w-[12%]" />
              <col className="w-[6%]" />
              <col className="w-[11%]" />
              <col className="w-[7%]" />
              <col className="w-[4%]" />
              <col className="w-[4%]" />
            </colgroup>
            <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
              <tr>
                {["Número", "Réu principal", "Classe", "Situação", "Fluxo atual", "Última movimentação", "Dias s/ mov.", "Prioridade", "Próx. audiência", "Pendências", "Responsável"].map((h) => (
                  <th key={h} className="whitespace-nowrap px-3 py-2.5 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {processosDaPagina.map((p) => {
                const reu = reuPrincipal(p);
                const dados = dadosPorProcesso.get(p.id);
                const ult = dados?.ultima ?? null;
                const dias = dados?.dias ?? null;
                const estado100 = dados?.estado100 ?? { pausada: false, motivo: null };
                const aud = dados?.proxima ?? null;
                const pend = dados?.pendencias ?? 0;
                return (
                  <tr
                    key={p.id}
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() => navigate({ to: "/processos/$id", params: { id: p.id } })}
                  >
                    <td className="break-words px-2 py-2">
                      <div className="flex items-center gap-2">
                        <Link to="/processos/$id" params={{ id: p.id }} className="numero-processo font-semibold text-primary hover:underline">
                          {p.numero}
                        </Link>
                        {(p as typeof p & { conferir?: boolean }).conferir ? (
                          <span className="inline-flex items-center gap-1 align-middle">
                            <span className="rounded border border-alerta/30 bg-alerta-suave px-1.5 py-0.5 text-[10px] font-medium text-alerta" title="Processo sinalizado para conferência">
                              Conferir
                            </span>
                            {podeEditar ? (
                              <button
                                type="button"
                                aria-label="Remover aviso Conferir deste processo"
                                title="Remover o aviso Conferir"
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); void marcarConferencia(p.id, false); }}
                                className="inline-flex size-4 items-center justify-center rounded-full border border-alerta/40 bg-background text-[10px] font-bold leading-none text-alerta hover:bg-alerta hover:text-primary-foreground"
                              >
                                ×
                              </button>
                            ) : null}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="break-words px-2 py-2">
                      <div>{reu ? reu.nome : "—"}</div>
                      {(etiquetasPorProcesso[p.id] ?? []).length ? (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {(etiquetasPorProcesso[p.id] ?? []).map((e) => (
                            <EtiquetaProcesso key={e.id} processoId={p.id} etiqueta={e} />
                          ))}
                        </div>
                      ) : null}
                      {p.reus.length > 1 ? <span className="text-xs text-muted-foreground"> +{p.reus.length - 1}</span> : null}
                      {reu?.preso ? <div className="text-xs text-urgente">{reu.tipo_prisao}</div> : null}
                    </td>
                    <td className="break-words px-2 py-2 text-muted-foreground">{p.classe}</td>
                    <td className="break-words px-2 py-2">{p.status}</td>
                    <td className="break-words px-2 py-2 font-medium" title={p.pje_tarefas ?? undefined}>{dados?.fluxoAtual ?? rotuloFluxo(p)}</td>
                    <td className="break-words px-2 py-2">
                      <div>{formatarData(ult?.data ?? null)}</div>
                      <div className="text-xs text-muted-foreground">{ult?.descricao}</div>
                    </td>
                    <td className="break-words px-2 py-2 font-medium">
                      <div>{dias === null ? "—" : `${dias} dias`}</div>
                      {estado100.pausada ? (
                        <span
                          className="mt-1 inline-flex rounded border border-info/30 bg-info/10 px-1.5 py-0.5 text-[10px] font-medium text-info"
                          title={estado100.motivo ?? "Contagem de 100 dias pausada"}
                        >
                          Pausada
                        </span>
                      ) : null}
                    </td>
                    <td className="break-words px-2 py-2 text-muted-foreground">
                      {(() => { const al = alertasPorProcesso[p.id] ?? []; return al.length ? <div className="flex flex-wrap gap-1">{al.map((a, i) => <EtiquetaAlerta key={i} alerta={a} />)}</div> : "—"; })()}
                    </td>
                    <td className="break-words px-2 py-2">{formatarData(aud?.data ?? null)}</td>
                    <td className="px-3 py-2.5">
                      {pend ? <Etiqueta severidade="atencao">{pend}</Etiqueta> : "—"}
                    </td>
                    <td className="break-words px-2 py-2 text-muted-foreground">{p.responsavel || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-3 py-3">
            <p className="text-xs text-muted-foreground">
              Mostrando {filtrados.length ? inicioPagina + 1 : 0}–{Math.min(inicioPagina + PROCESSOS_POR_PAGINA, filtrados.length)} de {filtrados.length} processo(s)
            </p>

            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                className="inline-flex h-8 items-center rounded-md border border-border bg-background px-3 text-xs font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                disabled={paginaAtual === 1}
                onClick={() => irParaPagina(paginaAtual - 1)}
              >
                Anterior
              </button>

              {paginasVisiveis.map((p, i) => {
                const anterior = paginasVisiveis[i - 1];
                return (
                  <span key={p} className="contents">
                    {anterior && p - anterior > 1 ? <span className="px-1 text-xs text-muted-foreground">…</span> : null}
                    <button
                      type="button"
                      aria-current={p === paginaAtual ? "page" : undefined}
                      className={`inline-flex size-8 items-center justify-center rounded-md border text-xs font-medium ${p === paginaAtual ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-muted"}`}
                      onClick={() => irParaPagina(p)}
                    >
                      {p}
                    </button>
                  </span>
                );
              })}

              <button
                type="button"
                className="inline-flex h-8 items-center rounded-md border border-border bg-background px-3 text-xs font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                disabled={paginaAtual === totalPaginas}
                onClick={() => irParaPagina(paginaAtual + 1)}
              >
                Próxima
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
