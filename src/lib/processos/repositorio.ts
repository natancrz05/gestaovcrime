import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ProcessoCompleto } from "./modelo";

/**
 * Acesso a dados do módulo de Processos (banco persistente).
 * As telas dependem apenas destas funções.
 */

const SELECAO =
  "*, partes(*), reus(*), movimentacoes(*), observacoes_internas(*), audiencias(*), pendencias(*), prioridades(*)";

export async function listarProcessosCompletos(): Promise<ProcessoCompleto[]> {
  const { data, error } = await supabase.from("processos").select(SELECAO).order("numero");
  if (error) throw error;
  return (data ?? []) as unknown as ProcessoCompleto[];
}

export async function obterProcesso(id: string): Promise<ProcessoCompleto | null> {
  const { data, error } = await supabase.from("processos").select(SELECAO).eq("id", id).maybeSingle();
  if (error) throw error;
  return data as unknown as ProcessoCompleto | null;
}

export const processosQuery = () =>
  queryOptions({ queryKey: ["processos"], staleTime: 30_000, queryFn: listarProcessosCompletos });

export const processoQuery = (id: string) =>
  queryOptions({ queryKey: ["processos", id], staleTime: 30_000, queryFn: () => obterProcesso(id) });

export interface NovoProcessoEntrada {
  numero: string;
  classe: string;
  assunto: string;
  data_distribuicao: string | null;
  status: string;
  fase: string;
  responsavel: string;
  observacao_geral: string;
  partes: { nome: string; tipo: string; observacao: string }[];
  reus: {
    nome: string;
    situacao: string;
    preso: boolean;
    tipo_prisao: string;
    data_prisao: string | null;
    observacoes: string;
  }[];
  movimentacao: { data: string; descricao: string; tipo: string } | null;
  observacao_interna: string;
}

export async function criarProcesso(e: NovoProcessoEntrada): Promise<string> {
  const { data, error } = await supabase
    .from("processos")
    .insert({
      numero: e.numero,
      classe: e.classe,
      assunto: e.assunto,
      data_distribuicao: e.data_distribuicao,
      status: e.status,
      fase: e.fase,
      responsavel: e.responsavel,
      observacao_geral: e.observacao_geral,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") throw new Error("Já existe um processo com este número.");
    throw error;
  }
  const id = data.id;
  const ops = [];
  if (e.partes.length) ops.push(supabase.from("partes").insert(e.partes.map((p) => ({ ...p, processo_id: id }))));
  if (e.reus.length)
    ops.push(supabase.from("reus").insert(e.reus.map((r, i) => ({ ...r, ordem: i, processo_id: id }))));
  if (e.movimentacao) ops.push(supabase.from("movimentacoes").insert({ ...e.movimentacao, processo_id: id }));
  if (e.observacao_interna.trim())
    ops.push(supabase.from("observacoes_internas").insert({ texto: e.observacao_interna, processo_id: id }));
  const res = await Promise.all(ops);
  const falha = res.find((r) => r.error);
  if (falha?.error) throw falha.error;
  return id;
}

export async function adicionarMovimentacao(m: {
  processo_id: string;
  data: string;
  descricao: string;
  tipo: string;
  observacao: string;
}) {
  const { error } = await supabase.from("movimentacoes").insert(m);
  if (error) throw error;
}

export async function adicionarReu(r: {
  processo_id: string;
  nome: string;
  situacao: string;
  preso: boolean;
  tipo_prisao: string;
  data_prisao: string | null;
  observacoes: string;
  ordem: number;
}) {
  const { error } = await supabase.from("reus").insert(r);
  if (error) throw error;
}

export async function adicionarParte(p: { processo_id: string; nome: string; tipo: string; observacao: string }) {
  const { error } = await supabase.from("partes").insert(p);
  if (error) throw error;
}

export async function adicionarObservacao(o: { processo_id: string; texto: string }) {
  const { error } = await supabase.from("observacoes_internas").insert(o);
  if (error) throw error;
}

export interface PrioridadeManualEntrada {
  processo_id: string;
  titulo: string;
  nivel: "alta" | "media" | "baixa";
  observacao: string;
}

export async function salvarPrioridadeManual(e: PrioridadeManualEntrada, id?: string) {
  const { error } = id
    ? await supabase.from("prioridades").update(e).eq("id", id)
    : await supabase.from("prioridades").insert(e);
  if (error) throw error;
}

export async function removerPrioridadeManual(id: string) {
  const { error } = await supabase.from("prioridades").delete().eq("id", id);
  if (error) throw error;
}

export interface AudienciaEntrada {
  processo_id: string;
  tipo: string;
  data: string;
  horario: string | null;
  modalidade: string;
  local: string;
  situacao: string;
  observacao: string;
  aguardando_nova_data?: boolean;
}

export async function salvarAudiencia(e: AudienciaEntrada, id?: string) {
  const { error } = id
    ? await supabase.from("audiencias").update(e as never).eq("id", id)
    : await supabase.from("audiencias").insert(e as never);
  if (error) throw error;
}

export async function removerAudiencia(id: string) {
  const { error } = await supabase.from("audiencias").delete().eq("id", id);
  if (error) throw error;
}


/** Consulta enxuta usada por campos de seleção de processo. */
export interface ProcessoParaSelecao {
  id: string;
  numero: string;
  classe: string;
  pje_reu: string | null;
  partes: { nome: string }[];
  reus: { nome: string; ordem: number }[];
}

export async function listarProcessosParaSelecao(): Promise<ProcessoParaSelecao[]> {
  const { data, error } = await supabase
    .from("processos")
    .select("id, numero, classe, pje_reu, partes(nome), reus(nome, ordem)")
    .order("numero");
  if (error) throw error;
  return (data ?? []) as unknown as ProcessoParaSelecao[];
}

export const processosSeletorQuery = () =>
  queryOptions({
    queryKey: ["processos-seletor"],
    staleTime: 30_000,
    queryFn: listarProcessosParaSelecao,
  });
