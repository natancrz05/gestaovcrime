/**
 * Central de Audiências: identifica processos aguardando marcação de
 * audiência a partir do campo TAREFAS (planilha do PJe). Critério
 * administrativo de acompanhamento — sem conclusão jurídica.
 */
import { contagemSuspensa, diasEntre, hojeISO, proximaAudiencia, reuPrincipal, ultimaMovimentacao, type ProcessoCompleto } from "./modelo";

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
  // Audiência cadastrada e pendente (Agendada/Redesignada/aguardando nova data) já está no fluxo operacional.
  const pendente = p.audiencias.some((a) => a.situacao !== "Realizada" && a.situacao !== "Cancelada");
  // Audiência Realizada após a informação da planilha: a espera foi atendida. Não reinicia contagem.
  const ref = p.pje_ultima_mov_data ?? "";
  const realizadaDepois = p.audiencias.some((a) => a.situacao === "Realizada" && (a.data_realizacao ?? a.data) >= ref);
  if (realizadaDepois && !pendente) return null;
  // Contagem pela DATA ULT MOV da planilha; movimentação "Audiência realizada" não inicia nova espera.
  const movs = ultimaMovimentacao(p);
  const movValida = movs && !/audi[eê]ncia realizada/i.test(movs.descricao) ? movs.data : null;
  const datas = [p.pje_ultima_mov_data, movValida].filter(Boolean) as string[];
  const ultimaMov = datas.sort().at(-1) ?? null;
  const dias = ultimaMov && !contagemSuspensa(p) ? diasEntre(ultimaMov, hoje) : null;
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
