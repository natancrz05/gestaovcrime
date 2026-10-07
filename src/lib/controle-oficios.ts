import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ControleOficio {
  id: string;
  ano: number;
  sequencial: number;
  processo_id: string | null;
  data_expedicao: string;
  destinatario: string;
  finalidade: string;
  criado_por: string | null;
  criado_em: string;
  atualizado_em: string;
  processos: { numero: string } | null;
}

export interface ControleOficioEntrada {
  processo_id: string | null;
  data_expedicao: string;
  destinatario: string;
  finalidade: string;
}

export function formatarNumeroOficio(sequencial: number, ano: number) {
  return `${String(sequencial).padStart(2, "0")}/${ano}`;
}

async function listarControleOficios(): Promise<ControleOficio[]> {
  const pagina = 1000;
  const todos: ControleOficio[] = [];

  for (let inicio = 0; ; inicio += pagina) {
    const { data, error } = await supabase
      .from("controle_oficios")
      .select(
        "id,ano,sequencial,processo_id,data_expedicao,destinatario,finalidade,criado_por,criado_em,atualizado_em,processos(numero)",
      )
      .order("ano", { ascending: false })
      .order("sequencial", { ascending: false })
      .range(inicio, inicio + pagina - 1);

    if (error) throw new Error(error.message);

    const lote = (data ?? []) as unknown as ControleOficio[];
    todos.push(...lote);
    if (lote.length < pagina) break;
  }

  return todos;
}

export const controleOficiosQuery = () =>
  queryOptions({
    queryKey: ["controle-oficios"],
    staleTime: 30_000,
    queryFn: listarControleOficios,
  });

export async function criarControleOficio(entrada: ControleOficioEntrada) {
  const { data, error } = await supabase.rpc("criar_controle_oficio", {
    p_data_expedicao: entrada.data_expedicao,
    p_destinatario: entrada.destinatario.trim(),
    p_finalidade: entrada.finalidade.trim(),
    p_processo_id: entrada.processo_id || null,
  });

  if (error) throw new Error(error.message);
  const criado = data?.[0];
  if (!criado) throw new Error("O ofício foi enviado ao banco, mas a numeração não foi retornada.");
  return criado;
}

export async function atualizarControleOficio(
  oficio: Pick<ControleOficio, "id" | "ano">,
  entrada: ControleOficioEntrada,
) {
  const anoData = Number(entrada.data_expedicao.slice(0, 4));
  if (anoData !== oficio.ano) {
    throw new Error(
      `O número deste ofício pertence a ${oficio.ano}. Para preservar a sequência, mantenha a data nesse mesmo ano.`,
    );
  }

  const destinatario = entrada.destinatario.trim();
  const finalidade = entrada.finalidade.trim();
  if (!destinatario) throw new Error("Informe o destinatário.");
  if (!finalidade) throw new Error("Informe a finalidade / observação.");

  const { error } = await supabase
    .from("controle_oficios")
    .update({
      processo_id: entrada.processo_id || null,
      data_expedicao: entrada.data_expedicao,
      destinatario,
      finalidade,
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", oficio.id);

  if (error) throw new Error(error.message);
}

export async function removerControleOficio(id: string) {
  const { error } = await supabase.from("controle_oficios").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
