import { createFileRoute, Link } from "@tanstack/react-router";
import { SeletorProcesso } from "@/components/processos/SeletorProcesso";
import { usePode } from "@/lib/sessao";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Cabecalho, EstadoVazio } from "@/components/ui-serventia/Cabecalho";
import { CartoesCategorias, ListaAtencao, contarCategorias } from "@/components/processos/Prioridades";
import { CLASSE_CAMPO, Campo, Secao } from "@/components/processos/campos";
import { processosQuery, removerPrioridadeManual, salvarPrioridadeManual } from "@/lib/processos/repositorio";
import { NIVEIS, processosQueRequeremAtencao, type CategoriaPrioridade } from "@/lib/processos/prioridades";
import type { PrioridadeProcesso } from "@/lib/processos/modelo";
import { AcoesEtiquetasProcesso, EtiquetasProcesso } from "@/components/processos/GerenciarEtiquetas";

export const Route = createFileRoute("/_authenticated/prioridades")({
  head: () => ({
    meta: [
      { title: "Prioridades — Gestão da Vara Criminal" },
      { name: "description", content: "Alertas automáticos de gestão e prioridades manuais da serventia." },
      { property: "og:title", content: "Prioridades — Gestão da Vara Criminal" },
      { property: "og:description", content: "Alertas automáticos de gestão e prioridades manuais da serventia." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(processosQuery()),
  errorComponent: ({ error }) => <EstadoVazio titulo="Erro ao carregar prioridades" descricao={error.message} />,
  component: Pagina,
});

type Nivel = PrioridadeProcesso["nivel"];
const BOTAO = "inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60";
const NIVEL_ROTULO: Record<string, string> = { alta: "Alta", media: "Média", baixa: "Baixa" };

function Pagina() {
  const { data: processos } = useSuspenseQuery(processosQuery());
  const qc = useQueryClient();
  const podeEditar = usePode("editar");
  const [filtro, setFiltro] = useState<CategoriaPrioridade | null>(null);
  const atencao = useMemo(() => processosQueRequeremAtencao(processos), [processos]);
  const contagens = contarCategorias(atencao);
  const automaticas = atencao
    .map((x) => ({ ...x, alertas: x.alertas.filter((a) => a.categoria !== "manual") }))
    .filter((x) => x.alertas.length);
  const exibidos = filtro ? atencao.filter((x) => x.alertas.some((a) => a.categoria === filtro)) : automaticas;

  const manuais = processos.flatMap((p) => p.prioridades.map((m) => ({ ...m, numero: p.numero })));
  const vazio = { processo_id: "", titulo: "", nivel: "media" as Nivel, observacao: "" };
  const [form, setForm] = useState(vazio);
  const [editando, setEditando] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.processo_id || !form.titulo.trim()) return setErro("Selecione o processo e informe o título.");
    setSalvando(true); setErro("");
    try {
      await salvarPrioridadeManual(form, editando ?? undefined);
      await qc.invalidateQueries({ queryKey: ["processos"] });
      setForm(vazio); setEditando(null);
    } catch (err) { setErro(err instanceof Error ? err.message : "Erro ao salvar."); }
    setSalvando(false);
  }

  async function remover(id: string) {
    if (!confirm("Remover esta prioridade manual?")) return;
    await removerPrioridadeManual(id);
    await qc.invalidateQueries({ queryKey: ["processos"] });
  }

  return (
    <div className="space-y-6">
      <Cabecalho titulo="Prioridades" subtitulo="Alertas de gestão — não representam conclusão jurídica sobre os processos." />

      <CartoesCategorias contagens={contagens} selecionada={filtro} onSelecionar={setFiltro} />

      <Secao titulo={filtro ? "Processos filtrados" : "Automáticas"}>
        <p className="mb-3 text-xs text-muted-foreground">
          Réu preso, prisão temporária e tempo sem movimentação acima do limite configurado. Clique em um cartão acima para filtrar.
        </p>
        <ListaAtencao itens={exibidos} />
      </Secao>

      <Secao titulo="Manuais">
        {podeEditar ? <form onSubmit={salvar} className="grid gap-3 rounded-md border border-dashed border-border p-3 md:grid-cols-[2fr_2fr_1fr] md:items-end">
          <Campo rotulo="Processo">
            <SeletorProcesso value={form.processo_id} onChange={(id) => setForm({ ...form, processo_id: id })} />
          </Campo>
          <Campo rotulo="Título">
            <input className={CLASSE_CAMPO} value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
          </Campo>
          <Campo rotulo="Nível">
            <select className={CLASSE_CAMPO} value={form.nivel} onChange={(e) => setForm({ ...form, nivel: e.target.value as Nivel })}>
              {NIVEIS.map((n) => <option key={n.v} value={n.v}>{n.r}</option>)}
            </select>
          </Campo>
          <div className="md:col-span-2">
            <Campo rotulo="Observação">
              <input className={CLASSE_CAMPO} value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} />
            </Campo>
          </div>
          <div className="flex gap-2">
            <button className={BOTAO} disabled={salvando}>{editando ? "Salvar alteração" : "Adicionar prioridade"}</button>
            {editando ? <button type="button" className="h-9 rounded-md border border-border px-3 text-sm" onClick={() => { setEditando(null); setForm(vazio); }}>Cancelar</button> : null}
          </div>
          {erro ? <p className="text-sm text-urgente md:col-span-3">{erro}</p> : null}
        </form> : null}

        <ul className="mt-4 divide-y divide-border rounded-md border border-border">
          {manuais.length === 0 ? <li className="px-3 py-3 text-sm text-muted-foreground">Nenhuma prioridade manual.</li> : null}
          {manuais.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 text-sm">
              <div>
                <p className="font-medium">
                  {m.titulo || m.motivo}{" "}
                  <span className="ml-1 rounded-full border border-alerta/30 bg-alerta-suave px-2 py-0.5 text-[11px] text-alerta">{NIVEL_ROTULO[m.nivel]}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  <Link to="/processos/$id" params={{ id: m.processo_id }} className="numero-processo hover:underline">{m.numero}</Link>
                  {m.observacao ? ` · ${m.observacao}` : ""}
                </p>
              </div>
              {podeEditar ? <div className="flex items-center gap-1">
                <AcoesEtiquetasProcesso processoId={m.processo_id} etiquetas={processos.find((p) => p.id === m.processo_id)?.etiquetas} />
                <button aria-label="Editar" className="rounded-md border border-border p-1.5 hover:bg-muted" onClick={() => { setEditando(m.id); setForm({ processo_id: m.processo_id, titulo: m.titulo || m.motivo, nivel: m.nivel, observacao: m.observacao }); }}>
                  <Pencil className="size-3.5" />
                </button>
                <button aria-label="Remover" className="rounded-md border border-border p-1.5 hover:bg-muted" onClick={() => remover(m.id)}>
                  <Trash2 className="size-3.5" />
                </button>
              </div> : null}
            </li>
          ))}
        </ul>
      </Secao>
    </div>
  );
}
