import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { Cabecalho, EstadoVazio } from "@/components/ui-serventia/Cabecalho";
import { CLASSE_CAMPO, Campo, Opcoes, Secao } from "@/components/processos/campos";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatarData } from "@/lib/dominio";
import { hojeISO } from "@/lib/processos/modelo";
import { processosQuery, removerAudiencia, salvarAudiencia, type AudienciaEntrada } from "@/lib/processos/repositorio";
import {
  CONFIG_AUDIENCIAS,
  MODALIDADES,
  SITUACOES_AUDIENCIA,
  TIPOS_AUDIENCIA,
  futuras,
  horaCurta,
  listarAudienciasDe,
  type AudienciaListada,
} from "@/lib/processos/audiencias";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/audiencias")({
  head: () => ({
    meta: [
      { title: "Audiências — Gestão da Vara Criminal" },
      { name: "description", content: "Pauta e calendário de audiências da Vara Criminal de Coração de Maria/BA." },
      { property: "og:title", content: "Audiências — Gestão da Vara Criminal" },
      { property: "og:description", content: "Pauta e calendário de audiências da Vara Criminal de Coração de Maria/BA." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(processosQuery()),
  errorComponent: ({ error }) => <EstadoVazio titulo="Erro ao carregar audiências" descricao={error.message} />,
  component: Pagina,
});

const BOTAO = "inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60";
const BOTAO_SEC = "inline-flex h-8 items-center gap-1 rounded-md border border-border bg-background px-3 text-xs font-medium hover:bg-muted";

function EtiquetaExtenso() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-atencao/25 bg-atencao-suave px-2 py-0.5 text-[11px] font-medium text-atencao">
      <span className="size-1.5 rounded-full bg-current" /> Prazo extenso
    </span>
  );
}

