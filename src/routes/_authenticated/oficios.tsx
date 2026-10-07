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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePode } from "@/lib/sessao";
import {
  atualizarControleOficio,
  controleOficiosQuery,
  criarControleOficio,
  dataDoControleOficio,
  formatarNumeroOficio,
  numeroDoControleOficio,
  removerControleOficio,
  type ControleOficio,
  type ControleOficioEntrada,
} from "@/lib/controle-oficios";
import { hojeISO } from "@/lib/processos/modelo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/oficios")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(controleOficiosQuery()),
  errorComponent: ({ error }) => (
    <EstadoVazio
      titulo="Não foi possível carregar o controle de ofícios"
      descricao={error.message}
    />
  ),
  head: () => ({
    meta: [
      { title: "Ofícios — Gestão da Vara Criminal" },
      {
        name: "description",
        content: "Controle anual de expedição de ofícios da serventia.",
      },
    ],
  }),
  component: Pagina,
});

const BOTAO =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60";
const BOTAO_SEC =
  "inline-flex h-8 items-center justify-center gap-1 rounded-md border border-border bg-background px-3 text-xs font-medium hover:bg-muted disabled:opacity-60";

const normalizar = (valor: string) =>
  valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

function Pagina() {
  const { data: oficios } = useSuspenseQuery(controleOficiosQuery());
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
  const [edicao, setEdicao] = useState<ControleOficio | "novo" | null>(null);

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
          numeroDoControleOficio(o),
          o.processos?.numero ?? o.processo_original ?? "",
          o.destinatario,
          o.finalidade,
        ].join(" "),
      ).includes(termo),
    );
  }, [doAno, busca]);

  const maiorSequencial = doAno.reduce(
    (maior, oficio) =>
      oficio.sequencial !== null ? Math.max(maior, oficio.sequencial) : maior,
    0,
  );
  const mesAtual = hojeISO().slice(0, 7);
  const nesteMes =
    ano === anoAtual
      ? doAno.filter((o) => o.data_expedicao?.startsWith(mesAtual)).length
      : 0;
  const destinatarios = new Set(
    doAno.map((o) => normalizar(o.destinatario.trim())).filter(Boolean),
  ).size;

  async function recarregar() {
    await qc.invalidateQueries({ queryKey: ["controle-oficios"] });
  }

  async function excluir(oficio: ControleOficio) {
    if (oficio.historico_importado) {
      toast.error("O histórico importado é preservado como consta na planilha original.");
      return;
    }
    const numero = numeroDoControleOficio(oficio);
    if (
      !window.confirm(
        `Excluir o ofício ${numero}? A sequência não será retrocedida e esse número não será reutilizado.`,
      )
    )
      return;

    try {
      await removerControleOficio(oficio.id);
      await recarregar();
      toast.success("Ofício excluído. A numeração permanece reservada.");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Não foi possível excluir o ofício.",
      );
    }
  }

  return (
    <div className="space-y-6">
      <Cabecalho
        titulo="Controle de Ofícios"
        subtitulo="Expedições da serventia com numeração anual automática"
        acao={
          podeEditar ? (
            <button className={BOTAO} onClick={() => setEdicao("novo")}>
              <Plus className="size-4" />
              Novo ofício
            </button>
          ) : undefined
        }
      />

      <div className="rounded-lg border border-info/25 bg-info-suave px-4 py-3 text-sm text-info">
        O número é reservado automaticamente ao salvar. A sequência reinicia a
        cada ano e números excluídos não são reutilizados.
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador
          icone={FileText}
          rotulo="Maior número do ano"
          valor={
            maiorSequencial
              ? formatarNumeroOficio(maiorSequencial, ano)
              : "Nenhum"
          }
          sub={String(ano)}
        />
        <Indicador
          icone={Send}
          rotulo="Registros no ano"
          valor={String(doAno.length)}
          sub={`Controle de ${ano}`}
        />
        <Indicador
          icone={CalendarDays}
          rotulo={ano === anoAtual ? "Neste mês" : "Ano selecionado"}
          valor={String(ano === anoAtual ? nesteMes : doAno.length)}
          sub={
            ano === anoAtual
              ? "Expedições no mês atual"
              : `Expedições registradas em ${ano}`
          }
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
                {anos.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex min-w-[280px] flex-1 flex-col gap-1 text-xs text-muted-foreground">
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
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Ofício</th>
                <th className="px-3 py-2 font-medium">Data</th>
                <th className="px-3 py-2 font-medium">Processo</th>
                <th className="px-3 py-2 font-medium">Destinatário</th>
                <th className="px-3 py-2 font-medium">
                  Finalidade / observação
                </th>
                {podeEditar ? (
                  <th className="px-3 py-2 text-right font-medium">Ações</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((o) => (
                <tr key={o.id} className="border-t border-border align-top">
                  <td className="whitespace-nowrap px-3 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold tabular-nums text-primary">
                        {numeroDoControleOficio(o)}
                      </span>
                      {o.historico_importado ? (
                        <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          Histórico
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    {dataDoControleOficio(o)}
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
                    ) : o.processo_original ? (
                      <span className="numero-processo text-muted-foreground">
                        {o.processo_original}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="max-w-[260px] px-3 py-3 font-medium">
                    {o.destinatario}
                  </td>
                  <td className="max-w-[420px] px-3 py-3 text-muted-foreground">
                    {o.finalidade}
                  </td>
                  {podeEditar ? (
                    <td className="px-3 py-3">
                      {o.historico_importado ? (
                        <p className="text-right text-xs text-muted-foreground">
                          Preservado da planilha
                        </p>
                      ) : (
                        <div className="flex justify-end gap-1">
                          <button
                            className={BOTAO_SEC}
                            onClick={() => setEdicao(o)}
                          >
                            <Pencil className="size-3.5" />
                            Editar
                          </button>
                          <button
                            className={cn(BOTAO_SEC, "text-urgente")}
                            onClick={() => excluir(o)}
                          >
                            <Trash2 className="size-3.5" />
                            Excluir
                          </button>
                        </div>
                      )}
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
                    Nenhum ofício encontrado para este ano e pesquisa.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <Dialog
        open={!!edicao}
        onOpenChange={(aberto) => !aberto && setEdicao(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {edicao === "novo"
                ? "Novo ofício"
                : `Editar ofício ${numeroDoControleOficio(edicao)}`}
            </DialogTitle>
          </DialogHeader>

          {edicao ? (
            <FormOficio
              oficio={edicao === "novo" ? null : edicao}
              onSalvar={async (entrada) => {
                if (edicao === "novo") {
                  const criado = await criarControleOficio(entrada);
                  toast.success(
                    `Ofício ${formatarNumeroOficio(criado.sequencial, criado.ano)} cadastrado.`,
                  );
                } else {
                  await atualizarControleOficio(edicao, entrada);
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
  oficio: ControleOficio | null;
  onSalvar: (entrada: ControleOficioEntrada) => Promise<void>;
}) {
  const [valor, setValor] = useState<ControleOficioEntrada>({
    processo_id: oficio?.processo_id ?? null,
    data_expedicao: oficio?.data_expedicao ?? hojeISO(),
    destinatario: oficio?.destinatario ?? "",
    finalidade: oficio?.finalidade ?? "",
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();

        if (
          !valor.data_expedicao ||
          !valor.destinatario.trim() ||
          !valor.finalidade.trim()
        ) {
          setErro("Informe a data, o destinatário e a finalidade / observação.");
          return;
        }

        setSalvando(true);
        setErro("");

        try {
          await onSalvar(valor);
        } catch (e) {
          setErro(
            e instanceof Error ? e.message : "Não foi possível salvar o ofício.",
          );
          setSalvando(false);
        }
      }}
    >
      <div className="rounded-md border border-info/25 bg-info-suave p-3 text-sm text-info">
        {oficio ? (
          <>
            Número reservado:{" "}
            <strong>
              {numeroDoControleOficio(oficio)}
            </strong>
            . A edição não altera a numeração.
          </>
        ) : (
          <>
            O número será reservado automaticamente ao salvar, usando o ano da
            data de expedição.
          </>
        )}
      </div>

      <Campo rotulo="Processo (opcional)">
        <SeletorProcesso
          value={valor.processo_id ?? ""}
          onChange={(processo_id) =>
            setValor({ ...valor, processo_id: processo_id || null })
          }
        />
      </Campo>

      <div className="grid gap-3 md:grid-cols-2">
        <Campo rotulo="Data de expedição">
          <input
            type="date"
            className={CLASSE_CAMPO}
            value={valor.data_expedicao}
            onChange={(e) =>
              setValor({ ...valor, data_expedicao: e.target.value })
            }
          />
        </Campo>

        <Campo rotulo="Destinatário">
          <input
            className={CLASSE_CAMPO}
            value={valor.destinatario}
            onChange={(e) =>
              setValor({ ...valor, destinatario: e.target.value })
            }
            placeholder="Ex.: DT Coração de Maria, SEAP, CEDEP..."
          />
        </Campo>
      </div>

      <Campo rotulo="Finalidade / observação">
        <textarea
          rows={4}
          className={cn(CLASSE_CAMPO, "h-auto py-2")}
          value={valor.finalidade}
          onChange={(e) =>
            setValor({ ...valor, finalidade: e.target.value })
          }
          placeholder="Descreva de forma simples a finalidade do ofício."
        />
      </Campo>

      {erro ? <p className="text-sm text-urgente">{erro}</p> : null}

      <div className="flex justify-end">
        <button className={BOTAO} disabled={salvando}>
          {salvando
            ? "Salvando…"
            : oficio
              ? "Salvar alterações"
              : "Gerar e cadastrar ofício"}
        </button>
      </div>
    </form>
  );
}
