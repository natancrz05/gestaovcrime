import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CLASSE_CAMPO, Campo, Opcoes } from "@/components/processos/campos";
import { formatarData } from "@/lib/dominio";
import { hojeISO, type ProcessoCompleto } from "@/lib/processos/modelo";
import {
  PRIORIDADES_PENDENCIA, STATUS_PENDENCIA, TIPOS_PENDENCIA, rotuloPrioridade,
  type PendenciaEntrada, type PendenciaListada,
} from "@/lib/processos/pendencias";
import { cn } from "@/lib/utils";

export const BOTAO = "inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60";
export const BOTAO_SEC = "inline-flex h-8 items-center rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground hover:bg-muted";

export const novaPendencia = (processo_id = ""): PendenciaEntrada => ({
  processo_id, titulo: "", descricao: "", tipo: "Cumprir despacho", prazo: hojeISO(), prioridade: "media",
  status: "A fazer", responsavel: "", observacoes: "", data_conclusao: null,
});

export function paraEntrada(p: PendenciaListada): PendenciaEntrada {
  return {
    processo_id: p.processo_id, titulo: p.titulo, descricao: p.descricao, tipo: p.tipo, prazo: p.prazo,
    prioridade: p.prioridade, status: p.status, responsavel: p.responsavel, observacoes: p.observacoes,
    data_conclusao: p.data_conclusao,
  };
}

/** Etiquetas de destaque: atrasada (vermelho), alta (âmbar), concluída (verde). */
export function EtiquetasPendencia({ p }: { p: PendenciaListada }) {
  const base = "inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium";
  return (
    <span className="inline-flex flex-wrap gap-1">
      {p.concluidaFlag ? <span className={cn(base, "border-concluido/30 bg-concluido-suave text-concluido")}>Concluída</span> : null}
      {p.atrasada ? <span className={cn(base, "border-urgente/30 bg-urgente-suave text-urgente")}>Atrasada</span> : null}
      {!p.concluidaFlag && p.prioridade === "alta" ? <span className={cn(base, "border-atencao/30 bg-atencao-suave text-atencao")}>Alta prioridade</span> : null}
      {p.prazoProximo ? <span className={cn(base, "border-border bg-muted text-muted-foreground")}>Prazo próximo</span> : null}
    </span>
  );
}

