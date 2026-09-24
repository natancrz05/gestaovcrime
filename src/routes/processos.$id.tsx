import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Cabecalho, EstadoVazio, AvisoEtapa } from "@/components/ui-serventia/Cabecalho";
import { Etiqueta } from "@/components/ui-serventia/Etiqueta";
import { CLASSE_CAMPO, Campo, Opcoes, Secao } from "@/components/processos/campos";
import { formatarData } from "@/lib/dominio";
import { cn } from "@/lib/utils";
import { DialogosPendencia, EtiquetasPendencia, novaPendencia } from "@/components/processos/Pendencias";
import { classificar, concluirPendencia, salvarPendencia, type PendenciaEntrada, type PendenciaListada } from "@/lib/processos/pendencias";
import type { ProcessoCompleto } from "@/lib/processos/modelo";
import {
  TIPOS_MOVIMENTACAO,
  TIPOS_PARTE,
  TIPOS_PRISAO,
  diasSemMovimentacao,
  hojeISO,
  ultimaMovimentacao,
} from "@/lib/processos/modelo";
import {
  adicionarMovimentacao,
  adicionarObservacao,
  adicionarParte,
  adicionarReu,
  processoQuery,
} from "@/lib/processos/repositorio";

export const Route = createFileRoute("/processos/$id")({
  head: () => ({
    meta: [
      { title: "Ficha do processo — Gestão da Vara Criminal" },
      { name: "description", content: "Ficha individual do processo: partes, réus, movimentações e anotações internas." },
      { property: "og:title", content: "Ficha do processo — Gestão da Vara Criminal" },
      { property: "og:description", content: "Ficha individual do processo no acervo interno da serventia." },
    ],
  }),
  loader: async ({ context, params }) => {
    const p = await context.queryClient.ensureQueryData(processoQuery(params.id));
    if (!p) throw notFound();
  },
  notFoundComponent: () => <EstadoVazio titulo="Processo não encontrado" descricao="Verifique o endereço ou volte à lista de processos." />,
  errorComponent: ({ error }) => <EstadoVazio titulo="Erro ao carregar o processo" descricao={error.message} />,
  component: Pagina,
});

const ABAS = ["Resumo", "Partes", "Réus", "Movimentações", "Audiências", "Pendências", "Prioridades", "Observações"] as const;
const BOTAO = "inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60";

