/** Cadastro/edição manual, retirada da prisão e reavaliação de presos provisórios (mesmo registro da tabela reus). */
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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

const CHAVE_PRAZO_TEMPORARIA = "Prazo da prisão temporária (dias)";
const CHAVE_TERMINO_TEMPORARIA = "Término de eventual prazo";
const BTN = "inline-flex h-9 items-center rounded-md px-3 text-sm font-medium disabled:opacity-50";

function somarDiasISO(iso: string, dias: number): string {
  const [ano, mes, dia] = iso.split("-").map(Number);
  const data = new Date(Date.UTC(ano!, mes! - 1, dia!));
  data.setUTCDate(data.getUTCDate() + dias);
  return `${data.getUTCFullYear()}-${String(data.getUTCMonth() + 1).padStart(2, "0")}-${String(data.getUTCDate()).padStart(2, "0")}`;
}

export function FormReuPreso({ reu, aberto, onFechar, onSalvo }: { reu: ReuEditavel | null; aberto: boolean; onFechar: () => void; onSalvo: () => void }) {
  const queryClient = useQueryClient();
  const [proc, setProc] = useState("");
  const [numeroProcesso, setNumeroProcesso] = useState("");
  const [reuId, setReuId] = useState<string>("novo");
  const [f, setF] = useState({ nome: "", rji: "", tipo_prisao: "Prisão preventiva", especie_cautelar: "", data_prisao: "", situacao: "", observacoes: "" });
  const [prazoTemporaria, setPrazoTemporaria] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setProc(reu?.processo_id ?? ""); setNumeroProcesso(""); setReuId(reu?.id ?? "novo");
    setF({ nome: reu?.nome ?? "", rji: reu?.rji ?? "", tipo_prisao: reu && TIPOS_CUSTODIA.includes(reu.tipo_prisao) ? reu.tipo_prisao : "Prisão preventiva",
      especie_cautelar: reu?.especie_cautelar ?? "", data_prisao: reu?.data_prisao ?? "", situacao: reu?.situacao ?? "", observacoes: reu?.observacoes ?? "" });
    setPrazoTemporaria(reu?.dados_planilha?.[CHAVE_PRAZO_TEMPORARIA] ?? "");
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
      setPrazoTemporaria(dp[CHAVE_PRAZO_TEMPORARIA] ?? "");
    }
  };

  const salvar = async () => {
    if (!f.nome.trim()) { toast.error("Informe o nome do réu"); return; }
    setSalvando(true);

    let processoId = proc;
    if (!processoId) {
      const numero = numeroProcesso.trim();
      if (!numero) {
        setSalvando(false);
        toast.error("Informe o número do processo");
        return;
      }
      const numeroNumerico = numero.replace(/\D/g, "");
      const { data: existente, error: buscaErro } = await supabase
        .from("processos")
        .select("id")
        .or(`numero.eq.${numero},numero.eq.${numeroNumerico}`)
        .maybeSingle();
      if (buscaErro) {
        setSalvando(false);
        toast.error(buscaErro.message);
        return;
      }
      if (existente?.id) {
        processoId = existente.id;
      } else {
        const { data: criado, error: criarErro } = await supabase
          .from("processos")
          .insert({ numero, classe: "Não informada", origem: "manual", conferir: true })
          .select("id")
          .single();
        if (criarErro || !criado?.id) {
          setSalvando(false);
          toast.error(criarErro?.message ?? "Não foi possível cadastrar o processo.");
          return;
        }
        processoId = criado.id;
      }
    }
    const base = reu ?? vinculados.find((x) => x.id === reuId);
    const dados = { ...((base?.dados_planilha ?? {}) as Record<string, string>) };

    if (f.tipo_prisao === "Prisão temporária") {
      const prazoInformado = prazoTemporaria.trim();
      const terminoExistente = dados[CHAVE_TERMINO_TEMPORARIA]?.trim();
      if (!prazoInformado && !terminoExistente) {
        setSalvando(false);
        toast.error("Informe o prazo da prisão temporária em dias.");
        return;
      }
      if (prazoInformado) {
        const dias = Number(prazoInformado);
        if (!Number.isInteger(dias) || dias <= 0 || dias > 365) {
          setSalvando(false);
          toast.error("Informe um prazo válido, em dias.");
          return;
        }
        if (!f.data_prisao) {
          setSalvando(false);
          toast.error("Informe a data da prisão para calcular o término da temporária.");
          return;
        }
        dados[CHAVE_PRAZO_TEMPORARIA] = String(dias);
        dados[CHAVE_TERMINO_TEMPORARIA] = somarDiasISO(f.data_prisao, dias);
      }
    }

    const linha = { processo_id: processoId, nome: f.nome.trim(), rji: f.rji.trim(), tipo_prisao: f.tipo_prisao, especie_cautelar: f.especie_cautelar.trim(),
      data_prisao: f.data_prisao || null, situacao: f.situacao.trim(), observacoes: f.observacoes, preso: true, dados_planilha: dados };
    const id = reu?.id ?? (reuId !== "novo" ? reuId : null);
    let error;
    if (id) ({ error } = await supabase.from("reus").update(linha).eq("id", id));
    else ({ error } = await supabase.from("reus").insert({ ...linha, ordem: vinculados.length }));
    setSalvando(false);
    if (error) { toast.error(error.message); return; }
    // Reflete a alteração do tipo imediatamente no contador e na lista compartilhados.
    // A invalidação em onSalvo continua reconciliando os dados com o banco.
    if (id) {
      queryClient.setQueryData<Array<{ id: string; tipo_prisao: string }>>(["reus-presos"], (anterior) =>
        anterior?.map((item) => item.id === id ? { ...item, tipo_prisao: linha.tipo_prisao } : item),
      );
    }
    toast.success("Preso provisório salvo"); onSalvo(); onFechar();
  };

  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{reu ? "Editar preso provisório" : "Adicionar preso provisório"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {proc ? (
            <Campo rotulo="Processo"><SeletorProcesso value={proc} onChange={(v) => { setProc(v); setReuId("novo"); }} /></Campo>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-amber-700">Este réu não está vinculado a um processo. Informe o número para corrigir o cadastro.</p>
              <Campo rotulo="Número do processo">
                <input
                  className={CLASSE_CAMPO}
                  value={numeroProcesso}
                  onChange={(e) => setNumeroProcesso(e.target.value)}
                  placeholder="Ex.: 8000000-00.2026.8.05.0000"
                />
              </Campo>
            </div>
          )}
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
            <Campo rotulo="Tipo de prisão">
              <select className={CLASSE_CAMPO} value={f.tipo_prisao} onChange={set("tipo_prisao")}>
                {TIPOS_CUSTODIA.map((t) => <option key={t}>{t}</option>)}
              </select>
            </Campo>
            <Campo rotulo="Data da prisão"><input type="date" className={CLASSE_CAMPO} value={f.data_prisao} onChange={set("data_prisao")} /></Campo>
            {f.tipo_prisao === "Prisão temporária" ? (
              <div className="sm:col-span-2 rounded-md border border-border bg-muted/30 p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Campo rotulo="Prazo da temporária (dias)">
                    <input
                      type="number"
                      min={1}
                      max={365}
                      inputMode="numeric"
                      className={CLASSE_CAMPO}
                      value={prazoTemporaria}
                      onChange={(e) => setPrazoTemporaria(e.target.value)}
                      placeholder="Ex.: 5 ou 30"
                    />
                  </Campo>
                  <div className="flex flex-col justify-end">
                    <span className="mb-1 text-xs font-medium text-muted-foreground">Término calculado</span>
                    <div className="flex h-9 items-center rounded-md border border-border bg-background px-3 text-sm">
                      {f.data_prisao && Number(prazoTemporaria) > 0
                        ? formatarData(somarDiasISO(f.data_prisao, Number(prazoTemporaria)))
                        : "Informe a data e o prazo"}
                    </div>
                  </div>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">O sistema calcula e acompanha automaticamente o término da prisão temporária.</p>
              </div>
            ) : null}
          </div>
          <Campo rotulo="Observações"><textarea className={`${CLASSE_CAMPO} h-20 py-2`} value={f.observacoes} onChange={set("observacoes")} /></Campo>
          <p className="text-xs text-muted-foreground">Reavaliações são registradas pela ação própria e mantidas no histórico. Campos técnicos e datas derivadas são controlados automaticamente pelo sistema.</p>
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
    queryFn: async () => ((await (supabase.from as never as (t: string) => { select: (s: string) => { eq: (c: string, v: string) => { order: (c: string, o: object) => Promise<{ data: { id: string; tipo_prisao: string; data_prisao: string | null; data_encerramento: string; motivo: string }[] | null }> } } })("reu_prisoes_encerradas").select("*").eq("reu_id", reu!.id).order("data_encerramento", { ascending: false })).data) ?? [],
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
        <p className="text-sm text-muted-foreground">O preso provisório deixará as listas de Presos Provisórios e Prisões Temporárias. O processo, o cadastro do réu, os processos relacionados e o histórico são preservados. Uma nova prisão poderá ser registrada depois sem apagar esta.</p>
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
  const [editando, setEditando] = useState<number | null>(null);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { if (reu) { setModo("existente"); setProc(""); setNumero(""); setTipo("acao_penal"); setEditando(null); setErro(""); } }, [reu]);

  const novoVinculo = () => {
    setEditando(null);
    setModo("existente");
    setProc("");
    setNumero("");
    setTipo("acao_penal");
    setErro("");
  };

  const editarVinculo = (indice: number) => {
    if (!reu) return;
    const atual = (reu.processos_relacionados ?? [])[indice];
    if (!atual) return;
    setEditando(indice);
    setErro("");
    setTipo(atual.tipo || "acao_penal");
    if (atual.processo_id) {
      setModo("existente");
      setProc(atual.processo_id);
      setNumero("");
    } else {
      setModo("novo");
      setProc("");
      setNumero(atual.numero);
    }
  };

  const excluirVinculo = async (indice: number) => {
    if (!reu) return;
    const atuais = reu.processos_relacionados ?? [];
    const atual = atuais[indice];
    if (!atual) return;
    if (!window.confirm(`Remover o vínculo com o processo ${atual.numero}? O processo continuará no acervo.`)) return;
    setSalvando(true);
    try {
      const lista = atuais.filter((_, i) => i !== indice);
      const { error } = await supabase.from("reus").update({ processos_relacionados: lista }).eq("id", reu.id);
      if (error) throw new Error(error.message);
      toast.success("Vínculo com processo relacionado removido");
      onSalvo();
      onFechar();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSalvando(false);
    }
  };
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
      const atuais = reu.processos_relacionados ?? [];
      const vinculoAtual = editando === null ? null : atuais[editando];
      const editandoMesmoVinculoPrincipal =
        editando !== null &&
        vinculoAtual?.processo_id === pid &&
        pid === reu.processo_id;
      if (pid === reu.processo_id && !editandoMesmoVinculoPrincipal) {
        throw new Error("Este já é o processo principal do preso");
      }
      if (atuais.some((r, i) => i !== editando && (r.processo_id === pid || soDig(r.numero) === soDig(num)))) {
        toast.info("Processo já relacionado — vínculo existente mantido");
        return;
      }
      const anterior = editando === null ? null : atuais[editando];
      const vinculo = { tipo, numero: num, processo_id: pid, situacao: anterior?.situacao ?? "manual" };
      const lista = editando === null
        ? [...atuais, vinculo]
        : atuais.map((r, i) => i === editando ? vinculo : r);
      const { error } = await supabase.from("reus").update({ processos_relacionados: lista }).eq("id", reu.id);
      if (error) throw new Error(error.message);
      toast.success(editando === null ? "Processo relacionado adicionado" : "Processo relacionado atualizado"); onSalvo(); onFechar();
    } catch (e) {
      const mensagem = (e as Error).message;
      setErro(mensagem);
      toast.error(mensagem);
    } finally { setSalvando(false); }
  };
  return (
    <Dialog open={!!reu} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>Gerenciar processos relacionados — {reu?.nome}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium">Vínculos atuais</p>
              <button className={`${BTN} border border-border`} disabled={salvando} onClick={novoVinculo}>Novo vínculo</button>
            </div>
            {(reu?.processos_relacionados ?? []).length === 0 ? (
              <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">Nenhum processo relacionado cadastrado.</p>
            ) : (
              <div className="divide-y divide-border rounded-md border border-border">
                {(reu?.processos_relacionados ?? []).map((item, indice) => (
                  <div key={`${item.processo_id ?? item.numero}-${indice}`} className="flex flex-wrap items-center justify-between gap-3 p-3">
                    <div>
                      <p className="numero-processo text-sm font-medium">{item.numero}</p>
                      <p className="text-xs text-muted-foreground">{TIPOS_REL.find(([v]) => v === item.tipo)?.[1] ?? item.tipo}</p>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <button className="font-medium text-primary hover:underline" disabled={salvando} onClick={() => editarVinculo(indice)}>Editar</button>
                      <button className="font-medium text-urgente hover:underline" disabled={salvando} onClick={() => void excluirVinculo(indice)}>Excluir</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3 rounded-md border border-border bg-muted/20 p-3">
            <p className="text-sm font-medium">{editando === null ? "Adicionar processo relacionado" : "Editar processo relacionado"}</p>
            {erro ? <p className="rounded-md border border-urgente/30 bg-urgente-suave px-3 py-2 text-xs text-urgente">{erro}</p> : null}
          <Campo rotulo="Tipo de relação"><select className={CLASSE_CAMPO} value={tipo} onChange={(e) => setTipo(e.target.value)}>{TIPOS_REL.map(([v, r]) => <option key={v} value={v}>{r}</option>)}</select></Campo>
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-1.5"><input type="radio" checked={modo === "existente"} onChange={() => setModo("existente")} /> Processo do acervo</label>
            <label className="flex items-center gap-1.5"><input type="radio" checked={modo === "novo"} onChange={() => setModo("novo")} /> Não está no acervo</label>
          </div>
          {modo === "existente" ? <Campo rotulo="Processo"><SeletorProcesso value={proc} onChange={setProc} /></Campo>
            : <Campo rotulo="Número do processo (cadastro mínimo, sinalizado para conferência)"><input className={CLASSE_CAMPO} value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="0000000-00.0000.0.00.0000" /></Campo>}
          <div className="flex justify-end gap-2">
            <button className={`${BTN} border border-border`} onClick={onFechar}>Cancelar</button>
            <button className={`${BTN} bg-primary text-primary-foreground`} disabled={salvando} onClick={salvar}>{salvando ? "Salvando..." : editando === null ? "Adicionar" : "Salvar alterações"}</button>
          </div>
          </div>
          <p className="text-xs text-muted-foreground">Excluir remove somente o vínculo com o preso. O processo relacionado permanece no acervo.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
