import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Cabecalho, EstadoVazio } from "@/components/ui-serventia/Cabecalho";
import { Etiqueta } from "@/components/ui-serventia/Etiqueta";
import { CLASSE_CAMPO, Opcoes } from "@/components/processos/campos";
import { formatarData } from "@/lib/dominio";
import {
  STATUS_PROCESSO,
  TIPOS_PRISAO,
  diasSemMovimentacao,
  hojeISO,
  pendenciasAbertas,
  proximaAudiencia,
  reuPrincipal,
  ultimaMovimentacao,
} from "@/lib/processos/modelo";
import { processosQuery } from "@/lib/processos/repositorio";

export const Route = createFileRoute("/processos/")({
  head: () => ({
    meta: [
      { title: "Processos — Gestão da Vara Criminal" },
      { name: "description", content: "Acervo de processos da serventia da Vara Criminal de Coração de Maria/BA." },
      { property: "og:title", content: "Processos — Gestão da Vara Criminal" },
      { property: "og:description", content: "Acervo de processos da serventia da Vara Criminal de Coração de Maria/BA." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(processosQuery()),
  errorComponent: ({ error }) => <EstadoVazio titulo="Erro ao carregar processos" descricao={error.message} />,
  component: Pagina,
});

const PERIODOS = [
  { v: "", r: "Qualquer período" },
  { v: "0-30", r: "Até 30 dias" },
  { v: "31-100", r: "31 a 100 dias" },
  { v: "101-", r: "Mais de 100 dias" },
  { v: "sem", r: "Sem movimentação registrada" },
];

function Pagina() {
  const { data: processos } = useSuspenseQuery(processosQuery());
  const navigate = useNavigate();
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState("");
  const [classe, setClasse] = useState("");
  const [preso, setPreso] = useState("");
  const [tipoPrisao, setTipoPrisao] = useState("");
  const [periodo, setPeriodo] = useState("");
  const hoje = hojeISO();

  const classes = useMemo(() => [...new Set(processos.map((p) => p.classe))].sort(), [processos]);

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return processos.filter((p) => {
      if (t) {
        const alvo = [p.numero, p.classe, p.assunto, ...p.partes.map((x) => x.nome), ...p.reus.map((x) => x.nome)]
          .join(" ")
          .toLowerCase();
        if (!alvo.includes(t)) return false;
      }
      if (status && p.status !== status) return false;
      if (classe && p.classe !== classe) return false;
      if (preso === "sim" && !p.reus.some((r) => r.preso)) return false;
      if (preso === "nao" && p.reus.some((r) => r.preso)) return false;
      if (tipoPrisao && !p.reus.some((r) => r.tipo_prisao === tipoPrisao)) return false;
      if (periodo) {
        const d = diasSemMovimentacao(p, hoje);
        if (periodo === "sem") return d === null;
        if (d === null) return false;
        const [min, max] = periodo.split("-");
        if (d < Number(min) || (max && d > Number(max))) return false;
      }
      return true;
    });
  }, [processos, busca, status, classe, preso, tipoPrisao, periodo, hoje]);

  return (
    <div className="space-y-6">
      <Cabecalho
        titulo="Processos"
        subtitulo={`${filtrados.length} de ${processos.length} processos (dados fictícios)`}
        acao={
          <Link
            to="/processos/novo"
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="size-4" /> Novo Processo
          </Link>
        }
      />

      <div className="grid gap-3 rounded-lg border border-border bg-card p-4 shadow-card md:grid-cols-3 lg:grid-cols-6">
        <div className="relative md:col-span-3 lg:col-span-6">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <input
            className={`${CLASSE_CAMPO} pl-9`}
            placeholder="Pesquisar por número, parte, réu, classe ou assunto"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            aria-label="Pesquisar processos"
          />
        </div>
        <select className={CLASSE_CAMPO} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="">Todos os status</option>
          <Opcoes valores={STATUS_PROCESSO} />
        </select>
        <select className={`${CLASSE_CAMPO} lg:col-span-2`} value={classe} onChange={(e) => setClasse(e.target.value)} aria-label="Classe">
          <option value="">Todas as classes</option>
          <Opcoes valores={classes} />
        </select>
        <select className={CLASSE_CAMPO} value={preso} onChange={(e) => setPreso(e.target.value)} aria-label="Réu preso">
          <option value="">Réu preso: todos</option>
          <option value="sim">Com réu preso</option>
          <option value="nao">Sem réu preso</option>
        </select>
        <select className={CLASSE_CAMPO} value={tipoPrisao} onChange={(e) => setTipoPrisao(e.target.value)} aria-label="Tipo de prisão">
          <option value="">Tipo de prisão: todos</option>
          <Opcoes valores={TIPOS_PRISAO} />
        </select>
        <select className={CLASSE_CAMPO} value={periodo} onChange={(e) => setPeriodo(e.target.value)} aria-label="Última movimentação">
          {PERIODOS.map((p) => (
            <option key={p.v} value={p.v}>{p.r}</option>
          ))}
        </select>
      </div>

      {filtrados.length === 0 ? (
        <EstadoVazio titulo="Nenhum processo encontrado" descricao="Ajuste a pesquisa ou os filtros." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
              <tr>
                {["Número", "Réu principal", "Classe", "Situação", "Última movimentação", "Dias s/ mov.", "Prioridade", "Próx. audiência", "Pendências", "Responsável"].map((h) => (
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
                      <Link to="/processos/$id" params={{ id: p.id }} className="numero-processo font-semibold text-primary hover:underline">
                        {p.numero}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5">
                      {reu ? reu.nome : "—"}
                      {p.reus.length > 1 ? <span className="text-xs text-muted-foreground"> +{p.reus.length - 1}</span> : null}
                      {reu?.preso ? <div className="text-xs text-urgente">{reu.tipo_prisao}</div> : null}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">{p.classe}</td>
                    <td className="whitespace-nowrap px-3 py-2.5">{p.status}</td>
                    <td className="px-3 py-2.5">
                      <div>{formatarData(ult?.data ?? null)}</div>
                      <div className="text-xs text-muted-foreground">{ult?.descricao}</div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-medium">{dias === null ? "—" : `${dias} dias`}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      {p.prioridades.length ? p.prioridades.map((x) => x.titulo || x.motivo).join(", ") : "—"}
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
