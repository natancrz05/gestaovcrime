import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus, Upload } from "lucide-react";
import { AcoesEtiquetasProcesso, EtiquetasProcesso } from "@/components/processos/GerenciarEtiquetas";
import { Cabecalho, EstadoVazio } from "@/components/ui-serventia/Cabecalho";
import { CLASSE_CAMPO, Secao } from "@/components/processos/campos";
import { ImportarReusPresos } from "@/components/processos/ImportarReusPresos";
import { FormReuPreso, RegistrarReavaliacao, RetirarPrisao, situacaoRevisao, TIPOS_CUSTODIA, type ReuEditavel } from "@/components/processos/GerenciarReuPreso";
import { supabase } from "@/integrations/supabase/client";
import { formatarData } from "@/lib/dominio";
import { diasEntre, hojeISO, type EtiquetaProcesso } from "@/lib/processos/modelo";
import { ROTULO_TIPO_PROC, tipoPrisaoDe, type ProcRel } from "@/lib/processos/importacao-reus";
import { toast } from "sonner";
import { usePode, useSessao } from "@/lib/sessao";
import { presosQuery } from "@/lib/processos/reus-presos";

interface Preso extends ReuEditavel {
  processos_relacionados: ProcRel[];
  conferir: boolean; motivo_conferencia: string; processos: { numero: string; processos_etiquetas?: { etiquetas?: EtiquetaProcesso | null }[] } | null;\n  etiquetas: EtiquetaProcesso[];
}

