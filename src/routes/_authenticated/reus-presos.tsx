import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus, Upload } from "lucide-react";
import { Cabecalho, EstadoVazio } from "@/components/ui-serventia/Cabecalho";
import { Etiqueta } from "@/components/ui-serventia/Etiqueta";
import { CLASSE_CAMPO, Secao } from "@/components/processos/campos";
import { ImportarReusPresos } from "@/components/processos/ImportarReusPresos";
import { FormReuPreso, RegistrarReavaliacao, RetirarPrisao, TIPOS_CUSTODIA, type ReuEditavel } from "@/components/processos/GerenciarReuPreso";
import { supabase } from "@/integrations/supabase/client";
import { formatarData } from "@/lib/dominio";
import { diasEntre, hojeISO } from "@/lib/processos/modelo";
import { tipoPrisaoDe, type ProcRel } from "@/lib/processos/importacao-reus";
import { normalizarCorEtiqueta } from "@/lib/processos/etiquetas-niveis";
import { toast } from "sonner";
import { usePode } from "@/lib/sessao";
import { presosQuery } from "@/lib/processos/reus-presos";
import { etiquetasDosProcessosQuery } from "@/lib/processos/repositorio";
import { GerenciarEtiquetasProcesso } from "@/components/processos/GerenciarEtiquetasProcesso";
import { EtiquetaProcesso } from "@/components/processos/EtiquetaProcesso";

interface Preso extends ReuEditavel {
  processos_relacionados: ProcRel[];
  conferir: boolean;
  motivo_conferencia: string;
  processos: { numero: string } | null;
}

interface PrioridadeResumo {
  id: string;
  processo_id: string;
  titulo: string;
  motivo: string;
  nivel: string;
  observacao: string;
}

interface ReavaliacaoResumo {
  reu_id: string;
  data_reavaliacao: string;
}

