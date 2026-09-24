import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Cabecalho } from "@/components/ui-serventia/Cabecalho";
import { CLASSE_CAMPO } from "@/components/processos/campos";
import { supabase } from "@/integrations/supabase/client";
import { pode } from "@/lib/permissoes";

export const Route = createFileRoute("/_authenticated/configuracoes/auditoria")({
  beforeLoad: ({ context }) => {
    if (!pode(context.sessao.perfil, "gerenciar-usuarios")) throw redirect({ to: "/" });
  },
  head: () => ({
    meta: [
      { title: "Auditoria — Gestão da Vara Criminal" },
      { name: "description", content: "Registro de ações realizadas no sistema da serventia." },
      { property: "og:title", content: "Auditoria — Gestão da Vara Criminal" },
      { property: "og:description", content: "Registro de ações realizadas no sistema da serventia." },
    ],
  }),
  component: Pagina,
});

const ACOES = ["Criado", "Editado", "Excluído", "Concluído", "Alteração de status", "Login", "Logout", "Login malsucedido"];
const MODULOS = ["Acesso", "Processos", "Réus", "Movimentações", "Audiências", "Pendências", "Prioridades", "Usuários"];

function Pagina() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["auditoria", "todas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("auditoria")
        .select("id, criado_em, usuario_nome, acao, modulo, processo_id, processo_numero, descricao")
        .order("criado_em", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data;
    },
  });
  const vazio = { usuario: "", de: "", ate: "", acao: "", modulo: "", processo: "" };
  const [f, setF] = useState(vazio);
  const set = (k: keyof typeof vazio) => (e: { target: { value: string } }) => setF((p) => ({ ...p, [k]: e.target.value }));
  const usuarios = useMemo(() => [...new Set((data ?? []).map((r) => r.usuario_nome).filter(Boolean))].sort(), [data]);
  const dig = (s: string) => s.replace(/\D/g, "");
  const linhas = (data ?? []).filter((r) => {
    const dia = new Date(r.criado_em).toLocaleDateString("sv-SE");
    return (
      (!f.usuario || r.usuario_nome === f.usuario) &&
      (!f.de || dia >= f.de) &&
      (!f.ate || dia <= f.ate) &&
      (!f.acao || r.acao === f.acao) &&
      (!f.modulo || r.modulo === f.modulo) &&
      (!f.processo || (dig(f.processo) !== "" && dig(r.processo_numero).includes(dig(f.processo))))
    );
  });
  const sel = (rotulo: string, k: keyof typeof vazio, ops: string[]) => (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      {rotulo}
      <select aria-label={rotulo} className={CLASSE_CAMPO} value={f[k]} onChange={set(k)}>
        <option value="">Todos</option>
        {ops.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );

  return (
    <div className="space-y-6">
      <Link to="/configuracoes" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Configurações
      </Link>
      <Cabecalho titulo="Auditoria" subtitulo="Registro das ações realizadas no sistema. Somente leitura." />
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4 shadow-card">
        {sel("Usuário", "usuario", usuarios)}
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">De<input aria-label="De" type="date" className={CLASSE_CAMPO} value={f.de} onChange={set("de")} /></label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">Até<input aria-label="Até" type="date" className={CLASSE_CAMPO} value={f.ate} onChange={set("ate")} /></label>
        {sel("Ação", "acao", ACOES)}
        {sel("Módulo", "modulo", MODULOS)}
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">Número do processo<input aria-label="Número do processo" className={CLASSE_CAMPO} value={f.processo} onChange={set("processo")} placeholder="Número ou trecho" /></label>
        <button className="h-9 rounded-md border border-border px-3 text-sm hover:bg-muted" onClick={() => setF(vazio)}>Limpar filtros</button>
      </div>
      <p className="text-sm text-muted-foreground">{linhas.length} registro{linhas.length === 1 ? "" : "s"}</p>
      <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-card">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>{["Data/hora", "Usuário", "Ação", "Módulo", "Processo", "Descrição"].map((c) => <th key={c} className="px-3 py-2 font-medium">{c}</th>)}</tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Carregando…</td></tr>
            ) : error ? (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-urgente">Não foi possível carregar a auditoria.</td></tr>
            ) : linhas.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Nenhum registro para os filtros aplicados.</td></tr>
            ) : (
              linhas.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums">{new Date(r.criado_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</td>
                  <td className="px-3 py-2">{r.usuario_nome || "Sistema"}</td>
                  <td className={"px-3 py-2 " + (r.acao === "Login malsucedido" ? "text-urgente" : "")}>{r.acao}</td>
                  <td className="px-3 py-2">{r.modulo}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {r.processo_id && r.processo_numero ? (
                      <Link to="/processos/$id" params={{ id: r.processo_id }} className="text-primary hover:underline">{r.processo_numero}</Link>
                    ) : r.processo_numero || "—"}
                  </td>
                  <td className="px-3 py-2">{r.descricao}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
