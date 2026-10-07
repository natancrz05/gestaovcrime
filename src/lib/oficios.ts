import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Oficio {
  id: string;
  ano: number;
  sequencial: number;
  numero: string;
  processo_id: string | null;
  data_expedicao: string;
  destinatario: string;
  finalidade: string;
  criado_por: string | null;
  criado_em: string;
  atualizado_em: string;
  processos: { numero: string } | null;
}

export interface OficioEntrada {
  processo_id: string | null;
  data_expedicao: string;
  destinatario: string;
  finalidade: string;
}

async function listarOficios(ano?: number): Promise<Oficio[]> {
  const pagina = 1000;
  const todos: Oficio[] = [];

  for (let inicio = 0; ; inicio += pagina) {
    let consulta = supabase
      .from("oficios")
      .select("*, processos(numero)")
      .order("ano", { ascending: false })
      .order("sequencial", { ascending: false })
      .range(inicio, inicio + pagina - 1);

    if (ano) consulta = consulta.eq("ano", ano);

    const { data, error } = await consulta;
    if (error) throw error;

    const lote = (data ?? []) as unknown as Oficio[];
    todos.push(...lote);
    if (lote.length < pagina) break;
  }

  return todos;
}

export const oficiosQuery = (ano?: number) =>
  queryOptions({
    queryKey: ano ? ["oficios", ano] : ["oficios"],
    staleTime: 30_000,
    queryFn: () => listarOficios(ano),
  });

export async function criarOficio(entrada: OficioEntrada): Promise<string> {
  const { data, error } = await supabase.rpc("criar_oficio", {
    p_processo_id: entrada.processo_id || null,
    p_data_expedicao: entrada.data_expedicao,
    p_destinatario: entrada.destinatario.trim(),
    p_finalidade: entrada.finalidade.trim(),
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function atualizarOficio(
  id: string,
  ano: number,
  entrada: OficioEntrada,
) {
  if (Number(entrada.data_expedicao.slice(0, 4)) !== ano) {
    throw new Error(
      `O ofício pertence a ${ano}. Para preservar a numeração, a data deve permanecer nesse mesmo ano.`,
    );
  }

  const payload = {
    processo_id: entrada.processo_id || null,
    data_expedicao: entrada.data_expedicao,
    destinatario: entrada.destinatario.trim(),
    finalidade: entrada.finalidade.trim(),
    atualizado_em: new Date().toISOString(),
  };

  if (!payload.destinatario) throw new Error("Informe o destinatário.");
  if (!payload.finalidade) throw new Error("Informe a finalidade do ofício.");

  const { error } = await supabase.from("oficios").update(payload).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function removerOficio(id: string) {
  const { error } = await supabase.from("oficios").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export const numeroOficio = (sequencial: number, ano: number) =>
  `${String(sequencial).padStart(2, "0")}/${ano}`;
