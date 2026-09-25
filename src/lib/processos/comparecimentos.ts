/** Controle de comparecimentos periódicos (mensais). Apenas acompanhamento administrativo. */
import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { diasEntre, hojeISO } from "./modelo";

export const CONFIG_COMPARECIMENTOS = { diasVencendo: 7 };

export type SituacaoComparecimento = "vencido" | "vencendo" | "regular";

export const SITUACOES_COMP: { chave: SituacaoComparecimento; rotulo: string; classe: string; ponto: string }[] = [
  { chave: "vencido", rotulo: "Vencido", classe: "bg-urgente-suave text-urgente border-urgente/25", ponto: "bg-urgente" },
  { chave: "vencendo", rotulo: "Vencendo", classe: "bg-alerta-suave text-alerta border-alerta/30", ponto: "bg-alerta" },
  { chave: "regular", rotulo: "Regular", classe: "bg-concluido-suave text-concluido border-concluido/25", ponto: "bg-concluido" },
];

export interface RegistroComparecimento {
  id: string;
  data_prevista: string;
  data_realizada: string;
  situacao: string;
  observacao: string;
  criado_em: string;
}

export interface Comparecimento {
  id: string;
  processo_id: string;
  pessoa: string;
  data_inicio: string;
  periodicidade: string;
  proximo: string;
  observacao: string;
  situacao: string;
  criado_em: string;
  processos: { numero: string } | null;
  comparecimento_registros: RegistroComparecimento[];
}

export interface ComparecimentoListado extends Comparecimento {
  numero: string;
  status: SituacaoComparecimento;
  dias: number;
  ultimo: string | null;
  historico: RegistroComparecimento[];
}

export function situacaoPorData(proximo: string, hoje = hojeISO()): SituacaoComparecimento {
  const d = diasEntre(hoje, proximo);
  if (d < 0) return "vencido";
  if (d <= CONFIG_COMPARECIMENTOS.diasVencendo) return "vencendo";
  return "regular";
}

async function listar(): Promise<Comparecimento[]> {
  const { data, error } = await supabase
    .from("comparecimentos")
    .select("*, processos(numero), comparecimento_registros(*)")
    .order("proximo");
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Comparecimento[];
}

export const comparecimentosQuery = () => queryOptions({ queryKey: ["comparecimentos"], queryFn: listar });

const ORDEM = { vencido: 0, vencendo: 1, regular: 2 };

export function preparar(lista: Comparecimento[], hoje = hojeISO()): ComparecimentoListado[] {
  return lista
    .map((c) => {
      const historico = [...c.comparecimento_registros].sort(
        (a, b) => b.data_realizada.localeCompare(a.data_realizada) || b.criado_em.localeCompare(a.criado_em),
      );
      return {
        ...c,
        numero: c.processos?.numero ?? "—",
        status: situacaoPorData(c.proximo, hoje),
        dias: diasEntre(hoje, c.proximo),
        ultimo: historico[0]?.data_realizada ?? null,
        historico,
      };
    })
    .sort((a, b) => {
      // Cadastros encerrados vão para o fim da lista.
      const e = Number(a.situacao === "Encerrado") - Number(b.situacao === "Encerrado");
      return e || ORDEM[a.status] - ORDEM[b.status] || a.proximo.localeCompare(b.proximo);
    });
}

/** Soma um mês mantendo o dia (ex.: 10/09 → 10/10). */
export function somarMes(iso: string): string {
  const [a, m, d] = iso.split("-").map(Number) as [number, number, number];
  const ultimoDia = new Date(a, m + 1, 0).getDate();
  const nm = m === 12 ? 1 : m + 1;
  const na = m === 12 ? a + 1 : a;
  return `${na}-${String(nm).padStart(2, "0")}-${String(Math.min(d, ultimoDia)).padStart(2, "0")}`;
}

export interface ComparecimentoEntrada {
  processo_id: string;
  pessoa: string;
  data_inicio: string;
  proximo: string;
  observacao: string;
  situacao: string;
}

export async function salvarComparecimento(v: ComparecimentoEntrada, id?: string) {
  const dados = { ...v, pessoa: v.pessoa.trim().slice(0, 200), observacao: v.observacao.slice(0, 1000), periodicidade: "Mensal" };
  const { error } = id
    ? await supabase.from("comparecimentos").update(dados).eq("id", id)
    : await supabase.from("comparecimentos").insert(dados);
  if (error) throw new Error(error.message);
}

export async function registrarComparecimento(id: string, data: string, obs: string) {
  const { data: r, error } = await supabase.rpc("registrar_comparecimento", { p_id: id, p_data: data, p_obs: obs });
  if (error) throw new Error(error.message);
  return r as string;
}