export const Route = createFileRoute("/_authenticated/reus-presos")({
  head: () => ({
    meta: [
      { title: "Presos Provisórios — Gestão da Vara Criminal" },
      { name: "description", content: "Presos provisórios da Vara Criminal, com visão operacional de prisão, prazos e sinalizações." },
      { property: "og:title", content: "Presos Provisórios — Gestão da Vara Criminal" },
      { property: "og:description", content: "Visão operacional dos presos provisórios da Vara Criminal de Coração de Maria/BA." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(presosQuery()),
  errorComponent: ({ error }) => <EstadoVazio titulo="Erro ao carregar presos provisórios" descricao={error.message} />,
  component: Pagina,
});

const semAcento = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

// A espécie da planilha é a fonte de verdade para a classificação exibida.
// O tipo legado do cadastro fica como fallback para registros sem espécie.
const tipoExibido = (p: Pick<Preso, "tipo_prisao" | "especie_cautelar">) =>
  p.especie_cautelar?.trim() ? tipoPrisaoDe(p.especie_cautelar) : p.tipo_prisao;

const NIVEL_PRIORIDADE = {
  critico: { rotulo: "Crítico", severidade: "urgente", ordem: 0 },
  alta: { rotulo: "Urgente", severidade: "alerta", ordem: 1 },
  media: { rotulo: "Atenção", severidade: "atencao", ordem: 2 },
  conferir: { rotulo: "Conferir", severidade: "conferir", ordem: 3 },
  baixa: { rotulo: "Informativo", severidade: "info", ordem: 4 },
} as const;

const ORDEM_ETIQUETA = {
  critico: 0,
  urgente: 1,
  atencao: 2,
  conferir: 3,
  informativo: 4,
  concluido: 5,
} as const;

function normalizarData(v?: string | null): string | null {
  const s = v?.trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

function somarDiasISO(iso: string, dias: number): string {
  const [a, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + dias);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

function maiorData(datas: Array<string | null>): string | null {
  const validas = datas.filter((d): d is string => Boolean(d)).sort();
  return validas[validas.length - 1] ?? null;
}

function resumoPrazoPrisao(p: Preso, hoje: string, ultimaReavaliacaoHistorico?: string | null) {
  const tipo = tipoExibido(p);
  const dp = p.dados_planilha ?? {};

  if (tipo === "Prisão temporária") {
    const termino = maiorData([
      normalizarData(dp["Término de eventual prazo"]),
      normalizarData(dp["Termino de eventual prazo"]),
      normalizarData(dp["Término do prazo"]),
      normalizarData(dp["Termino do prazo"]),
    ]);
    if (!termino) {
      return { principal: "Sem data registrada", detalhe: "Término da temporária", cls: "text-muted-foreground" };
    }
    const dias = diasEntre(hoje, termino);
    if (dias < 0) return { principal: `Vencido há ${Math.abs(dias)}d`, detalhe: `Término: ${formatarData(termino)}`, cls: "font-medium text-urgente" };
    if (dias === 0) return { principal: "Término hoje", detalhe: formatarData(termino), cls: "font-medium text-urgente" };
    if (dias === 1) return { principal: "Falta 1 dia", detalhe: `Término: ${formatarData(termino)}`, cls: "font-medium text-urgente" };
    if (dias <= 5) return { principal: `Faltam ${dias} dias`, detalhe: `Término: ${formatarData(termino)}`, cls: "font-medium text-alerta" };
    if (dias <= 15) return { principal: `Faltam ${dias} dias`, detalhe: `Término: ${formatarData(termino)}`, cls: "font-medium text-atencao" };
    return { principal: "Regular", detalhe: `Término: ${formatarData(termino)}`, cls: "text-foreground" };
  }

  if (tipo === "Prisão preventiva") {
    const base = maiorData([
      normalizarData(ultimaReavaliacaoHistorico),
      normalizarData(dp["Última reavaliação"]),
      normalizarData(dp["Data da última reavaliação"]),
      normalizarData(dp["Data da decisão da preventiva"]),
      normalizarData(dp["Data da decisão preventiva"]),
    ]);
    if (!base) {
      return { principal: "Conferir reavaliação", detalhe: "Sem data-base confiável", cls: "font-medium text-temporaria" };
    }
    const limite = somarDiasISO(base, 90);
    const dias = diasEntre(hoje, limite);
    if (dias < 0) return { principal: `Vencida há ${Math.abs(dias)}d`, detalhe: `Marco: ${formatarData(limite)}`, cls: "font-medium text-urgente" };
    if (dias === 0) return { principal: "Revisão hoje", detalhe: formatarData(limite), cls: "font-medium text-urgente" };
    if (dias <= 5) return { principal: `Faltam ${dias} dias`, detalhe: `Marco: ${formatarData(limite)}`, cls: "font-medium text-alerta" };
    if (dias <= 15) return { principal: `Faltam ${dias} dias`, detalhe: `Marco: ${formatarData(limite)}`, cls: "font-medium text-atencao" };
    return { principal: "Regular", detalhe: `Próxima revisão: ${formatarData(limite)}`, cls: "text-foreground" };
  }

  return { principal: "—", detalhe: null as string | null, cls: "text-muted-foreground" };
}

function Pagina() {
  const data = useSuspenseQuery(presosQuery()).data as unknown as Preso[];
  const podeEditar = usePode("editar");
  const qc = useQueryClient();
  const processoIds = useMemo(
    () => [...new Set(data.map((p) => p.processo_id).filter((id): id is string => Boolean(id)))],
    [data],
  );
  const { data: etiquetasPorProcesso = {} } = useQuery(etiquetasDosProcessosQuery(processoIds));
  const { data: prioridades = [] } = useQuery({
    queryKey: ["processos", "prioridades", processoIds],
    enabled: processoIds.length > 0,
    staleTime: 30_000,
    queryFn: async (): Promise<PrioridadeResumo[]> => {
      const { data: lista, error } = await supabase
        .from("prioridades")
        .select("id, processo_id, titulo, motivo, nivel, observacao")
        .in("processo_id", processoIds);
      if (error) throw error;
      return (lista ?? []) as PrioridadeResumo[];
    },
  });
  const prioridadesPorProcesso = useMemo(() => {
    const mapa: Record<string, PrioridadeResumo[]> = {};
    for (const prioridade of prioridades) {
      (mapa[prioridade.processo_id] ??= []).push(prioridade);
    }
    return mapa;
  }, [prioridades]);

  const reuIds = useMemo(() => data.map((p) => p.id), [data]);
  const { data: reavaliacoes = [] } = useQuery({
    queryKey: ["reus-presos", "reavaliacoes", reuIds],
    enabled: reuIds.length > 0,
    staleTime: 0,
    queryFn: async (): Promise<ReavaliacaoResumo[]> => {
      const { data: lista, error } = await supabase
        .from("reu_reavaliacoes")
        .select("reu_id, data_reavaliacao")
        .in("reu_id", reuIds)
        .order("data_reavaliacao", { ascending: false });
      if (error) throw error;
      return (lista ?? []) as ReavaliacaoResumo[];
    },
  });
  const ultimaReavaliacaoPorReu = useMemo(() => {
    const mapa: Record<string, string> = {};
    for (const reavaliacao of reavaliacoes) {
      if (!mapa[reavaliacao.reu_id] || reavaliacao.data_reavaliacao > mapa[reavaliacao.reu_id]) {
        mapa[reavaliacao.reu_id] = reavaliacao.data_reavaliacao;
      }
    }
    return mapa;
  }, [reavaliacoes]);

  const [importar, setImportar] = useState(false);
  const [form, setForm] = useState<{ reu: ReuEditavel | null } | null>(null);
  const [soltar, setSoltar] = useState<ReuEditavel | null>(null);
  const [reav, setReav] = useState<ReuEditavel | null>(null);
  const [acoesAberta, setAcoesAberta] = useState<string | null>(null);
  const [termo, setTermo] = useState("");
  const [tipo, setTipo] = useState("");
  const hoje = hojeISO();
  const atualizar = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["reus-presos"] }),
      qc.invalidateQueries({ queryKey: ["reus-presos", "reavaliacoes"] }),
    ]);
  };

  const marcarConferencia = async (id: string, conferir: boolean) => {
    const { error } = await supabase.from("reus").update({ conferir }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(conferir ? "Revisão do cadastro reaberta" : "Revisão do cadastro concluída");
    atualizar();
  };

  const excluirCadastroSemProcesso = async (p: Preso) => {
    if (p.processo_id) return;
    const confirmar = window.confirm(
      `Excluir definitivamente o cadastro de "${p.nome}"? Este registro não possui processo vinculado. A exclusão não remove nenhum processo.`,
    );
    if (!confirmar) return;

    const { error } = await supabase.from("reus").delete().eq("id", p.id);
    if (error) {
      toast.error(`Não foi possível excluir o cadastro: ${error.message}`);
      return;
    }
    toast.success("Cadastro excluído");
    atualizar();
  };

  const exibidos = useMemo(() => {
    const t = semAcento(termo.trim());
    const d = t.replace(/\D/g, "");
    return data.filter((p) => {
      const tipoAtual = tipoExibido(p);
      if (tipo === "outras" ? ["Prisão temporária", "Prisão preventiva"].includes(tipoAtual) : tipo && tipoAtual !== tipo) return false;
      if (!t) return true;
      const campos = [p.nome, p.rji, p.processos?.numero ?? "", ...p.processos_relacionados.map((r) => r.numero)];
      return campos.some((c) => semAcento(c).includes(t) || (d.length >= 3 && c.replace(/\D/g, "").includes(d)));
    });
  }, [data, termo, tipo]);

  return (
    <div className="space-y-6">
      {podeEditar ? <>
        <ImportarReusPresos aberto={importar} onFechar={() => setImportar(false)} onConcluir={atualizar} />
        <FormReuPreso aberto={!!form} reu={form?.reu ?? null} onFechar={() => setForm(null)} onSalvo={atualizar} />
        <RetirarPrisao reu={soltar} onFechar={() => setSoltar(null)} onSalvo={atualizar} />
        <RegistrarReavaliacao reu={reav} onFechar={() => setReav(null)} onSalvo={atualizar} />
      </> : null}

      <Cabecalho
        titulo="Presos Provisórios"
        subtitulo={`${data.length} réus custodiados — visão operacional de prisão, revisão e sinalizações`}
        acao={podeEditar ? <div className="flex gap-2">
          <button className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-muted" onClick={() => setImportar(true)}><Upload className="size-4" /> Importar planilha</button>
          <button className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground" onClick={() => setForm({ reu: null })}><Plus className="size-4" /> Adicionar preso provisório</button>
        </div> : undefined}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {([
          ["", "Presos provisórios", data.length],
          ["Prisão temporária", "Prisões temporárias", data.filter((p) => tipoExibido(p) === "Prisão temporária").length],
          ["Prisão preventiva", "Prisões preventivas", data.filter((p) => tipoExibido(p) === "Prisão preventiva").length],
          ["outras", "Outras prisões", data.filter((p) => !["Prisão temporária", "Prisão preventiva"].includes(tipoExibido(p))).length],
        ] as const).map(([v, r, n]) => (
          <button key={r} type="button" onClick={() => setTipo(v)} aria-pressed={tipo === v}
            className={`rounded-lg border bg-card p-4 text-left transition-colors hover:border-primary/50 ${tipo === v ? "border-primary ring-1 ring-primary" : "border-border"}`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{r}</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{n}</p>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full max-w-md">
          <label htmlFor="pesq-presos" className="mb-1 block text-xs font-medium text-muted-foreground">Pesquisar presos provisórios</label>
          <input id="pesq-presos" type="search" className={CLASSE_CAMPO} placeholder="Nome, RJI, processo cautelar, IP ou ação penal..." value={termo} onChange={(e) => setTermo(e.target.value)} />
        </div>
        <div>
          <label htmlFor="tipo-presos" className="mb-1 block text-xs font-medium text-muted-foreground">Tipo de prisão</label>
          <select id="tipo-presos" className={CLASSE_CAMPO} value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="">Todos</option>
            {TIPOS_CUSTODIA.map((x) => <option key={x}>{x}</option>)}
            <option value="outras">Outras prisões (exceto temporária e preventiva)</option>
          </select>
        </div>
      </div>

      <Secao titulo={`Presos provisórios (${exibidos.length})`}>
        {exibidos.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum preso provisório encontrado.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  {["Processo", "Réu custodiado", "Prisão", "Prazo / revisão", "Sinalizações", ...(podeEditar ? ["Ações"] : [])].map((h, i, arr) => (
                    <th key={h} className={`px-3 py-2 font-medium ${podeEditar && i === arr.length - 1 ? "sticky right-0 z-20 bg-card shadow-[-6px_0_10px_-10px_rgba(0,0,0,0.35)]" : ""}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border align-top">
                {exibidos.map((p) => {
                  const temProcessoValido = Boolean(
                    p.processos?.numero?.trim() ||
                    p.processos_relacionados.some((r) => r.numero?.trim()),
                  );
                  const semProcessoValido = !temProcessoValido;
                  const processoRelacionado = p.processos_relacionados.find((r) => r.numero?.trim()) ?? null;
                  const numeroProcesso = p.processos?.numero?.trim() || processoRelacionado?.numero || "";
                  const resumo = resumoPrazoPrisao(p, hoje, ultimaReavaliacaoPorReu[p.id] ?? null);

                  const prioridadesDoProcesso = p.processo_id ? prioridadesPorProcesso[p.processo_id] ?? [] : [];
                  const prioridadeDominante = [...prioridadesDoProcesso]
                    .filter((pr) => pr.nivel in NIVEL_PRIORIDADE)
                    .sort((a, b) =>
                      NIVEL_PRIORIDADE[a.nivel as keyof typeof NIVEL_PRIORIDADE].ordem -
                      NIVEL_PRIORIDADE[b.nivel as keyof typeof NIVEL_PRIORIDADE].ordem
                    )[0] ?? null;

                  const etiquetas = p.processo_id
                    ? [...(etiquetasPorProcesso[p.processo_id] ?? [])].sort(
                        (a, b) =>
                          ORDEM_ETIQUETA[normalizarCorEtiqueta(a.cor)] -
                          ORDEM_ETIQUETA[normalizarCorEtiqueta(b.cor)] ||
                          a.nome.localeCompare(b.nome, "pt-BR"),
                      )
                    : [];

                  const mostrarConferirCadastro = p.conferir && prioridadeDominante?.nivel !== "conferir";
                  const ocupadasAntesDasEtiquetas = (prioridadeDominante ? 1 : 0) + (mostrarConferirCadastro ? 1 : 0);
                  const etiquetasVisiveis = etiquetas.slice(0, Math.max(0, 2 - ocupadasAntesDasEtiquetas));
                  const totalSinalizacoes = ocupadasAntesDasEtiquetas + etiquetas.length;

                  return (
                    <tr key={p.id} className="hover:bg-muted/20">
                      <td className="px-3 py-3 text-xs whitespace-nowrap">
                        {p.processo_id && p.processos?.numero ? (
                          <Link to="/processos/$id" params={{ id: p.processo_id }} className="numero-processo font-medium text-primary hover:underline">
                            {p.processos.numero}
                          </Link>
                        ) : numeroProcesso ? (
                          <span className="numero-processo">{numeroProcesso}</span>
                        ) : (
                          <div className="space-y-1">
                            <span className="block text-muted-foreground">Não vinculado</span>
                            {podeEditar ? (
                              <button
                                type="button"
                                className="text-[11px] font-medium text-primary hover:underline"
                                onClick={() => setForm({ reu: p })}
                              >
                                Vincular processo
                              </button>
                            ) : null}
                          </div>
                        )}
                      </td>

                      <td className="px-3 py-3">
                        <div className="font-medium text-foreground">{p.nome}</div>
                        {p.rji ? <div className="mt-0.5 text-xs text-muted-foreground">RJI {p.rji}</div> : null}
                      </td>

                      <td className="px-3 py-3">
                        <div className="font-medium text-foreground">{tipoExibido(p)}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {p.data_prisao ? `Desde ${formatarData(p.data_prisao)}` : "Data não informada"}
                        </div>
                      </td>

                      <td className="px-3 py-3">
                        <div className={resumo.cls}>{resumo.principal}</div>
                        {resumo.detalhe ? <div className="mt-0.5 text-xs text-muted-foreground">{resumo.detalhe}</div> : null}
                      </td>

                      <td className="px-3 py-3">
                        {totalSinalizacoes === 0 ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <div className="flex max-w-[280px] flex-wrap items-center gap-1">
                            {prioridadeDominante ? (() => {
                              const cfg = NIVEL_PRIORIDADE[prioridadeDominante.nivel as keyof typeof NIVEL_PRIORIDADE];
                              return (
                                <Etiqueta
                                  key={`prioridade-${prioridadeDominante.id}`}
                                  severidade={cfg.severidade}
                                  className="whitespace-nowrap"
                                >
                                  <span title={`Prioridade manual: ${prioridadeDominante.titulo || prioridadeDominante.motivo || cfg.rotulo}`}>{cfg.rotulo}</span>
                                </Etiqueta>
                              );
                            })() : null}

                            {mostrarConferirCadastro ? (
                              <Etiqueta key="conferir-cadastro" severidade="conferir" className="whitespace-nowrap">
                                <span title={p.motivo_conferencia || "Cadastro marcado para conferência"}>Conferir cadastro</span>
                              </Etiqueta>
                            ) : null}

                            {etiquetasVisiveis.map((e) => (
                              <EtiquetaProcesso key={e.id} processoId={p.processo_id!} etiqueta={e} />
                            ))}

                            {totalSinalizacoes > 2 ? (
                              <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                                +{totalSinalizacoes - 2}
                              </span>
                            ) : null}
                          </div>
                        )}
                      </td>

                      {podeEditar ? (
                        <td className="sticky right-0 z-10 bg-card px-3 py-3 whitespace-nowrap shadow-[-6px_0_10px_-10px_rgba(0,0,0,0.35)]">
                          {semProcessoValido ? (
                            <div className="flex items-center gap-2">
                              <button className="text-xs font-medium text-primary hover:underline" onClick={() => setForm({ reu: p })}>
                                Vincular processo
                              </button>
                              <button
                                className="text-xs text-destructive hover:underline"
                                type="button"
                                onClick={() => void excluirCadastroSemProcesso(p)}
                              >
                                Excluir
                              </button>
                            </div>
                          ) : (
                            <>
                              <button
                                className="inline-flex h-8 items-center rounded-md border border-border bg-background px-2.5 text-xs font-medium text-foreground hover:bg-muted"
                                type="button"
                                aria-haspopup="menu"
                                aria-expanded={acoesAberta === p.id}
                                onClick={() => setAcoesAberta(acoesAberta === p.id ? null : p.id)}
                              >
                                Ações ▾
                              </button>
                              {acoesAberta === p.id ? (
                                <div className="relative z-10 mt-2 w-56 rounded-md border border-border bg-card p-1 shadow-lg">
                                  <button className="block w-full rounded px-2 py-1.5 text-left text-xs text-foreground hover:bg-muted" onClick={() => { setForm({ reu: p }); setAcoesAberta(null); }}>Atualizar prisão</button>
                                  <button className="block w-full rounded px-2 py-1.5 text-left text-xs text-foreground hover:bg-muted" onClick={() => { setReav(p); setAcoesAberta(null); }}>Registrar reavaliação</button>
                                  {p.processo_id ? (
                                    <GerenciarEtiquetasProcesso
                                      processoId={p.processo_id}
                                      etiquetasAtuais={etiquetasPorProcesso[p.processo_id] ?? []}
                                    >
                                      {(abrir) => (
                                        <button
                                          type="button"
                                          className="block w-full rounded px-2 py-1.5 text-left text-xs text-foreground hover:bg-muted"
                                          onClick={() => { setAcoesAberta(null); abrir(); }}
                                        >
                                          Adicionar etiqueta
                                        </button>
                                      )}
                                    </GerenciarEtiquetasProcesso>
                                  ) : null}
                                  <button className="block w-full rounded px-2 py-1.5 text-left text-xs text-urgente hover:bg-urgente-suave" onClick={() => { setSoltar(p); setAcoesAberta(null); }}>Encerrar situação prisional</button>
                                  <div className="my-1 border-t border-border" />
                                  <button className="block w-full rounded px-2 py-1.5 text-left text-xs text-foreground hover:bg-muted" onClick={() => { marcarConferencia(p.id, !p.conferir); setAcoesAberta(null); }}>
                                    {p.conferir ? "Concluir revisão do cadastro" : "Reabrir revisão do cadastro"}
                                  </button>
                                </div>
                              ) : null}
                            </>
                          )}
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Secao>

      <p className="text-xs text-muted-foreground">
        A tela inicial prioriza processo, custodiado, espécie da prisão, prazo/revisão e sinalizações. Detalhes completos permanecem disponíveis no processo e nas ações do cadastro.
      </p>
    </div>
  );
}
