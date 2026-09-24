import { AUDIENCIAS, PENDENCIAS, PROCESSOS, PROXIMAS_ACOES } from "./dados-ficticios";
import type { Audiencia, Pendencia, Processo, ProximaAcao, SinalizadorTipo } from "./dominio";

/**
 * Camada de acesso a dados.
 *
 * Hoje retorna dados fictícios em memória. Nas próximas etapas estas funções
 * serão trocadas por consultas ao banco (mantendo a mesma assinatura), sem
 * impacto nas páginas.
 */

export function listarProcessos(): Processo[] {
  return PROCESSOS;
}

export function listarProcessosPor(tipo: SinalizadorTipo): Processo[] {
  return PROCESSOS.filter((p) => p.sinalizadores.some((s) => s.tipo === tipo));
}

export function listarProcessosPrioritarios(): Processo[] {
  return PROCESSOS.filter((p) =>
    p.sinalizadores.some((s) => s.severidade === "urgente" || s.severidade === "atencao"),
  ).sort((a, b) => b.diasSemMovimentacao - a.diasSemMovimentacao);
}

export function listarPendencias(): Pendencia[] {
  return PENDENCIAS;
}

export function listarProximasAcoes(): ProximaAcao[] {
  return PROXIMAS_ACOES;
}

export function listarAudiencias(): Audiencia[] {
  return [...AUDIENCIAS].sort((a, b) => a.data.localeCompare(b.data));
}

export interface IndicadorPainel {
  chave: string;
  titulo: string;
  valor: number;
  descricao: string;
  severidade: "urgente" | "atencao" | "alerta" | "info" | "concluido";
  para: string;
}

export function obterIndicadores(): IndicadorPainel[] {
  const semMov = PROCESSOS.filter((p) => p.diasSemMovimentacao > 100).length;
  return [
    {
      chave: "reus-presos",
      titulo: "Réus presos",
      valor: listarProcessosPor("reu-preso").length,
      descricao: "Processos com réu custodiado",
      severidade: "urgente",
      para: "/reus-presos",
    },
    {
      chave: "prisoes-temporarias",
      titulo: "Prisões temporárias",
      valor: listarProcessosPor("prisao-temporaria").length,
      descricao: "Prazos em curso a controlar",
      severidade: "urgente",
      para: "/prisoes-temporarias",
    },
    {
      chave: "sem-movimentacao",
      titulo: "+100 dias sem movimentação",
      valor: semMov,
      descricao: "Acervo parado",
      severidade: "atencao",
      para: "/sem-movimentacao",
    },
    {
      chave: "audiencias-proximas",
      titulo: "Audiências próximas",
      valor: listarProcessosPor("audiencia-proxima").length,
      descricao: "Nos próximos 30 dias",
      severidade: "alerta",
      para: "/audiencias",
    },
    {
      chave: "audiencias-distantes",
      titulo: "Audiências com prazo extenso",
      valor: listarProcessosPor("audiencia-distante").length,
      descricao: "Designadas para data distante",
      severidade: "info",
      para: "/audiencias",
    },
    {
      chave: "pendencias",
      titulo: "Pendências",
      valor: PENDENCIAS.length,
      descricao: "Itens em aberto na serventia",
      severidade: "atencao",
      para: "/pendencias",
    },
    {
      chave: "prazos",
      titulo: "Prazos próximos",
      valor: listarProcessosPor("prazo-proximo").length,
      descricao: "Vencimento em até 7 dias",
      severidade: "alerta",
      para: "/prioridades",
    },
    {
      chave: "atencao",
      titulo: "Processos que exigem atenção",
      valor: listarProcessosPrioritarios().length,
      descricao: "Reunião de todas as prioridades",
      severidade: "urgente",
      para: "/prioridades",
    },
  ];
}
