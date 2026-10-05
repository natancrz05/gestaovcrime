import { useState, type ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CLASSE_CAMPO, Campo } from "@/components/processos/campos";
import {
  adicionarEtiquetaAoProcesso,
  etiquetasQuery,
  removerEtiquetaDoProcesso,
  salvarEtiqueta,
  type EtiquetaDoProcesso,
} from "@/lib/processos/repositorio";
import { usePode } from "@/lib/sessao";
import { OPCOES_COR_ETIQUETA } from "@/lib/processos/etiquetas-niveis";

const BOTAO = "inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60";
const BOTAO_SEC = "inline-flex h-9 items-center rounded-md border border-border bg-background px-4 text-sm font-medium hover:bg-muted disabled:opacity-60";

export function GerenciarEtiquetasProcesso({
  processoId,
  etiquetasAtuais,
  children,
}: {
  processoId: string;
  etiquetasAtuais: EtiquetaDoProcesso[];
  children?: (abrir: () => void) => ReactNode;
}) {
  const podeEditar = usePode("editar");
  const qc = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const [etiquetaId, setEtiquetaId] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [criando, setCriando] = useState(false);
  const [novaEtiqueta, setNovaEtiqueta] = useState({ nome: "", cor: "informativo", favorita: false });

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
    setCriando(false);
    setNovaEtiqueta({ nome: "", cor: "informativo", favorita: false });
    setAberto(true);
  };

  async function remover(etiqueta: EtiquetaDoProcesso) {
    setSalvando(true);
    setErro("");
    try {
      await removerEtiquetaDoProcesso(processoId, etiqueta.id);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["processos", "etiquetas"] }),
        qc.invalidateQueries({ queryKey: ["processos", processoId, "etiquetas"] }),
      ]);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível remover a etiqueta.");
    } finally {
      setSalvando(false);
    }
  }

  async function salvar() {
    if (!etiquetaId) {
      setErro("Selecione uma etiqueta.");
      return;
    }
    setSalvando(true);
    setErro("");
    try {
      await adicionarEtiquetaAoProcesso(processoId, etiquetaId);
      await qc.invalidateQueries({ queryKey: ["processos", "etiquetas"] });
      await qc.invalidateQueries({ queryKey: ["processos", processoId, "etiquetas"] });
      setAberto(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível adicionar a etiqueta.");
    } finally {
      setSalvando(false);
    }
  }
  async function criarEAdicionar() {
    if (!novaEtiqueta.nome.trim()) {
      setErro("Informe o nome da nova etiqueta.");
      return;
    }
    setSalvando(true);
    setErro("");
    try {
      const novaId = await salvarEtiqueta(novaEtiqueta);
      await adicionarEtiquetaAoProcesso(processoId, novaId);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["etiquetas"] }),
        qc.invalidateQueries({ queryKey: ["processos", "etiquetas"] }),
        qc.invalidateQueries({ queryKey: ["processos", processoId, "etiquetas"] }),
      ]);
      setCriando(false);
      setNovaEtiqueta({ nome: "", cor: "informativo", favorita: false });
      setAberto(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível criar a etiqueta.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      {children ? children(abrir) : (
        <button type="button" className={BOTAO_SEC} onClick={abrir}>
          Adicionar etiqueta
        </button>
      )}

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent>
          <DialogHeader><DialogTitle>Gerenciar etiquetas do processo</DialogTitle></DialogHeader>

          {etiquetasAtuais.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Etiquetas deste processo</p>
              <div className="flex flex-wrap gap-2">
                {etiquetasAtuais.map((e) => (
                  <div key={e.id} className="inline-flex items-center overflow-hidden rounded-md border border-border bg-muted/40 text-xs">
                    <span className="px-2 py-1.5">{e.nome}</span>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 border-l border-border px-2 py-1.5 font-medium text-urgente hover:bg-urgente-suave disabled:opacity-50"
                      aria-label={"Remover etiqueta " + e.nome}
                      title={"Remover etiqueta " + e.nome}
                      disabled={salvando}
                      onClick={() => void remover(e)}
                    >
                      <Trash2 className="size-3.5" />
                      Remover
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {erro ? <p className="text-sm text-urgente">{erro}</p> : null}

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando etiquetas…</p>
          ) : (
            <div className="space-y-4">
              {!criando ? (
                <>
                  {disponiveis.length > 0 ? (
                    <Campo rotulo="Adicionar etiqueta existente">
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
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Não há outras etiquetas existentes para adicionar a este processo.
                    </p>
                  )}

                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                    onClick={() => {
                      setErro("");
                      setCriando(true);
                      setEtiquetaId("");
                    }}
                  >
                    <Plus className="size-4" />
                    Criar nova etiqueta
                  </button>

                  <div className="flex justify-end gap-2">
                    <button type="button" className={BOTAO_SEC} onClick={() => setAberto(false)}>
                      Cancelar
                    </button>
                    {disponiveis.length > 0 ? (
                      <button type="button" className={BOTAO} disabled={salvando || !etiquetaId} onClick={salvar}>
                        {salvando ? "Adicionando…" : "Adicionar"}
                      </button>
                    ) : null}
                  </div>
                </>
              ) : (
                <div className="space-y-3 rounded-md border border-border bg-muted/20 p-3">
                  <p className="text-sm font-semibold">Nova etiqueta</p>
                  <Campo rotulo="Nome">
                    <input
                      autoFocus
                      className={CLASSE_CAMPO}
                      value={novaEtiqueta.nome}
                      onChange={(e) => setNovaEtiqueta({ ...novaEtiqueta, nome: e.target.value })}
                      placeholder="Ex.: Urgente, conferir mídia, réu preso"
                    />
                  </Campo>
                  <Campo rotulo="Cor">
                    <select
                      className={CLASSE_CAMPO}
                      value={novaEtiqueta.cor}
                      onChange={(e) => setNovaEtiqueta({ ...novaEtiqueta, cor: e.target.value })}
                    >
                      {OPCOES_COR_ETIQUETA.map((cor) => (
                        <option key={cor.valor} value={cor.valor}>{cor.rotulo}</option>
                      ))}
                    </select>
                  </Campo>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={novaEtiqueta.favorita}
                      onChange={(e) => setNovaEtiqueta({ ...novaEtiqueta, favorita: e.target.checked })}
                    />
                    Usar como etiqueta favorita
                  </label>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      className={BOTAO_SEC}
                      disabled={salvando}
                      onClick={() => {
                        setErro("");
                        setCriando(false);
                        setNovaEtiqueta({ nome: "", cor: "informativo", favorita: false });
                      }}
                    >
                      Voltar
                    </button>
                    <button
                      type="button"
                      className={BOTAO}
                      disabled={salvando || !novaEtiqueta.nome.trim()}
                      onClick={() => void criarEAdicionar()}
                    >
                      {salvando ? "Criando…" : "Criar e adicionar"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
