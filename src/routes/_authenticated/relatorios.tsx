import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  Download,
  FolderOpen,
  Lock,
  PauseCircle,
} from "lucide-react";
import { Cabecalho } from "@/components/ui-serventia/Cabecalho";
import { EtiquetaProcesso } from "@/components/processos/EtiquetaProcesso";
import { CLASSE_CAMPO } from "@/components/processos/campos";
import { pode } from "@/lib/permissoes";
import { etiquetasDosProcessosQuery, processosResumoQuery } from "@/lib/processos/repositorio";
import {
  STATUS_PROCESSO,
  diasSemMovimentacao,
  estadoContagem100Dias,
  reuPrincipal,
  rotuloFluxo,
  ultimaMovimentacao,
  type ProcessoCompleto,
} from "@/lib/processos/modelo";
import { CONFIG_PRIORIDADES } from "@/lib/processos/prioridades";
import {
  MODALIDADES,
  SITUACOES_AUDIENCIA,
  TIPOS_AUDIENCIA,
  horaCurta,
  listarAudienciasDe,
} from "@/lib/processos/audiencias";
import {
  listarPendenciasDe,
  rotuloPrioridade,
} from "@/lib/processos/pendencias";
import {
  SITUACOES_COMP,
  comparecimentosQuery,
  preparar,
  type Comparecimento,
} from "@/lib/processos/comparecimentos";
import { presosQuery } from "@/lib/processos/reus-presos";
import { tipoPrisaoDe } from "@/lib/processos/importacao-reus";
import {
  DADOS_VAZIOS_ALERTAS_BETA,
  alertasOcultosBetaQuery,
  chaveOcultacaoAlertaBeta,
  dadosAuxiliaresAlertasBetaQuery,
  montarItensAtencaoBeta,
  type NivelAtencaoBeta,
  type ReuPresoBeta,
} from "@/lib/processos/alertas-beta";
import {
  agruparItensAtencaoBeta,
  filtrarGruposAtencaoBeta,
} from "@/lib/processos/agrupamento-alertas";
import { cn } from "@/lib/utils";

type Tipo =
  | "processos"
  | "presos-provisorios"
  | "sem-movimentacao"
  | "audiencias"
  | "comparecimentos"
  | "pendencias"
  | "prioridades";

const RELATORIOS: { chave: Tipo; titulo: string; descricao: string; icone: typeof FolderOpen }[] = [
  { chave: "processos", titulo: "Processos", descricao: "Acervo, fluxo, movimentação e situação", icone: FolderOpen },
  { chave: "presos-provisorios", titulo: "Presos Provisórios", descricao: "Custódias ativas por tipo de prisão", icone: Lock },
  {
    chave: "sem-movimentacao",
    titulo: "+100 dias sem movimentação",
    descricao: "Somente processos com contagem ativa",
    icone: PauseCircle,
  },
  { chave: "audiencias", titulo: "Audiências", descricao: "Pauta, situação, tipo e modalidade", icone: CalendarDays },
  { chave: "comparecimentos", titulo: "Comparecimentos", descricao: "Vencidos, próximos e regulares", icone: ClipboardCheck },
  { chave: "pendencias", titulo: "Pendências", descricao: "Abertas, atrasadas e concluídas", icone: ClipboardList },
  {
    chave: "prioridades",
    titulo: "Prioridades e Alertas",
    descricao: "Mesma consolidação da Central de Prioridades",
    icone: AlertTriangle,
  },
];

const NIVEIS: { v: Exclude<NivelAtencaoBeta, "administrativo">; r: string }[] = [
  { v: "critico", r: "Crítico" },
  { v: "urgente", r: "Urgente" },
  { v: "atencao", r: "Atenção" },
  { v: "conferir", r: "Conferir" },
  { v: "informativo", r: "Informativo" },
];

const ORIGENS = ["Automático", "Manual", "Etiqueta"] as const;
const MODULOS_ALERTA = ["Processos", "Presos Provisórios", "Audiências", "Pendências", "Comparecimentos"] as const;

