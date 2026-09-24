/**
 * Tipos de domínio do sistema de gestão da serventia.
 *
 * Esta camada é intencionalmente independente da UI e de qualquer fonte de
 * dados. Nas próximas etapas, os repositórios em `src/lib/repositorio.ts`
 * poderão passar a consultar um banco de dados sem alterar as telas.
 */

export type SinalizadorTipo =
  | "reu-preso"
  | "prisao-temporaria"
  | "sem-movimentacao"
  | "audiencia-proxima"
  | "audiencia-distante"
  | "pendencia"
  | "prazo-proximo";

export type Severidade = "urgente" | "atencao" | "alerta" | "info" | "concluido";

export interface Sinalizador {
  tipo: SinalizadorTipo;
  rotulo: string;
  severidade: Severidade;
}

export interface Processo {
  id: string;
  numero: string;
  classe: string;
  assunto: string;
  fase: string;
  ultimaMovimentacao: string; // ISO date
  descricaoUltimaMovimentacao: string;
  diasSemMovimentacao: number;
  proximaAudiencia: string | null; // ISO date
  proximaProvidencia: string;
  responsavel: string;
  sinalizadores: Sinalizador[];
}

export interface Pendencia {
  id: string;
  processoNumero: string;
  descricao: string;
  prazo: string | null; // ISO date
  severidade: Severidade;
}

export interface ProximaAcao {
  id: string;
  descricao: string;
  processoNumero: string;
  prazo: string | null;
  severidade: Severidade;
}

export interface Audiencia {
  id: string;
  processoNumero: string;
  tipo: string;
  data: string; // ISO date
  local: string;
  situacao: "Designada" | "Redesignada" | "Confirmada";
}

export const SEVERIDADE_CLASSES: Record<Severidade, string> = {
  urgente: "bg-urgente-suave text-urgente border-urgente/25",
  atencao: "bg-atencao-suave text-atencao border-atencao/25",
  alerta: "bg-alerta-suave text-alerta border-alerta/30",
  info: "bg-info-suave text-info border-info/25",
  concluido: "bg-concluido-suave text-concluido border-concluido/25",
};

export function formatarData(iso: string | null): string {
  if (!iso) return "—";
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

/** Dias entre hoje (data de referência fixa dos dados fictícios) e a data. */
export const DATA_REFERENCIA = "2026-09-24";

export function diasAte(iso: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - new Date(DATA_REFERENCIA).getTime();
  return Math.round(ms / 86_400_000);
}
