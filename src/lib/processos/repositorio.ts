import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ProcessoCompleto } from "./modelo";
import { tipoAudienciaCanonico } from "./audiencias";

/**
 * Acesso a dados do módulo de Processos (banco persistente).
 * As telas dependem apenas destas funções.
 */

const SELECAO =
  "*, partes(*), reus(*), movimentacoes(*), observacoes_internas(*), audiencias(*), pendencias(*), prioridades(*)";

export async function listarProcessosCompletos(): Promise<ProcessoCompleto[]> {
  const pagina = 1000;
  const todos: ProcessoCompleto[] = [];

  for (let inicio = 0; ; inicio += pagina) {
    const { data, error } = await supabase
      .from("processos")
      .select(SELECAO)
      .order("numero")
      .range(inicio, inicio + pagina - 1);
    if (error) throw error;

    const lote = (data ?? []) as unknown as ProcessoCompleto[];
    todos.push(...lote);
    if (lote.length < pagina) break;
  }

  return todos;
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

export interface EtiquetaDoProcesso {
  id: string;
  nome: string;
  cor: string;
  favorita: boolean;
}

/**
 * Etiquetas são persistidas no Supabase e compartilhadas entre todos os usuários.
 * Elas permanecem fora da consulta central de processos para não afetar os demais módulos.
 */
export async function listarEtiquetasDoProcesso(processoId: string): Promise<EtiquetaDoProcesso[]> {
  const { data, error } = await supabase
    .from("processos_etiquetas")
    .select("etiqueta_id")
    .eq("processo_id", processoId);
  if (error) throw error;
  const ids = (data ?? []).map((x) => x.etiqueta_id);
  if (!ids.length) return [];

  const { data: etiquetas, error: etiquetasError } = await supabase
    .from("etiquetas")
    .select("id, nome, cor, favorita")
    .in("id", ids)
    .order("nome");
  if (etiquetasError) throw etiquetasError;
  return (etiquetas ?? []) as EtiquetaDoProcesso[];
}

export async function listarEtiquetasPorProcessos(processoIds: string[]): Promise<Record<string, EtiquetaDoProcesso[]>> {
  const unicos = [...new Set(processoIds.filter(Boolean))];
  if (!unicos.length) return {};

  // Evita enviar centenas/milhares de UUIDs em um único filtro `.in()`.
  // Em telas grandes (ex.: acervo com ~1.000 processos), a URL do PostgREST
  // pode ultrapassar o limite e a consulta de etiquetas falhar silenciosamente
  // na interface. Lotes menores mantêm a mesma fonte de dados para todo o sistema.
  const TAMANHO_LOTE = 100;
  const vinculos: { processo_id: string; etiqueta_id: string }[] = [];

  for (let i = 0; i < unicos.length; i += TAMANHO_LOTE) {
    const lote = unicos.slice(i, i + TAMANHO_LOTE);
    const { data, error } = await supabase
      .from("processos_etiquetas")
      .select("processo_id, etiqueta_id")
      .in("processo_id", lote);
    if (error) throw error;
    vinculos.push(...(data ?? []));
  }

  const ids = [...new Set(vinculos.map((x) => x.etiqueta_id))];
  const resultado: Record<string, EtiquetaDoProcesso[]> = Object.fromEntries(
    unicos.map((id) => [id, [] as EtiquetaDoProcesso[]]),
  );
  if (!ids.length) return resultado;

  const etiquetas: EtiquetaDoProcesso[] = [];
  for (let i = 0; i < ids.length; i += TAMANHO_LOTE) {
    const lote = ids.slice(i, i + TAMANHO_LOTE);
    const { data, error } = await supabase
      .from("etiquetas")
      .select("id, nome, cor, favorita")
      .in("id", lote)
      .order("nome");
    if (error) throw error;
    etiquetas.push(...((data ?? []) as EtiquetaDoProcesso[]));
  }

  const porId = new Map(etiquetas.map((e) => [e.id, e]));
  for (const vinculo of vinculos) {
    const etiqueta = porId.get(vinculo.etiqueta_id);
    if (etiqueta) resultado[vinculo.processo_id]?.push(etiqueta);
  }

  for (const lista of Object.values(resultado)) {
    lista.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }

  return resultado;
}

export const etiquetasDoProcessoQuery = (processoId: string) =>
  queryOptions({
    queryKey: ["processos", processoId, "etiquetas"],
    staleTime: 30_000,
    queryFn: () => listarEtiquetasDoProcesso(processoId),
  });

export const etiquetasDosProcessosQuery = (processoIds: string[]) =>
  queryOptions({
    queryKey: ["processos", "etiquetas", [...processoIds].sort()],
    staleTime: 30_000,
    queryFn: () => listarEtiquetasPorProcessos(processoIds),
    enabled: processoIds.length > 0,
  });

export async function listarEtiquetas(): Promise<EtiquetaDoProcesso[]> {
  const { data, error } = await supabase
    .from("etiquetas")
    .select("id, nome, cor, favorita")
    .order("favorita", { ascending: false })
    .order("nome");
  if (error) throw error;
  return (data ?? []) as EtiquetaDoProcesso[];
}

export const etiquetasQuery = () =>
  queryOptions({
    queryKey: ["etiquetas"],
    staleTime: 30_000,
    queryFn: listarEtiquetas,
  });

export interface EtiquetaEntrada {
  nome: string;
  cor: string;
  favorita: boolean;
}

export async function salvarEtiqueta(e: EtiquetaEntrada, id?: string): Promise<string> {
  const payload = { nome: e.nome.trim(), cor: e.cor, favorita: e.favorita };
  if (!payload.nome) throw new Error("Informe o nome da etiqueta.");
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Usuário não autenticado.");

  const resultado = id
    ? await supabase.from("etiquetas").update(payload).eq("id", id).select("id").single()
    : await supabase.from("etiquetas").insert({ ...payload, criado_por: userData.user.id }).select("id").single();

  if (resultado.error) {
    if (resultado.error.code === "23505") throw new Error("Já existe uma etiqueta com este nome.");
    throw new Error(`${resultado.error.message} [${resultado.error.code ?? "sem código"}]`);
  }
  return resultado.data.id;
}

export async function removerEtiqueta(id: string) {
  const { error } = await supabase.from("etiquetas").delete().eq("id", id);
  if (error) throw error;
}

export async function adicionarEtiquetaAoProcesso(processoId: string, etiquetaId: string) {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase.from("processos_etiquetas").insert({
    processo_id: processoId,
    etiqueta_id: etiquetaId,
    criado_por: userData.user?.id ?? null,
  });
  if (error && error.code !== "23505") throw error;
}

export async function removerEtiquetaDoProcesso(processoId: string, etiquetaId: string) {
  const { error } = await supabase
    .from("processos_etiquetas")
    .delete()
    .eq("processo_id", processoId)
    .eq("etiqueta_id", etiquetaId);
  if (error) throw error;
}

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
  nivel: "critico" | "alta" | "media" | "conferir" | "baixa";
  observacao: string;
}

