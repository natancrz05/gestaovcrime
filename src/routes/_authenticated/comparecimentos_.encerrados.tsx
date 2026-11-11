import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { ArrowLeft, Archive, RotateCcw } from "lucide-react";
import { Cabecalho, EstadoVazio } from "@/components/ui-serventia/Cabecalho";
import { CLASSE_CAMPO, Secao } from "@/components/processos/campos";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatarData } from "@/lib/dominio";
import { hojeISO } from "@/lib/processos/modelo";
import { usePode } from "@/lib/sessao";
import { toast } from "sonner";
import {
  comparecimentosQuery,
  comparecimentoHistoricoQuery,
  preparar,
  reativarComparecimento,
  type ComparecimentoListado,
} from "@/lib/processos/comparecimentos";

export const Route = createFileRoute("/_authenticated/comparecimentos_/encerrados")({
  validateSearch: zodValidator(z.object({ id: fallback(z.string(), "").default("") })),
  head: () => ({
    meta: [
      { title: "Comparecimentos encerrados — Gestão da Vara Criminal" },
      { name: "description", content: "Histórico de cadastros de comparecimento encerrados." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(comparecimentosQuery()),
  errorComponent: ({ error }) => (
    <EstadoVazio titulo="Erro ao carregar comparecimentos encerrados" descricao={error.message} />
  ),
  component: Pagina,
});

const BOTAO_SEC =
  "inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-muted";
const BOTAO =
  "inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60";

const normalizar = (valor: string) =>
  valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function Pagina() {
  const { data } = useSuspenseQuery(comparecimentosQuery());
  const busca = Route.useSearch();
  const navigate = Route.useNavigate();
  const hoje = hojeISO();
  const lista = useMemo(() => preparar(data, hoje), [data, hoje]);
  const encerrados = useMemo(
    () => lista.filter((comparecimento) => comparecimento.situacao === "Encerrado"),
    [lista],
  );
  const [termo, setTermo] = useState("");
  const selecionado = encerrados.find((c) => c.id === busca.id) ?? null;
  const abrir = (id: string) => navigate({ search: (anterior) => ({ ...anterior, id }) });
  const fechar = () => navigate({ search: (anterior) => ({ ...anterior, id: "" }) });
  const [reativando, setReativando] = useState(false);
  const podeEditar = usePode("editar");
  const qc = useQueryClient();


  const indiceBusca = useMemo(() => {
    const mapa = new Map<string, { texto: string; digitos: string }>();
    for (const comparecimento of encerrados) {
      const campos = [
        comparecimento.pessoa,
        comparecimento.numero,
        comparecimento.cpf,
        ...(comparecimento.numeros_informados ?? []),
        ...Object.values(comparecimento.dados_planilha ?? {}),
      ].map((valor) => String(valor ?? ""));

      mapa.set(comparecimento.id, {
        texto: normalizar(campos.join(" ")),
        digitos: campos.map((valor) => valor.replace(/\D/g, "")).join(" "),
      });
    }
    return mapa;
  }, [encerrados]);

  const exibidos = useMemo(() => {
    const t = normalizar(termo.trim());
    if (!t) return encerrados;
    const digitos = t.replace(/\D/g, "");

    return encerrados.filter((comparecimento) => {
      const indice = indiceBusca.get(comparecimento.id);
      if (!indice) return false;
      return (
        indice.texto.includes(t) ||
        (digitos.length >= 3 && indice.digitos.includes(digitos))
      );
    });
  }, [encerrados, indiceBusca, termo]);

  const historico = useQuery(comparecimentoHistoricoQuery(selecionado?.id ?? null));

  const reativar = async () => {
    if (!selecionado || reativando) return;
    if (!window.confirm(`Reativar o comparecimento de "${selecionado.pessoa}"? O histórico será preservado e o cadastro voltará para a lista de ativos.`)) return;

    setReativando(true);
    try {
      await reativarComparecimento(selecionado.id);
      await qc.invalidateQueries({ queryKey: ["comparecimentos"] });
      toast.success("Comparecimento reativado.");
      await navigate({ to: "/comparecimentos", search: { situacao: "", id: selecionado.id } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível reativar o comparecimento.");
    } finally {
      setReativando(false);
    }
  };

  return (
    <div className="space-y-6">
      <Cabecalho
        titulo="Comparecimentos encerrados"
        subtitulo={`${encerrados.length} cadastros preservados no histórico`}
        acao={
          <Link to="/comparecimentos" className={BOTAO_SEC}>
            <ArrowLeft className="size-4" /> Voltar aos ativos
          </Link>
        }
      />

      <div className="rounded-lg border border-border bg-card p-4 shadow-card">
        <div className="flex items-start gap-3">
          <Archive className="mt-0.5 size-5 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">Histórico de comparecimentos encerrados</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Estes cadastros não aparecem mais na lista operacional de comparecimentos ativos,
              mas permanecem disponíveis para consulta.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-md">
        <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="pesq-comp-encerrados">
          Pesquisar encerrados
        </label>
        <input
          id="pesq-comp-encerrados"
          type="search"
          className={CLASSE_CAMPO}
          placeholder="Nome, processo, CPF, IP ou ação penal..."
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
        />
      </div>

      <Secao titulo={`Comparecimentos encerrados (${exibidos.length})`}>
        {exibidos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum comparecimento encerrado encontrado.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[850px] table-fixed text-sm">
              <colgroup>
                <col className="w-[28%]" />
                <col className="w-[30%]" />
                <col className="w-[18%]" />
                <col className="w-[14%]" />
                <col className="w-[10%]" />
              </colgroup>
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Pessoa</th>
                  <th className="px-3 py-2 font-medium">Processo</th>
                  <th className="px-3 py-2 font-medium">Último comparecimento</th>
                  <th className="px-3 py-2 font-medium">Periodicidade</th>
                  <th className="px-3 py-2 font-medium">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {exibidos.map((comparecimento) => (
                  <tr
                    key={comparecimento.id}
                    className="cursor-pointer text-muted-foreground hover:bg-muted/40"
                    onClick={() => void abrir(comparecimento.id)}
                  >
                    <td className="break-words px-3 py-2 align-top font-medium text-foreground">
                      {comparecimento.pessoa}
                    </td>
                    <td className="break-words px-3 py-2 align-top">
                      <span className="numero-processo">{comparecimento.numero}</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 align-top">
                      {formatarData(comparecimento.ultimo)}
                    </td>
                    <td className="px-3 py-2 align-top">{comparecimento.periodicidade}</td>
                    <td className="px-3 py-2 align-top">Encerrado</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Secao>

      <Dialog open={!!selecionado} onOpenChange={(aberto) => { if (!aberto) void fechar(); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Comparecimento encerrado — {selecionado?.pessoa}</DialogTitle>
          </DialogHeader>

          {selecionado ? (
            <div className="space-y-4 text-sm">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Processo</p>
                  {selecionado.processo_id ? (
                    <Link
                      to="/processos/$id"
                      params={{ id: selecionado.processo_id }}
                      className="numero-processo font-medium text-primary hover:underline"
                    >
                      {selecionado.numero}
                    </Link>
                  ) : (
                    <p className="numero-processo">{selecionado.numero}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">CPF</p>
                  <p>{selecionado.cpf || "—"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Data de início</p>
                  <p>{formatarData(selecionado.data_inicio)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Periodicidade</p>
                  <p>{selecionado.periodicidade}</p>
                </div>
              </div>

              {selecionado.observacao ? (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Observação do cadastro</p>
                  <p className="mt-1 whitespace-pre-wrap">{selecionado.observacao}</p>
                </div>
              ) : null}

              {podeEditar ? (
                <div className="flex justify-end border-t border-border pt-3">
                  <button type="button" className={BOTAO} disabled={reativando} onClick={() => void reativar()}>
                    <RotateCcw className="size-4" />
                    {reativando ? "Reativando…" : "Reativar cadastro"}
                  </button>
                </div>
              ) : null}

              <div className="border-t border-border pt-3">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Histórico de comparecimentos
                </p>
                {historico.isLoading ? (
                  <p className="text-sm text-muted-foreground">Carregando histórico...</p>
                ) : historico.data?.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="text-left text-muted-foreground">
                        <tr>
                          <th className="py-1 pr-3 font-medium">Previsto</th>
                          <th className="py-1 pr-3 font-medium">Realizado</th>
                          <th className="py-1 pr-3 font-medium">Situação</th>
                          <th className="py-1 font-medium">Observação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {historico.data.map((registro) => (
                          <tr key={registro.id}>
                            <td className="py-1 pr-3">{formatarData(registro.data_prevista)}</td>
                            <td className="py-1 pr-3">{formatarData(registro.data_realizada)}</td>
                            <td className="py-1 pr-3">{registro.situacao}</td>
                            <td className="py-1">{registro.observacao || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhum comparecimento registrado no histórico.</p>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
