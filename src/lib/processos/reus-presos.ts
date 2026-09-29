import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { EtiquetaProcesso } from "./modelo";

/** Fonte única dos réus atualmente custodiados, compartilhada pelo módulo e pelo Dashboard. */
export const presosQuery = () =>
  queryOptions({
    queryKey: ["reus-presos"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("reus").select("*, processos(numero, processos_etiquetas(etiquetas(id,nome,cor,favorita)))").eq("preso", true).order("nome");
      if (error) throw new Error(error.message);
      return (data ?? []).map((item) => ({
        ...item,
        etiquetas: (((item as { processos?: { processos_etiquetas?: { etiquetas?: EtiquetaProcesso | null }[] } | null }).processos?.processos_etiquetas ?? [])
          .map((v) => v.etiquetas)
          .filter(Boolean)) as EtiquetaProcesso[],
      }));
    },
  });