function Pagina() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(processoQuery(id));
  const qc = useQueryClient();
  const [aba, setAba] = useState<(typeof ABAS)[number]>("Resumo");
  if (!data) return null;
  const p = data;
  const ult = ultimaMovimentacao(p);
  const dias = diasSemMovimentacao(p, hojeISO());
  const recarregar = () => qc.invalidateQueries({ queryKey: ["processos"] });
  const movs = [...p.movimentacoes].sort((a, b) => b.data.localeCompare(a.data) || b.criado_em.localeCompare(a.criado_em));

  return (
    <div className="space-y-5">
      <Link to="/processos" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Processos
      </Link>
      <Cabecalho titulo={p.numero} subtitulo={`${p.classe} · ${p.assunto}`} />

      <nav className="flex flex-wrap gap-1 border-b border-border" role="tablist">
        {ABAS.map((a) => (
          <button
            key={a}
            role="tab"
            aria-selected={aba === a}
            onClick={() => setAba(a)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${aba === a ? "border-primary font-medium text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {a}
          </button>
        ))}
      </nav>

      {aba === "Resumo" && (
        <Secao titulo="Resumo">
          <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Número", p.numero],
              ["Classe", p.classe],
              ["Assunto", p.assunto || "—"],
              ["Situação", p.status],
              ["Fase", p.fase || "—"],
              ["Comarca / Unidade", `${p.comarca} · ${p.unidade}`],
              ["Data de distribuição", formatarData(p.data_distribuicao)],
              ["Cadastro no sistema", formatarData(p.criado_em.slice(0, 10))],
              ["Última movimentação", ult ? `${formatarData(ult.data)} — ${ult.descricao}` : "Nenhuma registrada"],
              ["Dias sem movimentação", dias === null ? "—" : `${dias} dias sem movimentação`],
              ["Responsável", p.responsavel || "—"],
              ["Observação geral", p.observacao_geral || "—"],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-muted-foreground">{k}</dt>
                <dd className="mt-0.5 font-medium text-foreground">{v}</dd>
              </div>
            ))}
          </dl>
        </Secao>
      )}

      {aba === "Partes" && (
        <Secao titulo="Partes">
          <Lista vazio="Nenhuma parte cadastrada." itens={p.partes.map((x) => ({ id: x.id, titulo: x.nome, sub: [x.tipo, x.observacao].filter(Boolean).join(" · ") }))} />
          <FormParte onSalvar={async (v) => { await adicionarParte({ ...v, processo_id: p.id }); await recarregar(); }} />
        </Secao>
      )}

      {aba === "Réus" && (
        <Secao titulo="Réus">
          {p.reus.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum réu cadastrado.</p> : null}
          <div className="space-y-2">
            {[...p.reus].sort((a, b) => a.ordem - b.ordem).map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3 text-sm">
                <div>
                  <p className="font-medium">{r.nome}</p>
                  <p className="text-xs text-muted-foreground">{[r.situacao, r.observacoes].filter(Boolean).join(" · ") || "—"}</p>
                </div>
                {r.preso ? (
                  <Etiqueta severidade="urgente">{r.tipo_prisao} desde {formatarData(r.data_prisao)}</Etiqueta>
                ) : (
                  <Etiqueta severidade="info">Não preso</Etiqueta>
                )}
              </div>
            ))}
          </div>
          <FormReu onSalvar={async (v) => { await adicionarReu({ ...v, processo_id: p.id, ordem: p.reus.length }); await recarregar(); }} />
        </Secao>
      )}

      {aba === "Movimentações" && (
        <Secao titulo="Movimentações">
          <FormMovimentacao onSalvar={async (v) => { await adicionarMovimentacao({ ...v, processo_id: p.id }); await recarregar(); }} />
          <ol className="mt-5 space-y-2 border-l-2 border-border pl-4">
            {movs.map((m) => (
              <li key={m.id} className="text-sm">
                <p><span className="font-medium">{formatarData(m.data)}</span> · <span className="text-muted-foreground">{m.tipo}</span></p>
                <p>{m.descricao}</p>
                {m.observacao ? <p className="text-xs text-muted-foreground">{m.observacao}</p> : null}
              </li>
            ))}
            {movs.length === 0 ? <li className="text-sm text-muted-foreground">Nenhuma movimentação registrada.</li> : null}
          </ol>
        </Secao>
      )}

      {aba === "Audiências" && (
        <Secao titulo="Audiências">
          <Lista vazio="Nenhuma audiência registrada." itens={p.audiencias.map((a) => ({ id: a.id, titulo: `${formatarData(a.data)} — ${a.tipo}`, sub: `${a.local} · ${a.situacao}` }))} />
          <div className="mt-4"><AvisoEtapa>O controle completo de audiências será implementado em etapa futura.</AvisoEtapa></div>
        </Secao>
      )}
      {aba === "Pendências" && <AbaPendencias p={p} recarregar={recarregar} />}
      {aba === "Prioridades" && (
        <Secao titulo="Prioridades">
          <Lista vazio="Nenhuma prioridade registrada." itens={p.prioridades.map((x) => ({ id: x.id, titulo: x.titulo || x.motivo, sub: [x.nivel, x.observacao].filter(Boolean).join(" · ") }))} />
          <div className="mt-4"><AvisoEtapa>As regras de prioridade serão implementadas na etapa correspondente.</AvisoEtapa></div>
        </Secao>
      )}

      {aba === "Observações" && (
        <Secao titulo="Anotações internas de gestão">
          <p className="mb-3 text-xs text-muted-foreground">Anotações administrativas — não constituem decisão nem manifestação processual.</p>
          <FormObservacao onSalvar={async (texto) => { await adicionarObservacao({ processo_id: p.id, texto }); await recarregar(); }} />
          <div className="mt-4">
            <Lista vazio="Nenhuma anotação." itens={[...p.observacoes_internas].sort((a, b) => b.criado_em.localeCompare(a.criado_em)).map((o) => ({ id: o.id, titulo: o.texto, sub: new Date(o.criado_em).toLocaleString("pt-BR") }))} />
          </div>
        </Secao>
      )}
    </div>
  );
}

function Lista({ itens, vazio }: { itens: { id: string; titulo: string; sub: string }[]; vazio: string }) {
  if (itens.length === 0) return <p className="text-sm text-muted-foreground">{vazio}</p>;
  return (
    <ul className="divide-y divide-border rounded-md border border-border">
      {itens.map((i) => (
        <li key={i.id} className="px-3 py-2 text-sm">
          <p className="font-medium">{i.titulo}</p>
          {i.sub ? <p className="text-xs text-muted-foreground">{i.sub}</p> : null}
        </li>
      ))}
    </ul>
  );
}

