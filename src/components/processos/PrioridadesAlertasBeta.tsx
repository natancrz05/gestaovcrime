import { Link } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Bell, Database, Search, X } from "lucide-react";
import { Cabecalho, EstadoVazio } from "@/components/ui-serventia/Cabecalho";
import { CLASSE_CAMPO } from "@/components/processos/campos";
import { cn } from "@/lib/utils";
import { formatarData } from "@/lib/dominio";
import { hojeISO } from "@/lib/processos/modelo";
import { comparecimentosQuery } from "@/lib/processos/comparecimentos";
import { presosQuery } from "@/lib/processos/reus-presos";
import { etiquetasDosProcessosQuery, processosQuery } from "@/lib/processos/repositorio";
import {
  DADOS_VAZIOS_ALERTAS_BETA,
  dadosAuxiliaresAlertasBetaQuery,
  montarItensAtencaoBeta,
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

export function PrioridadesAlertasBeta() {
  const { data: processos } = useSuspenseQuery(processosQuery());
  const presos = useQuery(presosQuery());
  const comparecimentos = useQuery(comparecimentosQuery());
  const auxiliares = useQuery(dadosAuxiliaresAlertasBetaQuery());
  const processoIds = useMemo(() => processos.map((p) => p.id), [processos]);
  const { data: etiquetasPorProcesso = {} } = useQuery(etiquetasDosProcessosQuery(processoIds));

  const [busca, setBusca] = useState("");
  const [nivel, setNivel] = useState("");
  const [origem, setOrigem] = useState("");
  const [categoria, setCategoria] = useState("");
  const [modulo, setModulo] = useState("");
  const [prazo, setPrazo] = useState("");

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

  const categorias = useMemo(
    () => [...new Set(itens.map((i) => i.categoria))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [itens],
  );
  const modulos = useMemo(
    () => [...new Set(itens.map((i) => i.modulo))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [itens],
  );

  const exibidos = useMemo(() => {
    const termo = normalizarBusca(busca.trim());
    return itens.filter((i) => {
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
  }, [itens, busca, nivel, origem, categoria, modulo, prazo]);

  const contagens = useMemo(() => {
    const mapa = Object.fromEntries(NIVEIS.map((n) => [n.valor, 0])) as Record<NivelAtencaoBeta, number>;
    for (const i of itens) mapa[i.nivel]++;
    return mapa;
  }, [itens]);

  const basePje = statusBasePjeBeta(dadosAux, hoje);
  const algumFiltro = Boolean(busca || nivel || origem || categoria || modulo || prazo);

  if (presos.isLoading || comparecimentos.isLoading || auxiliares.isLoading) {
    return <EstadoVazio titulo="Carregando versão beta" descricao="Calculando prioridades e alertas a partir dos dados atuais do sistema." />;
  }

  return (
    <div className="space-y-6">
      <Cabecalho
        titulo="Prioridades e Alertas"
        subtitulo="BETA — visão unificada e calculada em tempo real; a versão atual permanece preservada para comparação."
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

      <section className={cn(
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
          {basePje.atualizadoHoje ? (
            <span className="rounded-full border border-concluido/30 bg-background px-2.5 py-1 text-xs font-medium text-concluido">Atualizada</span>
          ) : (
            <span className="rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground">Administrativo</span>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-4 shadow-card">
        <div className="mb-3 flex items-center gap-2">
          <Bell className="size-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Checagem</h2>
          <span className="text-xs text-muted-foreground">{exibidos.length} de {itens.length} item(ns)</span>
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
            {ORIGENS.map((o) => <option key={o}>{o}</option>)}
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
              Alertas automáticos não são apagados manualmente: desaparecem quando a condição que os originou deixa de existir.
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
        Durante o beta, o cadastro, edição e exclusão das prioridades manuais continuam disponíveis na versão atual. Nenhuma tabela nova foi criada e nenhum alerta beta é gravado no banco.
      </p>
    </div>
  );
}
