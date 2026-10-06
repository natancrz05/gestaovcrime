import { createFileRoute, Link } from "@tanstack/react-router";
import { SeletorProcesso } from "@/components/processos/SeletorProcesso";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { lazy, Suspense, useMemo, useState } from "react";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { CheckCircle2, Pencil, Plus, Upload, XCircle } from "lucide-react";
const ImportarComparecimentos = lazy(() =>
  import("@/components/processos/ImportarComparecimentos").then((modulo) => ({
    default: modulo.ImportarComparecimentos,
  })),
);
import { Cabecalho, EstadoVazio } from "@/components/ui-serventia/Cabecalho";
import { CLASSE_CAMPO, Campo, Secao } from "@/components/processos/campos";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatarData } from "@/lib/dominio";
import { hojeISO } from "@/lib/processos/modelo";
import { etiquetasDosProcessosQuery, processosReferenciaQuery } from "@/lib/processos/repositorio";
import { usePode } from "@/lib/sessao";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { EtiquetaComparecimento } from "@/components/processos/EtiquetaComparecimento";
import { EtiquetaProcesso } from "@/components/processos/EtiquetaProcesso";
import {
  SITUACOES_COMP,
  comparecimentosQuery,
  preparar,
  registrarComparecimento,
  salvarComparecimento,
  encerrarComparecimento,
  somarMeses,
  mesesDe,
  PERIODICIDADES,
  type ComparecimentoEntrada,
  type ComparecimentoListado,
  type SituacaoComparecimento,
} from "@/lib/processos/comparecimentos";

