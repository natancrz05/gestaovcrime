import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { usePode } from "@/lib/sessao";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { FileSpreadsheet, Plus, Search, X } from "lucide-react";
import { EtiquetaAlerta } from "@/components/processos/Prioridades";
import { AcoesEtiquetasProcesso, EtiquetasProcesso } from "@/components/processos/GerenciarEtiquetas";
import { CONFIG_PRIORIDADES, alertasDoProcesso } from "@/lib/processos/prioridades";
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
  rotuloFluxo,
  hojeISO,
  pendenciasAbertas,
  proximaAudiencia,
  reuPrincipal,
  ultimaMovimentacao,
} from "@/lib/processos/modelo";
import { processosQuery } from "@/lib/processos/repositorio";

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
  loader: ({ context }) => context.queryClient.ensureQueryData(processosQuery()),
  errorComponent: ({ error }) => <EstadoVazio titulo="Erro ao carregar processos" descricao={error.message} />,
  component: Pagina,
});

const CHAVES = ["q", "status", "situacao", "classe", "preso", "tipoPrisao", "etiqueta", "periodo", "movimentacao", "temporaria", "prioridade", "pendencia", "audiencia", "audienciaStatus", "semMov", "gestaoPrioridade", "gestaoPendencia", "ordem"] as const;
type Chave = (typeof CHAVES)[number];
type BuscaProcessos = Partial<Record<Chave, string>>;

const FLAGS: { k: Chave; r: string }[] = [
  { k: "temporaria", r: "Prisão temporária" },
  { k: "prioridade", r: "Com prioridade" },
  { k: "pendencia", r: "Com pendência aberta" },
  { k: "audiencia", r: "Com audiência cadastrada" },
  { k: "semMov", r: `Mais de ${CONFIG_PRIORIDADES.limiteDiasSemMovimentacao} dias sem movimentação` },
];

const ORDENS = [
  { v: "processo", r: "Número do processo" },
  { v: "distribuicao", r: "Data de distribuição (recente)" },
  { v: "movimentacao", r: "Última movimentação (recente)" },
  { v: "dias", r: "Dias sem movimentação (maior)" },
  { v: "prioridade", r: "Prioridade (mais alertas)" },
];

const PERIODOS = [
  { v: "", r: "Qualquer período" },
  { v: "0-30", r: "Até 30 dias" },
  { v: "31-100", r: "31 a 100 dias" },
  { v: "101-", r: "Mais de 100 dias" },
  { v: "sem", r: "Sem movimentação registrada" },
];

