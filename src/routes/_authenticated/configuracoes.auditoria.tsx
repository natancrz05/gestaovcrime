import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
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

const ACOES = [
  "Criado",
  "Editado",
  "Excluído",
  "Concluído",
  "Alteração de status",
  "Importação",
  "Importação desfeita",
  "Login",
  "Logout",
  "Login malsucedido",
];

const MODULOS = [
  "Acesso",
  "Processos",
  "Réus",
  "Movimentações",
  "Audiências",
  "Comparecimentos",
  "Pendências",
  "Prioridades",
  "Importação",
  "Usuários",
  "Problemas e Sugestões",
  "Sistema",
];

const vazio = { usuario: "", de: "", ate: "", acao: "", modulo: "", processo: "" };
const TAMANHOS = [50, 100];

function diaSeguinte(data: string) {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function formatarCNJBusca(valor: string) {
  const d = valor.replace(/\D/g, "");
  if (d.length !== 20) return "";
  return `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9, 13)}.${d.slice(13, 14)}.${d.slice(14, 16)}.${d.slice(16)}`;
}

function Pagina() {
  const [f, setF] = useState(vazio);
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(50);

  const usuariosQuery = useQuery({
    queryKey: ["auditoria", "usuarios-filtro"],
    queryFn: async () => {
      const { data, error } = await supabase.from("usuarios").select("nome").order("nome");
      if (error) throw error;
      return [...new Set((data ?? []).map((u) => u.nome).filter(Boolean))];
    },
  });

  const auditoria = useQuery({
    queryKey: ["auditoria", "pagina", pagina, porPagina, f],
    queryFn: async () => {
      const inicio = (pagina - 1) * porPagina;
      const fim = inicio + porPagina - 1;

      let q = supabase
        .from("auditoria")
        .select(
          "id, criado_em, usuario_nome, acao, modulo, processo_id, processo_numero, descricao",
          { count: "exact" },
        )
        .order("criado_em", { ascending: false })
        .order("id", { ascending: false })
        .range(inicio, fim);

      if (f.usuario) q = q.eq("usuario_nome", f.usuario);
      if (f.de) q = q.gte("criado_em", `${f.de}T00:00:00-03:00`);
      if (f.ate) q = q.lt("criado_em", `${diaSeguinte(f.ate)}T00:00:00-03:00`);
      if (f.acao) q = q.eq("acao", f.acao);
      if (f.modulo) q = q.eq("modulo", f.modulo);

      if (f.processo.trim()) {
        const bruto = f.processo.trim();
        const formatado = formatarCNJBusca(bruto);
        q = formatado
          ? q.or(`processo_numero.ilike.%${bruto}%,processo_numero.ilike.%${formatado}%`)
          : q.ilike("processo_numero", `%${bruto}%`);
      }

      const { data, error, count } = await q;
      if (error) throw error;
      return { linhas: data ?? [], total: count ?? 0 };
    },
  });

  const total = auditoria.data?.total ?? 0;
  const linhas = auditoria.data?.linhas ?? [];
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
  const inicioExibido = total ? (pagina - 1) * porPagina + 1 : 0;
  const fimExibido = total ? Math.min(pagina * porPagina, total) : 0;

  const set = (k: keyof typeof vazio) => (e: { target: { value: string } }) => {
    setPagina(1);
    setF((p) => ({ ...p, [k]: e.target.value }));
  };

  const limparFiltros = () => {
    setF(vazio);
    setPagina(1);
  };

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

      <Cabecalho
        titulo="Auditoria"
        subtitulo="Registro das ações realizadas no sistema. Somente leitura."
      />

      <div className="rounded-lg border border-border bg-card p-4 shadow-card">
        <div className="flex flex-wrap items-end gap-3">
          {sel("Usuário", "usuario", usuariosQuery.data ?? [])}
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            De
            <input aria-label="De" type="date" className={CLASSE_CAMPO} value={f.de} onChange={set("de")} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Até
            <input aria-label="Até" type="date" className={CLASSE_CAMPO} value={f.ate} onChange={set("ate")} />
          </label>
          {sel("Ação", "acao", ACOES)}
          {sel("Módulo", "modulo", MODULOS)}
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Número do processo
            <input
              aria-label="Número do processo"
              className={CLASSE_CAMPO}
              value={f.processo}
              onChange={set("processo")}
              placeholder="Número ou trecho"
            />
          </label>
          <button className="h-9 rounded-md border border-border px-3 text-sm hover:bg-muted" onClick={limparFiltros}>
            Limpar filtros
          </button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Retenção: os logs permanecem disponíveis por 90 dias completos e são removidos automaticamente no dia seguinte.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <p>
          {total === 0
            ? "Nenhum registro"
            : `Mostrando ${inicioExibido}–${fimExibido} de ${total.toLocaleString("pt-BR")} registros`}
        </p>
        <label className="flex items-center gap-2 text-xs">
          Registros por página
          <select
            className="h-8 rounded-md border border-border bg-background px-2 text-sm text-foreground"
            value={porPagina}
            onChange={(e) => {
              setPorPagina(Number(e.target.value));
              setPagina(1);
            }}
          >
            {TAMANHOS.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-card">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              {["Data/hora", "Usuário", "Ação", "Módulo", "Processo", "Descrição"].map((c) => (
                <th key={c} className="px-3 py-2 font-medium">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {auditoria.isLoading || auditoria.isFetching ? (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Carregando…</td></tr>
            ) : auditoria.error ? (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-urgente">Não foi possível carregar a auditoria.</td></tr>
            ) : linhas.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Nenhum registro para os filtros aplicados.</td></tr>
            ) : (
              linhas.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                    {new Date(r.criado_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                  </td>
                  <td className="px-3 py-2">{r.usuario_nome || "Sistema"}</td>
                  <td className={"px-3 py-2 " + (r.acao === "Login malsucedido" ? "text-urgente" : "")}>{r.acao}</td>
                  <td className="px-3 py-2">{r.modulo}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {r.processo_id && r.processo_numero ? (
                      <Link to="/processos/$id" params={{ id: r.processo_id }} className="text-primary hover:underline">
                        {r.processo_numero}
                      </Link>
                    ) : r.processo_numero || "—"}
                  </td>
                  <td className="px-3 py-2">{r.descricao}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Página {pagina} de {totalPaginas}
        </p>
        <div className="flex items-center gap-2">
          <button
            className="inline-flex h-9 items-center gap-1 rounded-md border border-border px-3 text-sm hover:bg-muted disabled:opacity-50"
            disabled={pagina <= 1 || auditoria.isFetching}
            onClick={() => setPagina((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="size-4" /> Anterior
          </button>
          <button
            className="inline-flex h-9 items-center gap-1 rounded-md border border-border px-3 text-sm hover:bg-muted disabled:opacity-50"
            disabled={pagina >= totalPaginas || auditoria.isFetching}
            onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
          >
            Próxima <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