function useEnvio() {
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  async function enviar(fn: () => Promise<void>) {
    setSalvando(true); setErro("");
    try { await fn(); } catch (e) { setErro(e instanceof Error ? e.message : "Erro ao salvar."); }
    setSalvando(false);
  }
  return { salvando, erro, enviar };
}

function FormMovimentacao({ onSalvar }: { onSalvar: (v: { data: string; descricao: string; tipo: string; observacao: string }) => Promise<void> }) {
  const vazio = { data: hojeISO(), descricao: "", tipo: "Despacho", observacao: "" };
  const [v, setV] = useState(vazio);
  const { salvando, erro, enviar } = useEnvio();
  return (
    <form
      className="grid gap-3 rounded-md border border-dashed border-border p-3 md:grid-cols-[1fr_1fr_2fr_2fr_auto] md:items-end"
      onSubmit={(e) => { e.preventDefault(); if (!v.data || !v.descricao.trim()) return; enviar(async () => { await onSalvar(v); setV(vazio); }); }}
    >
      <Campo rotulo="Data"><input type="date" className={CLASSE_CAMPO} value={v.data} onChange={(e) => setV({ ...v, data: e.target.value })} /></Campo>
      <Campo rotulo="Tipo"><select className={CLASSE_CAMPO} value={v.tipo} onChange={(e) => setV({ ...v, tipo: e.target.value })}><Opcoes valores={TIPOS_MOVIMENTACAO} /></select></Campo>
      <Campo rotulo="Descrição"><input className={CLASSE_CAMPO} value={v.descricao} onChange={(e) => setV({ ...v, descricao: e.target.value })} /></Campo>
      <Campo rotulo="Observação"><input className={CLASSE_CAMPO} value={v.observacao} onChange={(e) => setV({ ...v, observacao: e.target.value })} /></Campo>
      <button className={BOTAO} disabled={salvando}>Registrar</button>
      {erro ? <p className="text-sm text-urgente md:col-span-5">{erro}</p> : null}
    </form>
  );
}

function FormReu({ onSalvar }: { onSalvar: (v: { nome: string; situacao: string; preso: boolean; tipo_prisao: string; data_prisao: string | null; observacoes: string }) => Promise<void> }) {
  const vazio = { nome: "", situacao: "", preso: false, tipo_prisao: "Não preso", data_prisao: "", observacoes: "" };
  const [v, setV] = useState(vazio);
  const { salvando, erro, enviar } = useEnvio();
  return (
    <form
      className="mt-4 grid gap-3 rounded-md border border-dashed border-border p-3 md:grid-cols-6 md:items-end"
      onSubmit={(e) => { e.preventDefault(); if (!v.nome.trim()) return; enviar(async () => { await onSalvar({ ...v, data_prisao: v.preso && v.data_prisao ? v.data_prisao : null, tipo_prisao: v.preso ? v.tipo_prisao : "Não preso" }); setV(vazio); }); }}
    >
      <div className="md:col-span-2"><Campo rotulo="Nome do réu"><input className={CLASSE_CAMPO} value={v.nome} onChange={(e) => setV({ ...v, nome: e.target.value })} /></Campo></div>
      <Campo rotulo="Situação"><input className={CLASSE_CAMPO} value={v.situacao} onChange={(e) => setV({ ...v, situacao: e.target.value })} /></Campo>
      <Campo rotulo="Está preso?">
        <select className={CLASSE_CAMPO} value={v.preso ? "sim" : "nao"} onChange={(e) => setV({ ...v, preso: e.target.value === "sim", tipo_prisao: e.target.value === "sim" ? "Prisão preventiva" : "Não preso" })}>
          <option value="nao">Não</option><option value="sim">Sim</option>
        </select>
      </Campo>
      <Campo rotulo="Tipo de prisão"><select disabled={!v.preso} className={CLASSE_CAMPO} value={v.tipo_prisao} onChange={(e) => setV({ ...v, tipo_prisao: e.target.value })}><Opcoes valores={TIPOS_PRISAO} /></select></Campo>
      <Campo rotulo="Data da prisão"><input type="date" disabled={!v.preso} className={CLASSE_CAMPO} value={v.data_prisao} onChange={(e) => setV({ ...v, data_prisao: e.target.value })} /></Campo>
      <div className="md:col-span-5"><Campo rotulo="Observações"><input className={CLASSE_CAMPO} value={v.observacoes} onChange={(e) => setV({ ...v, observacoes: e.target.value })} /></Campo></div>
      <button className={BOTAO} disabled={salvando}>Adicionar réu</button>
      {erro ? <p className="text-sm text-urgente md:col-span-6">{erro}</p> : null}
    </form>
  );
}