export async function salvarPrioridadeManual(e: PrioridadeManualEntrada, id?: string) {
  const { error } = id
    ? await supabase.from("prioridades").update(e).eq("id", id)
    : await supabase.from("prioridades").insert(e);
  if (error) {
    const nivelNaoHabilitado =
      error.code === "23514" && error.message.includes("prioridades_nivel_check");
    throw new Error(
      nivelNaoHabilitado
        ? "O nível escolhido ainda não está habilitado para prioridades manuais. A atualização do sistema precisa ser concluída."
        : error.message,
    );
  }
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
  const horario = e.horario ? e.horario.slice(0, 5) : null;
  let consulta = supabase
    .from("audiencias")
    .select("id, processo_id, tipo, horario")
    .eq("data", e.data);

  consulta = horario ? consulta.eq("horario", horario) : consulta.is("horario", null);
  const { data: existentes, error: consultaError } = await consulta;
  if (consultaError) throw consultaError;

  const finalidade = tipoAudienciaCanonico(e.tipo);
  const doMesmoProcesso = (existentes ?? []).filter((a) => a.id !== id && a.processo_id === e.processo_id);

  const duplicada = doMesmoProcesso.find((a) =>
    tipoAudienciaCanonico(a.tipo) === finalidade &&
    (a.horario ?? "").slice(0, 5) === (horario ?? ""),
  );
  if (duplicada) throw new Error("Esta audiência já está cadastrada para o processo, na mesma data, horário e finalidade.");

  const mesmoHorario = doMesmoProcesso.find((a) =>
    (a.horario ?? "").slice(0, 5) === (horario ?? ""),
  );
  if (mesmoHorario) throw new Error("O processo já possui outra audiência neste mesmo horário.");

  const payload = { ...e, tipo: finalidade, horario };
  const { error } = id
    ? await supabase.from("audiencias").update(payload as never).eq("id", id)
    : await supabase.from("audiencias").insert(payload as never);
  if (error) throw error;
}

export async function removerAudiencia(id: string) {
  const { error } = await supabase.from("audiencias").delete().eq("id", id);
  if (error) throw error;
}


/** Consulta mínima para telas que precisam apenas identificar o processo. */
export interface ProcessoReferencia {
  id: string;
  numero: string;
}

export async function listarProcessosReferencia(): Promise<ProcessoReferencia[]> {
  const pagina = 1000;
  const todos: ProcessoReferencia[] = [];

  for (let inicio = 0; ; inicio += pagina) {
    const { data, error } = await supabase
      .from("processos")
      .select("id, numero")
      .order("numero")
      .range(inicio, inicio + pagina - 1);
    if (error) throw error;

    const lote = (data ?? []) as ProcessoReferencia[];
    todos.push(...lote);
    if (lote.length < pagina) break;
  }

  return todos;
}

export const processosReferenciaQuery = () =>
  queryOptions({
    queryKey: ["processos-referencia"],
    staleTime: 60_000,
    queryFn: listarProcessosReferencia,
  });

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
  const pagina = 1000;
  const todos: ProcessoParaSelecao[] = [];

  for (let inicio = 0; ; inicio += pagina) {
    const { data, error } = await supabase
      .from("processos")
      .select("id, numero, classe, pje_reu, partes(nome), reus(nome, ordem)")
      .order("numero")
      .range(inicio, inicio + pagina - 1);
    if (error) throw error;

    const lote = (data ?? []) as unknown as ProcessoParaSelecao[];
    todos.push(...lote);
    if (lote.length < pagina) break;
  }

  return todos;
}

export const processosSeletorQuery = () =>
  queryOptions({
    queryKey: ["processos-seletor"],
    staleTime: 30_000,
    queryFn: listarProcessosParaSelecao,
  });
