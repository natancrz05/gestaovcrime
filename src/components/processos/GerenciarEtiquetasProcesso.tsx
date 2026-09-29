import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CLASSE_CAMPO, Campo } from "@/components/processos/campos";
import {
  adicionarEtiquetaAoProcesso,
  etiquetasQuery,
  type EtiquetaDoProcesso,
} from "@/lib/processos/repositorio";
import { usePode } from "@/lib/sessao";

const BOTAO = "inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60";
const BOTAO_SEC = "inline-flex h-9 items-center rounded-md border border-border bg-background px-4 text-sm font-medium hover:bg-muted disabled:opacity-60";

export function GerenciarEtiquetasProcesso({
  processoId,
  etiquetasAtuais,
}: {
  processoId: string;
  etiquetasAtuais: EtiquetaDoProcesso[];
}) {
  const podeEditar = usePode("editar");
  const qc = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const [etiquetaId, setEtiquetaId] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  const { data: etiquetas = [], isLoading } = useQuery({
    ...etiquetasQuery(),
    enabled: aberto && podeEditar,
  });

  if (!podeEditar) return null;

  const atuais = new Set(etiquetasAtuais.map((e) => e.id));
  const disponiveis = etiquetas.filter((e) => !atuais.has(e.id));

  const abrir = () => {
    setErro("");
    setEtiquetaId("");
    setAberto(true);
  };

  async function salvar() {
    if (!etiquetaId) {
      setErro("Selecione uma etiqueta.");
      return;
    }
    setSalvando(true);
    setErro("");
    try {
      await adicionarEtiquetaAoProcesso(processoId, etiquetaId);
      await qc.invalidateQueries({ queryKey: ["processos", processoId, "etiquetas"] });
      setAberto(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível adicionar a etiqueta.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <button type="button" className={BOTAO_SEC} onClick={abrir}>
        Adicionar etiqueta
      </button>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar etiqueta</DialogTitle></DialogHeader>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando etiquetas…</p>
          ) : disponiveis.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Não há etiquetas disponíveis para adicionar a este processo.
            </p>
          ) : (
            <div className="space-y-4">
              <Campo rotulo="Etiqueta">
                <select
                  className={CLASSE_CAMPO}
                  value={etiquetaId}
                  onChange={(e) => setEtiquetaId(e.target.value)}
                >
                  <option value="">Selecione uma etiqueta</option>
                  {disponiveis.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nome}
                    </option>
                  ))}
                </select>
              </Campo>

              {erro ? <p className="text-sm text-urgente">{erro}</p> : null}

              <div className="flex justify-end gap-2">
                <button type="button" className={BOTAO_SEC} onClick={() => setAberto(false)}>
                  Cancelar
                </button>
                <button type="button" className={BOTAO} disabled={salvando} onClick={salvar}>
                  {salvando ? "Adicionando…" : "Adicionar"}
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
