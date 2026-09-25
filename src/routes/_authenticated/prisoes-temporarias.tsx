import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Cabecalho, EstadoVazio } from "@/components/ui-serventia/Cabecalho";
import { Secao } from "@/components/processos/campos";
import { supabase } from "@/integrations/supabase/client";
import { formatarData } from "@/lib/dominio";
import { diasEntre, hojeISO } from "@/lib/processos/modelo";
import { ROTULO_TIPO_PROC, type ProcRel } from "@/lib/processos/importacao-reus";

interface Temp {
  id: string; processo_id: string | null; nome: string; situacao: string; data_prisao: string | null; rji: string;
  especie_cautelar: string; dados_planilha: Record<string, string>; processos_relacionados: ProcRel[];
  conferir: boolean; motivo_conferencia: string; processos: { numero: string } | null;
}

const tempQuery = () => queryOptions({
  queryKey: ["prisoes-temporarias"],
  queryFn: async () => {
    const { data, error } = await supabase.from("reus").select("*, processos(numero)").eq("preso", true).eq("tipo_prisao", "Prisão temporária").order("nome");
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as Temp[];
  },
});

export const Route = createFileRoute("/_authenticated/prisoes-temporarias")({
  head: () => ({
    meta: [
      { title: "Prisões Temporárias — Gestão da Vara Criminal" },
      { name: "description", content: "Controle de prazos de prisões temporárias em curso." },
      { property: "og:title", content: "Prisões Temporárias — Gestão da Vara Criminal" },
      { property: "og:description", content: "Controle de prazos de prisões temporárias em curso." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(tempQuery()),
  errorComponent: ({ error }) => <EstadoVazio titulo="Erro ao carregar prisões temporárias" descricao={error.message} />,
  component: Pagina,
});

function Pagina() {
  const { data } = useSuspenseQuery(tempQuery());
  const hoje = hojeISO();
  return (
    <div className="space-y-6">
      <Cabecalho titulo="Prisões Temporárias" subtitulo="Controle de prazos — verificar vencimento e necessidade de providência" />
      <Secao titulo={`Prisões temporárias (${data.length})`}>
        {data.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma prisão temporária registrada.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>{["Processo", "Réu custodiado", "Data da prisão", "Dias", "Processos relacionados", "Término / reavaliação"].map((h) => <th key={h} className="px-2 py-2 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-border align-top">
                {data.map((p) => {
                  const dp = p.dados_planilha ?? {};
                  return (
                    <tr key={p.id}>
                      <td className="px-2 py-2 text-xs whitespace-nowrap">
                        {p.processo_id ? <Link to="/processos/$id" params={{ id: p.processo_id }} className="numero-processo font-medium text-primary hover:underline">{p.processos?.numero}</Link>
                          : <span className="text-muted-foreground">Não vinculado</span>}
                      </td>
                      <td className="px-2 py-2">
                        <div className="font-medium">{p.nome}{p.conferir ? <span title={p.motivo_conferencia} className="ml-2 rounded border border-alerta/30 bg-alerta-suave px-1.5 py-0.5 text-[10px] font-medium text-alerta">Conferir</span> : null}</div>
                        {p.rji ? <div className="text-xs text-muted-foreground">RJI {p.rji}</div> : null}
                        {p.especie_cautelar ? <div className="text-xs text-muted-foreground">{p.especie_cautelar}</div> : null}
                      </td>
                      <td className="px-2 py-2">{formatarData(p.data_prisao)}</td>
                      <td className="px-2 py-2 tabular-nums">{p.data_prisao ? diasEntre(p.data_prisao, hoje) : dp["Dias preso (planilha)"] ?? "—"}</td>
                      <td className="px-2 py-2 text-xs">
                        {p.processos_relacionados.map((r, i) => (
                          <div key={i} className="whitespace-nowrap">
                            <span className="text-muted-foreground">{ROTULO_TIPO_PROC[r.tipo] ?? r.tipo}: </span>
                            {r.processo_id ? <Link to="/processos/$id" params={{ id: r.processo_id }} className="numero-processo text-primary hover:underline">{r.numero}</Link>
                              : <span className="numero-processo">{r.numero} <span className="text-alerta">(não vinculado)</span></span>}
                          </div>
                        ))}
                      </td>
                      <td className="px-2 py-2 text-xs">
                        {dp["Término de eventual prazo"] ? <div>Término: {formatarData(dp["Término de eventual prazo"])}</div> : null}
                        {dp["Data de reavaliação"] ? <div>Reavaliação: {formatarData(dp["Data de reavaliação"])}</div> : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Secao>
    </div>
  );
}
