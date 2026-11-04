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
 * A prisão preventiva nasce de uma decisão judicial que já examina a custódia.
 * Até existir reavaliação posterior, a data da prisão é o primeiro marco dos 90 dias.
 */
export function baseReavaliacaoPreventiva({
  dataPrisao,
  ultimaReavaliacaoHistorico,
  dadosPlanilha,
}: {
  dataPrisao?: string | null;
  ultimaReavaliacaoHistorico?: string | null;
  dadosPlanilha?: Record<string, string> | null;
}): string | null {
  const dp = dadosPlanilha ?? {};
  const datas = [
    normalizarDataReavaliacao(dataPrisao),
    normalizarDataReavaliacao(ultimaReavaliacaoHistorico),
    normalizarDataReavaliacao(dp["Última reavaliação"]),
    normalizarDataReavaliacao(dp["Data da última reavaliação"]),
    normalizarDataReavaliacao(dp["Data da decisão da preventiva"]),
    normalizarDataReavaliacao(dp["Data da decisão preventiva"]),
  ].filter((d): d is string => Boolean(d)).sort();

  return datas.at(-1) ?? null;
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