function FormParte({ onSalvar }: { onSalvar: (v: { nome: string; tipo: string; observacao: string }) => Promise<void> }) {
  const vazio = { nome: "", tipo: "Vítima", observacao: "" };
  const [v, setV] = useState(vazio);
  const { salvando, erro, enviar } = useEnvio();
  return (
    <form
      className="mt-4 grid gap-3 rounded-md border border-dashed border-border p-3 md:grid-cols-[2fr_1fr_2fr_auto] md:items-end"
      onSubmit={(e) => { e.preventDefault(); if (!v.nome.trim()) return; enviar(async () => { await onSalvar(v); setV(vazio); }); }}
    >
      <Campo rotulo="Nome"><input className={CLASSE_CAMPO} value={v.nome} onChange={(e) => setV({ ...v, nome: e.target.value })} /></Campo>
      <Campo rotulo="Tipo"><select className={CLASSE_CAMPO} value={v.tipo} onChange={(e) => setV({ ...v, tipo: e.target.value })}><Opcoes valores={TIPOS_PARTE} /></select></Campo>
      <Campo rotulo="Observação"><input className={CLASSE_CAMPO} value={v.observacao} onChange={(e) => setV({ ...v, observacao: e.target.value })} /></Campo>
      <button className={BOTAO} disabled={salvando}>Adicionar parte</button>
      {erro ? <p className="text-sm text-urgente md:col-span-4">{erro}</p> : null}
    </form>
  );
}

function FormObservacao({ onSalvar }: { onSalvar: (texto: string) => Promise<void> }) {
  const [t, setT] = useState("");
  const { salvando, erro, enviar } = useEnvio();
  return (
    <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (!t.trim()) return; enviar(async () => { await onSalvar(t); setT(""); }); }}>
      <input className={CLASSE_CAMPO} placeholder="Ex.: Conferir situação da audiência." value={t} onChange={(e) => setT(e.target.value)} />
      <button className={BOTAO} disabled={salvando}>Anotar</button>
      {erro ? <p className="text-sm text-urgente">{erro}</p> : null}
    </form>
  );
}

function AbaPendencias({ p, recarregar }: { p: ProcessoCompleto; recarregar: () => Promise<unknown> }) {
  const lista = p.pendencias.map((x) => classificar(x, p.numero)).sort((a, b) => Number(a.concluidaFlag) - Number(b.concluidaFlag) || (a.prazo ?? "9999").localeCompare(b.prazo ?? "9999"));
  const [detalhe, setDetalhe] = useState<PendenciaListada | null>(null);
  const [edicao, setEdicao] = useState<{ id?: string; dados: PendenciaEntrada } | null>(null);
  return (
    <Secao titulo="Pendências" acao={<button className={BOTAO} onClick={() => setEdicao({ dados: novaPendencia(p.id) })}>Nova pendência</button>}>
      {lista.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma pendência registrada.</p> : (
        <ul className="divide-y divide-border">
          {lista.map((x) => (
            <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <div>
                <button className={cn("text-left text-sm font-medium hover:underline", x.concluidaFlag && "text-muted-foreground line-through")} onClick={() => setDetalhe(x)}>{x.titulo || x.descricao}</button>
                <p className="text-xs text-muted-foreground">{x.tipo} · Prazo {formatarData(x.prazo)} · {x.status}{x.responsavel ? ` · ${x.responsavel}` : ""}</p>
              </div>
              <EtiquetasPendencia p={x} />
            </li>
          ))}
        </ul>
      )}
      <DialogosPendencia
        detalhe={detalhe} setDetalhe={setDetalhe} edicao={edicao} setEdicao={setEdicao}
        onSalvar={async (d, id) => { await salvarPendencia(d, id); await recarregar(); }}
        onConcluir={async (id) => { await concluirPendencia(id); await recarregar(); }}
      />
    </Secao>
  );
}
