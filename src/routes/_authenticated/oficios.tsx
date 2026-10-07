import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  CalendarDays,
  FileText,
  Pencil,
  Plus,
  Search,
  Send,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Cabecalho, EstadoVazio } from "@/components/ui-serventia/Cabecalho";
import { CLASSE_CAMPO, Campo } from "@/components/processos/campos";
import { SeletorProcesso } from "@/components/processos/SeletorProcesso";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePode } from "@/lib/sessao";
import {
  atualizarOficio,
  criarOficio,
  oficiosQuery,
  removerOficio,
  type Oficio,
  type OficioEntrada,
} from "@/lib/oficios";
import { hojeISO } from "@/lib/processos/modelo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/oficios")({
  loader: ({ context }) => context.queryClient.ensureQueryData(oficiosQuery()),
  head: () => ({
    meta: [
      { title: "Ofícios — Gestão da Vara Criminal" },
      {
        name: "description",
        content: "Controle anual de expedição de ofícios da serventia.",
      },
    ],
  }),
  errorComponent: ({ error }) => (
    <EstadoVazio titulo="Erro ao carregar ofícios" descricao={error.message} />
  ),
  component: Pagina,
});

const BOTAO =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60";
const BOTAO_SEC =
  "inline-flex h-8 items-center justify-center gap-1 rounded-md border border-border bg-background px-3 text-xs font-medium hover:bg-muted disabled:opacity-60";

const fmt = (iso: string) => iso.split("-").reverse().join("/");

const normalizar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

