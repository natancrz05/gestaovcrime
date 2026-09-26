/** Cadastro/edição manual, retirada da prisão e reavaliação de réus presos (mesmo registro da tabela reus). */
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Campo, CLASSE_CAMPO } from "./campos";
import { SeletorProcesso } from "./SeletorProcesso";
import { supabase } from "@/integrations/supabase/client";
import { formatarData } from "@/lib/dominio";
import { hojeISO } from "@/lib/processos/modelo";

export const TIPOS_CUSTODIA = ["Prisão preventiva", "Prisão temporária", "Prisão em flagrante", "Outra"];

export interface ReuEditavel {
  id: string; processo_id: string | null; nome: string; situacao: string; tipo_prisao: string; data_prisao: string | null;
  rji: string; especie_cautelar: string; observacoes?: string; dados_planilha: Record<string, string>;
}

const EXTRAS = ["Andamento do último procedimento", "Término de eventual prazo", "Prazo de reavaliação", "Sistema"] as const;
const BTN = "inline-flex h-9 items-center rounded-md px-3 text-sm font-medium disabled:opacity-50";

export function FormReuPreso({ reu, aberto, onFechar, onSalvo }: { reu: ReuEditavel | null; aberto: boolean; onFechar: () => void; onSalvo: () => void }) {
  const [proc, setProc] = useState("");
  const [reuId, setReuId] = useState<string>("novo");
  const [f, setF] = useState({ nome: "", rji: "", tipo_prisao: "Prisão preventiva", especie_cautelar: "", data_prisao: "", situacao: "", observacoes: "" });
  const [extras, setExtras] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setProc(reu?.processo_id ?? ""); setReuId(reu?.id ?? "novo");
    setF({ nome: reu?.nome ?? "", rji: reu?.rji ?? "", tipo_prisao: reu && TIPOS_CUSTODIA.includes(reu.tipo_prisao) ? reu.tipo_prisao : "Prisão preventiva",
      especie_cautelar: reu?.especie_cautelar ?? "", data_prisao: reu?.data_prisao ?? "", situacao: reu?.situacao ?? "", observacoes: reu?.observacoes ?? "" });
    setExtras(Object.fromEntries(EXTRAS.map((k) => [k, reu?.dados_planilha?.[k] ?? ""])));
  }, [aberto, reu]);

  const { data: vinculados = [] } = useQuery({
    queryKey: ["reus-do-processo", proc], enabled: !!proc && !reu,
    queryFn: async () => (await supabase.from("reus").select("*").eq("processo_id", proc).order("ordem")).data ?? [],
  });

  const escolherReu = (id: string) => {
    setReuId(id);
    const r = vinculados.find((x) => x.id === id);
    if (r) {
      setF({ nome: r.nome, rji: r.rji, tipo_prisao: TIPOS_CUSTODIA.includes(r.tipo_prisao) ? r.tipo_prisao : "Prisão preventiva", especie_cautelar: r.especie_cautelar,
        data_prisao: r.data_prisao ?? "", situacao: r.situacao, observacoes: r.observacoes });
      const dp = (r.dados_planilha ?? {}) as Record<string, string>;
      setExtras(Object.fromEntries(EXTRAS.map((k) => [k, dp[k] ?? ""])));
    }
  };

  const salvar = async () => {
    if (!proc) return toast.error("Selecione o processo");
    if (!f.nome.trim()) return toast.error("Informe o nome do réu");
    setSalvando(true);
    const base = reu ?? vinculados.find((x) => x.id === reuId);
    const dados = { ...((base?.dados_planilha ?? {}) as Record<string, string>) };
    for (const k of EXTRAS) { if (extras[k]?.trim()) dados[k] = extras[k].trim(); else delete dados[k]; }
    const linha = { processo_id: proc, nome: f.nome.trim(), rji: f.rji.trim(), tipo_prisao: f.tipo_prisao, especie_cautelar: f.especie_cautelar.trim(),
      data_prisao: f.data_prisao || null, situacao: f.situacao.trim(), observacoes: f.observacoes, preso: true, dados_planilha: dados };
    const id = reu?.id ?? (reuId !== "novo" ? reuId : null);
    let error;
    if (id) ({ error } = await supabase.from("reus").update(linha).eq("id", id));
    else ({ error } = await supabase.from("reus").insert({ ...linha, ordem: vinculados.length }));
    setSalvando(false);
    if (error) return toast.error(error.message);
    toast.success("Réu preso salvo"); onSalvo(); onFechar();
  };

  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{reu ? "Editar réu preso" : "Adicionar réu preso"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Campo rotulo="Processo"><SeletorProcesso value={proc} onChange={(v) => { setProc(v); setReuId("novo"); }} /></Campo>
          {!reu && proc ? (
            <Campo rotulo="Réu">
              <select className={CLASSE_CAMPO} value={reuId} onChange={(e) => escolherReu(e.target.value)}>
                <option value="novo">+ Cadastrar novo réu</option>
                {vinculados.map((r) => <option key={r.id} value={r.id}>{r.nome}{r.preso ? " (já preso)" : ""}</option>)}
              </select>
            </Campo>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo rotulo="Nome do réu"><input className={CLASSE_CAMPO} value={f.nome} onChange={set("nome")} /></Campo>
            <Campo rotulo="RJI"><input className={CLASSE_CAMPO} value={f.rji} onChange={set("rji")} /></Campo>
            <Campo rotulo="Tipo de prisão"><select className={CLASSE_CAMPO} value={f.tipo_prisao} onChange={set("tipo_prisao")}>{TIPOS_CUSTODIA.map((t) => <option key={t}>{t}</option>)}</select></Campo>
            <Campo rotulo="Espécie de cautelar"><input className={CLASSE_CAMPO} value={f.especie_cautelar} onChange={set("especie_cautelar")} /></Campo>
            <Campo rotulo="Data da prisão"><input type="date" className={CLASSE_CAMPO} value={f.data_prisao} onChange={set("data_prisao")} /></Campo>
            <Campo rotulo="Situação"><input className={CLASSE_CAMPO} value={f.situacao} onChange={set("situacao")} /></Campo>
            <Campo rotulo="Término de eventual prazo"><input type="date" className={CLASSE_CAMPO} value={extras["Término de eventual prazo"] ?? ""} onChange={(e) => setExtras({ ...extras, "Término de eventual prazo": e.target.value })} /></Campo>
            <Campo rotulo="Prazo de reavaliação"><input className={CLASSE_CAMPO} value={extras["Prazo de reavaliação"] ?? ""} onChange={(e) => setExtras({ ...extras, "Prazo de reavaliação": e.target.value })} /></Campo>
            <Campo rotulo="Sistema"><input className={CLASSE_CAMPO} value={extras["Sistema"] ?? ""} onChange={(e) => setExtras({ ...extras, Sistema: e.target.value })} /></Campo>
            <Campo rotulo="Andamento do último procedimento"><input className={CLASSE_CAMPO} value={extras["Andamento do último procedimento"] ?? ""} onChange={(e) => setExtras({ ...extras, "Andamento do último procedimento": e.target.value })} /></Campo>
          </div>
          <Campo rotulo="Observações"><textarea className={`${CLASSE_CAMPO} h-20 py-2`} value={f.observacoes} onChange={set("observacoes")} /></Campo>
          <p className="text-xs text-muted-foreground">A última reavaliação é atualizada pela ação "Registrar reavaliação", que mantém o histórico.</p>
          <div className="flex justify-end gap-2">
            <button className={`${BTN} border border-border`} onClick={onFechar}>Cancelar</button>
            <button className={`${BTN} bg-primary text-primary-foreground`} disabled={salvando} onClick={salvar}>{salvando ? "Salvando..." : "Salvar"}</button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function RetirarPrisao({ reu, onFechar, onSalvo }: { reu: ReuEditavel | null; onFechar: () => void; onSalvo: () => void }) {
  const [sit, setSit] = useState("Solto");
  const [salvando, setSalvando] = useState(false);
  const confirmar = async () => {
    if (!reu) return;
    setSalvando(true);
    const { error } = await supabase.from("reus").update({ preso: false, tipo_prisao: "Não preso", situacao: sit.trim() || "Solto" }).eq("id", reu.id);
    setSalvando(false);
    if (error) return toast.error(error.message);
    toast.success("Réu retirado da condição de preso"); onSalvo(); onFechar();
  };
  return (
    <Dialog open={!!reu} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Retirar da condição de preso</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">{reu?.nome} deixará a lista de Réus Presos. O processo, o cadastro do réu e o histórico são preservados.</p>
        <Campo rotulo="Nova situação"><input className={CLASSE_CAMPO} value={sit} onChange={(e) => setSit(e.target.value)} /></Campo>
        <div className="flex justify-end gap-2">
          <button className={`${BTN} border border-border`} onClick={onFechar}>Cancelar</button>
          <button className={`${BTN} bg-primary text-primary-foreground`} disabled={salvando} onClick={confirmar}>Confirmar</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function RegistrarReavaliacao({ reu, onFechar, onSalvo }: { reu: ReuEditavel | null; onFechar: () => void; onSalvo: () => void }) {
  const [data, setData] = useState(hojeISO());
  const [prox, setProx] = useState("");
  const [obs, setObs] = useState("");
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { if (reu) { setData(hojeISO()); setProx(""); setObs(""); } }, [reu]);
  const { data: hist = [] } = useQuery({
    queryKey: ["reavaliacoes", reu?.id], enabled: !!reu,
    queryFn: async () => (await supabase.from("reu_reavaliacoes").select("*").eq("reu_id", reu!.id).order("data_reavaliacao", { ascending: false })).data ?? [],
  });
  const salvar = async () => {
    if (!reu) return;
    setSalvando(true);
    const { error } = await supabase.rpc("registrar_reavaliacao", { p_reu: reu.id, p_data: data, p_proxima: prox || null, p_obs: obs } as never);
    setSalvando(false);
    if (error) return toast.error(error.message);
    toast.success("Reavaliação registrada"); onSalvo(); onFechar();
  };
  return (
    <Dialog open={!!reu} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Registrar reavaliação — {reu?.nome}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Campo rotulo="Data da reavaliação"><input type="date" className={CLASSE_CAMPO} value={data} onChange={(e) => setData(e.target.value)} /></Campo>
          <Campo rotulo="Próxima data (opcional)"><input type="date" className={CLASSE_CAMPO} value={prox} onChange={(e) => setProx(e.target.value)} /></Campo>
          <Campo rotulo="Observação"><textarea className={`${CLASSE_CAMPO} h-16 py-2`} value={obs} onChange={(e) => setObs(e.target.value)} /></Campo>
          {hist.length ? (
            <div className="text-xs">
              <div className="mb-1 font-medium text-muted-foreground">Histórico</div>
              {hist.map((h) => <div key={h.id}>{formatarData(h.data_reavaliacao)}{h.observacao ? ` — ${h.observacao}` : ""}{h.usuario_nome ? ` (${h.usuario_nome})` : ""}</div>)}
            </div>
          ) : null}
          <div className="flex justify-end gap-2">
            <button className={`${BTN} border border-border`} onClick={onFechar}>Cancelar</button>
            <button className={`${BTN} bg-primary text-primary-foreground`} disabled={salvando || !data} onClick={salvar}>Salvar</button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Alerta operacional (não é prazo legal): somente para prisão preventiva. */
export function situacaoRevisao(tipo: string, ultima: string | undefined, hoje: string, dias: (a: string, b: string) => number) {
  if (tipo !== "Prisão preventiva") return null;
  if (!ultima) return { rotulo: "Conferir reavaliação", cls: "border-alerta/30 bg-alerta-suave text-alerta", dias: null as number | null };
  const d = dias(ultima, hoje);
  if (d < 85) return { rotulo: "Regular", cls: "border-border bg-muted text-muted-foreground", dias: d };
  if (d === 85) return { rotulo: "Revisão próxima", cls: "border-alerta/30 bg-alerta-suave text-alerta", dias: d };
  return { rotulo: "Revisão pendente", cls: "border-urgente/30 bg-urgente-suave text-urgente", dias: d };
}
