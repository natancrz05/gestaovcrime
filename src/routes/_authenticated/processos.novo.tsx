import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Cabecalho } from "@/components/ui-serventia/Cabecalho";
import { CLASSE_CAMPO, Campo, Opcoes, Secao } from "@/components/processos/campos";
import {
  STATUS_PROCESSO,
  TIPOS_MOVIMENTACAO,
  TIPOS_PARTE,
  TIPOS_PRISAO,
} from "@/lib/processos/modelo";
import { criarProcesso, type NovoProcessoEntrada } from "@/lib/processos/repositorio";

export const Route = createFileRoute("/_authenticated/processos/novo")({
  head: () => ({
    meta: [
      { title: "Novo processo — Gestão da Vara Criminal" },
      { name: "description", content: "Cadastro de processo no acervo interno da serventia." },
      { property: "og:title", content: "Novo processo — Gestão da Vara Criminal" },
      { property: "og:description", content: "Cadastro de processo no acervo interno da serventia." },
    ],
  }),
  component: Pagina,
});

type ReuForm = NovoProcessoEntrada["reus"][number];
type ParteForm = NovoProcessoEntrada["partes"][number];

const reuVazio = (): ReuForm => ({ nome: "", situacao: "", preso: false, tipo_prisao: "Não preso", data_prisao: null, observacoes: "" });
const parteVazia = (): ParteForm => ({ nome: "", tipo: "Vítima", observacao: "" });

const BOTAO_SEC =
  "inline-flex h-8 items-center gap-1 rounded-md border border-border bg-background px-3 text-xs font-medium hover:bg-muted";

