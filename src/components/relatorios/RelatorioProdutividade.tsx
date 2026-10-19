import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Gauge, CalendarCheck2, ListChecks, ShieldCheck, ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { CLASSE_CAMPO } from "@/components/processos/campos";
import { supabase } from "@/integrations/supabase/client";

const POR_PAGINA = 50;
const CATEGORIAS = ["Processos", "Movimentações", "Audiências", "Comparecimentos", "Pendências", "Prisões", "Ofícios"] as const;

function hojeLocal() {
  const d = new Date();
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function inicioMesLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function diaSeguinte(data: string) {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function csv(nome: string, linhas: string[][]) {
  const esc = (v: string) => /[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  const conteudo = linhas.map((l) => l.map(esc).join(";")).join("\r\n");
  const blob = new Blob(["\uFEFF" + conteudo], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nome}-${hojeLocal()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function RelatorioProdutividade() {
  const [de, setDe] = useState(inicioMesLocal());
  const [ate, setAte] = useState(hojeLocal());
  const [usuario, setUsuario] = useState("");
  const [categoria, setCategoria] = useState("");
  const [pagina, setPagina] = useState(1);

  const usuarios = useQuery({
    queryKey: ["produtividade", "usuarios"],
    queryFn: async () => {
      const { data, error } = await supabase.from("usuarios").select("nome").order("nome");
      if (error) throw error;
      return [...new Set((data ?? []).map((u) => u.nome).filter(Boolean))];
    },
  });

  const relatorio = useQuery({
    queryKey: ["produtividade", de, ate, usuario, categoria],
    queryFn: async () => {
      let produtivos = supabase
        .from("auditoria")
        .select(
          "id, criado_em, usuario_nome, categoria_produtividade, processo_id, processo_numero, descricao, acao, modulo",
          { count: "exact" },
        )
        .eq("conta_produtividade", true)
        .gte("criado_em", `${de}T00:00:00-03:00`)
        .lt("criado_em", `${diaSeguinte(ate)}T00:00:00-03:00`)
        .order("criado_em", { ascending: false })
        .limit(5000);

      let ignorados = supabase
        .from("auditoria")
        .select("id", { count: "exact", head: true })
        .eq("conta_produtividade", false)
        .gte("criado_em", `${de}T00:00:00-03:00`)
        .lt("criado_em", `${diaSeguinte(ate)}T00:00:00-03:00`);

      if (usuario) {
        produtivos = produtivos.eq("usuario_nome", usuario);
        ignorados = ignorados.eq("usuario_nome", usuario);
      }
      if (categoria) produtivos = produtivos.eq("categoria_produtividade", categoria);

      const [p, i] = await Promise.all([produtivos, ignorados]);
      if (p.error) throw p.error;
      if (i.error) throw i.error;

      return {
        eventos: p.data ?? [],
        totalProdutivos: p.count ?? 0,
        totalIgnorados: i.count ?? 0,
      };
    },
  });

  const eventos = relatorio.data?.eventos ?? [];
  const total = relatorio.data?.totalProdutivos ?? 0;
  const ignorados = relatorio.data?.totalIgnorados ?? 0;

  const diasAtivos = useMemo(
    () => new Set(eventos.map((e) => e.criado_em.slice(0, 10))).size,
    [eventos],
  );
  const mediaDia = diasAtivos ? total / diasAtivos : 0;

  const porCategoria = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of eventos) {
      const k = e.categoria_produtividade || "Outros";
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [eventos]);

  const porUsuario = useMemo(() => {
    const m = new Map<string, { total: number; categorias: Map<string, number> }>();
    for (const e of eventos) {
      const nome = e.usuario_nome || "Sistema";
      const atual = m.get(nome) ?? { total: 0, categorias: new Map<string, number>() };
      atual.total++;
      const cat = e.categoria_produtividade || "Outros";
      atual.categorias.set(cat, (atual.categorias.get(cat) ?? 0) + 1);
      m.set(nome, atual);
    }
    return [...m.entries()]
      .map(([nome, dados]) => ({
        nome,
        total: dados.total,
        categorias: [...dados.categorias.entries()].sort((a, b) => b[1] - a[1]),
      }))
      .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, "pt-BR"));
  }, [eventos]);

  const totalPaginas = Math.max(1, Math.ceil(eventos.length / POR_PAGINA));
  const exibidos = eventos.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  const alterarFiltro = (fn: (v: string) => void) => (v: string) => {
    setPagina(1);
    fn(v);
  };

  const exportar = () => {
    csv("relatorio-produtividade", [
      ["Data/hora", "Usuário", "Categoria", "Processo", "Descrição"],
      ...eventos.map((e) => [
        new Date(e.criado_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }),
        e.usuario_nome || "Sistema",
        e.categoria_produtividade || "—",
        e.processo_numero || "—",
        e.descricao,
      ]),
    ]);
  };

  return (
    <section className="space-y-5 rounded-lg border border-border bg-card p-4 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Relatório: Produtividade</h2>
          <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
            Conta apenas operações produtivas identificadas com segurança na auditoria. Importações, acessos,
            automações, prioridades organizacionais e eventos ambíguos permanecem registrados, mas não entram no indicador.
          </p>
        </div>
        <button
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          disabled={!eventos.length}
          onClick={exportar}
        >
          <Download className="size-4" /> Exportar CSV
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          De
          <input type="date" className={CLASSE_CAMPO} value={de} onChange={(e) => { setPagina(1); setDe(e.target.value); }} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Até
          <input type="date" className={CLASSE_CAMPO} value={ate} onChange={(e) => { setPagina(1); setAte(e.target.value); }} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Usuário
          <select className={CLASSE_CAMPO} value={usuario} onChange={(e) => alterarFiltro(setUsuario)(e.target.value)}>
            <option value="">Todos</option>
            {(usuarios.data ?? []).map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Categoria
          <select className={CLASSE_CAMPO} value={categoria} onChange={(e) => alterarFiltro(setCategoria)(e.target.value)}>
            <option value="">Todas</option>
            {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        {(usuario || categoria || de !== inicioMesLocal() || ate !== hojeLocal()) ? (
          <button
            className="h-9 rounded-md border border-border px-3 text-sm hover:bg-muted"
            onClick={() => {
              setDe(inicioMesLocal());
              setAte(hojeLocal());
              setUsuario("");
              setCategoria("");
              setPagina(1);
            }}
          >
            Limpar filtros
          </button>
        ) : null}
      </div>

      {relatorio.isLoading ? (
        <div className="rounded-md border border-border p-8 text-center text-sm text-muted-foreground">
          Calculando produtividade…
        </div>
      ) : relatorio.error ? (
        <div className="rounded-md border border-urgente/30 bg-urgente-suave p-4 text-sm text-urgente">
          Não foi possível calcular a produtividade.
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Resumo icone={ListChecks} rotulo="Operações produtivas" valor={total.toLocaleString("pt-BR")} />
            <Resumo icone={CalendarCheck2} rotulo="Dias com produção" valor={diasAtivos.toLocaleString("pt-BR")} />
            <Resumo icone={Gauge} rotulo="Média por dia ativo" valor={mediaDia.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} />
            <Resumo icone={ShieldCheck} rotulo="Logs técnicos ignorados" valor={ignorados.toLocaleString("pt-BR")} />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-md border border-border p-3">
              <h3 className="mb-3 text-sm font-semibold">Distribuição por categoria</h3>
              {porCategoria.length ? (
                <div className="space-y-2">
                  {porCategoria.map(([cat, n]) => (
                    <div key={cat} className="flex items-center justify-between gap-3 text-sm">
                      <span>{cat}</span>
                      <span className="font-semibold tabular-nums">{n}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-muted-foreground">Nenhuma operação produtiva no período.</p>}
            </div>

            <div className="rounded-md border border-border p-3">
              <h3 className="mb-3 text-sm font-semibold">Resumo por usuário</h3>
              {porUsuario.length ? (
                <div className="space-y-3">
                  {porUsuario.map((u) => (
                    <div key={u.nome} className="border-b border-border pb-2 last:border-0 last:pb-0">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-medium">{u.nome}</span>
                        <span className="font-semibold tabular-nums">{u.total}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {u.categorias.map(([cat, n]) => `${cat}: ${n}`).join(" · ")}
                      </p>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-muted-foreground">Nenhuma operação produtiva no período.</p>}
            </div>
          </div>

          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  {["Data/hora", "Usuário", "Categoria", "Processo", "Descrição"].map((c) => (
                    <th key={c} className="px-3 py-2 font-medium">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {exibidos.length ? exibidos.map((e) => (
                  <tr key={e.id} className="border-t border-border">
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                      {new Date(e.criado_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                    </td>
                    <td className="px-3 py-2">{e.usuario_nome || "Sistema"}</td>
                    <td className="px-3 py-2">{e.categoria_produtividade || "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2">
                      {e.processo_id && e.processo_numero ? (
                        <Link to="/processos/$id" params={{ id: e.processo_id }} className="text-primary hover:underline">
                          {e.processo_numero}
                        </Link>
                      ) : e.processo_numero || "—"}
                    </td>
                    <td className="px-3 py-2">{e.descricao}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">Nenhuma operação produtiva no período.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {total > eventos.length
                ? `Exibindo os ${eventos.length.toLocaleString("pt-BR")} registros mais recentes de ${total.toLocaleString("pt-BR")} operações.`
                : `Página ${pagina} de ${totalPaginas} · ${total.toLocaleString("pt-BR")} operação(ões) no período.`}
            </p>
            <div className="flex gap-2">
              <button
                className="inline-flex h-9 items-center gap-1 rounded-md border border-border px-3 text-sm hover:bg-muted disabled:opacity-50"
                disabled={pagina <= 1}
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="size-4" /> Anterior
              </button>
              <button
                className="inline-flex h-9 items-center gap-1 rounded-md border border-border px-3 text-sm hover:bg-muted disabled:opacity-50"
                disabled={pagina >= totalPaginas}
                onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
              >
                Próxima <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function Resumo({
  icone: Icone,
  rotulo,
  valor,
}: {
  icone: typeof ListChecks;
  rotulo: string;
  valor: string;
}) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icone className="size-4 text-primary" /> {rotulo}
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{valor}</p>
    </div>
  );
}
