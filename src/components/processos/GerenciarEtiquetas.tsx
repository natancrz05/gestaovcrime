import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal, Plus, Star, Tag, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { alternarFavoritaEtiqueta, criarEtiqueta, listarEtiquetas, listarEtiquetasDoProcesso, removerEtiquetaDoProcesso, vincularEtiqueta } from "@/lib/processos/etiquetas";
import type { EtiquetaProcesso } from "@/lib/processos/modelo";
import { usePode } from "@/lib/sessao";

const COR_CLASSES: Record<string, string> = {
  default: "border-border bg-muted text-foreground",
  azul: "border-primary/25 bg-primary/10 text-primary",
  vermelho: "border-urgente/25 bg-urgente-suave text-urgente",
  amarelo: "border-atencao/25 bg-atencao-suave text-atencao",
  verde: "border-concluido/25 bg-concluido-suave text-concluido",
};

export function EtiquetasProcesso({ etiquetas = [], compact = false }: { etiquetas?: EtiquetaProcesso[]; compact?: boolean }) {
  if (!etiquetas.length) return null;
  return (
    <div className={cn("flex flex-wrap gap-1", compact ? "max-w-[280px]" : "")}>
      {etiquetas.map((e) => (
        <span key={e.id} className={cn("inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium", COR_CLASSES[e.cor] ?? COR_CLASSES.default)} title={e.nome}>
          <Tag className="size-3" />{e.nome}
        </span>
      ))}
    </div>
  );
}

export function AcoesEtiquetasProcesso({ processoId, etiquetas = [], className }: { processoId: string; etiquetas?: EtiquetaProcesso[]; className?: string }) {
  const podeEditar = usePode("editar");
  const qc = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const [nova, setNova] = useState("");
  const [cor, setCor] = useState("default");
  const [salvando, setSalvando] = useState(false);

  const tagsQuery = useQuery({ queryKey: ["etiquetas"], queryFn: listarEtiquetas, enabled: aberto, staleTime: 30_000 });
  const vinculadasQuery = useQuery({ queryKey: ["processo-etiquetas", processoId], queryFn: () => listarEtiquetasDoProcesso(processoId), enabled: aberto, staleTime: 0 });
  const vinculadas = vinculadasQuery.data ?? etiquetas;
  const ids = useMemo(() => new Set(vinculadas.map((e) => e.id)), [vinculadas]);

  if (!podeEditar) return null;

  async function invalidar() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["processos"] }),
      qc.invalidateQueries({ queryKey: ["processo-etiquetas", processoId] }),
      qc.invalidateQueries({ queryKey: ["reus-presos"] }),
      qc.invalidateQueries({ queryKey: ["comparecimentos"] }),
    ]);
  }

  async function adicionar(id: string) {
    try { await vincularEtiqueta(processoId, id); await invalidar(); toast.success("Etiqueta adicionada ao processo"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível adicionar a etiqueta."); }
  }

  async function remover(id: string) {
    try { await removerEtiquetaDoProcesso(processoId, id); await invalidar(); toast.success("Etiqueta removida do processo"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível remover a etiqueta."); }
  }

  async function criarEAdicionar() {
    const nome = nova.trim();
    if (!nome) return;
    setSalvando(true);
    try {
      const etiqueta = await criarEtiqueta(nome, cor);
      await vincularEtiqueta(processoId, etiqueta.id);
      setNova(""); setCor("default");
      await qc.invalidateQueries({ queryKey: ["etiquetas"] });
      await invalidar();
      toast.success("Etiqueta criada e adicionada ao processo");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível criar a etiqueta."); }
    finally { setSalvando(false); }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className={cn("inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-xs font-medium hover:bg-muted", className)}
            onClick={(e) => e.stopPropagation()} aria-label="Ações do processo">
            <MoreHorizontal className="size-4" /> Ações
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setAberto(true)}>
            <Tag className="size-4" /> Adicionar etiqueta
            {vinculadas.length ? <span className="ml-auto text-xs text-muted-foreground">{vinculadas.length}</span> : null}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Etiquetas do processo</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Etiquetas vinculadas</p>
              {vinculadas.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {vinculadas.map((e) => (
                    <span key={e.id} className={cn("inline-flex items-center gap-1 rounded border px-2 py-1 text-xs font-medium", COR_CLASSES[e.cor] ?? COR_CLASSES.default)}>
                      <Tag className="size-3" /> {e.nome}
                      <button type="button" className="ml-0.5 rounded-full hover:bg-black/10" aria-label={"Remover etiqueta " + e.nome} onClick={() => void remover(e.id)}>
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : <p className="text-sm text-muted-foreground">Nenhuma etiqueta vinculada.</p>}
            </div>

            <div className="border-t border-border pt-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Adicionar etiqueta existente</p>
              {tagsQuery.isLoading ? <p className="text-sm text-muted-foreground">Carregando etiquetas…</p> : tagsQuery.data?.length ? (
                <div className="max-h-44 space-y-1 overflow-y-auto">
                  {tagsQuery.data.map((e) => (
                    <button key={e.id} type="button" disabled={ids.has(e.id)} onClick={() => void adicionar(e.id)}
                      className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-muted disabled:cursor-default disabled:opacity-50">
                      <span className={cn("size-2 rounded-full", COR_CLASSES[e.cor]?.split(" ")[2] ?? "bg-muted-foreground")} />
                      <span>{e.nome}</span>
                      <button
                        type="button"
                        title={e.favorita ? "Remover dos favoritos" : "Marcar como favorita"}
                        aria-label={e.favorita ? "Remover dos favoritos" : "Marcar como favorita"}
                        className="ml-auto rounded p-1 text-muted-foreground hover:bg-muted hover:text-atencao"
                        onClick={(event) => {
                          event.stopPropagation();
                          void alternarFavoritaEtiqueta(e.id, !e.favorita).then(() => qc.invalidateQueries({ queryKey: ["etiquetas"] })).catch((err) => toast.error(err instanceof Error ? err.message : "Não foi possível atualizar a etiqueta."));
                        }}
                      >
                        <Star className={cn("size-3.5", e.favorita && "fill-current text-atencao")} />
                      </button>
                      {ids.has(e.id) ? <span className="text-[10px] text-muted-foreground">Já vinculada</span> : null}
                    </button>
                  ))}
                </div>
              ) : <p className="text-sm text-muted-foreground">Ainda não existem etiquetas cadastradas.</p>}
            </div>

            <div className="border-t border-border pt-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Criar nova etiqueta</p>
              <div className="flex gap-2">
                <input className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Ex.: Marcar audiência" value={nova} maxLength={60} onChange={(e) => setNova(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void criarEAdicionar(); }} />
                <select className="h-9 rounded-md border border-input bg-background px-2 text-xs" value={cor} onChange={(e) => setCor(e.target.value)}>
                  <option value="default">Neutra</option><option value="azul">Azul</option><option value="vermelho">Vermelha</option><option value="amarelo">Amarela</option><option value="verde">Verde</option>
                </select>
                <button type="button" disabled={salvando || !nova.trim()} onClick={() => void criarEAdicionar()}
                  className="inline-flex h-9 items-center gap-1 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-50">
                  <Plus className="size-4" /> Criar
                </button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