function Pagina() {
  const { data: processos } = useSuspenseQuery(processosQuery());
  const hoje = hojeISO();
  const todas = useMemo(() => listarAudienciasDe(processos, hoje), [processos, hoje]);
  const prox = futuras(todas);
  const deHoje = prox.filter((a) => a.dias === 0);
  const em7 = prox.filter((a) => a.dias > 0 && a.dias <= 7);
  const em30 = prox.filter((a) => a.dias > 7 && a.dias <= 30);
  const extensas = prox.filter((a) => a.prazoExtenso);

  const [detalhe, setDetalhe] = useState<AudienciaListada | null>(null);
  const [edicao, setEdicao] = useState<{ id?: string; valores: AudienciaEntrada } | null>(null);
  const qc = useQueryClient();
  const recarregar = () => qc.invalidateQueries({ queryKey: ["processos"] });

  const novo = (): AudienciaEntrada => ({ processo_id: "", tipo: "Instrução", data: hoje, horario: "09:00", modalidade: "Presencial", local: "", situacao: "Designada", observacao: "" });
  const editar = (a: AudienciaListada) => {
    setDetalhe(null);
    setEdicao({ id: a.id, valores: { processo_id: a.processo_id, tipo: a.tipo, data: a.data, horario: a.horario ? a.horario.slice(0, 5) : "", modalidade: a.modalidade, local: a.local, situacao: a.situacao, observacao: a.observacao } });
  };
  async function excluir(a: AudienciaListada) {
    if (!confirm("Excluir esta audiência?")) return;
    await removerAudiencia(a.id);
    setDetalhe(null);
    await recarregar();
  }

  return (
    <div className="space-y-6">
      <Cabecalho
        titulo="Audiências"
        subtitulo={`${prox.length} audiências futuras · ${todas.length} registradas`}
        acao={<button className={BOTAO} onClick={() => setEdicao({ valores: novo() })}><Plus className="size-4" /> Nova audiência</button>}
      />

      <section aria-label="Próximas audiências" className="grid gap-3 md:grid-cols-3">
        <GrupoProximas titulo="Hoje" itens={deHoje} destaque onAbrir={setDetalhe} />
        <GrupoProximas titulo="Próximos 7 dias" itens={em7} onAbrir={setDetalhe} />
        <GrupoProximas titulo="Próximos 30 dias" itens={em30} onAbrir={setDetalhe} />
      </section>

      <Calendario audiencias={todas} onAbrir={setDetalhe} />

      <Secao titulo="Todas as audiências">
        {todas.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma audiência registrada.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>{["Data", "Horário", "Processo", "Réu", "Tipo", "Modalidade", "Situação", ""].map((h) => <th key={h} className="px-2 py-2 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-border">
                {todas.map((a) => (
                  <tr key={a.id} className={cn("cursor-pointer hover:bg-muted/40", a.dias < 0 && "text-muted-foreground")} onClick={() => setDetalhe(a)}>
                    <td className="whitespace-nowrap px-2 py-2 font-medium">{formatarData(a.data)}</td>
                    <td className="px-2 py-2">{horaCurta(a.horario)}</td>
                    <td className="numero-processo whitespace-nowrap px-2 py-2">{a.numero}</td>
                    <td className="px-2 py-2">{a.reu}</td>
                    <td className="px-2 py-2">{a.tipo}</td>
                    <td className="px-2 py-2">{a.modalidade}</td>
                    <td className="px-2 py-2">{a.situacao}</td>
                    <td className="px-2 py-2">{a.prazoExtenso ? <EtiquetaExtenso /> : a.dias === 0 ? <span className="text-xs font-semibold text-urgente">Hoje</span> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Secao>

      <Secao titulo="Audiências com prazo extenso">
        <p className="mb-3 text-xs text-muted-foreground">
          Designadas para mais de {CONFIG_AUDIENCIAS.limiteDiasPrazoExtenso} dias a partir de hoje. Critério administrativo de acompanhamento — não indica irregularidade.
        </p>
        {extensas.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma.</p> : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {extensas.map((a) => (
              <li key={a.id}>
                <button className="flex w-full flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted/40" onClick={() => setDetalhe(a)}>
                  <span><span className="font-medium">{formatarData(a.data)}</span> · <span className="numero-processo">{a.numero}</span> · {a.tipo}</span>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">em {a.dias} dias <EtiquetaExtenso /></span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Secao>

      <Dialog open={!!detalhe} onOpenChange={(o) => !o && setDetalhe(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Detalhes da audiência</DialogTitle></DialogHeader>
          {detalhe ? (
            <div className="space-y-4">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ["Processo", detalhe.numero], ["Réu", detalhe.reu], ["Tipo", detalhe.tipo],
                  ["Data", formatarData(detalhe.data)], ["Horário", horaCurta(detalhe.horario)], ["Modalidade", detalhe.modalidade],
                  ["Local/sala", detalhe.local || "—"], ["Situação", detalhe.situacao],
                ].map(([k, v]) => (
                  <div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="font-medium">{v}</dd></div>
                ))}
                <div className="col-span-2"><dt className="text-xs text-muted-foreground">Observações</dt><dd>{detalhe.observacao || "—"}</dd></div>
              </dl>
              {detalhe.prazoExtenso ? <EtiquetaExtenso /> : null}
              <div className="flex flex-wrap justify-between gap-2 border-t border-border pt-3">
                <Link to="/processos/$id" params={{ id: detalhe.processo_id }} className="text-sm font-medium text-primary hover:underline">Abrir ficha do processo</Link>
                <div className="flex gap-2">
                  <button className={BOTAO_SEC} onClick={() => editar(detalhe)}><Pencil className="size-3.5" /> Editar</button>
                  <button className={BOTAO_SEC} onClick={() => excluir(detalhe)}><Trash2 className="size-3.5" /> Excluir</button>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!edicao} onOpenChange={(o) => !o && setEdicao(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{edicao?.id ? "Editar audiência" : "Nova audiência"}</DialogTitle></DialogHeader>
          {edicao ? (
            <FormAudiencia
              inicial={edicao.valores}
              processos={processos.map((p) => ({ id: p.id, numero: p.numero }))}
              onSalvar={async (v) => { await salvarAudiencia(v, edicao.id); await recarregar(); setEdicao(null); }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GrupoProximas({ titulo, itens, destaque, onAbrir }: { titulo: string; itens: AudienciaListada[]; destaque?: boolean; onAbrir: (a: AudienciaListada) => void }) {
  return (
    <div className={cn("rounded-lg border bg-card p-4 shadow-card", destaque && itens.length ? "border-l-4 border-border border-l-urgente" : "border-border")}>
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{titulo}</p>
        <p className={cn("text-2xl font-semibold tabular-nums", destaque && itens.length ? "text-urgente" : "text-foreground")}>{itens.length}</p>
      </div>
      <ul className="mt-2 space-y-1.5">
        {itens.slice(0, 4).map((a) => (
          <li key={a.id}>
            <button className="w-full rounded px-1 py-0.5 text-left text-xs hover:bg-muted" onClick={() => onAbrir(a)}>
              <span className="font-medium">{formatarData(a.data).slice(0, 5)} {horaCurta(a.horario)}</span> · {a.tipo}
              <span className="numero-processo block text-muted-foreground">{a.numero}</span>
            </button>
          </li>
        ))}
        {itens.length === 0 ? <li className="text-xs text-muted-foreground">Nenhuma audiência.</li> : null}
      </ul>
    </div>
  );
}

function FormAudiencia({ inicial, processos, onSalvar }: { inicial: AudienciaEntrada; processos: { id: string; numero: string }[]; onSalvar: (v: AudienciaEntrada) => Promise<void> }) {
  const [v, setV] = useState(inicial);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  return (
    <form
      className="grid gap-3 md:grid-cols-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!v.processo_id || !v.data) return setErro("Selecione o processo e informe a data.");
        setSalvando(true); setErro("");
        try { await onSalvar({ ...v, horario: v.horario || null }); } catch (err) { setErro(err instanceof Error ? err.message : "Erro ao salvar."); setSalvando(false); }
      }}
    >
      <div className="md:col-span-3">
        <Campo rotulo="Processo">
          <select className={CLASSE_CAMPO} value={v.processo_id} onChange={(e) => setV({ ...v, processo_id: e.target.value })}>
            <option value="">Selecione…</option>
            {processos.map((p) => <option key={p.id} value={p.id}>{p.numero}</option>)}
          </select>
        </Campo>
      </div>
      <Campo rotulo="Tipo de audiência"><select className={CLASSE_CAMPO} value={v.tipo} onChange={(e) => setV({ ...v, tipo: e.target.value })}><Opcoes valores={TIPOS_AUDIENCIA} /></select></Campo>
      <Campo rotulo="Data"><input type="date" className={CLASSE_CAMPO} value={v.data} onChange={(e) => setV({ ...v, data: e.target.value })} /></Campo>
      <Campo rotulo="Horário"><input type="time" className={CLASSE_CAMPO} value={v.horario ?? ""} onChange={(e) => setV({ ...v, horario: e.target.value })} /></Campo>
      <Campo rotulo="Modalidade"><select className={CLASSE_CAMPO} value={v.modalidade} onChange={(e) => setV({ ...v, modalidade: e.target.value })}><Opcoes valores={MODALIDADES} /></select></Campo>
      <Campo rotulo="Local/sala"><input className={CLASSE_CAMPO} value={v.local} onChange={(e) => setV({ ...v, local: e.target.value })} /></Campo>
      <Campo rotulo="Situação"><select className={CLASSE_CAMPO} value={v.situacao} onChange={(e) => setV({ ...v, situacao: e.target.value })}><Opcoes valores={SITUACOES_AUDIENCIA} /></select></Campo>
      <div className="md:col-span-3"><Campo rotulo="Observação"><textarea className={`${CLASSE_CAMPO} h-20 py-2`} value={v.observacao} onChange={(e) => setV({ ...v, observacao: e.target.value })} /></Campo></div>
      {erro ? <p className="text-sm text-urgente md:col-span-3">{erro}</p> : null}
      <div className="flex justify-end md:col-span-3"><button className={BOTAO} disabled={salvando}>{salvando ? "Salvando…" : "Salvar audiência"}</button></div>
    </form>
  );
}

/* ---------------- Calendário (mês / semana / dia) ---------------- */

type Visao = "mes" | "semana" | "dia";
const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const deISO = (s: string) => new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
const somar = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

function Calendario({ audiencias, onAbrir }: { audiencias: AudienciaListada[]; onAbrir: (a: AudienciaListada) => void }) {
  const hoje = hojeISO();
  const [visao, setVisao] = useState<Visao>("mes");
  const [ref, setRef] = useState(() => deISO(hoje));
  const porDia = useMemo(() => {
    const m = new Map<string, AudienciaListada[]>();
    for (const a of audiencias) m.set(a.data, [...(m.get(a.data) ?? []), a]);
    return m;
  }, [audiencias]);

  const navegar = (dir: number) =>
    setRef((r) => (visao === "mes" ? new Date(r.getFullYear(), r.getMonth() + dir, 1) : somar(r, dir * (visao === "semana" ? 7 : 1))));

  let dias: Date[] = [];
  let titulo = "";
  if (visao === "mes") {
    const inicio = new Date(ref.getFullYear(), ref.getMonth(), 1);
    const primeiro = somar(inicio, -inicio.getDay());
    dias = Array.from({ length: 42 }, (_, i) => somar(primeiro, i));
    titulo = `${MESES[ref.getMonth()]} de ${ref.getFullYear()}`;
  } else if (visao === "semana") {
    const primeiro = somar(ref, -ref.getDay());
    dias = Array.from({ length: 7 }, (_, i) => somar(primeiro, i));
    titulo = `${formatarData(iso(dias[0] ?? ref))} a ${formatarData(iso(dias[6] ?? ref))}`;
  } else {
    dias = [ref];
    titulo = `${DIAS_SEMANA[ref.getDay()]}, ${formatarData(iso(ref))}`;
  }

  const Item = ({ a }: { a: AudienciaListada }) => (
    <button
      onClick={() => onAbrir(a)}
      className={cn(
        "block w-full truncate rounded border px-1.5 py-0.5 text-left text-[11px]",
        a.tipo === "Tribunal do Júri" ? "border-primary/30 bg-primary/10 text-primary" : "border-info/25 bg-info-suave text-info",
        a.situacao === "Cancelada" && "line-through opacity-60",
      )}
      title={`${a.tipo} — ${a.numero}`}
    >
      {horaCurta(a.horario)} {a.tipo}
    </button>
  );

  return (
    <Secao
      titulo="Calendário"
      acao={
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border border-border p-0.5" role="group" aria-label="Visualização">
            {(["mes", "semana", "dia"] as const).map((v) => (
              <button key={v} aria-pressed={visao === v} onClick={() => setVisao(v)} className={cn("rounded px-2.5 py-1 text-xs", visao === v ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
                {v === "mes" ? "Mês" : v === "semana" ? "Semana" : "Dia"}
              </button>
            ))}
          </div>
          <button aria-label="Anterior" className="rounded-md border border-border p-1.5 hover:bg-muted" onClick={() => navegar(-1)}><ChevronLeft className="size-4" /></button>
          <button className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-muted" onClick={() => setRef(deISO(hoje))}>Hoje</button>
          <button aria-label="Próximo" className="rounded-md border border-border p-1.5 hover:bg-muted" onClick={() => navegar(1)}><ChevronRight className="size-4" /></button>
        </div>
      }
    >
      <p className="mb-3 text-sm font-medium text-foreground first-letter:uppercase" data-testid="titulo-calendario">{titulo}</p>
      {visao === "dia" ? (
        <ul className="space-y-2">
          {(porDia.get(iso(ref)) ?? []).map((a) => (
            <li key={a.id}>
              <button onClick={() => onAbrir(a)} className="w-full rounded-md border border-border p-3 text-left text-sm hover:bg-muted/40">
                <span className="font-semibold">{horaCurta(a.horario)}</span> · {a.tipo} · <span className="numero-processo">{a.numero}</span>
                <span className="block text-xs text-muted-foreground">{a.reu} · {a.modalidade} · {a.local || "—"}</span>
              </button>
            </li>
          ))}
          {!(porDia.get(iso(ref)) ?? []).length ? <li className="text-sm text-muted-foreground">Nenhuma audiência neste dia.</li> : null}
        </ul>
      ) : (
        <div className="grid grid-cols-7 overflow-hidden rounded-md border border-border text-xs">
          {DIAS_SEMANA.map((d) => <div key={d} className="border-b border-border bg-muted/60 px-2 py-1.5 font-medium text-muted-foreground">{d}</div>)}
          {dias.map((d) => {
            const k = iso(d);
            const fora = visao === "mes" && d.getMonth() !== ref.getMonth();
            return (
              <div key={k} className={cn("space-y-1 border-b border-r border-border p-1.5", visao === "semana" ? "min-h-40" : "min-h-20", fora && "bg-muted/30 text-muted-foreground")}>
                <button onClick={() => { setRef(d); setVisao("dia"); }} className={cn("rounded px-1 text-[11px] hover:bg-muted", k === hoje && "bg-primary font-semibold text-primary-foreground")}>
                  {d.getDate()}
                </button>
                {(porDia.get(k) ?? []).map((a) => <Item key={a.id} a={a} />)}
              </div>
            );
          })}
        </div>
      )}
    </Secao>
  );
}
