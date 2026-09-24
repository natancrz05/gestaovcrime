/**
 * Módulo de audiências. "Prazo extenso" é apenas critério administrativo de
 * acompanhamento — não indica irregularidade nem excesso de prazo.
 */
import { diasEntre, hojeISO, reuPrincipal, type AudienciaProcesso, type ProcessoCompleto } from "./modelo";

export const CONFIG_AUDIENCIAS = {
  /** Audiência marcada para mais de X dias a partir de hoje. */
  limiteDiasPrazoExtenso: 90,
};

export const TIPOS_AUDIENCIA = ["Audiência de custódia", "Instrução", "Continuação", "Oitiva", "Tribunal do Júri", "Outro"] as const;
export const MODALIDADES = ["Presencial", "Virtual", "Híbrida"] as const;
export const SITUACOES_AUDIENCIA = ["Designada", "Redesignada", "Realizada", "Cancelada"] as const;

export interface AudienciaListada extends AudienciaProcesso {
  numero: string;
  reu: string;
  dias: number;
  prazoExtenso: boolean;
}

export function listarAudienciasDe(processos: ProcessoCompleto[], hoje = hojeISO()): AudienciaListada[] {
  return processos
    .flatMap((p) =>
      p.audiencias.map((a) => {
        const dias = diasEntre(hoje, a.data);
        return {
          ...a,
          numero: p.numero,
          reu: reuPrincipal(p)?.nome ?? "—",
          dias,
          prazoExtenso: dias > CONFIG_AUDIENCIAS.limiteDiasPrazoExtenso && a.situacao !== "Cancelada",
        };
      }),
    )
    .sort((a, b) => a.data.localeCompare(b.data) || (a.horario ?? "").localeCompare(b.horario ?? ""));
}

export function futuras(lista: AudienciaListada[]) {
  return lista.filter((a) => a.dias >= 0 && a.situacao !== "Cancelada" && a.situacao !== "Realizada");
}

export const horaCurta = (h: string | null) => (h ? h.slice(0, 5) : "—");