function Pagina() {
  const { data: processos } = useSuspenseQuery(processosQuery());
  const qc = useQueryClient();
  const navigate = useNavigate();
  const sp = Route.useSearch();
  const podeEditar = usePode("editar");
  const busca = sp.q ?? "", status = sp.status ?? "", situacao = sp.situacao ?? "", classe = sp.classe ?? "", preso = sp.preso ?? "";
  const tipoPrisao = sp.tipoPrisao ?? "", etiqueta = sp.etiqueta ?? "", periodo = sp.periodo ?? "", movimentacao = sp.movimentacao ?? "", audienciaStatus = sp.audienciaStatus ?? "", gestaoPrioridade = sp.gestaoPrioridade ?? "", gestaoPendencia = sp.gestaoPendencia ?? "", ordem = sp.ordem ?? "processo";
  const set = (k: Chave, v: string) =>
    navigate({ to: "/processos", search: (prev: BuscaProcessos) => { const n = { ...prev }; if (v) n[k] = v; else delete n[k]; return n; }, replace: true });
  const flag = (k: Chave) => sp[k] === "1";
  const algumFiltro = CHAVES.some((k) => k !== "ordem" && sp[k]);
  const hoje = hojeISO();
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

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    const lista = processos.filter((p) => {
      if (t) {
        const alvo = [p.numero, p.numero.replace(/\D/g, ""), p.classe, p.assunto, p.status, ...p.partes.map((x) => x.nome), ...p.reus.map((x) => x.nome)]
          .join(" ")
          .toLowerCase();
        if (!alvo.includes(t)) return false;
      }
      if (status && p.status !== status) return false;
      if (situacao === "ativos" && ["Suspenso", "Arquivado", "Baixado"].includes(p.status)) return false;
      if (situacao === "suspensos" && p.status !== "Suspenso") return false;
      if (situacao === "arquivados" && !["Arquivado", "Baixado"].includes(p.status)) return false;
      if (classe && p.classe !== classe) return false;
      if (preso === "sim" && !p.reus.some((r) => r.preso)) return false;
      if (preso === "nao" && p.reus.some((r) => r.preso)) return false;
      if (tipoPrisao && !p.reus.some((r) => r.tipo_prisao === tipoPrisao)) return false;\n      if (etiqueta && !p.etiquetas?.some((e) => e.id === etiqueta)) return false;
      if (flag("temporaria") && !p.reus.some((r) => r.preso && r.tipo_prisao === "Prisão temporária")) return false;
      if (flag("prioridade") && alertasDoProcesso(p, hoje).length === 0) return false;
      if (flag("pendencia") && pendenciasAbertas(p).length === 0) return false;
      if (gestaoPrioridade === "com" && alertasDoProcesso(p, hoje).length === 0) return false;
      if (gestaoPrioridade === "sem" && alertasDoProcesso(p, hoje).length > 0) return false;
      if (gestaoPendencia === "com" && pendenciasAbertas(p).length === 0) return false;
      if (gestaoPendencia === "sem" && pendenciasAbertas(p).length > 0) return false;
      if (flag("audiencia") && p.audiencias.length === 0) return false;
      if (flag("semMov")) { const d = diasSemMovimentacao(p, hoje); if (d === null || d <= CONFIG_PRIORIDADES.limiteDiasSemMovimentacao) return false; }
      if (movimentacao) {
        const d = diasSemMovimentacao(p, hoje);
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
      if (periodo) {
        const d = diasSemMovimentacao(p, hoje);
        if (periodo === "sem") return d === null;
        if (d === null) return false;
        const [min, max] = periodo.split("-");
        if (d < Number(min) || (max && d > Number(max))) return false;
      }
      return true;
    });
    const dias = (p: (typeof processos)[number]) => diasSemMovimentacao(p, hoje) ?? -1;
    const ORD: Record<string, (a: (typeof processos)[number], b: (typeof processos)[number]) => number> = {
      processo: (a, b) => a.numero.localeCompare(b.numero),
      distribuicao: (a, b) => (b.data_distribuicao ?? "").localeCompare(a.data_distribuicao ?? ""),
      movimentacao: (a, b) => (ultimaMovimentacao(b)?.data ?? "").localeCompare(ultimaMovimentacao(a)?.data ?? ""),
      dias: (a, b) => dias(b) - dias(a),
      prioridade: (a, b) => alertasDoProcesso(b, hoje).length - alertasDoProcesso(a, hoje).length || a.numero.localeCompare(b.numero),
    };
    return [...lista].sort(ORD[ordem] ?? ORD["processo"]);
  }, [processos, sp, hoje]);

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
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-foreground">Filtros avançados {Object.keys(sp).filter((k) => k !== "ordem").length ? <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">{Object.keys(sp).filter((k) => k !== "ordem").length} ativos</span> : null}</summary>
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
          <select className={CLASSE_CAMPO} value={situacao} onChange={(e) => set("situacao", e.target.value)} aria-label="Situação">
            <option value="">Situação: todos</option>
            <option value="ativos">Ativos</option>
            <option value="suspensos">Suspensos</option>
            <option value="arquivados">Arquivados</option>
          </select>
          <select className={CLASSE_CAMPO} value={status} onChange={(e) => set("status", e.target.value)} aria-label="Status">
            <option value="">Todos os status</option>
            <Opcoes valores={STATUS_PROCESSO} />
          </select>
          <select className={`${CLASSE_CAMPO} lg:col-span-2`} value={classe} onChange={(e) => set("classe", e.target.value)} aria-label="Classe">
            <option value="">Todas as classes</option>
            <Opcoes valores={classes} />
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
          <select className={CLASSE_CAMPO} value={movimentacao} onChange={(e) => set("movimentacao", e.target.value)} aria-label="Movimentação">
            <option value="">Movimentação: qualquer</option>
            <option value="30+">Mais de 30 dias</option>
            <option value="60+">Mais de 60 dias</option>
            <option value="90+">Mais de 90 dias</option>
            <option value="100+">Mais de 100 dias</option>
          </select>
          <select className={CLASSE_CAMPO} value={audienciaStatus} onChange={(e) => set("audienciaStatus", e.target.value)} aria-label="Audiência">
            <option value="">Audiência: qualquer</option>
            <option value="aguardando">Aguardando</option>
            <option value="nao-aguardando">Não aguardando</option>
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
          <select className={CLASSE_CAMPO} value={periodo} onChange={(e) => set("periodo", e.target.value)} aria-label="Última movimentação">
            {PERIODOS.map((p) => <option key={p.v} value={p.v}>{p.r}</option>)}
          </select>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 md:col-span-3 lg:col-span-6">
            {FLAGS.map((f) => (
              <label key={f.k} className="inline-flex items-center gap-1.5 text-sm text-foreground">
                <input type="checkbox" className="size-4 accent-primary" checked={flag(f.k)} onChange={(e) => set(f.k, e.target.checked ? "1" : "")} />
                {f.r}
              </label>
            ))}
            <div className="ml-auto flex items-center gap-2">
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
        </div>
      </details>

      {filtrados.length === 0 ? (
        <EstadoVazio titulo="Nenhum processo encontrado" descricao="Ajuste a pesquisa ou os filtros." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
              <tr>
                {["Número", "Réu principal", "Classe", "Situação", "Fluxo atual", "Última movimentação", "Dias s/ mov.", "Prioridade", "Próx. audiência", "Pendências", "Etiquetas", "Responsável", "Ações"].map((h) => (
                  <th key={h} className="whitespace-nowrap px-3 py-2.5 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtrados.map((p) => {
                const reu = reuPrincipal(p);
                const ult = ultimaMovimentacao(p);
                const dias = diasSemMovimentacao(p, hoje);
                const aud = proximaAudiencia(p, hoje);
                const pend = pendenciasAbertas(p).length;
                return (
                  <tr
                    key={p.id}
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() => navigate({ to: "/processos/$id", params: { id: p.id } })}
                  >
                    <td className="whitespace-nowrap px-3 py-2.5">
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
                    <td className="px-3 py-2.5">
                      {reu ? reu.nome : "—"}
                      {p.reus.length > 1 ? <span className="text-xs text-muted-foreground"> +{p.reus.length - 1}</span> : null}
                      {reu?.preso ? <div className="text-xs text-urgente">{reu.tipo_prisao}</div> : null}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">{p.classe}</td>
                    <td className="whitespace-nowrap px-3 py-2.5">{p.status}</td>
                    <td className="min-w-40 px-3 py-2.5 text-xs font-medium" title={p.pje_tarefas ?? undefined}>{rotuloFluxo(p)}</td>
                    <td className="px-3 py-2.5">
                      <div>{formatarData(ult?.data ?? null)}</div>
                      <div className="text-xs text-muted-foreground">{ult?.descricao}</div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-medium">{dias === null ? "—" : `${dias} dias`}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      {(() => { const al = alertasDoProcesso(p, hoje); return al.length ? <div className="flex flex-wrap gap-1">{al.map((a, i) => <EtiquetaAlerta key={i} alerta={a} />)}</div> : "—"; })()}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">{formatarData(aud?.data ?? null)}</td>
                    <td className="px-3 py-2.5">
                      {pend ? <Etiqueta severidade="atencao">{pend}</Etiqueta> : "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{p.responsavel || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
