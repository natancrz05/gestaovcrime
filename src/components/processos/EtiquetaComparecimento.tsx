import { SITUACOES_COMP, type SituacaoComparecimento } from "@/lib/processos/comparecimentos";
import { cn } from "@/lib/utils";

export function EtiquetaComparecimento({ s }: { s: SituacaoComparecimento }) {
  const n = SITUACOES_COMP.find((x) => x.chave === s)!;
  return <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase", n.classe)}><span className={cn("size-1.5 rounded-full", n.ponto)} />{n.rotulo}</span>;
}
