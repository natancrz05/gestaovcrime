/**
 * Módulo de audiências. "Prazo extenso" é apenas critério administrativo de
 * acompanhamento — não indica irregularidade nem excesso de prazo.
 */
import { supabase } from "@/integrations/supabase/client";
import { diasEntre, hojeISO, reuPrincipal, type AudienciaProcesso, type ProcessoCompleto } from "./modelo";

export const CONFIG_AUDIENCIAS = {
  /** Audiência marcada para mais de X dias a partir de hoje. */
  limiteDiasPrazoExtenso: 90,
};

export const TIPOS_AUDIENCIA = ["Audiência de custódia", "Instrução", "Continuação", "Oitiva", "Tribunal do Júri", "Outro"] as const;
export const MODALIDADES = ["Presencial", "Virtual", "Híbrida"] as const;
export const SITUACOES_AUDIENCIA = ["Agendada", "Redesignada", "Realizada", "Cancelada"] as const;

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
          prazoExtenso: dias > CONFIG_AUDIENCIAS.limiteDiasPrazoExtenso && estaPendente(a),
        };
      }),
    )
    .sort((a, b) => a.data.localeCompare(b.data) || (a.horario ?? "").localeCompare(b.horario ?? ""));
}

export function futuras(lista: AudienciaListada[]) {
  return lista.filter((a) => a.dias >= 0 && estaPendente(a));
}

export const horaCurta = (h: string | null) => (h ? h.slice(0, 5) : "—");

/** Pendente = Agendada (inclui registros antigos "Designada") ou Redesignada. */
export const estaPendente = (a: { situacao: string }) => a.situacao !== "Realizada" && a.situacao !== "Cancelada";

/** Única lógica de confirmação (lista e calendário): situação, data efetiva e movimentação sem duplicar. */
export async function confirmarAudiencia(id: string, data: string, obs: string) {
  const { error } = await supabase.rpc("confirmar_audiencia" as never, { p_id: id, p_data: data, p_obs: obs } as never);
  if (error) throw error;
}