export const Route = createFileRoute("/_authenticated/relatorios")({
  validateSearch: (s: Record<string, unknown>): { tipo?: Tipo } => {
    const t = s["tipo"];
    return RELATORIOS.some((r) => r.chave === t) ? { tipo: t as Tipo } : {};
  },
  beforeLoad: ({ context }) => {
    if (!pode(context.sessao.perfil, "relatorios")) throw redirect({ to: "/" });
  },
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(processosResumoQuery()),
      context.queryClient.ensureQueryData(presosQuery()),
      context.queryClient.ensureQueryData(comparecimentosQuery()),
    ]),
  head: () => ({
    meta: [
      { title: "Relatórios — Gestão da Vara Criminal" },
      { name: "description", content: "Relatórios administrativos da serventia com exportação em CSV." },
      { property: "og:title", content: "Relatórios — Gestão da Vara Criminal" },
      { property: "og:description", content: "Relatórios administrativos da serventia com exportação em CSV." },
    ],
  }),
  component: Pagina,
});

const fmt = (iso: string | null | undefined) =>
  iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—";

interface Coluna {
  titulo: string;
}

type Linha = {
  chave: string;
  processoId?: string | null;
  celulas: (string | number)[];
  destaque?: "urgente" | "atencao" | "sucesso" | undefined;
};

