import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

function normalizarDataReavaliacao(v?: string | null): string | null {
  const s = v?.trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

/**
 * Mantém prisão e reavaliação como fatos distintos.
 * - dataPrisao: data histórica da prisão, nunca é substituída por reavaliação.
 * - ultimaReavaliacao: evento posterior registrado separadamente.
 * - referenciaPrazo: somente a referência operacional para o próximo ciclo de 90 dias.
 */
export function referenciaPreventiva({
  dataPrisao,
  ultimaReavaliacaoHistorico,
  dadosPlanilha,
}: {
  dataPrisao?: string | null;
  ultimaReavaliacaoHistorico?: string | null;
  dadosPlanilha?: Record<string, string> | null;
}) {
  const dp = dadosPlanilha ?? {};
  const prisao = normalizarDataReavaliacao(dataPrisao);
  const reavaliacoes = [
    normalizarDataReavaliacao(ultimaReavaliacaoHistorico),
    normalizarDataReavaliacao(dp["Última reavaliação"]),
    normalizarDataReavaliacao(dp["Data da última reavaliação"]),
  ].filter((d): d is string => Boolean(d)).sort();
  const ultimaReavaliacao = reavaliacoes.at(-1) ?? null;

  return {
    dataPrisao: prisao,
    ultimaReavaliacao,
    referenciaPrazo: ultimaReavaliacao ?? prisao,
    origemReferencia: ultimaReavaliacao ? "reavaliacao" as const : prisao ? "prisao" as const : null,
  };
}

/** Fonte única dos réus atualmente custodiados, compartilhada pelo módulo e pelo Dashboard. */
export const presosQuery = () =>
  queryOptions({
    queryKey: ["reus-presos"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("reus").select("*, processos(numero)").eq("preso", true).order("nome");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
