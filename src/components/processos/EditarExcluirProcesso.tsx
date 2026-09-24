import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CLASSE_CAMPO, Campo } from "@/components/processos/campos";
import { STATUS_PROCESSO, type ProcessoCompleto } from "@/lib/processos/modelo";
import { usePode } from "@/lib/sessao";

const BOTAO = "inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60";
const BOTAO_SEC = "inline-flex h-9 items-center rounded-md border border-border bg-background px-4 text-sm font-medium hover:bg-muted disabled:opacity-60";
const BOTAO_PERIGO = "inline-flex h-9 items-center rounded-md border border-urgente/40 bg-background px-4 text-sm font-medium text-urgente hover:bg-urgente/10 disabled:opacity-60";

export function AcoesProcesso({ p }: { p: ProcessoCompleto }) {
  const podeEditar = usePode("editar");
  const podeExcluir = usePode("excluir-processo");
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [form, setForm] = useState<null | Record<string, string>>(null);
  const [confirmar, setConfirmar] = useState(false);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  if (!podeEditar && !podeExcluir) return null;

  const abrir = () => {
    setErro("");
    setForm({
      numero: p.numero, classe: p.classe, assunto: p.assunto ?? "", status: p.status, fase: p.fase ?? "",
      data_distribuicao: p.data_distribuicao ?? "", responsavel: p.responsavel ?? "", observacao_geral: p.observacao_geral ?? "",
    });
  };

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setOcupado(true); setErro("");
    const { error } = await supabase.from("processos").update({ ...form, data_distribuicao: form.data_distribuicao || null }).eq("id", p.id);
    setOcupado(false);
    if (error) return setErro(error.code === "23505" ? "Já existe um processo com este número." : "Não foi possível salvar: " + error.message);
    await qc.invalidateQueries({ queryKey: ["processos"] });
    setForm(null);
  }

  async function excluir() {
    setOcupado(true); setErro("");
    const { error, count } = await supabase.from("processos").delete({ count: "exact" }).eq("id", p.id);
    setOcupado(false);
    if (error || !count) return setErro("Não foi possível excluir o processo." + (error ? " " + error.message : ""));
    await qc.invalidateQueries({ queryKey: ["processos"] });
    navigate({ to: "/processos" });
  }

  const campo = (k: string, rotulo: string, tipo = "text", req = false) => (
    <Campo rotulo={rotulo}><input type={tipo} required={req} className={CLASSE_CAMPO} value={form![k]} onChange={(e) => setForm({ ...form!, [k]: e.target.value })} /></Campo>
  );

  return (
    <div className="flex gap-2">
      {podeEditar ? <button className={BOTAO_SEC} onClick={abrir}>Editar processo</button> : null}
      {podeExcluir ? <button className={BOTAO_PERIGO} onClick={() => { setErro(""); setConfirmar(true); }}>Excluir processo</button> : null}

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editar processo</DialogTitle></DialogHeader>
          {form ? (
            <form className="space-y-3" onSubmit={salvar}>
              {campo("numero", "Número", "text", true)}
              {campo("classe", "Classe", "text", true)}
              {campo("assunto", "Assunto")}
              <Campo rotulo="Status">
                <select className={CLASSE_CAMPO} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {[...new Set([...STATUS_PROCESSO, form.status])].map((s) => <option key={s}>{s}</option>)}
                </select>
              </Campo>
              {campo("fase", "Fase processual")}
              {campo("data_distribuicao", "Data de distribuição", "date")}
              {campo("responsavel", "Responsável")}
              <Campo rotulo="Observação geral"><textarea className={CLASSE_CAMPO + " min-h-20"} value={form.observacao_geral} onChange={(e) => setForm({ ...form, observacao_geral: e.target.value })} /></Campo>
              {erro ? <p className="text-sm text-urgente">{erro}</p> : null}
              <div className="flex justify-end gap-2">
                <button type="button" className={BOTAO_SEC} onClick={() => setForm(null)}>Cancelar</button>
                <button className={BOTAO} disabled={ocupado}>{ocupado ? "Salvando…" : "Salvar"}</button>
              </div>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={confirmar} onOpenChange={setConfirmar}>
        <DialogContent>
          <DialogHeader><DialogTitle>Excluir processo {p.numero}?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Esta ação não pode ser desfeita. Também serão excluídos os réus, partes, movimentações, audiências, pendências, prioridades e anotações vinculados a este processo.
          </p>
          {erro ? <p className="text-sm text-urgente">{erro}</p> : null}
          <div className="flex justify-end gap-2">
            <button className={BOTAO_SEC} onClick={() => setConfirmar(false)}>Cancelar</button>
            <button className={BOTAO_PERIGO} disabled={ocupado} onClick={excluir}>{ocupado ? "Excluindo…" : "Excluir definitivamente"}</button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