function Pagina() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [id, setId] = useState({ numero: "", classe: "", assunto: "", data_distribuicao: "", status: "Ativo", fase: "", responsavel: "" });
  const [partes, setPartes] = useState<ParteForm[]>([]);
  const [reus, setReus] = useState<ReuForm[]>([reuVazio()]);
  const [mov, setMov] = useState({ data: "", descricao: "", tipo: "Despacho" });
  const [obsGeral, setObsGeral] = useState("");
  const [obsInterna, setObsInterna] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  const atualizarReu = (i: number, v: Partial<ReuForm>) =>
    setReus((rs) => rs.map((r, j) => (j === i ? { ...r, ...v } : r)));
  const atualizarParte = (i: number, v: Partial<ParteForm>) =>
    setPartes((ps) => ps.map((p, j) => (j === i ? { ...p, ...v } : p)));

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    if (!id.numero.trim() || !id.classe.trim()) return setErro("Informe ao menos o número e a classe do processo.");
    if (mov.descricao.trim() && !mov.data) return setErro("Informe a data da movimentação.");
    setSalvando(true);
    try {
      const novoId = await criarProcesso({
        ...id,
        data_distribuicao: id.data_distribuicao || null,
        observacao_geral: obsGeral,
        partes: partes.filter((p) => p.nome.trim()),
        reus: reus
          .filter((r) => r.nome.trim())
          .map((r) => (r.preso ? { ...r, data_prisao: r.data_prisao || null } : { ...r, tipo_prisao: "Não preso", data_prisao: null })),
        movimentacao: mov.descricao.trim() ? mov : null,
        observacao_interna: obsInterna,
      });
      await qc.invalidateQueries({ queryKey: ["processos"] });
      navigate({ to: "/processos/$id", params: { id: novoId } });
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível salvar.");
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={salvar} className="space-y-5">
      <Cabecalho titulo="Novo processo" subtitulo="Cadastro para organização interna. Use apenas dados fictícios nesta fase de testes." />

      <Secao titulo="Identificação">
        <div className="grid gap-4 md:grid-cols-3">
          <Campo rotulo="Número do processo *">
            <input className={`${CLASSE_CAMPO} numero-processo`} placeholder="0000000-00.0000.8.05.0000" value={id.numero} onChange={(e) => setId({ ...id, numero: e.target.value })} />
          </Campo>
          <Campo rotulo="Classe *">
            <input className={CLASSE_CAMPO} value={id.classe} onChange={(e) => setId({ ...id, classe: e.target.value })} />
          </Campo>
          <Campo rotulo="Assunto">
            <input className={CLASSE_CAMPO} value={id.assunto} onChange={(e) => setId({ ...id, assunto: e.target.value })} />
          </Campo>
          <Campo rotulo="Data de distribuição">
            <input type="date" className={CLASSE_CAMPO} value={id.data_distribuicao} onChange={(e) => setId({ ...id, data_distribuicao: e.target.value })} />
          </Campo>
          <Campo rotulo="Status">
            <select className={CLASSE_CAMPO} value={id.status} onChange={(e) => setId({ ...id, status: e.target.value })}>
              <Opcoes valores={STATUS_PROCESSO} />
            </select>
          </Campo>
          <Campo rotulo="Fase processual">
            <input className={CLASSE_CAMPO} value={id.fase} onChange={(e) => setId({ ...id, fase: e.target.value })} />
          </Campo>
          <Campo rotulo="Responsável">
            <input className={CLASSE_CAMPO} value={id.responsavel} onChange={(e) => setId({ ...id, responsavel: e.target.value })} />
          </Campo>
        </div>
      </Secao>

      <Secao titulo="Réus e situação prisional" acao={<button type="button" className={BOTAO_SEC} onClick={() => setReus([...reus, reuVazio()])}><Plus className="size-3.5" /> Adicionar réu</button>}>
        <div className="space-y-4">
          {reus.map((r, i) => (
            <div key={i} className="grid gap-3 rounded-md border border-border p-3 md:grid-cols-6">
              <div className="md:col-span-2">
                <Campo rotulo={`Nome do réu ${i + 1}`}>
                  <input className={CLASSE_CAMPO} value={r.nome} onChange={(e) => atualizarReu(i, { nome: e.target.value })} />
                </Campo>
              </div>
              <Campo rotulo="Situação">
                <input className={CLASSE_CAMPO} value={r.situacao} onChange={(e) => atualizarReu(i, { situacao: e.target.value })} />
              </Campo>
              <Campo rotulo="Está preso?">
                <select className={CLASSE_CAMPO} value={r.preso ? "sim" : "nao"} onChange={(e) => atualizarReu(i, { preso: e.target.value === "sim", tipo_prisao: e.target.value === "sim" ? "Prisão preventiva" : "Não preso" })}>
                  <option value="nao">Não</option>
                  <option value="sim">Sim</option>
                </select>
              </Campo>
              <Campo rotulo="Tipo de prisão">
                <select className={CLASSE_CAMPO} disabled={!r.preso} value={r.tipo_prisao} onChange={(e) => atualizarReu(i, { tipo_prisao: e.target.value })}>
                  <Opcoes valores={TIPOS_PRISAO} />
                </select>
              </Campo>
              <Campo rotulo="Data da prisão">
                <input type="date" className={CLASSE_CAMPO} disabled={!r.preso} value={r.data_prisao ?? ""} onChange={(e) => atualizarReu(i, { data_prisao: e.target.value })} />
              </Campo>
              <div className="md:col-span-5">
                <Campo rotulo="Observação">
                  <input className={CLASSE_CAMPO} value={r.observacoes} onChange={(e) => atualizarReu(i, { observacoes: e.target.value })} />
                </Campo>
              </div>
              <div className="flex items-end">
                <button type="button" className={BOTAO_SEC} onClick={() => setReus(reus.filter((_, j) => j !== i))}><Trash2 className="size-3.5" /> Remover</button>
              </div>
            </div>
          ))}
        </div>
      </Secao>

      <Secao titulo="Demais partes" acao={<button type="button" className={BOTAO_SEC} onClick={() => setPartes([...partes, parteVazia()])}><Plus className="size-3.5" /> Adicionar parte</button>}>
        {partes.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma parte adicionada.</p> : null}
        <div className="space-y-3">
          {partes.map((p, i) => (
            <div key={i} className="grid gap-3 md:grid-cols-[2fr_1fr_2fr_auto] md:items-end">
              <Campo rotulo="Nome"><input className={CLASSE_CAMPO} value={p.nome} onChange={(e) => atualizarParte(i, { nome: e.target.value })} /></Campo>
              <Campo rotulo="Tipo">
                <select className={CLASSE_CAMPO} value={p.tipo} onChange={(e) => atualizarParte(i, { tipo: e.target.value })}><Opcoes valores={TIPOS_PARTE} /></select>
              </Campo>
              <Campo rotulo="Observação"><input className={CLASSE_CAMPO} value={p.observacao} onChange={(e) => atualizarParte(i, { observacao: e.target.value })} /></Campo>
              <button type="button" className={BOTAO_SEC} onClick={() => setPartes(partes.filter((_, j) => j !== i))}><Trash2 className="size-3.5" /></button>
            </div>
          ))}
        </div>
      </Secao>

      <Secao titulo="Última movimentação">
        <div className="grid gap-4 md:grid-cols-[1fr_1fr_3fr]">
          <Campo rotulo="Data"><input type="date" className={CLASSE_CAMPO} value={mov.data} onChange={(e) => setMov({ ...mov, data: e.target.value })} /></Campo>
          <Campo rotulo="Tipo">
            <select className={CLASSE_CAMPO} value={mov.tipo} onChange={(e) => setMov({ ...mov, tipo: e.target.value })}><Opcoes valores={TIPOS_MOVIMENTACAO} /></select>
          </Campo>
          <Campo rotulo="Descrição"><input className={CLASSE_CAMPO} value={mov.descricao} onChange={(e) => setMov({ ...mov, descricao: e.target.value })} /></Campo>
        </div>
      </Secao>

      <Secao titulo="Observações">
        <div className="grid gap-4 md:grid-cols-2">
          <Campo rotulo="Observação geral">
            <textarea className={`${CLASSE_CAMPO} h-24 py-2`} value={obsGeral} onChange={(e) => setObsGeral(e.target.value)} />
          </Campo>
          <Campo rotulo="Anotação interna de gestão">
            <textarea className={`${CLASSE_CAMPO} h-24 py-2`} placeholder="Ex.: Verificar cumprimento de mandado." value={obsInterna} onChange={(e) => setObsInterna(e.target.value)} />
          </Campo>
        </div>
      </Secao>

      {erro ? <p className="rounded-md border border-urgente/30 bg-urgente-suave px-3 py-2 text-sm text-urgente">{erro}</p> : null}

      <div className="flex justify-end gap-2">
        <Link to="/processos" className="inline-flex h-9 items-center rounded-md border border-border px-4 text-sm hover:bg-muted">Cancelar</Link>
        <button type="submit" disabled={salvando} className="inline-flex h-9 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
          {salvando ? "Salvando…" : "Salvar processo"}
        </button>
      </div>
    </form>
  );
}
