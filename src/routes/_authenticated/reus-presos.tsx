import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus, Upload } from "lucide-react";
import { Cabecalho, EstadoVazio } from "@/components/ui-serventia/Cabecalho";
import { CLASSE_CAMPO, Secao } from "@/components/processos/campos";
import { ImportarReusPresos } from "@/components/processos/ImportarReusPresos";
import { FormReuPreso, RegistrarReavaliacao, RetirarPrisao, situacaoRevisao, TIPOS_CUSTODIA, type ReuEditavel } from "@/components/processos/GerenciarReuPreso";
import { supabase } from "@/integrations/supabase/client";
import { formatarData } from "@/lib/dominio";
import { diasEntre, hojeISO } from "@/lib/processos/modelo";
import { ROTULO_TIPO_PROC, type ProcRel } from "@/lib/processos/importacao-reus";
import { usePode } from "@/lib/sessao";

interface Preso extends ReuEditavel {
  processos_relacionados: ProcRel[];
  conferir: boolean; motivo_conferencia: string; processos: { numero: string } | null;
}

const presosQuery = () => queryOptions({
  queryKey: ["reus-presos"],
  queryFn: async () => {
    const { data, error } = await supabase.from("reus").select("*, processos(numero)").eq("preso", true).order("nome");
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as Preso[];
  },
});

export const Route = createFileRoute("/_authenticated/reus-presos")({
  head: () => ({
    meta: [
      { title: "Réus Presos — Gestão da Vara Criminal" },
      { name: "description", content: "Réus custodiados da Vara Criminal, com processos relacionados e importação de planilha." },
      { property: "og:title", content: "Réus Presos — Gestão da Vara Criminal" },
      { property: "og:description", content: "Réus custodiados da Vara Criminal, com processos relacionados e importação de planilha." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(presosQuery()),
  errorComponent: ({ error }) => <EstadoVazio titulo="Erro ao carregar réus presos" descricao={error.message} />,
  component: Pagina,
});

const semAcento = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const BTN_P = "text-xs text-primary hover:underline";

function Pagina() {
  const { data } = useSuspenseQuery(presosQuery());
  const podeEditar = usePode("editar");
  const qc = useQueryClient();
  const [importar, setImportar] = useState(false);
  const [form, setForm] = useState<{ reu: ReuEditavel | null } | null>(null);
  const [soltar, setSoltar] = useState<ReuEditavel | null>(null);
  const [reav, setReav] = useState<ReuEditavel | null>(null);
  const [termo, setTermo] = useState("");
  const [tipo, setTipo] = useState("");
  const hoje = hojeISO();
  const atualizar = () => qc.invalidateQueries();

  const exibidos = useMemo(() => {
    const t = semAcento(termo.trim()); const d = t.replace(/\D/g, "");
    return data.filter((p) => {
      if (tipo && p.tipo_prisao !== tipo) return false;
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
        titulo="Réus Presos"
        subtitulo={`${data.length} réus custodiados — prioridade máxima de tramitação`}
        acao={podeEditar ? <div className="flex gap-2">
          <button className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-muted" onClick={() => setImportar(true)}><Upload className="size-4" /> Importar planilha</button>
          <button className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground" onClick={() => setForm({ reu: null })}><Plus className="size-4" /> Adicionar réu preso</button>
        </div> : undefined}
      />
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full max-w-md">
          <label htmlFor="pesq-presos" className="mb-1 block text-xs font-medium text-muted-foreground">Pesquisar réus presos</label>
          <input id="pesq-presos" type="search" className={CLASSE_CAMPO} placeholder="Nome, RJI, processo cautelar, IP ou ação penal..." value={termo} onChange={(e) => setTermo(e.target.value)} />
        </div>
        <div>
          <label htmlFor="tipo-presos" className="mb-1 block text-xs font-medium text-muted-foreground">Tipo de prisão</label>
          <select id="tipo-presos" className={CLASSE_CAMPO} value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="">Todos</option>{TIPOS_CUSTODIA.map((x) => <option key={x}>{x}</option>)}
          </select>
        </div>
      </div>
      <Secao titulo={`Réus presos (${exibidos.length})`}>
        {exibidos.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum réu preso encontrado.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>{["Processo", "Réu custodiado", "Espécie", "Data da prisão", "Dias preso", "Processos relacionados", "Última reavaliação", "Situação da revisão", ...(podeEditar ? ["Ações"] : [])].map((h) => <th key={h} className="px-2 py-2 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-border align-top">
                {exibidos.map((p) => {
                  const rel = p.processos_relacionados.length ? p.processos_relacionados
                    : p.processo_id ? [{ tipo: "", numero: p.processos?.numero ?? "", processo_id: p.processo_id, situacao: "encontrado" }] : [];
                  const dias = p.data_prisao ? diasEntre(p.data_prisao, hoje) : null;
                  const dp = p.dados_planilha ?? {};
                  const rev = situacaoRevisao(p.tipo_prisao, dp["Última reavaliação"] || undefined, hoje, diasEntre);
                  return (
                    <tr key={p.id}>
                      <td className="px-2 py-2 text-xs whitespace-nowrap">
                        {p.processo_id ? <Link to="/processos/$id" params={{ id: p.processo_id }} className="numero-processo font-medium text-primary hover:underline">{p.processos?.numero}</Link>
                          : rel[0] ? <span className="numero-processo">{rel[0].numero}</span> : <span className="text-muted-foreground">Não vinculado</span>}
                      </td>
                      <td className="px-2 py-2">
                        <div className="font-medium">{p.nome}{p.conferir ? <span title={p.motivo_conferencia} className="ml-2 rounded border border-alerta/30 bg-alerta-suave px-1.5 py-0.5 text-[10px] font-medium text-alerta">Conferir</span> : null}</div>
                        {p.rji ? <div className="text-xs text-muted-foreground">RJI {p.rji}</div> : null}
                        {p.situacao ? <div className="text-xs text-muted-foreground">{p.situacao}</div> : null}
                      </td>
                      <td className="px-2 py-2">{p.tipo_prisao}{p.especie_cautelar ? <div className="text-xs text-muted-foreground">{p.especie_cautelar}</div> : null}</td>
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
                      {podeEditar ? (
                        <td className="space-y-1 px-2 py-2 whitespace-nowrap">
                          <div><button className={BTN_P} onClick={() => setForm({ reu: p })}>Editar</button></div>
                          {p.tipo_prisao === "Prisão preventiva" ? <div><button className={BTN_P} onClick={() => setReav(p)}>Registrar reavaliação</button></div> : null}
                          <div><button className={BTN_P} onClick={() => setSoltar(p)}>Retirar da prisão</button></div>
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
