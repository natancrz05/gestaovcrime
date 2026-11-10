import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { diasEntre } from "./modelo";
import { tipoPrisaoDe } from "./importacao-reus";

export const TIPOS_CUSTODIA_OPERACIONAIS = [
  "Prisão preventiva",
  "Prisão temporária",
  "Prisão em flagrante",
  "Outra",
] as const;

export function tipoPrisaoOperacional({
  tipoPrisao,
  especieCautelar,
}: {
  tipoPrisao?: string | null;
  especieCautelar?: string | null;
}): string {
  if (
    tipoPrisao &&
    (TIPOS_CUSTODIA_OPERACIONAIS as readonly string[]).includes(tipoPrisao)
  ) {
    return tipoPrisao;
  }
  if (especieCautelar?.trim()) return tipoPrisaoDe(especieCautelar);
  return tipoPrisao?.trim() || "Outra";
}

export function normalizarDataOperacional(v?: string | null): string | null {
  const s = v?.trim();
  if (!s) return null;
  let iso: string | null = null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) iso = s;
  else {
    const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) iso = `${m[3]}-${m[2]}-${m[1]}`;
  }
  if (!iso) return null;
  const [ano, mes, dia] = iso.split("-").map(Number);
  if (!ano || !mes || !dia) return null;
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  if (
    data.getUTCFullYear() !== ano ||
    data.getUTCMonth() !== mes - 1 ||
    data.getUTCDate() !== dia
  ) return null;
  return iso;
}

export function somarDiasISO(iso: string, dias: number): string {
  const [ano, mes, dia] = iso.split("-").map(Number);
  if (ano === undefined || mes === undefined || dia === undefined) {
    throw new Error("Data ISO inválida.");
  }
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  data.setUTCDate(data.getUTCDate() + dias);
  return `${data.getUTCFullYear()}-${String(data.getUTCMonth() + 1).padStart(2, "0")}-${String(data.getUTCDate()).padStart(2, "0")}`;
}

function maiorData(datas: Array<string | null>): string | null {
  return datas.filter((d): d is string => Boolean(d)).sort().at(-1) ?? null;
}

/**
 * Mantém prisão e reavaliação como fatos distintos.
 * A data da prisão nunca é substituída: ela apenas funciona como primeiro marco
 * até existir uma reavaliação posterior registrada.
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
  const prisao = normalizarDataOperacional(dataPrisao);
  const reavaliacoes = [
    normalizarDataOperacional(ultimaReavaliacaoHistorico),
    normalizarDataOperacional(dp["Última reavaliação"]),
    normalizarDataOperacional(dp["Data da última reavaliação"]),
  ].filter((d): d is string => Boolean(d)).sort();
  const ultimaReavaliacao = reavaliacoes.at(-1) ?? null;

  return {
    dataPrisao: prisao,
    ultimaReavaliacao,
    referenciaPrazo: ultimaReavaliacao ?? prisao,
    origemReferencia: ultimaReavaliacao
      ? "reavaliacao" as const
      : prisao
        ? "prisao" as const
        : null,
  };
}

export type FaixaPrazoPreventiva =
  | "sem-base"
  | "vencida"
  | "hoje"
  | "ate-5"
  | "ate-15"
  | "regular";

export function estadoPrazoPreventiva({
  dataPrisao,
  ultimaReavaliacaoHistorico,
  dadosPlanilha,
  hoje,
}: {
  dataPrisao?: string | null;
  ultimaReavaliacaoHistorico?: string | null;
  dadosPlanilha?: Record<string, string> | null;
  hoje: string;
}) {
  const referencia = referenciaPreventiva({
    dataPrisao: dataPrisao ?? null,
    ultimaReavaliacaoHistorico: ultimaReavaliacaoHistorico ?? null,
    dadosPlanilha: dadosPlanilha ?? null,
  });
  if (!referencia.referenciaPrazo) {
    return {
      ...referencia,
      limite: null,
      diasRestantes: null,
      faixa: "sem-base" as const,
    };
  }

  const limite = somarDiasISO(referencia.referenciaPrazo, 90);
  const diasRestantes = diasEntre(hoje, limite);
  const faixa: FaixaPrazoPreventiva =
    diasRestantes < 0
      ? "vencida"
      : diasRestantes === 0
        ? "hoje"
        : diasRestantes <= 5
          ? "ate-5"
          : diasRestantes <= 15
            ? "ate-15"
            : "regular";

  return { ...referencia, limite, diasRestantes, faixa };
}

export function terminoPrisaoTemporaria(
  dadosPlanilha?: Record<string, string> | null,
): string | null {
  const dp = dadosPlanilha ?? {};
  return maiorData([
    normalizarDataOperacional(dp["Término de eventual prazo"]),
    normalizarDataOperacional(dp["Termino de eventual prazo"]),
    normalizarDataOperacional(dp["Término do prazo"]),
    normalizarDataOperacional(dp["Termino do prazo"]),
  ]);
}

/** Fonte única dos réus atualmente custodiados, compartilhada pelo módulo, Dashboard e Relatórios. */
export const presosQuery = () =>
  queryOptions({
    queryKey: ["reus-presos"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reus")
        .select("*, processos(numero)")
        .eq("preso", true)
        .order("nome");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
