import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
