/**
 * Módulo de pendências (tarefas administrativas da serventia).
 * "Atrasada" é apenas critério de gestão: prazo interno anterior a hoje.
 */
import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { diasEntre, hojeISO, type PendenciaProcesso, type ProcessoCompleto } from "./modelo";

export const CONFIG_PENDENCIAS = {
  /** Prazo em até X dias é considerado "próximo". */
  diasPrazoProximo: 7,
};

export const TIPOS_PENDENCIA = [
  "Cumprir despacho", "Expedir/intimar", "Certificar decurso de prazo", "Carta precatória",
  "Resposta à acusação", "Contrarrazões", "Manifestação do Ministério Público", "Manifestação da defesa",
  "Audiência", "Mandado", "Juntada", "Verificar situação prisional", "Outros",
] as const;
export const STATUS_PENDENCIA = ["A fazer", "Em andamento", "Aguardando", "Concluída"] as const;
export const PRIORIDADES_PENDENCIA = [
  { valor: "alta", rotulo: "Alta" },
  { valor: "media", rotulo: "Média" },
  { valor: "baixa", rotulo: "Baixa" },
] as const;
export const rotuloPrioridade = (v: string) => PRIORIDADES_PENDENCIA.find((p) => p.valor === v)?.rotulo ?? v;

export interface PendenciaListada extends PendenciaProcesso {
  numero: string;
  dias: number | null;
  atrasada: boolean;
  prazoProximo: boolean;
  concluidaFlag: boolean;
}

export function estaConcluida(p: PendenciaProcesso) {
  return p.status === "Concluída" || p.concluida;
}

export function classificar(p: PendenciaProcesso, numero: string, hoje = hojeISO()): PendenciaListada {
  const concl = estaConcluida(p);
  const dias = p.prazo ? diasEntre(hoje, p.prazo) : null;
  return {
    ...p,
    numero,
    dias,
    concluidaFlag: concl,
    atrasada: !concl && dias !== null && dias < 0,
    prazoProximo: !concl && dias !== null && dias >= 0 && dias <= CONFIG_PENDENCIAS.diasPrazoProximo,
  };
}

export function listarPendenciasDe(processos: ProcessoCompleto[]): PendenciaListada[] {
  return processos
    .flatMap((pr) => pr.pendencias.map((x) => classificar(x, pr.numero)))
    .sort((a, b) => Number(a.concluidaFlag) - Number(b.concluidaFlag) || (a.prazo ?? "9999").localeCompare(b.prazo ?? "9999"));
}

async function listarPendencias(): Promise<PendenciaListada[]> {
  const pagina = 1000;
  const todas: PendenciaListada[] = [];

  for (let inicio = 0; ; inicio += pagina) {
    const { data, error } = await supabase
      .from("pendencias")
      .select("*, processos(numero)")
      .order("criado_em", { ascending: false })
      .range(inicio, inicio + pagina - 1);
    if (error) throw error;

    const lote = data ?? [];
    todas.push(
      ...lote.map((pendencia) =>
        classificar(
          pendencia as PendenciaProcesso,
          (pendencia.processos as { numero?: string } | null)?.numero ?? "Não vinculado",
        ),
      ),
    );
    if (lote.length < pagina) break;
  }

  return todas.sort(
    (a, b) =>
      Number(a.concluidaFlag) - Number(b.concluidaFlag) ||
      (a.prazo ?? "9999").localeCompare(b.prazo ?? "9999"),
  );
}

export const pendenciasQuery = () =>
  queryOptions({
    queryKey: ["pendencias"],
    staleTime: 30_000,
    queryFn: listarPendencias,
  });

/** Próximas ações: atrasadas → alta prioridade → prazo próximo (ordem fixa, sem pontuação). */
export function proximasAcoes(lista: PendenciaListada[]) {
  const abertas = lista.filter((p) => !p.concluidaFlag);
  const grupo = (p: PendenciaListada) => (p.atrasada ? 0 : p.prioridade === "alta" ? 1 : p.prazoProximo ? 2 : 3);
  return abertas
    .filter((p) => grupo(p) < 3)
    .sort((a, b) => grupo(a) - grupo(b) || (a.prazo ?? "9999").localeCompare(b.prazo ?? "9999"));
}

export interface PendenciaEntrada {
  processo_id: string;
  titulo: string;
  descricao: string;
  tipo: string;
  prazo: string | null;
  prioridade: "baixa" | "media" | "alta";
  status: string;
  responsavel: string;
  observacoes: string;
  data_conclusao: string | null;
}

export async function salvarPendencia(e: PendenciaEntrada, id?: string) {
  const concl = e.status === "Concluída";
  const reg = { ...e, concluida: concl, data_conclusao: concl ? e.data_conclusao ?? hojeISO() : null };
  const { error } = id
    ? await supabase.from("pendencias").update(reg).eq("id", id)
    : await supabase.from("pendencias").insert(reg);
  if (error) throw error;
}

export async function concluirPendencia(id: string) {
  const { error } = await supabase
    .from("pendencias")
    .update({ status: "Concluída", concluida: true, data_conclusao: hojeISO() })
    .eq("id", id);
  if (error) throw error;
}
