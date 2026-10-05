import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Bell, Database, FileSpreadsheet, Pencil, Plus, Search, X } from "lucide-react";
import { Cabecalho, EstadoVazio } from "@/components/ui-serventia/Cabecalho";
import { CLASSE_CAMPO, Campo } from "@/components/processos/campos";
import { SeletorProcesso } from "@/components/processos/SeletorProcesso";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { formatarData } from "@/lib/dominio";
import { hojeISO } from "@/lib/processos/modelo";
import { comparecimentosQuery } from "@/lib/processos/comparecimentos";
import { usePode, useSessao } from "@/lib/sessao";
import { presosQuery } from "@/lib/processos/reus-presos";
import { etiquetasDosProcessosQuery, processosQuery, removerPrioridadeManual, salvarPrioridadeManual } from "@/lib/processos/repositorio";
import {
  DADOS_VAZIOS_ALERTAS_BETA,
  alertasOcultosBetaQuery,
  chaveOcultacaoAlertaBeta,
  dadosAuxiliaresAlertasBetaQuery,
  montarItensAtencaoBeta,
  ocultarAlertaBeta,
  statusBasePjeBeta,
  type ItemAtencaoBeta,
  type NivelAtencaoBeta,
  type OrigemAtencaoBeta,
  type ReuPresoBeta,
} from "@/lib/processos/alertas-beta";

const NIVEIS: { valor: NivelAtencaoBeta; rotulo: string; classe: string }[] = [
  { valor: "critico", rotulo: "Crítico", classe: "border-urgente/30 bg-urgente-suave text-urgente" },
  { valor: "urgente", rotulo: "Urgente", classe: "border-alerta/30 bg-alerta-suave text-alerta" },
  { valor: "atencao", rotulo: "Atenção", classe: "border-atencao/30 bg-atencao-suave text-atencao" },
  { valor: "conferir", rotulo: "Conferir", classe: "border-temporaria/30 bg-temporaria-suave text-temporaria" },
  { valor: "informativo", rotulo: "Informativo", classe: "border-info/30 bg-info/10 text-info" },
  { valor: "administrativo", rotulo: "Administrativo", classe: "border-border bg-muted text-muted-foreground" },
];

const ORIGENS: OrigemAtencaoBeta[] = ["Automático", "Manual", "Etiqueta", "Administrativo"];

const PRAZOS = [
  { valor: "", rotulo: "Prazo: todos" },
  { valor: "vencidos", rotulo: "Vencidos" },
  { valor: "hoje", rotulo: "Vence hoje" },
  { valor: "1-3", rotulo: "Próximos 1 a 3 dias" },
  { valor: "4-7", rotulo: "Próximos 4 a 7 dias" },
  { valor: "8-15", rotulo: "Próximos 8 a 15 dias" },
  { valor: "sem", rotulo: "Sem data-limite" },
];

const normalizarBusca = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function rotuloNivel(nivel: NivelAtencaoBeta) {
  return NIVEIS.find((n) => n.valor === nivel)?.rotulo ?? nivel;
}

function classeNivel(nivel: NivelAtencaoBeta) {
  return NIVEIS.find((n) => n.valor === nivel)?.classe ?? "border-border bg-muted text-muted-foreground";
}

function textoPrazo(item: ItemAtencaoBeta) {
  if (!item.dataLimite || item.diasRestantes === null) return "—";
  if (item.diasRestantes < 0) {
    const d = Math.abs(item.diasRestantes);
    return `${d} dia${d === 1 ? "" : "s"} vencido${d === 1 ? "" : "s"}`;
  }
  if (item.diasRestantes === 0) return "Hoje";
  return `Faltam ${item.diasRestantes} dia${item.diasRestantes === 1 ? "" : "s"}`;
}

