import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Etiqueta } from "@/components/ui-serventia/Etiqueta";
import { usePode } from "@/lib/sessao";
import { removerEtiquetaDoProcesso, type EtiquetaDoProcesso } from "@/lib/processos/repositorio";

function severidadeDaEtiqueta(cor: string) {
  return cor === "urgente" ? "urgente" : cor === "alerta" ? "alerta" : cor === "concluido" ? "concluido" : "info";
}

/**
 * Etiqueta vinculada a um processo.
 *
 * Em qualquer módulo, usuários com permissão de edição podem passar o mouse
 * sobre a etiqueta e clicar no "×" para remover apenas o vínculo com aquele
 * processo. A etiqueta continua existindo no catálogo e nos demais processos.
 */
export function EtiquetaProcesso({
  processoId,
  etiqueta,
  className,
}: {
  processoId: string;
  etiqueta: EtiquetaDoProcesso;
  className?: string;
}) {
  const podeEditar = usePode("editar");
  const qc = useQueryClient();
  const [removendo, setRemovendo] = useState(false);

  async function remover(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (removendo) return;
    setRemovendo(true);
    try {
      await removerEtiquetaDoProcesso(processoId, etiqueta.id);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["processos", "etiquetas"] }),
        qc.invalidateQueries({ queryKey: ["processos", processoId, "etiquetas"] }),
      ]);
      toast.success("Etiqueta removida do processo");
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível remover a etiqueta.");
    } finally {
      setRemovendo(false);
    }
  }

  return (
    <span className="group/etiqueta relative inline-flex items-center">
      <Etiqueta
        severidade={severidadeDaEtiqueta(etiqueta.cor)}
        className={`${podeEditar ? "pr-5" : ""} ${removendo ? "opacity-60" : ""} ${className ?? ""}`}
      >
        {etiqueta.nome}
      </Etiqueta>
      {podeEditar ? (
        <button
          type="button"
          aria-label={"Remover etiqueta " + etiqueta.nome}
          title={"Remover etiqueta " + etiqueta.nome + " deste processo"}
          disabled={removendo}
          onClick={remover}
          className="absolute right-1 top-1/2 inline-flex size-4 -translate-y-1/2 items-center justify-center rounded-full text-[11px] font-bold leading-none opacity-0 transition-opacity hover:bg-black/10 group-hover/etiqueta:opacity-100 focus:opacity-100 disabled:cursor-wait"
        >
          ×
        </button>
      ) : null}
    </span>
  );
}