export const Route = createFileRoute("/_authenticated/reus-presos")({
  head: () => ({
    meta: [
      { title: "Presos Provisórios — Gestão da Vara Criminal" },
      { name: "description", content: "Presos provisórios da Vara Criminal, com processos relacionados e importação de planilha." },
      { property: "og:title", content: "Presos Provisórios — Gestão da Vara Criminal" },
      { property: "og:description", content: "Presos provisórios da Vara Criminal, com processos relacionados e importação de planilha." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(presosQuery()),
  errorComponent: ({ error }) => <EstadoVazio titulo="Erro ao carregar presos provisórios" descricao={error.message} />,
  component: Pagina,
});

const semAcento = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const BTN_P = "text-xs text-primary hover:underline";

// A espécie da planilha é a fonte de verdade para a classificação exibida.
// O tipo legado do cadastro fica como fallback para registros sem espécie.
const tipoExibido = (p: Pick<Preso, "tipo_prisao" | "especie_cautelar">) =>
  p.especie_cautelar?.trim() ? tipoPrisaoDe(p.especie_cautelar) : p.tipo_prisao;

function Pagina() {
  const data = useSuspenseQuery(presosQuery()).data as unknown as Preso[];
  const podeEditar = usePode("editar");
  const qc = useQueryClient();
  const [importar, setImportar] = useState(false);
  const [form, setForm] = useState<{ reu: ReuEditavel | null } | null>(null);
  const [soltar, setSoltar] = useState<ReuEditavel | null>(null);
  const [reav, setReav] = useState<ReuEditavel | null>(null);
  const [acoesAberta, setAcoesAberta] = useState<string | null>(null);
  const [termo, setTermo] = useState("");
  const [tipo, setTipo] = useState("");
  const hoje = hojeISO();
  const atualizar = () => qc.invalidateQueries({ queryKey: ["reus-presos"] });
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
    const t = semAcento(termo.trim()); const d = t.replace(/\D/g, "");
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
        subtitulo={`${data.length} réus custodiados — prioridade máxima de tramitação`}
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
            <option value="">Todos</option>{TIPOS_CUSTODIA.map((x) => <option key={x}>{x}</option>)}<option value="outras">Outras prisões (exceto temporária e preventiva)</option>
          </select>
        </div>
      </div>
      <Secao titulo={`Presos provisórios (${exibidos.length})`}>
        {exibidos.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum preso provisório encontrado.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>{["Processo", "Réu custodiado", "Espécie", "Data da prisão", "Dias preso", "Processos relacionados", "Etiquetas", "Última reavaliação", "Situação da revisão", ...(podeEditar ? ["Ações"] : [])].map((h, i, arr) => <th key={h} className={`px-2 py-2 font-medium ${podeEditar && i === arr.length - 1 ? "sticky right-0 z-20 bg-card shadow-[-6px_0_10px_-10px_rgba(0,0,0,0.35)]" : ""}`}>{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-border align-top">
                {exibidos.map((p) => {
                  const temProcessoValido = Boolean(
                    p.processos?.numero?.trim() ||
                    p.processos_relacionados.some((r) => r.numero?.trim()),
                  );
                  const semProcessoValido = !temProcessoValido;
                  const rel = p.processos_relacionados.length ? p.processos_relacionados
                    : p.processo_id && p.processos?.numero ? [{ tipo: "", numero: p.processos.numero, processo_id: p.processo_id, situacao: "encontrado" }] : [];
                  const dias = p.data_prisao ? diasEntre(p.data_prisao, hoje) : null;
                  const dp = p.dados_planilha ?? {};
                  const rev = situacaoRevisao(tipoExibido(p), dp["Última reavaliação"] || undefined, hoje, diasEntre);
                  return (
                    <tr key={p.id}>
                      <td className="px-2 py-2 text-xs whitespace-nowrap">
                        {p.processo_id && p.processos?.numero ? <Link to="/processos/$id" params={{ id: p.processo_id }} className="numero-processo font-medium text-primary hover:underline">{p.processos.numero}</Link>
                          : rel[0] ? <span className="numero-processo">{rel[0].numero}</span> : (
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">Não vinculado</span>
                              {podeEditar ? (
                                <button
                                  type="button"
                                  className="rounded border border-primary/30 bg-primary/5 px-2 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/10"
                                  onClick={() => setForm({ reu: p })}
                                >
                                  Vincular processo
                                </button>
                              ) : null}
                              {podeEditar ? (
                                <button
                                  type="button"
                                  className="text-[10px] font-medium text-destructive hover:underline"
                                  onClick={() => void excluirCadastroSemProcesso(p)}
                                >
                                  Excluir
                                </button>
                              ) : null}
                            </div>
                          )}
                      </td>
                      <td className="px-2 py-2">
                        <div className="font-medium">
                          {p.nome}
                          {p.conferir ? (
                            <span className="group/selo relative ml-2 inline-flex align-middle" title={p.motivo_conferencia}>
                              <span onClick={podeEditar ? () => setForm({ reu: p }) : undefined} className={podeEditar ? "cursor-pointer rounded border border-alerta/30 bg-alerta-suave px-1.5 py-0.5 text-[10px] font-medium text-alerta" : "rounded border border-alerta/30 bg-alerta-suave px-1.5 py-0.5 text-[10px] font-medium text-alerta"}>Conferir</span>
                              {podeEditar ? (
                                <button
                                  type="button"
                                  aria-label="Remover selo Conferir deste cadastro"
                                  title="Remover o selo Conferir (os dados do cadastro são mantidos)"
                                  onClick={() => marcarConferencia(p.id, false)}
                                  className="absolute -right-1.5 -top-1.5 hidden size-3.5 items-center justify-center rounded-full border border-alerta/40 bg-background text-[9px] font-bold leading-none text-alerta group-hover/selo:flex hover:bg-alerta hover:text-primary-foreground"
                                >×</button>
                              ) : null}
                            </span>
                          ) : null}
                        </div>
                        {p.conferir && p.motivo_conferencia ? <div className="text-xs text-alerta">{p.motivo_conferencia}</div> : null}
                        {!p.conferir && p.motivo_conferencia ? <div className="text-xs text-muted-foreground">Revisão do cadastro: concluída</div> : null}
                        {p.rji ? <div className="text-xs text-muted-foreground">RJI {p.rji}</div> : null}
                        {p.situacao ? <div className="text-xs text-muted-foreground">{p.situacao}</div> : null}
                      </td>
                      <td className="px-2 py-2">{tipoExibido(p)}{p.especie_cautelar ? <div className="text-xs text-muted-foreground">{p.especie_cautelar}</div> : null}</td>
                      <td className="px-2 py-2">{formatarData(p.data_prisao)}</td>
                      <td className="px-2 py-2 tabular-nums">{dias ?? dp["Dias preso (planilha)"] ?? "—"}</td>
                      <td className="px-2 py-2 text-xs">
                        {rel.length === 0 ? <span className="text-muted-foreground">Não vinculado</span> : rel.map((r, i) => (
                          <div key={i} className="whitespace-nowrap">
                            {r.tipo ? <span className="text-muted-foreground">{ROTULO_TIPO_PROC[r.tipo] ?? r.tipo}: </span> : null}
                            {r.processo_id ? <Link to="/processos/$id" params={{ id: r.processo_id }} className="numero-processo text-primary hover:underline">{r.numero}</Link>
                              : <span className="numero-processo">{r.numero} <span className="text-alerta">(não vinculado)</span></span>}
                          </div>
                        ))}
                        {dp["Sistema"] ? <div className="text-muted-foreground">Sistema: {dp["Sistema"]}</div> : null}
                      </td>
                      <td className="px-2 py-2 text-xs">
                        {dp["Última reavaliação"] ? <div>{formatarData(dp["Última reavaliação"])}</div> : <div className="text-muted-foreground">—</div>}
                        {dp["Data de reavaliação"] ? <div className="text-muted-foreground">Próxima: {formatarData(dp["Data de reavaliação"])}</div> : null}
                        {dp["Prazo de reavaliação"] ? <div className="text-muted-foreground">Prazo: {dp["Prazo de reavaliação"]}</div> : null}
                        {dp["Término de eventual prazo"] ? <div className="text-muted-foreground">Término: {formatarData(dp["Término de eventual prazo"])}</div> : null}
                        {dp["Andamento do último procedimento"] ? <div className="text-muted-foreground">{dp["Andamento do último procedimento"]}</div> : null}
                      </td>
                      <td className="px-2 py-2 text-xs">
                        {rev ? <span className={`whitespace-nowrap rounded border px-1.5 py-0.5 font-medium ${rev.cls}`}>{rev.rotulo}{rev.dias !== null ? ` · ${rev.dias}d` : ""}</span> : <span className="text-muted-foreground">—</span>}
                      </td>
                      {podeEditar ? (\n                        <div className="flex items-center gap-2">\n                          {p.processo_id ? <AcoesEtiquetasProcesso processoId={p.processo_id} etiquetas={p.etiquetas} /> : null}\n
                        <td className="sticky right-0 z-10 bg-card px-2 py-2 whitespace-nowrap shadow-[-6px_0_10px_-10px_rgba(0,0,0,0.35)]">
                          <div className="flex items-center gap-2">
                            <button className={BTN_P} onClick={() => setForm({ reu: p })}>{semProcessoValido ? "Vincular processo" : (p.conferir ? "Conferir" : "Editar")}</button>
                            {semProcessoValido ? (
                              <button
                                className="text-xs text-destructive hover:underline"
                                type="button"
                                onClick={() => void excluirCadastroSemProcesso(p)}
                              >
                                Excluir cadastro
                              </button>
                            ) : (
                              <button className="inline-flex h-8 items-center rounded-md border border-border bg-background px-2.5 text-xs font-medium text-foreground hover:bg-muted" type="button" aria-haspopup="menu" aria-expanded={acoesAberta === p.id} onClick={() => setAcoesAberta(acoesAberta === p.id ? null : p.id)}>Ações ▾</button>
                            )}
                          </div>
                          {acoesAberta === p.id ? (
                            <div className="relative z-10 mt-2 w-56 rounded-md border border-border bg-card p-1 shadow-lg">
                              <button className="block w-full rounded px-2 py-1.5 text-left text-xs text-foreground hover:bg-muted" onClick={() => { setForm({ reu: p }); setAcoesAberta(null); }}>Atualizar prisão</button>
                              <button className="block w-full rounded px-2 py-1.5 text-left text-xs text-foreground hover:bg-muted" onClick={() => { setReav(p); setAcoesAberta(null); }}>Registrar reavaliação</button>
                              <button className="block w-full rounded px-2 py-1.5 text-left text-xs text-urgente hover:bg-urgente-suave" onClick={() => { setSoltar(p); setAcoesAberta(null); }}>Encerrar situação prisional</button>
                              <div className="my-1 border-t border-border" />
                              <button className="block w-full rounded px-2 py-1.5 text-left text-xs text-foreground hover:bg-muted" onClick={() => { marcarConferencia(p.id, !p.conferir); setAcoesAberta(null); }}>{p.conferir ? "Concluir revisão do cadastro" : "Reabrir revisão do cadastro"}</button>
                              {!p.processo_id ? (
                                <button
                                  className="block w-full rounded px-2 py-1.5 text-left text-xs text-destructive hover:bg-destructive/10"
                                  onClick={() => { setAcoesAberta(null); void excluirCadastroSemProcesso(p); }}
                                >
                                  Excluir cadastro
                                </button>
                              ) : null}
                            </div>
                          ) : null}
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
      <p className="text-xs text-muted-foreground">Situação da revisão: alerta operacional interno aos 85 dias da última reavaliação (somente prisão preventiva). Não representa prazo legal.</p>
    </div>
  );
}
