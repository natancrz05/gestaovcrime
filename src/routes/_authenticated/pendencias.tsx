import { createFileRoute, Link } from "@tanstack/react-router";
import { usePode } from "@/lib/sessao";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Cabecalho, EstadoVazio } from "@/components/ui-serventia/Cabecalho";
import { CLASSE_CAMPO, Campo, Opcoes } from "@/components/processos/campos";
import { BOTAO, BOTAO_SEC, DialogosPendencia, EtiquetasPendencia, novaPendencia } from "@/components/processos/Pendencias";
import { formatarData } from "@/lib/dominio";
import { processosQuery } from "@/lib/processos/repositorio";
import {
  PRIORIDADES_PENDENCIA, STATUS_PENDENCIA, concluirPendencia, listarPendenciasDe, rotuloPrioridade, salvarPendencia,
  type PendenciaEntrada, type PendenciaListada,
} from "@/lib/processos/pendencias";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/pendencias")({
  head: () => ({
    meta: [
      { title: "Pendências — Gestão da Vara Criminal" },
      { name: "description", content: "Registro e acompanhamento das tarefas da serventia vinculadas aos processos." },
      { property: "og:title", content: "Pendências — Gestão da Vara Criminal" },
      { property: "og:description", content: "Registro e acompanhamento das tarefas da serventia vinculadas aos processos." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(processosQuery()),
  errorComponent: ({ error }) => <EstadoVazio titulo="Erro ao carregar pendências" descricao={error.message} />,
  component: Pagina,
});

const PERIODOS = [
  { v: "", r: "Todos" },
  { v: "atrasadas", r: "Atrasadas" },
  { v: "7", r: "Próximos 7 dias" },
  { v: "30", r: "Próximos 30 dias" },
  { v: "sem", r: "Sem prazo" },
];

function Pagina() {
  const { data: processos } = useSuspenseQuery(processosQuery());
  const qc = useQueryClient();
  const recarregar = () => qc.invalidateQueries({ queryKey: ["processos"] });
  const podeEditar = usePode("editar");
  const todas = useMemo(() => listarPendenciasDe(processos), [processos]);
  const [status, setStatus] = useState("");
  const [prioridade, setPrioridade] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [periodo, setPeriodo] = useState("");
  const [detalhe, setDetalhe] = useState<PendenciaListada | null>(null);
  const [edicao, setEdicao] = useState<{ id?: string; dados: PendenciaEntrada } | null>(null);

  const responsaveis = [...new Set(todas.map((p) => p.responsavel).filter(Boolean))].sort();
  const lista = todas.filter((p) => {
    if (status && p.status !== status) return false;
    if (prioridade && p.prioridade !== prioridade) return false;
    if (responsavel && p.responsavel !== responsavel) return false;
    if (periodo === "atrasadas" && !p.atrasada) return false;
    if ((periodo === "7" || periodo === "30") && (p.dias === null || p.dias < 0 || p.dias > Number(periodo))) return false;
    if (periodo === "sem" && p.prazo) return false;
    return true;
  });
  const abertas = todas.filter((p) => !p.concluidaFlag);

  return (
    <div className="space-y-6">
      <Cabecalho
        titulo="Pendências"
        subtitulo="Tarefas da serventia vinculadas aos processos. Os destaques são critérios de gestão interna."
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {abertas.length} em aberto · <span className="text-urgente">{abertas.filter((p) => p.atrasada).length} atrasadas</span> ·{" "}
          <span className="text-atencao">{abertas.filter((p) => p.prioridade === "alta").length} de alta prioridade</span>
        </p>
        {podeEditar ? <button className={BOTAO} onClick={() => setEdicao({ dados: novaPendencia() })}>Nova pendência</button> : null}
      </div>

      <div className="grid gap-3 rounded-lg border border-border bg-card p-4 shadow-card sm:grid-cols-4">
        <Campo rotulo="Status"><select className={CLASSE_CAMPO} value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Todos</option><Opcoes valores={STATUS_PENDENCIA} /></select></Campo>
        <Campo rotulo="Prioridade"><select className={CLASSE_CAMPO} value={prioridade} onChange={(e) => setPrioridade(e.target.value)}><option value="">Todas</option>{PRIORIDADES_PENDENCIA.map((p) => <option key={p.valor} value={p.valor}>{p.rotulo}</option>)}</select></Campo>
        <Campo rotulo="Responsável"><select className={CLASSE_CAMPO} value={responsavel} onChange={(e) => setResponsavel(e.target.value)}><option value="">Todos</option><Opcoes valores={responsaveis} /></select></Campo>
        <Campo rotulo="Prazo"><select className={CLASSE_CAMPO} value={periodo} onChange={(e) => setPeriodo(e.target.value)}>{PERIODOS.map((p) => <option key={p.v} value={p.v}>{p.r}</option>)}</select></Campo>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr><th className="px-4 py-2">Título</th><th className="px-4 py-2">Processo</th><th className="px-4 py-2">Responsável</th><th className="px-4 py-2">Prioridade</th><th className="px-4 py-2">Prazo</th><th className="px-4 py-2">Status</th><th className="px-4 py-2" /></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {lista.map((p) => (
              <tr key={p.id} className={cn("border-l-4 border-l-transparent", p.atrasada && "border-l-urgente bg-urgente-suave/40", p.concluidaFlag && "text-muted-foreground")}>
                <td className="px-4 py-2.5">
                  <button className={cn("text-left font-medium hover:underline", p.concluidaFlag ? "line-through" : "text-foreground")} onClick={() => setDetalhe(p)}>{p.titulo || p.descricao}</button>
                  <div className="mt-1"><EtiquetasPendencia p={p} /></div>
                </td>
                <td className="px-4 py-2.5"><Link to="/processos/$id" params={{ id: p.processo_id }} className="numero-processo text-xs text-primary hover:underline">{p.numero}</Link></td>
                <td className="px-4 py-2.5">{p.responsavel || "—"}</td>
                <td className={cn("px-4 py-2.5", p.prioridade === "alta" && !p.concluidaFlag && "font-medium text-atencao")}>{rotuloPrioridade(p.prioridade)}</td>
                <td className={cn("px-4 py-2.5 tabular-nums", p.atrasada && "font-medium text-urgente")}>{formatarData(p.prazo)}</td>
                <td className={cn("px-4 py-2.5", p.concluidaFlag && "text-concluido")}>{p.status}</td>
                <td className="px-4 py-2.5 text-right">
                  {podeEditar && !p.concluidaFlag ? <button className={BOTAO_SEC} onClick={async () => { await concluirPendencia(p.id); await recarregar(); }}>Concluir</button> : null}
                </td>
              </tr>
            ))}
            {lista.length === 0 ? <tr><td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">Nenhuma pendência encontrada.</td></tr> : null}
          </tbody>
        </table>
      </div>

      <DialogosPendencia
        detalhe={detalhe} setDetalhe={setDetalhe} edicao={edicao} setEdicao={setEdicao} processos={processos}
        onSalvar={async (d, id) => { await salvarPendencia(d, id); await recarregar(); }}
        onConcluir={async (id) => { await concluirPendencia(id); await recarregar(); }}
      />
    </div>
  );
}