export const Route = createFileRoute("/_authenticated/comparecimentos")({
  validateSearch: zodValidator(z.object({ situacao: fallback(z.string(), "").default(""), id: fallback(z.string(), "").default("") })),
  head: () => ({
    meta: [
      { title: "Comparecimentos — Gestão da Vara Criminal" },
      { name: "description", content: "Controle de comparecimentos mensais da Vara Criminal de Coração de Maria/BA." },
      { property: "og:title", content: "Comparecimentos — Gestão da Vara Criminal" },
      { property: "og:description", content: "Controle de comparecimentos mensais da Vara Criminal de Coração de Maria/BA." },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([context.queryClient.ensureQueryData(comparecimentosQuery()), context.queryClient.ensureQueryData(processosReferenciaQuery())]),
  errorComponent: ({ error }) => <EstadoVazio titulo="Erro ao carregar comparecimentos" descricao={error.message} />,
  component: Pagina,
});

const BOTAO = "inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60";
const BOTAO_SEC = "inline-flex h-8 items-center gap-1 rounded-md border border-border bg-background px-3 text-xs font-medium hover:bg-muted";

function Pagina() {
  const { data } = useSuspenseQuery(comparecimentosQuery());
  const { data: processos } = useSuspenseQuery(processosReferenciaQuery());
  const busca = Route.useSearch();
  const navigate = Route.useNavigate();
  const hoje = hojeISO();
  const lista = useMemo(() => preparar(data, hoje), [data, hoje]);
  const ativos = useMemo(() => lista.filter((c) => c.situacao !== "Encerrado"), [lista]);
  const filtro = SITUACOES_COMP.some((s) => s.chave === busca.situacao) ? (busca.situacao as SituacaoComparecimento) : null;
  const [termo, setTermo] = useState("");
  const processoPorNumero = useMemo(() => {
    const mapa = new Map<string, string[]>();
    for (const p of processos) {
      const numero = p.numero.replace(/\D/g, "");
      if (!numero) continue;
      mapa.set(numero, [...(mapa.get(numero) ?? []), p.id]);
    }
    return mapa;
  }, [processos]);
  const processoIdEtiquetaPorComparecimento = useMemo(() => {
    const mapa = new Map<string, string | null>();
    for (const comparecimento of lista) {
      if (comparecimento.processo_id) {
        mapa.set(comparecimento.id, comparecimento.processo_id);
        continue;
      }
      const candidatos = [comparecimento.numero, ...(comparecimento.numeros_informados ?? [])]
        .map((numero) => String(numero ?? "").replace(/\D/g, ""))
        .filter(Boolean);
      const ids = [...new Set(candidatos.flatMap((numero) => processoPorNumero.get(numero) ?? []))];
      mapa.set(comparecimento.id, ids.length === 1 ? ids[0]! : null);
    }
    return mapa;
  }, [lista, processoPorNumero]);

  // Etiquetas são carregadas apenas para processos efetivamente referenciados
  // pelos comparecimentos; a lista completa continua disponível ao seletor.
  const processoIds = useMemo(
    () =>
      [...new Set([...processoIdEtiquetaPorComparecimento.values()].filter((id): id is string => Boolean(id)))],
    [processoIdEtiquetaPorComparecimento],
  );
  const { data: etiquetasPorProcesso = {} } = useQuery(etiquetasDosProcessosQuery(processoIds));
  const processoIdParaEtiquetas = (comparecimento: ComparecimentoListado) =>
    processoIdEtiquetaPorComparecimento.get(comparecimento.id) ?? null;

  const porSituacao = useMemo(
    () => (filtro ? ativos.filter((c) => c.status === filtro) : lista),
    [filtro, ativos, lista],
  );
  const indiceBusca = useMemo(() => {
    const mapa = new Map<string, { texto: string; digitos: string }>();
    for (const comparecimento of lista) {
      const campos = [
        comparecimento.pessoa,
        comparecimento.numero,
        comparecimento.cpf,
        ...(comparecimento.numeros_informados ?? []),
        ...Object.values(comparecimento.dados_planilha ?? {}),
      ].map((valor) => String(valor ?? ""));
      mapa.set(comparecimento.id, {
        texto: campos
          .map((valor) => valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase())
          .join(" "),
        digitos: campos.map((valor) => valor.replace(/\D/g, "")).join(" "),
      });
    }
    return mapa;
  }, [lista]);
  const exibidos = useMemo(() => {
    const t = termo.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    if (!t) return porSituacao;
    const d = t.replace(/\D/g, "");
    return porSituacao.filter((comparecimento) => {
      const indice = indiceBusca.get(comparecimento.id);
      if (!indice) return false;
      return indice.texto.includes(t) || (d.length >= 3 && indice.digitos.includes(d));
    });
  }, [porSituacao, termo, indiceBusca]);

  const contagensSituacao = useMemo(() => {
    const contagens = new Map<SituacaoComparecimento, number>();
    for (const comparecimento of ativos) {
      contagens.set(comparecimento.status, (contagens.get(comparecimento.status) ?? 0) + 1);
    }
    return contagens;
  }, [ativos]);
  const podeEditar = usePode("editar");
  const qc = useQueryClient();
  const recarregar = () => qc.invalidateQueries({ queryKey: ["comparecimentos"] });
  const removerSelo = async (id: string) => {
    const { error } = await supabase.from("comparecimentos").update({ conferir: false }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Selo Conferir removido");
    recarregar();
  };

  const encerrar = async (id: string) => {
    if (!window.confirm("Encerrar este comparecimento? O cadastro será mantido no histórico, mas deixará de aparecer entre os comparecimentos ativos.")) return;
    try {
      await encerrarComparecimento(id);
      toast.success("Comparecimento encerrado");
      await recarregar();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível encerrar o comparecimento.");
    }
  };

  const detalhe = lista.find((c) => c.id === busca.id) ?? null;
  const abrir = (id: string) => navigate({ search: (p) => ({ ...p, id }) });
  const [edicao, setEdicao] = useState<{ id?: string; valores: ComparecimentoEntrada } | null>(null);
  const [registro, setRegistro] = useState<ComparecimentoListado | null>(null);
  const [importar, setImportar] = useState(false);

  return (
    <div className="space-y-6">
      {podeEditar && importar ? (
        <Suspense fallback={null}>
          <ImportarComparecimentos aberto onFechar={() => setImportar(false)} onConcluir={recarregar} />
        </Suspense>
      ) : null}
      <Cabecalho
        titulo="Comparecimentos"
        subtitulo={`${ativos.length} cadastros ativos`}
        acao={podeEditar ? (
          <div className="flex flex-wrap gap-2">
          <button className={BOTAO_SEC + " h-9"} onClick={() => setImportar(true)}><Upload className="size-4" /> Importar planilha</button>
          <button className={BOTAO} onClick={() => setEdicao({ valores: { processo_id: "", pessoa: "", data_inicio: hoje, periodicidade: "Mensal", intervalo_meses: 1, proximo: somarMeses(hoje, 1), observacao: "", situacao: "Ativo" } })}>
            <Plus className="size-4" /> Novo comparecimento
          </button>
          </div>
        ) : undefined}
      />

      <section aria-label="Situações" className="grid gap-3 sm:grid-cols-3">
        {SITUACOES_COMP.map((s) => {
          const qtd = contagensSituacao.get(s.chave) ?? 0;
          const ativo = filtro === s.chave;
          return (
            <button key={s.chave} aria-pressed={ativo} onClick={() => navigate({ search: (p) => ({ ...p, situacao: ativo ? "" : s.chave }) })}
              className={cn("flex items-center justify-between rounded-lg border p-4 text-left shadow-card", ativo ? s.classe : "border-border bg-card hover:bg-muted/40")}>
              <span className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide"><span className={cn("size-2.5 rounded-full", s.ponto)} />
                {s.chave === "vencido" ? "Vencidos" : s.chave === "vencendo" ? "Vencendo em 7 dias" : "Regulares"}</span>
              <span className="text-3xl font-semibold tabular-nums">{qtd}</span>
            </button>
          );
        })}
      </section>

      <div className="max-w-md">
        <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="pesq-comp">Pesquisar comparecimentos</label>
        <input id="pesq-comp" type="search" className={CLASSE_CAMPO} placeholder="Nome, processo, CPF, IP ou ação penal..." value={termo} onChange={(e) => setTermo(e.target.value)} />
      </div>

      <Secao titulo={filtro ? `Comparecimentos — ${SITUACOES_COMP.find((s) => s.chave === filtro)!.rotulo}` : "Todos os comparecimentos"}>
        {exibidos.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum comparecimento.</p> : (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[1100px] table-fixed text-sm">
              <colgroup>
                <col className="w-[19%] min-w-[160px]" />
                <col className="w-[23%] min-w-[190px]" />
                <col className="w-[12%] min-w-[115px]" />
                <col className="w-[13%] min-w-[125px]" />
                <col className="w-[11%] min-w-[100px]" />
                <col className="w-[22%] min-w-[210px]" />
              </colgroup>
              <thead className="text-left text-xs text-muted-foreground">
                <tr>{["Pessoa", "Processo", "Último comparecimento", "Próximo comparecimento", "Situação", "Ações"].map((h) => <th key={h} className="whitespace-normal px-2 py-2 align-top font-medium">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-border">
                {exibidos.map((c) => (
                  <tr key={c.id} className={cn("cursor-pointer hover:bg-muted/40", c.situacao === "Encerrado" && "text-muted-foreground")} onClick={() => abrir(c.id)}>
                    <td className="break-words px-2 py-2 align-top leading-snug font-medium">{c.pessoa}{c.conferir ? (
                      <span className="group/selo relative ml-2 inline-flex align-middle" title={c.motivo_conferencia}>
                        <span className="rounded border border-alerta/30 bg-alerta-suave px-1.5 py-0.5 text-[10px] font-medium text-alerta">Conferir</span>
                        {podeEditar ? (
                          <button
                            type="button"
                            aria-label="Remover selo Conferir deste cadastro"
                            title="Remover o selo Conferir (os dados do cadastro são mantidos)"
                            onClick={(e) => { e.stopPropagation(); removerSelo(c.id); }}
                            className="absolute -right-1.5 -top-1.5 hidden size-3.5 items-center justify-center rounded-full border border-alerta/40 bg-background text-[9px] font-bold leading-none text-alerta group-hover/selo:flex hover:bg-alerta hover:text-primary-foreground"
                          >×</button>
                        ) : null}
                      </span>
                    ) : null}</td>
                    <td className="px-2 py-2 align-top leading-snug">
                      {(() => {
                        const processoEtiquetaId = processoIdParaEtiquetas(c);
                        const etiquetas = processoEtiquetaId ? (etiquetasPorProcesso[processoEtiquetaId] ?? []) : [];
                        return (
                          <>
                            {c.processo_id ? (
                              <span className="numero-processo break-words">{c.numero}</span>
                            ) : (
                              <>
                                Não vinculado
                                {c.numeros_informados?.length ? <span className="block break-words text-[11px]">{c.numeros_informados.join(" / ")}</span> : null}
                              </>
                            )}
                            {etiquetas.length ? (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {etiquetas.map((e) => (
                                  <EtiquetaProcesso key={e.id} processoId={processoEtiquetaId!} etiqueta={e} />
                                ))}
                              </div>
                            ) : null}
                          </>
                        );
                      })()}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 align-top leading-snug">{formatarData(c.ultimo)}</td>
                    <td className="whitespace-nowrap px-2 py-2 align-top leading-snug font-medium">{formatarData(c.proximo)}</td>
                    <td className="px-2 py-2 align-top leading-snug">{c.situacao === "Encerrado" ? "Encerrado" : <EtiquetaComparecimento s={c.status} />}</td>
                    <td className="px-2 py-2 text-right align-top" onClick={(e) => e.stopPropagation()}>
                      {podeEditar && c.situacao !== "Encerrado" ? <button className={BOTAO_SEC + " whitespace-nowrap"} onClick={() => setRegistro(c)}><CheckCircle2 className="size-3.5" /> Registrar comparecimento</button> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Secao>

      <Dialog open={!!detalhe} onOpenChange={(o) => !o && navigate({ search: (p) => ({ ...p, id: "" }) })}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Comparecimento — {detalhe?.pessoa}</DialogTitle></DialogHeader>
          {detalhe ? (
            <div className="space-y-4 text-sm">
              <p className="text-base font-semibold">Próximo comparecimento: {formatarData(detalhe.proximo)} {detalhe.situacao !== "Encerrado" ? <EtiquetaComparecimento s={detalhe.status} /> : null}</p>
              {(() => {
                const processoEtiquetaId = processoIdParaEtiquetas(detalhe);
                const etiquetas = processoEtiquetaId ? (etiquetasPorProcesso[processoEtiquetaId] ?? []) : [];
                return etiquetas.length ? (
                  <div className="flex flex-wrap gap-1">
                    {etiquetas.map((e) => (
                      <EtiquetaProcesso key={e.id} processoId={processoEtiquetaId!} etiqueta={e} />
                    ))}
                  </div>
                ) : null;
              })()}
              <dl className="grid grid-cols-2 gap-3">
                {[["Processo", detalhe.numero], ["Data de início", formatarData(detalhe.data_inicio)], ["Periodicidade", detalhe.periodicidade === "Personalizado" ? `Personalizado — a cada ${detalhe.intervalo_meses} ${detalhe.intervalo_meses === 1 ? "mês" : "meses"}` : detalhe.periodicidade], ["Cadastro", detalhe.situacao]].map(([k, v]) => (
                  <div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="font-medium">{v}</dd></div>
                ))}
                {detalhe.conferir ? <div className="col-span-2 rounded-md border border-alerta/30 bg-alerta-suave p-2 text-alerta"><dt className="text-xs font-medium">Sinalizado para conferência</dt><dd>{detalhe.motivo_conferencia || "Conferir vínculo com o processo."}{detalhe.numeros_informados?.length ? ` Números informados: ${detalhe.numeros_informados.join(" / ")}` : ""}</dd></div> : null}
                <div className="col-span-2"><dt className="text-xs text-muted-foreground">Observação</dt><dd>{detalhe.observacao || "—"}</dd></div>
              </dl>
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Histórico</p>
                {detalhe.historico.length === 0 ? <p className="text-muted-foreground">Nenhum comparecimento registrado.</p> : (
                  <table className="w-full text-xs">
                    <thead className="text-left text-muted-foreground"><tr>{["Prevista", "Realizada", "Situação", "Observação"].map((h) => <th key={h} className="py-1 pr-2 font-medium">{h}</th>)}</tr></thead>
                    <tbody className="divide-y divide-border">
                      {detalhe.historico.map((r) => (
                        <tr key={r.id}><td className="py-1 pr-2">{formatarData(r.data_prevista)}</td><td className="py-1 pr-2">{formatarData(r.data_realizada)}</td><td className="py-1 pr-2">{r.situacao}</td><td className="py-1">{r.observacao || "—"}</td></tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <div className="flex flex-wrap justify-between gap-2 border-t border-border pt-3">
                {detalhe.processo_id ? <Link to="/processos/$id" params={{ id: detalhe.processo_id }} className="font-medium text-primary hover:underline">Abrir ficha do processo</Link> : <span className="text-muted-foreground">Processo não vinculado — edite para vincular</span>}
                {podeEditar ? (
                  <div className="flex flex-wrap gap-2">
                    <button className={BOTAO_SEC} onClick={() => setEdicao({ id: detalhe.id, valores: { processo_id: detalhe.processo_id ?? "", pessoa: detalhe.pessoa, data_inicio: detalhe.data_inicio, periodicidade: detalhe.periodicidade, intervalo_meses: detalhe.intervalo_meses, proximo: detalhe.proximo, observacao: detalhe.observacao, situacao: detalhe.situacao } })}><Pencil className="size-3.5" /> Editar</button>
                    {detalhe.situacao !== "Encerrado" ? (
                      <>
                        <button className={BOTAO_SEC} onClick={() => setRegistro(detalhe)}><CheckCircle2 className="size-3.5" /> Registrar comparecimento</button>
                        <button className={BOTAO_SEC} onClick={() => void encerrar(detalhe.id)} title="Retirar este cadastro dos comparecimentos ativos"><XCircle className="size-3.5" /> Encerrar comparecimento</button>
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!edicao} onOpenChange={(o) => !o && setEdicao(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{edicao?.id ? "Editar comparecimento" : "Novo comparecimento"}</DialogTitle></DialogHeader>
          {edicao ? <FormComparecimento inicial={edicao.valores} processos={processos.map((p) => ({ id: p.id, numero: p.numero }))} onSalvar={async (v) => { await salvarComparecimento(v, edicao.id); await recarregar(); setEdicao(null); }} /> : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!registro} onOpenChange={(o) => !o && setRegistro(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar comparecimento</DialogTitle></DialogHeader>
          {registro ? <FormRegistro c={registro} onFeito={async () => { await recarregar(); setRegistro(null); }} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FormRegistro({ c, onFeito }: { c: ComparecimentoListado; onFeito: () => Promise<void> }) {
  const [data, setData] = useState(hojeISO());
  const [obs, setObs] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  return (
    <form className="space-y-3" onSubmit={async (e) => {
      e.preventDefault();
      if (!data) return setErro("Informe a data do comparecimento.");
      setSalvando(true); setErro("");
      try { await registrarComparecimento(c.id, data, obs); await onFeito(); } catch (err) { setErro(err instanceof Error ? err.message : "Erro ao registrar."); setSalvando(false); }
    }}>
      <p className="text-sm">{c.pessoa} · <span className="numero-processo">{c.numero}</span> · previsto para {formatarData(c.proximo)}</p>
      <Campo rotulo="Data do comparecimento"><input type="date" className={CLASSE_CAMPO} value={data} onChange={(e) => setData(e.target.value)} /></Campo>
      <Campo rotulo="Observação"><textarea className={`${CLASSE_CAMPO} h-20 py-2`} maxLength={1000} value={obs} onChange={(e) => setObs(e.target.value)} /></Campo>
      {data ? <p className="text-sm text-muted-foreground">Próximo comparecimento: <span className="font-semibold text-foreground">{formatarData(somarMeses(data, c.intervalo_meses))}</span></p> : null}
      {erro ? <p className="text-sm text-urgente">{erro}</p> : null}
      <div className="flex justify-end"><button className={BOTAO} disabled={salvando}>{salvando ? "Registrando…" : "Marcar como realizado"}</button></div>
    </form>
  );
}

function FormComparecimento({ inicial, processos, onSalvar }: { inicial: ComparecimentoEntrada; processos: { id: string; numero: string }[]; onSalvar: (v: ComparecimentoEntrada) => Promise<void> }) {
  const [v, setV] = useState(inicial);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  // Sugere o próximo comparecimento a partir da data de início e da periodicidade (pode ser ajustado).
  const recalcular = (n: ComparecimentoEntrada) =>
    setV({ ...n, proximo: n.data_inicio ? somarMeses(n.data_inicio, mesesDe(n.periodicidade, n.intervalo_meses)) : n.proximo });
  return (
    <form className="grid gap-3 md:grid-cols-2" onSubmit={async (e) => {
      e.preventDefault();
      if (!v.processo_id || !v.pessoa.trim() || !v.data_inicio || !v.proximo) return setErro("Preencha processo, pessoa, data de início e próximo comparecimento.");
      setSalvando(true); setErro("");
      try { await onSalvar(v); } catch (err) { setErro(err instanceof Error ? err.message : "Erro ao salvar."); setSalvando(false); }
    }}>
      <Campo rotulo="Processo">
        <SeletorProcesso value={v.processo_id} onChange={(id) => setV({ ...v, processo_id: id })} />
      </Campo>
      <Campo rotulo="Pessoa"><input className={CLASSE_CAMPO} maxLength={200} value={v.pessoa} onChange={(e) => setV({ ...v, pessoa: e.target.value })} /></Campo>
      <Campo rotulo="Data de início"><input type="date" className={CLASSE_CAMPO} value={v.data_inicio} onChange={(e) => recalcular({ ...v, data_inicio: e.target.value })} /></Campo>
      <Campo rotulo="Periodicidade">
        <select className={CLASSE_CAMPO} value={v.periodicidade} onChange={(e) => recalcular({ ...v, periodicidade: e.target.value })}>
          {PERIODICIDADES.map((p) => <option key={p.v} value={p.v}>{p.v}{p.meses ? ` (${p.meses} ${p.meses === 1 ? "mês" : "meses"})` : ""}</option>)}
        </select>
      </Campo>
      {v.periodicidade === "Personalizado" ? (
        <Campo rotulo="Intervalo (em meses)"><input type="number" min={1} max={120} className={CLASSE_CAMPO} value={v.intervalo_meses} onChange={(e) => recalcular({ ...v, intervalo_meses: Number(e.target.value) })} /></Campo>
      ) : null}
      <Campo rotulo="Próximo comparecimento"><input type="date" className={CLASSE_CAMPO} value={v.proximo} onChange={(e) => setV({ ...v, proximo: e.target.value })} /></Campo>
      <Campo rotulo="Situação do cadastro"><select className={CLASSE_CAMPO} value={v.situacao} onChange={(e) => setV({ ...v, situacao: e.target.value })}><option>Ativo</option><option>Encerrado</option></select></Campo>
      <div className="md:col-span-2"><Campo rotulo="Observação"><textarea className={`${CLASSE_CAMPO} h-20 py-2`} maxLength={1000} value={v.observacao} onChange={(e) => setV({ ...v, observacao: e.target.value })} /></Campo></div>
      <p className="text-xs text-muted-foreground md:col-span-2">A periodicidade é o intervalo definido para este processo (decisão, acordo ou medida aplicável). Regular, Vencendo ou Vencido é calculado automaticamente pela data do próximo comparecimento.</p>
      {erro ? <p className="text-sm text-urgente md:col-span-2">{erro}</p> : null}
      <div className="flex justify-end md:col-span-2"><button className={BOTAO} disabled={salvando}>{salvando ? "Salvando…" : "Salvar comparecimento"}</button></div>
    </form>
  );
}
