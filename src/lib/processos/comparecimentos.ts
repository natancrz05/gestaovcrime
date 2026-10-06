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
  processo_id: string | null;
  pessoa: string;
  cpf: string;
  dados_planilha: Record<string, string> | null;
  conferir: boolean;
  motivo_conferencia: string;
  numeros_informados: string[];
  data_inicio: string;
  periodicidade: string;
  intervalo_meses: number;
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

async function listar(apenasAtivos = false): Promise<Comparecimento[]> {
  const pagina = 1000;
  const todos: Comparecimento[] = [];

  for (let inicio = 0; ; inicio += pagina) {
    let consulta = supabase
      .from("comparecimentos")
      .select(
        "*, processos(numero), comparecimento_registros(id,data_prevista,data_realizada,situacao,observacao,criado_em)",
      )
      // Listas, Dashboard e alertas só precisam do registro mais recente.
      // O histórico completo é buscado sob demanda ao abrir a ficha.
      .order("data_realizada", { referencedTable: "comparecimento_registros", ascending: false })
      .order("criado_em", { referencedTable: "comparecimento_registros", ascending: false })
      .limit(1, { referencedTable: "comparecimento_registros" })
      .order("proximo")
      .range(inicio, inicio + pagina - 1);

    if (apenasAtivos) consulta = consulta.neq("situacao", "Encerrado");
    const { data, error } = await consulta;
    if (error) throw new Error(error.message);

    const lote = (data ?? []) as unknown as Comparecimento[];
    todos.push(...lote);
    if (lote.length < pagina) break;
  }

  return todos;
}

export const comparecimentosQuery = () =>
  queryOptions({ queryKey: ["comparecimentos"], staleTime: 30_000, queryFn: () => listar(false) });

export const comparecimentosAtivosQuery = () =>
  queryOptions({
    queryKey: ["comparecimentos", "ativos"],
    staleTime: 30_000,
    queryFn: () => listar(true),
  });

export const comparecimentoHistoricoQuery = (comparecimentoId: string | null) =>
  queryOptions({
    queryKey: ["comparecimentos", comparecimentoId, "historico"],
    enabled: Boolean(comparecimentoId),
    staleTime: 30_000,
    queryFn: async (): Promise<RegistroComparecimento[]> => {
      if (!comparecimentoId) return [];
      const { data, error } = await supabase
        .from("comparecimento_registros")
        .select("id, data_prevista, data_realizada, situacao, observacao, criado_em")
        .eq("comparecimento_id", comparecimentoId)
        .order("data_realizada", { ascending: false })
        .order("criado_em", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as RegistroComparecimento[];
    },
  });

/** Último comparecimento: o mais recente entre o histórico e a "Data da última assinatura" importada. */
function ultimoDe(registro: string | undefined, dados: unknown): string | null {
  const v = (dados as Record<string, unknown> | null)?.["Data da última assinatura"];
  const planilha = typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined;
  if (registro && planilha) return registro > planilha ? registro : planilha;
  return registro ?? planilha ?? null;
}

const ORDEM = { vencido: 0, vencendo: 1, regular: 2 };

export function preparar(lista: Comparecimento[], hoje = hojeISO()): ComparecimentoListado[] {
  return lista
    .map((c) => {
      const historico = [...c.comparecimento_registros].sort(
        (a, b) => b.data_realizada.localeCompare(a.data_realizada) || b.criado_em.localeCompare(a.criado_em),
      );
      return {
        ...c,
        numero: c.processos?.numero ?? "Não vinculado",
        status: situacaoPorData(c.proximo, hoje),
        dias: diasEntre(hoje, c.proximo),
        ultimo: ultimoDe(historico[0]?.data_realizada, c.dados_planilha),
        historico,
      };
    })
    .sort((a, b) => {
      // Cadastros encerrados vão para o fim da lista.
      const e = Number(a.situacao === "Encerrado") - Number(b.situacao === "Encerrado");
      return e || ORDEM[a.status] - ORDEM[b.status] || a.proximo.localeCompare(b.proximo);
    });
}

/**
 * Periodicidade = intervalo definido para aquele processo (decisão, acordo ou
 * medida aplicável). Não presume previsão legal específica.
 */
export const PERIODICIDADES = [
  { v: "Mensal", meses: 1 },
  { v: "Bimestral", meses: 2 },
  { v: "Trimestral", meses: 3 },
  { v: "Quadrimestral", meses: 4 },
  { v: "Semestral", meses: 6 },
  { v: "Anual", meses: 12 },
  { v: "Personalizado", meses: 0 },
] as const;

export function mesesDe(periodicidade: string, personalizado: number): number {
  const p = PERIODICIDADES.find((x) => x.v === periodicidade);
  return p && p.meses > 0 ? p.meses : Math.max(1, Math.min(120, Math.floor(personalizado) || 1));
}

/** Soma N meses mantendo o dia; se o dia não existir, usa o último dia do mês (ex.: 31/01 + 1 → 28/02). */
export function somarMeses(iso: string, n = 1): string {
  const [a, m, d] = iso.split("-").map(Number) as [number, number, number];
  const total = a * 12 + (m - 1) + n;
  const na = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const ultimoDia = new Date(na, nm, 0).getDate();
  return `${na}-${String(nm).padStart(2, "0")}-${String(Math.min(d, ultimoDia)).padStart(2, "0")}`;
}
export const somarMes = (iso: string) => somarMeses(iso, 1);

export interface ComparecimentoEntrada {
  processo_id: string;
  pessoa: string;
  data_inicio: string;
  periodicidade: string;
  intervalo_meses: number;
  proximo: string;
  observacao: string;
  situacao: string;
}

export async function salvarComparecimento(v: ComparecimentoEntrada, id?: string) {
  const dados = { ...v, ...(v.processo_id ? { conferir: false, motivo_conferencia: "" } : {}), pessoa: v.pessoa.trim().slice(0, 200), observacao: v.observacao.slice(0, 1000), intervalo_meses: mesesDe(v.periodicidade, v.intervalo_meses) };
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

export async function encerrarComparecimento(id: string) {
  const { error } = await supabase.from("comparecimentos").update({ situacao: "Encerrado" }).eq("id", id);
  if (error) throw new Error(error.message);
}