function exportarCSV(nome: string, colunas: Coluna[], linhas: Linha[]) {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const conteudo = [
    colunas.map((c) => esc(c.titulo)).join(";"),
    ...linhas.map((l) => l.celulas.map(esc).join(";")),
  ].join("\r\n");
  const blob = new Blob(["\uFEFF" + conteudo], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `relatorio-${nome}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function Pagina() {
  const { tipo } = Route.useSearch();
  const navigate = useNavigate({ from: "/relatorios" });
  const { data: processos } = useSuspenseQuery(processosResumoQuery());
  const { data: presos } = useSuspenseQuery(presosQuery());
  const { data: comparecimentos } = useSuspenseQuery(comparecimentosQuery());
  const atual = RELATORIOS.find((r) => r.chave === tipo);

  return (
    <div className="space-y-6">
      <Cabecalho
        titulo="Relatórios"
        subtitulo="Consultas administrativas consolidadas a partir dos módulos atuais do sistema"
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {RELATORIOS.map((r) => (
          <button
            key={r.chave}
            onClick={() => navigate({ search: { tipo: r.chave } })}
            className={cn(
              "flex items-start gap-3 rounded-lg border bg-card p-4 text-left shadow-card hover:shadow-card-hover",
              tipo === r.chave ? "border-primary ring-1 ring-primary" : "border-border",
            )}
          >
            <r.icone className="mt-0.5 size-5 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-semibold text-foreground">{r.titulo}</p>
              <p className="text-xs text-muted-foreground">{r.descricao}</p>
            </div>
          </button>
        ))}
      </div>

      {atual ? (
        <Relatorio
          key={atual.chave}
          tipo={atual.chave}
          titulo={atual.titulo}
          processos={processos}
          presos={presos as unknown as ReuPresoBeta[]}
          comparecimentos={comparecimentos as Comparecimento[]}
        />
      ) : (
        <p className="text-sm text-muted-foreground">Selecione um relatório acima.</p>
      )}
    </div>
  );
}

function Sel({
  rotulo,
  valor,
  set,
  opcoes,
}: {
  rotulo: string;
  valor: string;
  set: (v: string) => void;
  opcoes: readonly string[] | readonly { v: string; r: string }[];
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      {rotulo}
      <select
        className={CLASSE_CAMPO}
        value={valor}
        onChange={(e) => set(e.target.value)}
        aria-label={rotulo}
      >
        <option value="">Todos</option>
        {opcoes.map((o) =>
          typeof o === "string" ? (
            <option key={o} value={o}>{o}</option>
          ) : (
            <option key={o.v} value={o.v}>{o.r}</option>
          ),
        )}
      </select>
    </label>
  );
}

function Data({
  rotulo,
  valor,
  set,
}: {
  rotulo: string;
  valor: string;
  set: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      {rotulo}
      <input
        type="date"
        className={CLASSE_CAMPO}
        value={valor}
        onChange={(e) => set(e.target.value)}
        aria-label={rotulo}
      />
    </label>
  );
}

const noPeriodo = (d: string | null, de: string, ate: string) =>
  (!de || (d !== null && d >= de)) && (!ate || (d !== null && d <= ate));

const tipoCustodia = (p: ReuPresoBeta) =>
  p.especie_cautelar?.trim() ? tipoPrisaoDe(p.especie_cautelar) : p.tipo_prisao;

function Relatorio({
  tipo,
  titulo,
  processos,
  presos,
  comparecimentos,
}: {
  tipo: Tipo;
  titulo: string;
  processos: ProcessoCompleto[];
  presos: ReuPresoBeta[];
  comparecimentos: Comparecimento[];
}) {
  const [f, setF] = useState<Record<string, string>>({});
  const v = (k: string) => f[k] ?? "";
  const s = (k: string) => (x: string) => setF((p) => ({ ...p, [k]: x }));

  const classes = useMemo(
    () => [...new Set(processos.map((p) => p.classe).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [processos],
  );
  const numeros = useMemo(
    () => processos.map((p) => p.numero).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [processos],
  );
  const processoIds = useMemo(
    () => [...new Set(processos.map((p) => p.id))],
    [processos],
  );
  const reuIds = useMemo(() => presos.map((p) => p.id), [presos]);

  const etiquetas = useQuery(etiquetasDosProcessosQuery(processoIds));
  const auxiliares = useQuery(dadosAuxiliaresAlertasBetaQuery(reuIds));
  const ocultos = useQuery(alertasOcultosBetaQuery());
  const etiquetasPorProcesso = etiquetas.data ?? {};

  const etiquetasDo = (processoId: string) =>
    (etiquetasPorProcesso[processoId] ?? []).map((e) => e.nome).join(" · ") || "—";

  const tiposCustodia = useMemo(
    () =>
      [...new Set(presos.map(tipoCustodia).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, "pt-BR")),
    [presos],
  );

  const comparecimentosPreparados = useMemo(
    () => preparar(comparecimentos),
    [comparecimentos],
  );

  const gruposPrioridade = useMemo(() => {
    const itens = montarItensAtencaoBeta({
      processos,
      presos,
      comparecimentos,
      etiquetasPorProcesso,
      auxiliares: auxiliares.data ?? DADOS_VAZIOS_ALERTAS_BETA,
    });
    const chavesOcultas = new Set(ocultos.data ?? []);
    return agruparItensAtencaoBeta(
      itens.filter(
        (item) =>
          item.nivel !== "administrativo" &&
          !chavesOcultas.has(chaveOcultacaoAlertaBeta(item)),
      ),
    );
  }, [
    processos,
    presos,
    comparecimentos,
    etiquetasPorProcesso,
    auxiliares.data,
    ocultos.data,
  ]);

  let filtros: ReactNode = null;
  let colunas: string[] = [];
  let linhas: Linha[] = [];
  let nota: string | null = null;

  if (tipo === "processos") {
    filtros = (
      <>
        <Data rotulo="Distribuição de" valor={v("de")} set={s("de")} />
        <Data rotulo="Distribuição até" valor={v("ate")} set={s("ate")} />
        <Sel rotulo="Status" valor={v("status")} set={s("status")} opcoes={STATUS_PROCESSO} />
        <Sel rotulo="Classe" valor={v("classe")} set={s("classe")} opcoes={classes} />
        <Sel
          rotulo="Situação prisional"
          valor={v("prisao")}
          set={s("prisao")}
          opcoes={[
            { v: "preso", r: "Com preso provisório" },
            { v: "solto", r: "Sem preso provisório" },
          ]}
        />
      </>
    );
    colunas = [
      "Processo",
      "Etiquetas",
      "Classe",
      "Assunto",
      "Status",
      "Fluxo atual",
      "Distribuição",
      "Última movimentação",
      "Dias sem movimentação",
    ];
    linhas = processos
      .filter((p) => noPeriodo(p.data_distribuicao, v("de"), v("ate")))
      .filter((p) => !v("status") || p.status === v("status"))
      .filter((p) => !v("classe") || p.classe === v("classe"))
      .filter(
        (p) =>
          !v("prisao") ||
          (v("prisao") === "preso") === p.reus.some((r) => r.preso),
      )
      .sort((a, b) => a.numero.localeCompare(b.numero))
      .map((p) => {
        const u = ultimaMovimentacao(p);
        return {
          chave: p.id,
          processoId: p.id,
          celulas: [
            p.numero,
            etiquetasDo(p.id),
            p.classe,
            p.assunto || "—",
            p.status,
            rotuloFluxo(p),
            fmt(p.data_distribuicao),
            u ? `${fmt(u.data)} — ${u.descricao}` : "—",
            diasSemMovimentacao(p) ?? "—",
          ],
        };
      });
  } else if (tipo === "presos-provisorios") {
    filtros = (
      <Sel
        rotulo="Tipo de prisão"
        valor={v("tipoPrisao")}
        set={s("tipoPrisao")}
        opcoes={tiposCustodia}
      />
    );
    colunas = [
      "Processo",
      "Etiquetas",
      "Preso provisório",
      "Situação",
      "Tipo de prisão",
      "Data da prisão",
    ];
    linhas = presos
      .filter((p) => !v("tipoPrisao") || tipoCustodia(p) === v("tipoPrisao"))
      .sort(
        (a, b) =>
          (a.processos?.numero ?? "").localeCompare(b.processos?.numero ?? "") ||
          a.nome.localeCompare(b.nome, "pt-BR"),
      )
      .map((p) => ({
        chave: p.id,
        processoId: p.processo_id,
        celulas: [
          p.processos?.numero ?? "Não vinculado",
          p.processo_id ? etiquetasDo(p.processo_id) : "—",
          p.nome,
          p.situacao || "—",
          tipoCustodia(p) || "—",
          fmt(p.data_prisao),
        ],
      }));
  } else if (tipo === "sem-movimentacao") {
    const lim = CONFIG_PRIORIDADES.limiteDiasSemMovimentacao;
    nota =
      `Somente processos com mais de ${lim} dias e contagem ativa. Processos em arquivo provisório/definitivo, suspensos para aguardar ou aguardando instância superior permanecem fora deste alerta.`;
    colunas = [
      "Processo",
      "Etiquetas",
      "Réu",
      "Fluxo atual",
      "Última movimentação",
      "Data",
      "Dias sem movimentação",
    ];
    linhas = processos
      .map((p) => ({
        p,
        d: diasSemMovimentacao(p),
        u: ultimaMovimentacao(p),
        contagem100: estadoContagem100Dias(p),
      }))
      .filter(
        (x) =>
          !x.contagem100.pausada &&
          x.d !== null &&
          x.d > lim,
      )
      .sort((a, b) => (b.d ?? 0) - (a.d ?? 0))
      .map(({ p, d, u }) => ({
        chave: p.id,
        processoId: p.id,
        destaque: "atencao" as const,
        celulas: [
          p.numero,
          etiquetasDo(p.id),
          reuPrincipal(p)?.nome ?? "—",
          rotuloFluxo(p),
          u?.descricao ?? "—",
          fmt(u?.data),
          d ?? "—",
        ],
      }));
  } else if (tipo === "audiencias") {
    filtros = (
      <>
        <Data rotulo="Data de" valor={v("de")} set={s("de")} />
        <Data rotulo="Data até" valor={v("ate")} set={s("ate")} />
        <Sel rotulo="Processo" valor={v("numero")} set={s("numero")} opcoes={numeros} />
        <Sel rotulo="Tipo" valor={v("tipoAud")} set={s("tipoAud")} opcoes={TIPOS_AUDIENCIA} />
        <Sel rotulo="Modalidade" valor={v("modalidade")} set={s("modalidade")} opcoes={MODALIDADES} />
        <Sel rotulo="Status" valor={v("situacao")} set={s("situacao")} opcoes={SITUACOES_AUDIENCIA} />
      </>
    );
    colunas = [
      "Data",
      "Horário",
      "Processo",
      "Etiquetas",
      "Réu",
      "Tipo",
      "Modalidade",
      "Status",
    ];
    linhas = listarAudienciasDe(processos)
      .filter((a) => noPeriodo(a.data, v("de"), v("ate")))
      .filter((a) => !v("numero") || a.numero === v("numero"))
      .filter((a) => !v("tipoAud") || a.tipo === v("tipoAud"))
      .filter((a) => !v("modalidade") || a.modalidade === v("modalidade"))
      .filter((a) => !v("situacao") || a.situacao === v("situacao"))
      .map((a) => ({
        chave: a.id,
        processoId: a.processo_id,
        celulas: [
          fmt(a.data),
          horaCurta(a.horario),
          a.numero,
          etiquetasDo(a.processo_id),
          a.reu,
          a.tipo,
          a.modalidade,
          a.situacao,
        ],
      }));
  } else if (tipo === "comparecimentos") {
    filtros = (
      <>
        <Sel
          rotulo="Situação"
          valor={v("situacaoComp")}
          set={s("situacaoComp")}
          opcoes={SITUACOES_COMP.map((x) => ({ v: x.chave, r: x.rotulo }))}
        />
        <Sel
          rotulo="Cadastro"
          valor={v("cadastroComp")}
          set={s("cadastroComp")}
          opcoes={[
            { v: "Ativo", r: "Ativo" },
            { v: "Encerrado", r: "Encerrado" },
          ]}
        />
      </>
    );
    colunas = [
      "Pessoa",
      "Processo",
      "Etiquetas",
      "Último comparecimento",
      "Próximo comparecimento",
      "Situação",
      "Periodicidade",
      "Cadastro",
    ];
    linhas = comparecimentosPreparados
      .filter((c) => !v("situacaoComp") || c.status === v("situacaoComp"))
      .filter((c) => !v("cadastroComp") || c.situacao === v("cadastroComp"))
      .map((c) => ({
        chave: c.id,
        processoId: c.processo_id,
        destaque:
          c.situacao !== "Encerrado" && c.status === "vencido"
            ? ("urgente" as Linha["destaque"])
            : undefined,
        celulas: [
          c.pessoa,
          c.numero,
          c.processo_id ? etiquetasDo(c.processo_id) : "—",
          fmt(c.ultimo),
          fmt(c.proximo),
          SITUACOES_COMP.find((x) => x.chave === c.status)?.rotulo ?? c.status,
          c.periodicidade,
          c.situacao,
        ],
      }));
  } else if (tipo === "pendencias") {
    const todas = listarPendenciasDe(processos);
    const visao = v("visao") || "abertas";
    filtros = (
      <div className="flex flex-wrap items-end gap-1" role="group" aria-label="Situação">
        {[
          ["abertas", "Abertas", todas.filter((p) => !p.concluidaFlag).length],
          ["atrasadas", "Atrasadas", todas.filter((p) => p.atrasada).length],
          ["concluidas", "Concluídas", todas.filter((p) => p.concluidaFlag).length],
        ].map(([k, r, n]) => (
          <button
            key={String(k)}
            onClick={() => s("visao")(String(k))}
            className={cn(
              "h-9 rounded-md border px-3 text-sm",
              visao === k
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background hover:bg-muted",
            )}
          >
            {r} ({n})
          </button>
        ))}
      </div>
    );
    colunas = [
      "Pendência",
      "Processo",
      "Etiquetas",
      "Responsável",
      "Prioridade",
      "Prazo",
      "Status",
    ];
    linhas = todas
      .filter((p) =>
        visao === "atrasadas"
          ? p.atrasada
          : visao === "concluidas"
            ? p.concluidaFlag
            : !p.concluidaFlag,
      )
      .map((p) => ({
        chave: p.id,
        processoId: p.processo_id,
        destaque: p.atrasada
          ? ("urgente" as Linha["destaque"])
          : p.concluidaFlag
            ? ("sucesso" as Linha["destaque"])
            : undefined,
        celulas: [
          p.titulo || p.descricao,
          p.numero,
          etiquetasDo(p.processo_id),
          p.responsavel || "—",
          rotuloPrioridade(p.prioridade),
          fmt(p.prazo),
          p.atrasada ? `${p.status} (atrasada)` : p.status,
        ],
      }));
  } else {
    filtros = (
      <>
        <Sel rotulo="Nível" valor={v("nivel")} set={s("nivel")} opcoes={NIVEIS} />
        <Sel rotulo="Origem" valor={v("origem")} set={s("origem")} opcoes={ORIGENS} />
        <Sel rotulo="Módulo" valor={v("modulo")} set={s("modulo")} opcoes={MODULOS_ALERTA} />
      </>
    );
    nota =
      "Uma linha por processo, considerando o nível mais alto entre os motivos ativos, com as mesmas ocultações e consolidação da Central de Prioridades e Alertas.";

    const filtrados = filtrarGruposAtencaoBeta(gruposPrioridade, {
      nivel: v("nivel"),
      origem: v("origem"),
      modulo: v("modulo"),
    });

    colunas = [
      "Processo",
      "Etiquetas",
      "Pessoa",
      "Nível",
      "Origem",
      "Módulo",
      "Motivos ativos",
    ];
    linhas = filtrados.map((grupo) => ({
      chave: grupo.id,
      processoId: grupo.processoId,
      destaque:
        grupo.nivel === "critico"
          ? ("urgente" as Linha["destaque"])
          : undefined,
      celulas: [
        grupo.processoNumero ?? "Não vinculado",
        grupo.processoId ? etiquetasDo(grupo.processoId) : "—",
        grupo.pessoa ?? "—",
        NIVEIS.find((n) => n.v === grupo.nivel)?.r ?? grupo.nivel,
        [...new Set(grupo.motivos.map((m) => m.origem))].join(" · "),
        [...new Set(grupo.motivos.map((m) => m.modulo))].join(" · "),
        grupo.motivos.map((m) => m.titulo).join("; "),
      ],
    }));
  }

  const cols = colunas.map((t) => ({ titulo: t }));
  const carregandoDadosPrioridade =
    tipo === "prioridades" &&
    (etiquetas.isLoading || auxiliares.isLoading || ocultos.isLoading);

  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-4 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-foreground">
          Relatório: {titulo}{" "}
          <span className="text-sm font-normal text-muted-foreground">
            ({carregandoDadosPrioridade ? "…" : linhas.length} registro{linhas.length === 1 ? "" : "s"})
          </span>
        </h2>

        <div className="flex gap-2">
          {Object.values(f).some(Boolean) && tipo !== "pendencias" ? (
            <button
              className="h-9 rounded-md border border-border px-3 text-sm hover:bg-muted"
              onClick={() => setF({})}
            >
              Limpar filtros
            </button>
          ) : null}

          <button
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            disabled={linhas.length === 0 || carregandoDadosPrioridade}
            onClick={() => exportarCSV(tipo, cols, linhas)}
          >
            <Download className="size-4" /> Exportar CSV
          </button>
        </div>
      </div>

      {filtros ? <div className="flex flex-wrap items-end gap-3">{filtros}</div> : null}
      {nota ? <p className="text-xs text-muted-foreground">{nota}</p> : null}

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              {colunas.map((c) => (
                <th key={c} className="px-3 py-2 font-medium">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {carregandoDadosPrioridade ? (
              <tr>
                <td colSpan={colunas.length} className="px-3 py-6 text-center text-muted-foreground">
                  Consolidando prioridades e alertas…
                </td>
              </tr>
            ) : linhas.length === 0 ? (
              <tr>
                <td colSpan={colunas.length} className="px-3 py-6 text-center text-muted-foreground">
                  Nenhum registro para os filtros aplicados.
                </td>
              </tr>
            ) : (
              linhas.map((l) => (
                <tr
                  key={l.chave}
                  className={cn(
                    "border-t border-border",
                    l.destaque === "urgente" && "bg-urgente-suave",
                    l.destaque === "sucesso" && "text-muted-foreground",
                  )}
                >
                  {l.celulas.map((c, i) => (
                    <td
                      key={i}
                      className={cn(
                        "px-3 py-2",
                        l.destaque === "atencao" &&
                          i === l.celulas.length - 1 &&
                          "font-semibold text-atencao",
                      )}
                    >
                      {i === colunas.indexOf("Processo") && l.processoId ? (
                        <Link
                          to="/processos/$id"
                          params={{ id: l.processoId }}
                          className="font-medium text-primary hover:underline"
                        >
                          {c}
                        </Link>
                      ) : colunas[i] === "Etiquetas" && l.processoId ? (
                        (etiquetasPorProcesso[l.processoId] ?? []).length ? (
                          <div className="flex flex-wrap gap-1">
                            {(etiquetasPorProcesso[l.processoId] ?? []).map((e) => (
                              <EtiquetaProcesso
                                key={e.id}
                                processoId={l.processoId!}
                                etiqueta={e}
                              />
                            ))}
                          </div>
                        ) : (
                          "—"
                        )
                      ) : (
                        c
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
