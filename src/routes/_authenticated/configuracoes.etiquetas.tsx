import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { Cabecalho } from "@/components/ui-serventia/Cabecalho";
import { Etiqueta } from "@/components/ui-serventia/Etiqueta";
import { CLASSE_CAMPO, Campo } from "@/components/processos/campos";
import { usePode } from "@/lib/sessao";
import {
  etiquetasQuery,
  removerEtiqueta,
  salvarEtiqueta,
  type EtiquetaDoProcesso,
} from "@/lib/processos/repositorio";
import {
  OPCOES_COR_ETIQUETA,
  normalizarCorEtiqueta,
  opcaoCorEtiqueta,
} from "@/lib/processos/etiquetas-niveis";

export const Route = createFileRoute("/_authenticated/configuracoes/etiquetas")({
  head: () => ({
    meta: [
      { title: "Etiquetas — Gestão da Vara Criminal" },
      { name: "description", content: "Cadastro e organização das etiquetas utilizadas na gestão da serventia." },
    ],
  }),
  component: Pagina,
});

const BOTAO = "inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60";
const BOTAO_SEC = "inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-medium hover:bg-muted disabled:opacity-50";
type Edicao = { id?: string; nome: string; cor: string; favorita: boolean };

function Pagina() {
  const podeEditar = usePode("editar");
  const qc = useQueryClient();
  const { data: etiquetas = [], isLoading, error } = useQuery(etiquetasQuery());
  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  function nova() {
    setErro("");
    setEdicao({ nome: "", cor: "informativo", favorita: false });
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!edicao) return;
    setSalvando(true);
    setErro("");
    try {
      await salvarEtiqueta(edicao, edicao.id);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["etiquetas"] }),
        qc.invalidateQueries({ queryKey: ["processos", "etiquetas"] }),
      ]);
      setEdicao(null);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível salvar a etiqueta.");
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(e: EtiquetaDoProcesso) {
    if (!confirm(`Excluir a etiqueta "${e.nome}"? Ela também será desvinculada dos processos que a utilizam.`)) return;
    setErro("");
    try {
      await removerEtiqueta(e.id);
      await qc.invalidateQueries({ queryKey: ["etiquetas"] });
      await qc.invalidateQueries({ queryKey: ["processos", "etiquetas"] });
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível excluir a etiqueta.");
    }
  }

  return (
    <div className="space-y-6">
      <Link to="/configuracoes" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Configurações
      </Link>

      <Cabecalho
        titulo="Etiquetas"
        subtitulo="Cadastre e organize as etiquetas que poderão ser utilizadas nos processos."
        acao={podeEditar ? <button className={BOTAO} onClick={nova}><Plus className="size-4" /> Nova etiqueta</button> : null}
      />

      {error ? <p className="text-sm text-urgente">{(error as Error).message}</p> : null}
      {erro ? <p className="text-sm text-urgente">{erro}</p> : null}

      <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Etiqueta</th>
              <th className="px-4 py-2.5 font-medium">Cor</th>
              <th className="px-4 py-2.5 font-medium">Favorita</th>
              <th className="px-4 py-2.5 text-right font-medium">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">Carregando…</td></tr>
            ) : null}
            {!isLoading && etiquetas.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">Nenhuma etiqueta cadastrada.</td></tr>
            ) : null}
            {etiquetas.map((e) => {
              const cor = opcaoCorEtiqueta(e.cor);
              return (
                <tr key={e.id}>
                  <td className="px-4 py-2.5"><Etiqueta severidade={cor.severidade}>{e.nome}</Etiqueta></td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{cor.rotulo}</td>
                  <td className="px-4 py-2.5">
                    {e.favorita ? <Star className="size-4 fill-current text-alerta" aria-label="Favorita" /> : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    {podeEditar ? (
                      <div className="flex justify-end gap-1.5">
                        <button className={BOTAO_SEC} aria-label="Editar etiqueta" onClick={() => { setErro(""); setEdicao({ id: e.id, nome: e.nome, cor: normalizarCorEtiqueta(e.cor), favorita: e.favorita }); }}>
                          <Pencil className="size-3.5" /> Editar
                        </button>
                        <button className={BOTAO_SEC + " text-urgente"} aria-label="Excluir etiqueta" onClick={() => excluir(e)}>
                          <Trash2 className="size-3.5" /> Excluir
                        </button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {edicao ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="titulo-etiqueta">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-lg">
            <h2 id="titulo-etiqueta" className="text-base font-semibold">{edicao.id ? "Editar etiqueta" : "Nova etiqueta"}</h2>
            <form className="mt-4 space-y-3" onSubmit={salvar}>
              <Campo rotulo="Nome">
                <input required autoFocus className={CLASSE_CAMPO} value={edicao.nome} onChange={(e) => setEdicao({ ...edicao, nome: e.target.value })} />
              </Campo>
              <Campo rotulo="Cor">
                <select className={CLASSE_CAMPO} value={edicao.cor} onChange={(e) => setEdicao({ ...edicao, cor: e.target.value })}>
                  {OPCOES_COR_ETIQUETA.map((c) => <option key={c.valor} value={c.valor}>{c.rotulo}</option>)}
                </select>
              </Campo>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={edicao.favorita} onChange={(e) => setEdicao({ ...edicao, favorita: e.target.checked })} />
                Usar como etiqueta favorita
              </label>
              {erro ? <p className="text-sm text-urgente">{erro}</p> : null}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className={BOTAO_SEC} onClick={() => setEdicao(null)}>Cancelar</button>
                <button className={BOTAO} disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