export function FormPendencia({
  inicial, processos, onSalvar, onCancelar,
}: {
  inicial: PendenciaEntrada;
  processos?: ProcessoCompleto[] | undefined;
  onSalvar: (e: PendenciaEntrada) => Promise<void>;
  onCancelar: () => void;
}) {
  const [f, setF] = useState(inicial);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const set = <K extends keyof PendenciaEntrada>(k: K, v: PendenciaEntrada[K]) => setF((x) => ({ ...x, [k]: v }));
  return (
    <form
      className="space-y-3"
      onSubmit={async (ev) => {
        ev.preventDefault();
        if (!f.processo_id) return setErro("Selecione o processo.");
        if (!f.titulo.trim()) return setErro("Informe o título.");
        setSalvando(true);
        setErro("");
        try { await onSalvar(f); } catch (e) { setErro((e as Error).message); } finally { setSalvando(false); }
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2"><Campo rotulo="Título"><input className={CLASSE_CAMPO} value={f.titulo} onChange={(e) => set("titulo", e.target.value)} /></Campo></div>
        {processos ? (
          <div className="sm:col-span-2"><Campo rotulo="Processo relacionado">
            <select className={CLASSE_CAMPO} value={f.processo_id} onChange={(e) => set("processo_id", e.target.value)}>
              <option value="">Selecione…</option>
              {processos.map((p) => <option key={p.id} value={p.id}>{p.numero} — {p.classe}</option>)}
            </select>
          </Campo></div>
        ) : null}
        <Campo rotulo="Tipo"><select className={CLASSE_CAMPO} value={f.tipo} onChange={(e) => set("tipo", e.target.value)}><Opcoes valores={TIPOS_PENDENCIA} /></select></Campo>
        <Campo rotulo="Prazo / data prevista"><input type="date" className={CLASSE_CAMPO} value={f.prazo ?? ""} onChange={(e) => set("prazo", e.target.value || null)} /></Campo>
        <Campo rotulo="Prioridade">
          <select className={CLASSE_CAMPO} value={f.prioridade} onChange={(e) => set("prioridade", e.target.value as PendenciaEntrada["prioridade"])}>
            {PRIORIDADES_PENDENCIA.map((p) => <option key={p.valor} value={p.valor}>{p.rotulo}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Status"><select className={CLASSE_CAMPO} value={f.status} onChange={(e) => set("status", e.target.value)}><Opcoes valores={STATUS_PENDENCIA} /></select></Campo>
        <Campo rotulo="Responsável"><input className={CLASSE_CAMPO} value={f.responsavel} onChange={(e) => set("responsavel", e.target.value)} /></Campo>
        {f.status === "Concluída" ? (
          <Campo rotulo="Data de conclusão"><input type="date" className={CLASSE_CAMPO} value={f.data_conclusao ?? hojeISO()} onChange={(e) => set("data_conclusao", e.target.value || null)} /></Campo>
        ) : null}
        <div className="sm:col-span-2"><Campo rotulo="Descrição"><textarea className={cn(CLASSE_CAMPO, "h-20 py-2")} value={f.descricao} onChange={(e) => set("descricao", e.target.value)} /></Campo></div>
        <div className="sm:col-span-2"><Campo rotulo="Observações"><textarea className={cn(CLASSE_CAMPO, "h-16 py-2")} value={f.observacoes} onChange={(e) => set("observacoes", e.target.value)} /></Campo></div>
      </div>
      {erro ? <p className="text-sm text-urgente">{erro}</p> : null}
      <div className="flex justify-end gap-2">
        <button type="button" className={BOTAO_SEC} onClick={onCancelar}>Cancelar</button>
        <button className={BOTAO} disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</button>
      </div>
    </form>
  );
}

export function DialogosPendencia({
  detalhe, setDetalhe, edicao, setEdicao, processos, onSalvar, onConcluir,
}: {
  detalhe: PendenciaListada | null;
  setDetalhe: (p: PendenciaListada | null) => void;
  edicao: { id?: string; dados: PendenciaEntrada } | null;
  setEdicao: (e: { id?: string; dados: PendenciaEntrada } | null) => void;
  processos?: ProcessoCompleto[] | undefined;
  onSalvar: (e: PendenciaEntrada, id?: string) => Promise<void>;
  onConcluir: (id: string) => Promise<void>;
}) {
  const linha = (r: string, v: React.ReactNode) => (
    <div><dt className="text-xs text-muted-foreground">{r}</dt><dd className="text-sm text-foreground">{v || "—"}</dd></div>
  );
  return (
    <>
      <Dialog open={!!detalhe} onOpenChange={(o) => !o && setDetalhe(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Detalhes da pendência</DialogTitle></DialogHeader>
          {detalhe ? (
            <div className="space-y-4">
              <div><p className="font-medium">{detalhe.titulo}</p><div className="mt-1"><EtiquetasPendencia p={detalhe} /></div></div>
              <dl className="grid grid-cols-2 gap-3">
                {linha("Processo", <Link to="/processos/$id" params={{ id: detalhe.processo_id }} className="numero-processo text-primary hover:underline">{detalhe.numero}</Link>)}
                {linha("Tipo", detalhe.tipo)}
                {linha("Status", detalhe.status)}
                {linha("Prioridade", rotuloPrioridade(detalhe.prioridade))}
                {linha("Prazo", formatarData(detalhe.prazo))}
                {linha("Responsável", detalhe.responsavel)}
                {linha("Criada em", new Date(detalhe.criado_em).toLocaleDateString("pt-BR"))}
                {linha("Conclusão", detalhe.data_conclusao ? formatarData(detalhe.data_conclusao) : "")}
              </dl>
              {linha("Descrição", detalhe.descricao)}
              {linha("Observações", detalhe.observacoes)}
              <div className="flex justify-end gap-2">
                <button className={BOTAO_SEC} onClick={() => { setEdicao({ id: detalhe.id, dados: paraEntrada(detalhe) }); setDetalhe(null); }}>Editar</button>
                {!detalhe.concluidaFlag ? (
                  <button className={BOTAO} onClick={async () => { await onConcluir(detalhe.id); setDetalhe(null); }}>Concluir</button>
                ) : null}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
      <Dialog open={!!edicao} onOpenChange={(o) => !o && setEdicao(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{edicao?.id ? "Editar pendência" : "Nova pendência"}</DialogTitle></DialogHeader>
          {edicao ? (
            <FormPendencia
              key={edicao.id ?? "nova"}
              inicial={edicao.dados}
              processos={processos}
              onCancelar={() => setEdicao(null)}
              onSalvar={async (d) => { await onSalvar(d, edicao.id); setEdicao(null); }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
