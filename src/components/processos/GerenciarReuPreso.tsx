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

const EXTRAS = ["Andamento do último procedimento", "Término de eventual prazo", "Prazo de reavaliação", "Data de reavaliação", "Sistema"] as const;
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
    if (!proc) { toast.error("Selecione o processo"); return; }
    if (!f.nome.trim()) { toast.error("Informe o nome do réu"); return; }
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
    if (error) { toast.error(error.message); return; }
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
            <Campo rotulo="Próxima reavaliação"><input type="date" className={CLASSE_CAMPO} value={extras["Data de reavaliação"] ?? ""} onChange={(e) => setExtras({ ...extras, "Data de reavaliação": e.target.value })} /></Campo>
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

/** Encerra a situação prisional atual, preservando réu, processo, vínculos e histórico. */
export function RetirarPrisao({ reu, onFechar, onSalvo }: { reu: ReuEditavel | null; onFechar: () => void; onSalvo: () => void }) {
  const [data, setData] = useState(hojeISO());
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { if (reu) { setData(hojeISO()); setMotivo(""); } }, [reu]);
  const { data: hist = [] } = useQuery({
    queryKey: ["prisoes-encerradas", reu?.id], enabled: !!reu,
    queryFn: async () => ((await (supabase.from as never as (t: string) => { select: (s: string) => { eq: (c: string, v: string) => { order: (c: string, o: object) => Promise<{ data: { id: string; tipo_prisao: string; data_prisao: string | null; data_encerramento: string; motivo: string }[] | null }> } } }>("reu_prisoes_encerradas").select("*").eq("reu_id", reu!.id).order("data_encerramento", { ascending: false })).data) ?? [],
  });
  const confirmar = async () => {
    if (!reu) return;
    setSalvando(true);
    const { error } = await supabase.rpc("encerrar_prisao" as never, { p_reu: reu.id, p_data: data, p_motivo: motivo } as never);
    setSalvando(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Situação prisional encerrada"); onSalvo(); onFechar();
  };
  return (
    <Dialog open={!!reu} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Encerrar situação prisional — {reu?.nome}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">O réu deixará as listas de Réus Presos e Prisões Temporárias. O processo, o cadastro do réu, os processos relacionados e o histórico são preservados. Uma nova prisão poderá ser registrada depois sem apagar esta.</p>
        <div className="space-y-3">
          <Campo rotulo="Data do encerramento"><input type="date" className={CLASSE_CAMPO} value={data} onChange={(e) => setData(e.target.value)} /></Campo>
          <Campo rotulo="Motivo / observação (opcional)"><textarea className={`${CLASSE_CAMPO} h-16 py-2`} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></Campo>
          {hist.length ? (
            <div className="text-xs">
              <div className="mb-1 font-medium text-muted-foreground">Prisões anteriores encerradas</div>
              {hist.map((h) => <div key={h.id}>{h.tipo_prisao} · {formatarData(h.data_prisao)} a {formatarData(h.data_encerramento)}{h.motivo ? ` — ${h.motivo}` : ""}</div>)}
            </div>
          ) : null}
          <div className="flex justify-end gap-2">
            <button className={`${BTN} border border-border`} onClick={onFechar}>Cancelar</button>
            <button className={`${BTN} bg-primary text-primary-foreground`} disabled={salvando || !data} onClick={confirmar}>Encerrar</button>
          </div>
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
    if (error) { toast.error(error.message); return; }
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

const TIPOS_REL = [["ip", "IP"], ["cautelar", "Processo cautelar"], ["acao_penal", "Ação penal"], ["outro", "Outro processo relacionado"]] as const;
const soDig = (s: string) => s.replace(/\D/g, "");
function formatarCNJ(d: string) { return `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9, 13)}.${d.slice(13, 14)}.${d.slice(14, 16)}.${d.slice(16, 20)}`; }

/** Vincula um processo (existente ou criado de forma mínima) ao preso, no mesmo campo usado pelo importador. */
export function AdicionarRelacionado({ reu, onFechar, onSalvo }: { reu: (ReuEditavel & { processos_relacionados?: { tipo: string; numero: string; processo_id: string | null; situacao: string }[] }) | null; onFechar: () => void; onSalvo: () => void }) {
  const [modo, setModo] = useState<"existente" | "novo">("existente");
  const [proc, setProc] = useState("");
  const [numero, setNumero] = useState("");
  const [tipo, setTipo] = useState<string>("acao_penal");
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { if (reu) { setModo("existente"); setProc(""); setNumero(""); setTipo("acao_penal"); } }, [reu]);
  const salvar = async () => {
    if (!reu) return;
    setSalvando(true);
    try {
      let pid = proc; let num = "";
      if (modo === "existente") {
        if (!pid) throw new Error("Selecione o processo");
        const { data } = await supabase.from("processos").select("numero").eq("id", pid).single();
        num = data?.numero ?? "";
      } else {
        const d = soDig(numero);
        if (d.length !== 20) throw new Error("Informe o número CNJ completo (20 dígitos)");
        num = formatarCNJ(d);
        const { data: ex } = await supabase.from("processos").select("id, numero").eq("numero", num).maybeSingle();
        if (ex) { pid = ex.id; num = ex.numero; }
        else {
          const { data: novo, error } = await supabase.from("processos").insert({ numero: num, classe: "Não informada", origem: "manual", conferir: true }).select("id").single();
          if (error) throw new Error(error.message);
          pid = novo.id;
        }
      }
      if (pid === reu.processo_id) throw new Error("Este já é o processo principal do preso");
      const atuais = reu.processos_relacionados ?? [];
      if (atuais.some((r) => r.processo_id === pid || soDig(r.numero) === soDig(num))) { toast.info("Processo já relacionado — vínculo existente mantido"); onFechar(); return; }
      const lista = [...atuais, { tipo, numero: num, processo_id: pid, situacao: "manual" }];
      const { error } = await supabase.from("reus").update({ processos_relacionados: lista }).eq("id", reu.id);
      if (error) throw new Error(error.message);
      toast.success("Processo relacionado adicionado"); onSalvo(); onFechar();
    } catch (e) { toast.error((e as Error).message); } finally { setSalvando(false); }
  };
  return (
    <Dialog open={!!reu} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Adicionar processo relacionado — {reu?.nome}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Campo rotulo="Tipo de relação"><select className={CLASSE_CAMPO} value={tipo} onChange={(e) => setTipo(e.target.value)}>{TIPOS_REL.map(([v, r]) => <option key={v} value={v}>{r}</option>)}</select></Campo>
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-1.5"><input type="radio" checked={modo === "existente"} onChange={() => setModo("existente")} /> Processo do acervo</label>
            <label className="flex items-center gap-1.5"><input type="radio" checked={modo === "novo"} onChange={() => setModo("novo")} /> Não está no acervo</label>
          </div>
          {modo === "existente" ? <Campo rotulo="Processo"><SeletorProcesso value={proc} onChange={setProc} /></Campo>
            : <Campo rotulo="Número do processo (cadastro mínimo, sinalizado para conferência)"><input className={CLASSE_CAMPO} value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="0000000-00.0000.0.00.0000" /></Campo>}
          <div className="flex justify-end gap-2">
            <button className={`${BTN} border border-border`} onClick={onFechar}>Cancelar</button>
            <button className={`${BTN} bg-primary text-primary-foreground`} disabled={salvando} onClick={salvar}>Salvar</button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