function Pagina() {
  const { data: oficios } = useSuspenseQuery(oficiosQuery());
  const qc = useQueryClient();
  const podeEditar = usePode("editar");
  const anoAtual = Number(hojeISO().slice(0, 4));
  const anos = useMemo(
    () =>
      [...new Set([anoAtual, ...oficios.map((o) => o.ano)])].sort(
        (a, b) => b - a,
      ),
    [anoAtual, oficios],
  );

  const [ano, setAno] = useState(anoAtual);
  const [busca, setBusca] = useState("");
  const [edicao, setEdicao] = useState<Oficio | "novo" | null>(null);

  const doAno = useMemo(
    () => oficios.filter((o) => o.ano === ano),
    [oficios, ano],
  );

  const filtrados = useMemo(() => {
    const termo = normalizar(busca.trim());
    if (!termo) return doAno;
    return doAno.filter((o) =>
      normalizar(
        [
          o.numero,
          o.processos?.numero ?? "",
          o.destinatario,
          o.finalidade,
        ].join(" "),
      ).includes(termo),
    );
  }, [doAno, busca]);

  const ultimo = doAno[0] ?? null;
  const mesAtual = hojeISO().slice(0, 7);
  const nesteMes =
    ano === anoAtual
      ? doAno.filter((o) => o.data_expedicao.startsWith(mesAtual)).length
      : 0;
  const destinatarios = new Set(
    doAno.map((o) => normalizar(o.destinatario.trim())).filter(Boolean),
  ).size;

  async function recarregar() {
    await qc.invalidateQueries({ queryKey: ["oficios"] });
  }

  async function excluir(oficio: Oficio) {
    if (
      !window.confirm(
        `Excluir o ofício ${oficio.numero}? O número não será reutilizado.`,
      )
    )
      return;
    try {
      await removerOficio(oficio.id);
      await recarregar();
      toast.success("Ofício excluído. A numeração permanece reservada.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível excluir.");
    }
  }

  return (
    <div className="space-y-6">
      <Cabecalho
        titulo="Controle de Ofícios"
        subtitulo="Numeração anual automática e registro de expedições da serventia"
        acao={
          podeEditar ? (
            <button className={BOTAO} onClick={() => setEdicao("novo")}>
              <Plus className="size-4" /> Novo ofício
            </button>
          ) : undefined
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador
          icone={FileText}
          rotulo="Último ofício"
          valor={ultimo?.numero ?? "Nenhum"}
          sub={ultimo ? fmt(ultimo.data_expedicao) : `Ano ${ano}`}
        />
        <Indicador
          icone={Send}
          rotulo="Expedidos no ano"
          valor={String(doAno.length)}
          sub={String(ano)}
        />
        <Indicador
          icone={CalendarDays}
          rotulo={ano === anoAtual ? "Neste mês" : "Ano selecionado"}
          valor={String(ano === anoAtual ? nesteMes : doAno.length)}
          sub={ano === anoAtual ? "Expedições no mês atual" : `Registros de ${ano}`}
        />
        <Indicador
          icone={Users}
          rotulo="Destinatários"
          valor={String(destinatarios)}
          sub="Destinatários distintos no ano"
        />
      </section>

      <section className="rounded-lg border border-border bg-card p-4 shadow-card">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Ano
              <select
                className={cn(CLASSE_CAMPO, "min-w-28")}
                value={ano}
                onChange={(e) => setAno(Number(e.target.value))}
              >
                {anos.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex min-w-[260px] flex-1 flex-col gap-1 text-xs text-muted-foreground">
              Pesquisar
              <span className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <input
                  className={cn(CLASSE_CAMPO, "pl-8")}
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Ofício, processo, destinatário ou finalidade..."
                />
              </span>
            </label>
          </div>

          <p className="text-xs text-muted-foreground">
            {filtrados.length} registro{filtrados.length === 1 ? "" : "s"}
          </p>
        </div>

        <div className="mt-4 overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Ofício</th>
                <th className="px-3 py-2 font-medium">Data</th>
                <th className="px-3 py-2 font-medium">Processo</th>
                <th className="px-3 py-2 font-medium">Destinatário</th>
                <th className="px-3 py-2 font-medium">Finalidade / observação</th>
                {podeEditar ? (
                  <th className="px-3 py-2 text-right font-medium">Ações</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((o) => (
                <tr key={o.id} className="border-t border-border align-top">
                  <td className="px-3 py-3">
                    <span className="font-semibold tabular-nums text-primary">
                      {o.numero}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    {fmt(o.data_expedicao)}
                  </td>
                  <td className="px-3 py-3">
                    {o.processo_id && o.processos?.numero ? (
                      <Link
                        to="/processos/$id"
                        params={{ id: o.processo_id }}
                        className="numero-processo font-medium text-primary hover:underline"
                      >
                        {o.processos.numero}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="max-w-[260px] px-3 py-3">
                    <span className="font-medium">{o.destinatario}</span>
                  </td>
                  <td className="max-w-[380px] px-3 py-3 text-muted-foreground">
                    {o.finalidade}
                  </td>
                  {podeEditar ? (
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          className={BOTAO_SEC}
                          onClick={() => setEdicao(o)}
                        >
                          <Pencil className="size-3.5" /> Editar
                        </button>
                        <button
                          className={cn(BOTAO_SEC, "text-urgente")}
                          onClick={() => excluir(o)}
                        >
                          <Trash2 className="size-3.5" /> Excluir
                        </button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
              {!filtrados.length ? (
                <tr>
                  <td
                    colSpan={podeEditar ? 6 : 5}
                    className="px-3 py-8 text-center text-muted-foreground"
                  >
                    Nenhum ofício encontrado para este ano e filtros.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <Dialog open={!!edicao} onOpenChange={(aberto) => !aberto && setEdicao(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {edicao === "novo" ? "Novo ofício" : `Editar ofício ${edicao?.numero}`}
            </DialogTitle>
          </DialogHeader>
          {edicao ? (
            <FormOficio
              oficio={edicao === "novo" ? null : edicao}
              onSalvar={async (entrada) => {
                if (edicao === "novo") {
                  await criarOficio(entrada);
                  toast.success("Ofício cadastrado com numeração automática.");
                } else {
                  await atualizarOficio(edicao.id, edicao.ano, entrada);
                  toast.success("Ofício atualizado.");
                }
                await recarregar();
                setEdicao(null);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Indicador({
  icone: Icone,
  rotulo,
  valor,
  sub,
}: {
  icone: typeof FileText;
  rotulo: string;
  valor: string;
  sub: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {rotulo}
        </p>
        <Icone className="size-4 text-primary" />
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
        {valor}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

function FormOficio({
  oficio,
  onSalvar,
}: {
  oficio: Oficio | null;
  onSalvar: (entrada: OficioEntrada) => Promise<void>;
}) {
  const [v, setV] = useState<OficioEntrada>({
    processo_id: oficio?.processo_id ?? null,
    data_expedicao: oficio?.data_expedicao ?? hojeISO(),
    destinatario: oficio?.destinatario ?? "",
    finalidade: oficio?.finalidade ?? "",
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const anoData = Number(v.data_expedicao.slice(0, 4));

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!v.data_expedicao || !v.destinatario.trim() || !v.finalidade.trim()) {
          setErro("Informe a data, o destinatário e a finalidade.");
          return;
        }
        setSalvando(true);
        setErro("");
        try {
          await onSalvar(v);
        } catch (e) {
          setErro(e instanceof Error ? e.message : "Não foi possível salvar o ofício.");
          setSalvando(false);
        }
      }}
    >
      <div className="rounded-md border border-info/25 bg-info-suave p-3 text-sm text-info">
        {oficio ? (
          <>
            Número reservado: <strong>{oficio.numero}</strong>. A edição não altera a
            numeração.
          </>
        ) : (
          <>
            O número será gerado automaticamente ao salvar. Pela data informada, ele
            pertencerá à sequência de <strong>{anoData || "—"}</strong>.
          </>
        )}
      </div>

      <Campo rotulo="Processo (opcional)">
        <SeletorProcesso
          value={v.processo_id ?? ""}
          onChange={(id) => setV({ ...v, processo_id: id || null })}
        />
      </Campo>

      <div className="grid gap-3 md:grid-cols-2">
        <Campo rotulo="Data de expedição">
          <input
            type="date"
            className={CLASSE_CAMPO}
            value={v.data_expedicao}
            onChange={(e) => setV({ ...v, data_expedicao: e.target.value })}
          />
        </Campo>

        <Campo rotulo="Destinatário">
          <input
            className={CLASSE_CAMPO}
            value={v.destinatario}
            onChange={(e) => setV({ ...v, destinatario: e.target.value })}
            placeholder="Ex.: DT Coração de Maria, SEAP, CEDEP..."
          />
        </Campo>
      </div>

      <Campo rotulo="Finalidade / observação">
        <textarea
          className={cn(CLASSE_CAMPO, "h-24 py-2")}
          value={v.finalidade}
          onChange={(e) => setV({ ...v, finalidade: e.target.value })}
          placeholder="Ex.: Solicitação de antecedentes criminais; apresentação de testemunha; remessa..."
        />
      </Campo>

      {erro ? <p className="text-sm text-urgente">{erro}</p> : null}

      <div className="flex justify-end">
        <button className={BOTAO} disabled={salvando}>
          {salvando ? "Salvando…" : oficio ? "Salvar alterações" : "Gerar e cadastrar ofício"}
        </button>
      </div>
    </form>
  );
}