export function PrioridadesAlertas() {
  const { perfil } = useSessao();
  const ehAdmin = perfil === "administrador";
  const podeEditar = usePode("editar");
  const qc = useQueryClient();
  const { data: processos } = useSuspenseQuery(processosQuery());
  const presos = useQuery(presosQuery());
  const comparecimentos = useQuery(comparecimentosQuery());
  const reuIds = useMemo(() => (presos.data ?? []).map((p) => p.id), [presos.data]);
  const auxiliares = useQuery(dadosAuxiliaresAlertasBetaQuery(presos.data ? reuIds : null));
  const ocultos = useQuery(alertasOcultosBetaQuery());
  const processoIds = useMemo(() => processos.map((p) => p.id), [processos]);
  const { data: etiquetasPorProcesso = {} } = useQuery(etiquetasDosProcessosQuery(processoIds));

  const [busca, setBusca] = useState("");
  const [nivel, setNivel] = useState("");
  const [origem, setOrigem] = useState("");
  const [categoria, setCategoria] = useState("");
  const [modulo, setModulo] = useState("");
  const [prazo, setPrazo] = useState("");
  const [mostrarManual, setMostrarManual] = useState(false);
  const [manual, setManual] = useState({
    processo_id: "",
    titulo: "",
    nivel: "media" as "critico" | "alta" | "media" | "conferir" | "baixa",
    observacao: "",
  });
  const [salvandoManual, setSalvandoManual] = useState(false);
  const [erroManual, setErroManual] = useState("");
  const [editandoManualId, setEditandoManualId] = useState<string | null>(null);
  const [removendoId, setRemovendoId] = useState<string | null>(null);

  const hoje = hojeISO();
  const dadosAux = auxiliares.data ?? DADOS_VAZIOS_ALERTAS_BETA;

  const itens = useMemo(
    () =>
      montarItensAtencaoBeta({
        processos,
        presos: (presos.data ?? []) as unknown as ReuPresoBeta[],
        comparecimentos: comparecimentos.data ?? [],
        etiquetasPorProcesso,
        auxiliares: dadosAux,
        hoje,
      }),
    [processos, presos.data, comparecimentos.data, etiquetasPorProcesso, dadosAux, hoje],
  );

  const chavesOcultas = useMemo(() => new Set(ocultos.data ?? []), [ocultos.data]);

  const itensVisiveis = useMemo(() => {
    const porPerfil = ehAdmin ? itens : itens.filter((i) => i.id !== "base-pje");
    return porPerfil.filter((i) => !chavesOcultas.has(chaveOcultacaoAlertaBeta(i)));
  }, [itens, ehAdmin, chavesOcultas]);

  const categorias = useMemo(
    () => [...new Set(itensVisiveis.map((i) => i.categoria))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [itensVisiveis],
  );
  const modulos = useMemo(
    () => [...new Set(itensVisiveis.map((i) => i.modulo))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [itensVisiveis],
  );

  const exibidos = useMemo(() => {
    const termo = normalizarBusca(busca.trim());
    return itensVisiveis.filter((i) => {
      if (nivel && i.nivel !== nivel) return false;
      if (origem && i.origem !== origem) return false;
      if (categoria && i.categoria !== categoria) return false;
      if (modulo && i.modulo !== modulo) return false;

      if (prazo === "vencidos" && !(i.diasRestantes !== null && i.diasRestantes < 0)) return false;
      if (prazo === "hoje" && i.diasRestantes !== 0) return false;
      if (prazo === "1-3" && !(i.diasRestantes !== null && i.diasRestantes >= 1 && i.diasRestantes <= 3)) return false;
      if (prazo === "4-7" && !(i.diasRestantes !== null && i.diasRestantes >= 4 && i.diasRestantes <= 7)) return false;
      if (prazo === "8-15" && !(i.diasRestantes !== null && i.diasRestantes >= 8 && i.diasRestantes <= 15)) return false;
      if (prazo === "sem" && i.dataLimite !== null) return false;

      if (termo) {
        const alvo = normalizarBusca(
          [
            i.processoNumero,
            i.processoNumero?.replace(/\D/g, ""),
            i.pessoa,
            i.titulo,
            i.descricao,
            i.categoria,
            i.modulo,
            i.origem,
          ]
            .filter(Boolean)
            .join(" "),
        );
        if (!alvo.includes(termo) && !alvo.includes(termo.replace(/\D/g, ""))) return false;
      }
      return true;
    });
  }, [itensVisiveis, busca, nivel, origem, categoria, modulo, prazo]);

  const contagens = useMemo(() => {
    const mapa = Object.fromEntries(NIVEIS.map((n) => [n.valor, 0])) as Record<NivelAtencaoBeta, number>;
    for (const i of itensVisiveis) mapa[i.nivel]++;
    return mapa;
  }, [itensVisiveis]);

  const basePje = statusBasePjeBeta(dadosAux, hoje);
  const basePjeItem = itens.find((i) => i.id === "base-pje") ?? null;
  const basePjeOculta = Boolean(basePjeItem && chavesOcultas.has(chaveOcultacaoAlertaBeta(basePjeItem)));
  const algumFiltro = Boolean(busca || nivel || origem || categoria || modulo || prazo);

  async function adicionarManual(e: React.FormEvent) {
    e.preventDefault();
    if (!manual.processo_id || !manual.titulo.trim()) {
      setErroManual("Selecione o processo e informe o título.");
      return;
    }
    setSalvandoManual(true);
    setErroManual("");
    try {
      await salvarPrioridadeManual({
        processo_id: manual.processo_id,
        titulo: manual.titulo.trim(),
        nivel: manual.nivel,
        observacao: manual.observacao.trim(),
      }, editandoManualId ?? undefined);
      await qc.invalidateQueries({ queryKey: ["processos"] });
      setManual({ processo_id: "", titulo: "", nivel: "media", observacao: "" });
      setEditandoManualId(null);
      setMostrarManual(false);
    } catch (err) {
      setErroManual(err instanceof Error ? err.message : "Erro ao adicionar prioridade.");
    } finally {
      setSalvandoManual(false);
    }
  }


  function editarManual(item: ItemAtencaoBeta) {
    if (item.origem !== "Manual" || !item.processoId) return;
    const prioridadeId = item.id.split(":").pop();
    if (!prioridadeId) return;

    const nivelManual =
      item.nivel === "critico" ? "critico" :
      item.nivel === "urgente" ? "alta" :
      item.nivel === "atencao" ? "media" :
      item.nivel === "conferir" ? "conferir" :
      "baixa";

    setManual({
      processo_id: item.processoId,
      titulo: item.titulo.replace(/ \((crítico|urgente|atenção|conferir|informativo)\)$/i, ""),
      nivel: nivelManual,
      observacao: item.descricao,
    });
    setEditandoManualId(prioridadeId);
    setErroManual("");
    setMostrarManual(true);
  }

  async function removerAlerta(item: ItemAtencaoBeta) {
    setRemovendoId(item.id);
    try {
      if (item.origem === "Manual") {
        const prioridadeId = item.id.split(":").pop();
        if (!prioridadeId) throw new Error("Não foi possível identificar a prioridade manual.");
        await removerPrioridadeManual(prioridadeId);
        await qc.invalidateQueries({ queryKey: ["processos"] });
      } else {
        await ocultarAlertaBeta(chaveOcultacaoAlertaBeta(item));
        await qc.invalidateQueries({ queryKey: ["alertas-beta", "ocultos"] });
      }
      toast.success("Alerta removido.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao remover alerta.");
    } finally {
      setRemovendoId(null);
    }
  }

  if (presos.isLoading || !presos.data || comparecimentos.isLoading || auxiliares.isLoading) {
    return <EstadoVazio titulo="Carregando prioridades e alertas" descricao="Calculando prioridades e alertas a partir dos dados atuais do sistema." />;
  }

  return (
    <div className="space-y-6">
      <Cabecalho
        titulo="Prioridades e Alertas"
        subtitulo="Visão unificada de prioridades manuais, alertas automáticos, etiquetas e conferências operacionais."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {NIVEIS.filter((n) => n.valor !== "administrativo").map((n) => {
          const ativo = nivel === n.valor;
          return (
            <button
              key={n.valor}
              type="button"
              aria-pressed={ativo}
              onClick={() => setNivel(ativo ? "" : n.valor)}
              className={cn(
                "rounded-lg border bg-card p-4 text-left shadow-card transition-colors hover:border-primary/40",
                ativo ? "border-primary ring-1 ring-primary/30" : "border-border",
              )}
            >
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{n.rotulo}</p>
              <p className={cn("mt-1 text-3xl font-semibold tabular-nums", n.classe.split(" ").find((x) => x.startsWith("text-")))}>
                {contagens[n.valor]}
              </p>
            </button>
          );
        })}
      </div>

      {podeEditar ? (
        <section className="rounded-lg border border-border bg-card p-4 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Prioridade ou alerta manual</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Adicione uma sinalização interna vinculada a um processo. Ela permanecerá ativa até ser removida manualmente.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                const proximo = !mostrarManual;
                setMostrarManual(proximo);
                setErroManual("");
                if (!proximo || editandoManualId) {
                  setEditandoManualId(null);
                  setManual({ processo_id: "", titulo: "", nivel: "media", observacao: "" });
                }
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground hover:bg-muted"
            >
              {mostrarManual ? <X className="size-4" /> : <Plus className="size-4" />}
              {mostrarManual ? "Cancelar" : "Adicionar prioridade / alerta"}
            </button>
          </div>

          {mostrarManual ? (
            <form onSubmit={adicionarManual} className="mt-4 grid gap-3 border-t border-border pt-4 md:grid-cols-[2fr_2fr_1fr] md:items-end">
              <Campo rotulo="Processo">
                <SeletorProcesso value={manual.processo_id} onChange={(id) => setManual({ ...manual, processo_id: id })} />
              </Campo>
              <Campo rotulo="Título">
                <input
                  className={CLASSE_CAMPO}
                  placeholder="Ex.: conferir manifestação do MP"
                  value={manual.titulo}
                  onChange={(e) => setManual({ ...manual, titulo: e.target.value })}
                />
              </Campo>
              <Campo rotulo="Nível">
                <select
                  className={CLASSE_CAMPO}
                  value={manual.nivel}
                  onChange={(e) => setManual({ ...manual, nivel: e.target.value as "critico" | "alta" | "media" | "conferir" | "baixa" })}
                >
                  <option value="critico">Crítico</option>
                  <option value="alta">Urgente</option>
                  <option value="media">Atenção</option>
                  <option value="conferir">Conferir</option>
                  <option value="baixa">Informativo</option>
                </select>
              </Campo>
              <div className="md:col-span-2">
                <Campo rotulo="Observação">
                  <input
                    className={CLASSE_CAMPO}
                    placeholder="Observação opcional"
                    value={manual.observacao}
                    onChange={(e) => setManual({ ...manual, observacao: e.target.value })}
                  />
                </Campo>
              </div>
              <button
                type="submit"
                disabled={salvandoManual}
                className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {salvandoManual ? "Salvando..." : editandoManualId ? "Salvar alteração" : "Adicionar"}
              </button>
              {erroManual ? <p className="text-sm text-urgente md:col-span-3">{erroManual}</p> : null}
            </form>
          ) : null}
        </section>
      ) : null}

      {ehAdmin && !basePjeOculta ? <section className={cn(
        "rounded-lg border p-4 shadow-card",
        basePje.atualizadoHoje ? "border-concluido/30 bg-concluido-suave" : "border-border bg-card",
      )}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 rounded-md border border-current/15 p-2">
              <Database className="size-4" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Base PJe</p>
              <p className="mt-0.5 font-semibold text-foreground">{basePje.rotulo}</p>
              <p className="mt-1 text-xs text-muted-foreground">{basePje.detalhe}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {basePje.atualizadoHoje ? (
              <span className="rounded-full border border-concluido/30 bg-background px-2.5 py-1 text-xs font-medium text-concluido">Atualizada</span>
            ) : (
              <span className="rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground">Administrativo</span>
            )}
            <Link
              to="/processos/importar"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground hover:bg-muted"
            >
              <FileSpreadsheet className="size-3.5" /> Atualizar acervo
            </Link>
            {podeEditar && basePjeItem ? (
              <button
                type="button"
                aria-label="Remover alerta da Base PJe"
                title="Remover alerta"
                disabled={removendoId === basePjeItem.id}
                onClick={() => removerAlerta(basePjeItem)}
                className="inline-flex size-8 items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>
        </div>
      </section> : null}

      <section className="rounded-lg border border-border bg-card p-4 shadow-card">
        <div className="mb-3 flex items-center gap-2">
          <Bell className="size-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Checagem</h2>
          <span className="text-xs text-muted-foreground">{exibidos.length} de {itensVisiveis.length} item(ns)</span>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <div className="relative md:col-span-2 xl:col-span-2">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <input
              type="search"
              className={`${CLASSE_CAMPO} pl-9`}
              placeholder="Processo, réu, alerta ou categoria..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>

          <select className={CLASSE_CAMPO} value={nivel} onChange={(e) => setNivel(e.target.value)}>
            <option value="">Nível: todos</option>
            {NIVEIS.map((n) => <option key={n.valor} value={n.valor}>{n.rotulo}</option>)}
          </select>

          <select className={CLASSE_CAMPO} value={origem} onChange={(e) => setOrigem(e.target.value)}>
            <option value="">Origem: todas</option>
            {ORIGENS.filter((o) => ehAdmin || o !== "Administrativo").map((o) => <option key={o}>{o}</option>)}
          </select>

          <select className={CLASSE_CAMPO} value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            <option value="">Categoria: todas</option>
            {categorias.map((c) => <option key={c}>{c}</option>)}
          </select>

          <select className={CLASSE_CAMPO} value={modulo} onChange={(e) => setModulo(e.target.value)}>
            <option value="">Módulo: todos</option>
            {modulos.map((m) => <option key={m}>{m}</option>)}
          </select>

          <select className={CLASSE_CAMPO} value={prazo} onChange={(e) => setPrazo(e.target.value)}>
            {PRAZOS.map((p) => <option key={p.valor} value={p.valor}>{p.rotulo}</option>)}
          </select>

          <div className="flex items-center md:col-span-2 xl:col-span-5">
            <p className="text-xs text-muted-foreground">
              Ao remover um alerta automático, apenas a ocorrência atual é ocultada. Se a condição mudar ou gerar novo prazo, um novo alerta poderá aparecer.
            </p>
          </div>

          <button
            type="button"
            disabled={!algumFiltro}
            onClick={() => {
              setBusca("");
              setNivel("");
              setOrigem("");
              setCategoria("");
              setModulo("");
              setPrazo("");
            }}
            className="inline-flex h-9 items-center justify-center gap-1 rounded-md border border-border px-3 text-sm hover:bg-muted disabled:opacity-50"
          >
            <X className="size-4" /> Limpar
          </button>
        </div>
      </section>

      {exibidos.length === 0 ? (
        <EstadoVazio titulo="Nenhum item encontrado" descricao="Não há prioridades ou alertas para os filtros selecionados." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-card">
          <table className="w-full min-w-[1050px] text-sm">
            <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
              <tr>
                {["Nível", "Processo / pessoa", "Prioridade ou alerta", "Origem", "Módulo", "Data-limite", "Situação"].map((h) => (
                  <th key={h} className="px-3 py-2.5 font-medium">{h}</th>
                ))}
                <th className="w-10 px-2 py-2.5"><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {exibidos.map((i) => (
                <tr key={i.id} className="align-top hover:bg-muted/30">
                  <td className="px-3 py-3">
                    <span className={cn("inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium", classeNivel(i.nivel))}>
                      {rotuloNivel(i.nivel)}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    {i.processoId && i.processoNumero ? (
                      <Link to="/processos/$id" params={{ id: i.processoId }} className="numero-processo font-medium text-primary hover:underline">
                        {i.processoNumero}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">{i.processoNumero ?? "Sem processo vinculado"}</span>
                    )}
                    {i.pessoa ? <div className="mt-1 text-xs text-muted-foreground">{i.pessoa}</div> : null}
                  </td>
                  <td className="px-3 py-3">
                    <p className="font-medium text-foreground">{i.titulo}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{i.categoria}</p>
                    {i.descricao ? <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground">{i.descricao}</p> : null}
                  </td>
                  <td className="px-3 py-3 text-xs">{i.origem}</td>
                  <td className="px-3 py-3 text-xs">{i.modulo}</td>
                  <td className="px-3 py-3 text-xs">{i.dataLimite ? formatarData(i.dataLimite) : "—"}</td>
                  <td className="px-3 py-3 text-xs font-medium">{textoPrazo(i)}</td>
                  <td className="px-2 py-3 text-right">
                    {podeEditar ? (
                      <div className="flex items-center justify-end gap-0.5">
                        {i.origem === "Manual" ? (
                          <button
                            type="button"
                            aria-label={`Editar prioridade manual: ${i.titulo}`}
                            title="Editar prioridade manual"
                            onClick={() => editarManual(i)}
                            className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                        ) : null}
                        <button
                          type="button"
                          aria-label={`Remover alerta: ${i.titulo}`}
                          title="Remover alerta"
                          disabled={removendoId === i.id}
                          onClick={() => removerAlerta(i)}
                          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
        Prioridades e alertas podem ser removidos pelo X. Nos alertas automáticos, a remoção oculta a ocorrência atual; se surgir um novo prazo ou uma nova ocorrência, o sistema poderá gerar outro alerta.
      </p>
    </div>
  );
}
