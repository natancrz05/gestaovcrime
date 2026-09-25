/**
 * Central de Audiências: identifica processos aguardando marcação de
 * audiência a partir do campo TAREFAS (planilha do PJe). Critério
 * administrativo de acompanhamento — sem conclusão jurídica.
 */
import { diasEntre, hojeISO, proximaAudiencia, reuPrincipal, ultimaMovimentacao, type ProcessoCompleto } from "./modelo";

export type NivelAudiencia = "critica" | "alta" | "normal";

export const CONFIG_CENTRAL = { inicioAlta: 60, limiteAlta: 100 };

export const NIVEIS_AUDIENCIA: { chave: NivelAudiencia; rotulo: string; classe: string; ponto: string }[] = [
  { chave: "critica", rotulo: "Crítica", classe: "bg-urgente-suave text-urgente border-urgente/25", ponto: "bg-urgente" },
  { chave: "alta", rotulo: "Alta", classe: "bg-atencao-suave text-atencao border-atencao/25", ponto: "bg-atencao" },
  { chave: "normal", rotulo: "Normal", classe: "bg-concluido-suave text-concluido border-concluido/25", ponto: "bg-concluido" },
];

const normalizar = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** TAREFAS menciona audiência (audiência, marcar/designar audiência, etc.). */
export function tarefaIndicaAudiencia(tarefas: string | null | undefined): boolean {
  return !!tarefas && /audiencia/.test(normalizar(tarefas));
}

export function nivelPorDias(dias: number): NivelAudiencia {
  if (dias > CONFIG_CENTRAL.limiteAlta) return "critica";
  if (dias >= CONFIG_CENTRAL.inicioAlta) return "alta";
  return "normal";
}

export interface ItemCentral {
  processo: ProcessoCompleto;
  reu: string;
  ultimaMov: string | null;
  dias: number | null;
  nivel: NivelAudiencia;
  proxima: ReturnType<typeof proximaAudiencia>;
}

export function itemCentral(p: ProcessoCompleto, hoje = hojeISO()): ItemCentral | null {
  if (!tarefaIndicaAudiencia(p.pje_tarefas)) return null;
  // Fonte principal: DATA ULT MOV da planilha; na falta dela, a última movimentação registrada.
  const ultimaMov = p.pje_ultima_mov_data ?? ultimaMovimentacao(p)?.data ?? null;
  const dias = ultimaMov ? diasEntre(ultimaMov, hoje) : null;
  return {
    processo: p,
    reu: reuPrincipal(p)?.nome ?? p.pje_reu ?? "—",
    ultimaMov,
    dias,
    nivel: dias === null ? "normal" : nivelPorDias(dias),
    proxima: proximaAudiencia(p, hoje),
  };
}

export function listarCentral(processos: ProcessoCompleto[], hoje = hojeISO()): ItemCentral[] {
  const ordem = { critica: 0, alta: 1, normal: 2 };
  return processos
    .map((p) => itemCentral(p, hoje))
    .filter((x): x is ItemCentral => !!x)
    .sort((a, b) => ordem[a.nivel] - ordem[b.nivel] || (b.dias ?? 0) - (a.dias ?? 0));
}
