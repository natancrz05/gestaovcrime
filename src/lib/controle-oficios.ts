import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ControleOficio {
  id: string;
  ano: number;
  sequencial: number | null;
  processo_id: string | null;
  data_expedicao: string | null;
  destinatario: string;
  finalidade: string;
  numero_original: string | null;
  processo_original: string | null;
  data_original: string | null;
  historico_importado: boolean;
  fonte_importacao: string | null;
  chave_importacao: string | null;
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

export function numeroDoControleOficio(
  oficio: Pick<ControleOficio, "ano" | "sequencial" | "numero_original">,
) {
  if (oficio.numero_original?.trim()) return oficio.numero_original.trim();
  return oficio.sequencial !== null
    ? formatarNumeroOficio(oficio.sequencial, oficio.ano)
    : "—";
}

export function dataDoControleOficio(
  oficio: Pick<ControleOficio, "historico_importado" | "data_original" | "data_expedicao">,
) {
  if (oficio.historico_importado && oficio.data_original?.trim()) {
    return oficio.data_original.trim();
  }
  return oficio.data_expedicao
    ? oficio.data_expedicao.split("-").reverse().join("/")
    : "—";
}

async function listarControleOficios(): Promise<ControleOficio[]> {
  const pagina = 1000;
  const todos: ControleOficio[] = [];

  for (let inicio = 0; ; inicio += pagina) {
    const { data, error } = await supabase
      .from("controle_oficios")
      .select(
        "id,ano,sequencial,processo_id,data_expedicao,destinatario,finalidade,numero_original,processo_original,data_original,historico_importado,fonte_importacao,chave_importacao,criado_por,criado_em,atualizado_em,processos(numero)",
      )
      .order("ano", { ascending: false })
      .order("sequencial", { ascending: false, nullsFirst: false })
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

async function consultarProximoNumeroControleOficio(ano: number): Promise<number> {
  const { data, error } = await supabase.rpc("proximo_numero_controle_oficio", {
    p_ano: ano,
  });

  if (error) throw new Error(error.message);
  if (typeof data !== "number") {
    throw new Error("Não foi possível identificar a próxima numeração de ofício.");
  }

  return data;
}

export const proximoNumeroControleOficioQuery = (ano: number) =>
  queryOptions({
    queryKey: ["controle-oficios-proximo", ano],
    staleTime: 5_000,
    queryFn: () => consultarProximoNumeroControleOficio(ano),
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
  oficio: Pick<ControleOficio, "id" | "ano" | "historico_importado">,
  entrada: ControleOficioEntrada,
) {
  if (oficio.historico_importado) {
    throw new Error("Registros históricos importados são preservados como constam na planilha original.");
  }

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
  const { error } = await supabase.rpc("excluir_controle_oficio", {
    p_id: id,
  });
  if (error) throw new Error(error.message);
}
