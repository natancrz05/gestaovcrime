import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, FileSpreadsheet, Upload, Download, Undo2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { pode } from "@/lib/permissoes";
import { useSessao } from "@/lib/sessao";
import { Cabecalho } from "@/components/ui-serventia/Cabecalho";
import { Etiqueta } from "@/components/ui-serventia/Etiqueta";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  baixarCSV, formatarValor, lerPlanilha, rotuloCampo,
  type Analise, type LinhaProblema, type LinhaValida, type ResultadoSimulacao,
} from "@/lib/processos/importacao";
import { adicionarReu, listarProcessosCompletos } from "@/lib/processos/repositorio";

export const Route = createFileRoute("/_authenticated/processos/importar")({
  beforeLoad: ({ context }) => {
    if (!pode(context.sessao.perfil, "editar")) throw redirect({ to: "/processos" });
  },
  head: () => ({
    meta: [
      { title: "Importar / Atualizar em lote — Gestão da Vara Criminal" },
      { name: "description", content: "Importação inicial e atualização em lote de processos por planilha XLSX, com prévia e histórico." },
      { property: "og:title", content: "Importar / Atualizar em lote — Gestão da Vara Criminal" },
      { property: "og:description", content: "Importação inicial e atualização em lote de processos por planilha XLSX, com prévia e histórico." },
    ],
  }),
  component: Pagina,
});

const BOTAO = "inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50";
const BOTAO_SEC = "inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-4 text-sm text-foreground hover:bg-muted disabled:opacity-50";
const CARTAO = "rounded-lg border border-border bg-card p-4 shadow-card";

interface Importacao {
  id: string; numero: number; criado_em: string; usuario_nome: string; arquivo: string;
  analisados: number; novos: number; atualizados: number; sem_alteracao: number; ignorados: number;
  conflitos: number; erros: number; status: string; desfeita_em: string | null; desfeita_por: string | null;
  detalhes: { erros?: LinhaProblema[]; ignorados?: LinhaProblema[]; conflitos?: ResultadoSimulacao["conflitos"]; desfazer?: Record<string, number> };
}

const dataHora = (s: string) => new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

const normalizarNome = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9 ]/g, "").replace(/\s+/g, " ").trim();

async function enriquecerAcervo(linhas: LinhaValida[], conflitos: ResultadoSimulacao["conflitos"]) {
  const processos = await listarProcessosCompletos();
  const porNumero = new Map(processos.map((p) => [p.numero.replace(/\D/g, ""), p]));
  const conflitosMovimentacao = new Set(
    conflitos
      .filter((c) => c.campo === "pje_ultima_mov_data")
      .map((c) => c.numero.replace(/\D/g, "")),
  );

  let reusAdicionados = 0;
  let reusInstitucionaisRemovidos = 0;
  let movimentacoesPjeAcrescentadas = 0;
  let conflitosPjeReconciliados = 0;
  let naoLocalizados = 0;

  for (const linha of linhas) {
    const processo = porNumero.get(linha.numero.replace(/\D/g, ""));
    if (!processo) {
      naoLocalizados++;
      continue;
    }

    if (linha.reusInferidos.length) {
      const existentes = new Set(processo.reus.map((r) => normalizarNome(r.nome)));
      let ordem = processo.reus.reduce((m, r) => Math.max(m, r.ordem), -1) + 1;

      for (const nome of linha.reusInferidos) {
        const chave = normalizarNome(nome);
        if (!chave || existentes.has(chave)) continue;
        await adicionarReu({
          processo_id: processo.id,
          nome,
          situacao: "",
          preso: false,
          tipo_prisao: "Não preso",
          data_prisao: null,
          observacoes: "Réu identificado pela atualização do acervo PJe.",
          ordem,
        });
        existentes.add(chave);
        ordem++;
        reusAdicionados++;
      }
    }

    // Corrige resíduos de importações antigas que cadastraram órgão público,
    // Ministério Público, polícia ou juízo como se fossem réus. A remoção é
    // conservadora: só alcança o nome institucional exatamente identificado na
    // planilha e apenas quando o registro não tem prisão, situação ou observação
    // manual associada.
    if (linha.partesInstitucionaisIgnoradas.length) {
      const institucionais = new Set(linha.partesInstitucionaisIgnoradas.map(normalizarNome));
      for (const reu of processo.reus) {
        if (
          institucionais.has(normalizarNome(reu.nome)) &&
          !reu.preso &&
          !reu.situacao.trim() &&
          !reu.observacoes.trim()
        ) {
          const { error: deleteError } = await supabase.from("reus").delete().eq("id", reu.id);
          if (deleteError) throw deleteError;
          reusInstitucionaisRemovidos++;
        }
      }

      if (!linha.reusInferidos.length && processo.pje_reu) {
        const { error: limparError } = await supabase.from("processos").update({ pje_reu: null }).eq("id", processo.id);
        if (limparError) throw limparError;
      }
    }

    // O importador antigo comparava a data do PJe com qualquer movimentação
    // interna. Uma anotação manual mais recente podia impedir a atualização do
    // retrato do PJe. Aqui reconciliamos apenas esse caso, sem apagar a
    // movimentação manual nem mexer na data de autuação.
    const numeroNormalizado = linha.numero.replace(/\D/g, "");
    if (conflitosMovimentacao.has(numeroNormalizado) && linha.campos.pje_ultima_mov_data) {
      const patch = {
        pje_ultima_mov_data: linha.campos.pje_ultima_mov_data,
        pje_ultima_mov_descricao: linha.campos.pje_ultima_mov_descricao ?? processo.pje_ultima_mov_descricao,
        pje_qtde_dias: linha.campos.pje_qtde_dias ? Number(linha.campos.pje_qtde_dias) : processo.pje_qtde_dias,
      };

      const { error: updateError } = await supabase.from("processos").update(patch).eq("id", processo.id);
      if (updateError) throw updateError;
      conflitosPjeReconciliados++;

      const data = linha.campos.pje_ultima_mov_data;
      const descricao = linha.campos.pje_ultima_mov_descricao;
      if (
        descricao &&
        !processo.movimentacoes.some((m) => m.data === data && normalizarNome(m.descricao) === normalizarNome(descricao))
      ) {
        const { error: movError } = await supabase.from("movimentacoes").insert({
          processo_id: processo.id,
          data,
          descricao,
          origem: "pje_tjba",
          tipo: "",
          observacao: "Movimentação identificada na atualização do acervo PJe.",
        });
        if (movError) throw movError;
        movimentacoesPjeAcrescentadas++;
      }
    }
  }

  return { reusAdicionados, reusInstitucionaisRemovidos, movimentacoesPjeAcrescentadas, conflitosPjeReconciliados, naoLocalizados };
}

function Pagina() {
  const sessao = useSessao();
  const qc = useQueryClient();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [analise, setAnalise] = useState<Analise | null>(null);
  const [sim, setSim] = useState<ResultadoSimulacao | null>(null);
  const [aplicarConflitos, setAplicarConflitos] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [resultado, setResultado] = useState<Importacao | null>(null);
  const [enriquecimento, setEnriquecimento] = useState<{
    reusAdicionados: number;
    reusInstitucionaisRemovidos: number;
    movimentacoesPjeAcrescentadas: number;
    conflitosPjeReconciliados: number;
    naoLocalizados: number;
  } | null>(null);
  const [aberta, setAberta] = useState<Importacao | null>(null);

  const historico = useQuery({
    queryKey: ["importacoes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("importacoes").select("*").order("numero", { ascending: false });
      if (error) throw error;
      return data as unknown as Importacao[];
    },
  });

  const problemas = (a: Analise) => ({ erros: a.erros, ignorados: a.duplicados });

  async function simular(a: Analise, conflitos: boolean) {
    const { data, error } = await supabase.rpc("importar_processos", {
      p_arquivo: arquivo?.name ?? "", p_linhas: a.validas as unknown as Json,
      p_erros: a.erros as unknown as Json, p_ignorados: a.duplicados as unknown as Json,
      p_aplicar_conflitos: conflitos, p_simular: true,
    });
    if (error) throw new Error(error.message || "Falha ao gerar a prévia.");
    if (!data) throw new Error("A prévia não retornou resultado. Nenhuma alteração foi feita.");
    setSim(data as unknown as ResultadoSimulacao);
  }

  async function analisar() {
    if (!arquivo) return;
    setOcupado(true); setErro(""); setAnalise(null); setSim(null); setResultado(null); setEnriquecimento(null);
    try {
      const a = await lerPlanilha(arquivo);
      await simular(a, aplicarConflitos);
      // Só troca a tela pela prévia quando o resultado da análise já está disponível.
      setAnalise(a);
    } catch (e) {
      setSim(null); setAnalise(null);
      const msg = e instanceof Error ? e.message : (e as { message?: string })?.message;
      setErro(`Não foi possível analisar a planilha. ${msg || "Falha desconhecida."} Nenhuma alteração foi feita.`);
    } finally { setOcupado(false); }
  }

  async function trocarConflitos(v: boolean) {
    setAplicarConflitos(v);
    if (!analise) return;
    setOcupado(true);
    try { await simular(analise, v); } catch (e) { setErro(e instanceof Error ? e.message : "Falha na prévia."); }
    finally { setOcupado(false); }
  }

  function cancelar() {
    setArquivo(null); setAnalise(null); setSim(null); setErro(""); setAplicarConflitos(false); setEnriquecimento(null);
  }

  async function confirmar() {
    if (!analise) return;
    setOcupado(true); setErro("");
    const p = problemas(analise);
    const { data, error } = await supabase.rpc("importar_processos", {
      p_arquivo: arquivo?.name ?? "", p_linhas: analise.validas as unknown as Json,
      p_erros: p.erros as unknown as Json, p_ignorados: p.ignorados as unknown as Json,
      p_aplicar_conflitos: aplicarConflitos, p_simular: false,
    });
    setOcupado(false);
    if (error) {
      setErro(`A importação falhou e nenhuma alteração foi gravada. Motivo: ${error.message}`);
      return;
    }
    const id = (data as { id: string }).id;

    // O RPC atualiza os campos do processo. Em seguida, a camada inteligente do
    // leitor completa apenas réus ausentes, sem apagar cadastros manuais.
    let enriquecimento = {
      reusAdicionados: 0,
      reusInstitucionaisRemovidos: 0,
      movimentacoesPjeAcrescentadas: 0,
      conflitosPjeReconciliados: 0,
      naoLocalizados: 0,
    };
    try {
      await qc.invalidateQueries({ queryKey: ["processos"] });
      await qc.invalidateQueries({ queryKey: ["processos-seletor"] });
      enriquecimento = await enriquecerAcervo(analise.validas, sim?.conflitos ?? []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "falha desconhecida";
      setErro(`Os processos foram importados, mas houve falha ao completar alguns réus: ${msg}`);
    }

    const { data: imp } = await supabase.from("importacoes").select("*").eq("id", id).single();
    setResultado(imp as unknown as Importacao);
    setEnriquecimento(enriquecimento);
    setAnalise(null); setSim(null); setArquivo(null);
    qc.invalidateQueries({ queryKey: ["processos"] });
    qc.invalidateQueries({ queryKey: ["processos-seletor"] });
    qc.invalidateQueries({ queryKey: ["importacoes"] });
  }

  const ultimaDesfazivel = historico.data?.find((i) => !i.desfeita_em && i.status !== "Falhou");

  return (
    <div className="space-y-6">
      <Cabecalho
        titulo="Importar / Atualizar em lote"
        subtitulo="Planilha XLSX do PJe. Processos ausentes na planilha nunca são excluídos ou alterados, e os dados internos da serventia são preservados."
        acao={<Link to="/processos" className={BOTAO_SEC}><ArrowLeft className="size-4" /> Voltar aos processos</Link>}
      />

      {!analise && !resultado && (
        <div className={`${CARTAO} space-y-3`}>
          <p className="text-sm text-muted-foreground">
            O leitor aceita XLSX, XLS e ODS, procura automaticamente a aba correta e reconhece variações de cabeçalho.
            A coluna de número do processo é obrigatória. Nada é gravado antes da prévia e da sua confirmação.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <input type="file" accept=".xlsx,.xls,.ods,application/vnd.oasis.opendocument.spreadsheet" aria-label="Planilha do acervo" className="text-sm"
              onChange={(e) => { setArquivo(e.target.files?.[0] ?? null); setErro(""); }} />
            <button className={BOTAO} disabled={!arquivo || ocupado} onClick={analisar}>
              <FileSpreadsheet className="size-4" /> {ocupado ? "Analisando…" : "Analisar arquivo"}
            </button>
          </div>
        </div>
      )}

      {erro && <div className="rounded-md border border-urgente/40 bg-urgente/10 p-3 text-sm text-urgente">{erro}</div>}

      {analise && sim && (
        <Previa analise={analise} sim={sim} aplicarConflitos={aplicarConflitos} onConflitos={trocarConflitos}
          ocupado={ocupado} onCancelar={cancelar} onConfirmar={confirmar} arquivo={arquivo?.name ?? ""} />
      )}

      {resultado && (
        <div className={`${CARTAO} space-y-4`}>
          <h2 className="text-lg font-semibold">Importação #{resultado.numero} — {resultado.status}</h2>
          <Resumo imp={resultado} />
          {enriquecimento ? (
            <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
              <p>
                Enriquecimento do acervo: <strong>{enriquecimento.reusAdicionados}</strong> réu(s) ausente(s) acrescentado(s),
                {" "}<strong>{enriquecimento.reusInstitucionaisRemovidos}</strong> cadastro(s) institucional(is) incorreto(s) removido(s),
                {" "}<strong>{enriquecimento.conflitosPjeReconciliados}</strong> retrato(s) de movimentação do PJe reconciliado(s)
                e <strong>{enriquecimento.movimentacoesPjeAcrescentadas}</strong> movimentação(ões) do PJe acrescentada(s) sem apagar registros internos.
              </p>
              {enriquecimento.naoLocalizados ? (
                <p className="mt-1 text-xs text-atencao">{enriquecimento.naoLocalizados} processo(s) não puderam ser relocalizados para enriquecimento.</p>
              ) : null}
            </div>
          ) : null}
          <ListaProblemas imp={resultado} />
          <button className={BOTAO_SEC} onClick={() => setResultado(null)}><Upload className="size-4" /> Nova importação</button>
        </div>
      )}

      <div className={CARTAO}>
        <h2 className="mb-3 text-lg font-semibold">Histórico de importações</h2>
        {historico.data?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>{["Nº", "Data/hora", "Usuário", "Arquivo", "Analisados", "Novos", "Atualizados", "Sem alteração", "Conflitos", "Erros", "Status"].map((h) => <th key={h} className="px-2 py-2 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-border">
                {historico.data.map((i) => (
                  <tr key={i.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setAberta(i)}>
                    <td className="px-2 py-2 font-semibold text-primary">#{String(i.numero).padStart(3, "0")}</td>
                    <td className="whitespace-nowrap px-2 py-2">{dataHora(i.criado_em)}</td>
                    <td className="px-2 py-2">{i.usuario_nome || "—"}</td>
                    <td className="px-2 py-2">{i.arquivo}</td>
                    <td className="px-2 py-2">{i.analisados}</td><td className="px-2 py-2">{i.novos}</td>
                    <td className="px-2 py-2">{i.atualizados}</td><td className="px-2 py-2">{i.sem_alteracao}</td>
                    <td className="px-2 py-2">{i.conflitos}</td><td className="px-2 py-2">{i.erros + i.ignorados}</td>
                    <td className="px-2 py-2"><EtiquetaStatus s={i.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-sm text-muted-foreground">Nenhuma importação realizada.</p>}
      </div>

      <DetalheImportacao imp={aberta} onFechar={() => setAberta(null)}
        podeDesfazer={sessao.perfil === "administrador" && !!aberta && aberta.id === ultimaDesfazivel?.id}
        onDesfeita={() => { setAberta(null); qc.invalidateQueries({ queryKey: ["processos"] }); qc.invalidateQueries({ queryKey: ["importacoes"] }); }} />
    </div>
  );
}

function EtiquetaStatus({ s }: { s: string }) {
  const sev = s === "Concluída" ? "concluido" : s === "Concluída com alertas" ? "atencao" : s === "Falhou" ? "urgente" : "info";
  return <Etiqueta severidade={sev}>{s}</Etiqueta>;
}

function Numero({ n, r }: { n: number; r: string }) {
  return <div className="rounded-md border border-border p-3"><div className="text-2xl font-semibold">{n}</div><div className="text-xs text-muted-foreground">{r}</div></div>;
}

function Previa({ analise, sim, aplicarConflitos, onConflitos, ocupado, onCancelar, onConfirmar, arquivo }: {
  analise: Analise; sim: ResultadoSimulacao; aplicarConflitos: boolean; onConflitos: (v: boolean) => void;
  ocupado: boolean; onCancelar: () => void; onConfirmar: () => void; arquivo: string;
}) {
  const existentes = sim.atualizados.length + sim.sem_alteracao;
  return (
    <div className="space-y-4">
      <div className={`${CARTAO} space-y-3`}>
        <h2 className="text-lg font-semibold">Prévia da importação — {arquivo}</h2>
        <p className="text-sm text-muted-foreground">Simulação: nenhuma alteração foi feita ainda.</p>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-9">
          <Numero n={analise.totalLinhas} r="Total de linhas" />
          <Numero n={sim.novos.length} r="Processos novos" />
          <Numero n={existentes} r="Processos existentes" />
          <Numero n={sim.atualizados.length} r="Serão atualizados" />
          <Numero n={sim.sem_alteracao} r="Sem alteração" />
          <Numero n={analise.duplicados.length} r="Duplicidades conflitantes" />
          <Numero n={analise.duplicadosConsolidados} r="Duplicidades consolidadas" />
          <Numero n={sim.conflitos.length} r="Conflitos" />
          <Numero n={analise.erros.length} r="Linhas com erro" />
        </div>
        <p className="text-xs text-muted-foreground">
          Aba utilizada: <strong>{analise.aba}</strong>. Colunas reconhecidas: {analise.reconhecidas.join(", ")}.
          {analise.naoReconhecidas.length ? ` Colunas não utilizadas pelo sistema: ${analise.naoReconhecidas.join(", ")}.` : ""}
          {` ${analise.reusInferidosTotal} ocorrência(s) de réu foram interpretadas para conferência/enriquecimento do acervo.`}
        </p>
      </div>

      {analise.avisos.length > 0 && (
        <div className={`${CARTAO} space-y-2 border-info/40`}>
          <h3 className="font-semibold">Ajustes inteligentes da leitura {analise.avisos.length > 100 ? "(primeiros 100)" : ""}</h3>
          <p className="text-xs text-muted-foreground">
            São correções de interpretação, não erros. Ex.: parte institucional no polo REU ou inversão aparente entre AUTOR e REU no relatório do PJe.
          </p>
          <Tabela
            cab={["Linha", "Processo", "Ajuste"]}
            linhas={analise.avisos.slice(0, 100).map((a) => [a.linha, a.numero || "—", a.motivo])}
          />
        </div>
      )}

      {sim.conflitos.length > 0 && (
        <div className={`${CARTAO} space-y-2 border-atencao/50`}>
          <h3 className="font-semibold">Possíveis conflitos</h3>
          <p className="text-xs text-muted-foreground">Por padrão, os valores em conflito <strong>não</strong> são aplicados; o valor atual do sistema é mantido.</p>
          <Tabela cab={["Processo", "Campo", "Valor atual", "Valor da planilha", "Motivo"]}
            linhas={sim.conflitos.map((c) => [c.numero, rotuloCampo(c.campo), formatarValor(c.campo, String(c.atual)), formatarValor(c.campo, c.novo), c.motivo])} />
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-primary" checked={aplicarConflitos} disabled={ocupado} onChange={(e) => onConflitos(e.target.checked)} />
            Aplicar também os valores da planilha nos conflitos
          </label>
        </div>
      )}

      {sim.atualizados.length > 0 && (
        <div className={`${CARTAO} space-y-2`}>
          <h3 className="font-semibold">Registros que serão alterados {sim.atualizados.length > 50 ? "(primeiros 50)" : ""}</h3>
          <Tabela cab={["Processo", "Campo", "Antes", "Depois"]}
            linhas={sim.atualizados.slice(0, 50).flatMap((a) => a.mudancas.map((m, i) => [i === 0 ? a.numero : "", rotuloCampo(m.campo), formatarValor(m.campo, m.antes), formatarValor(m.campo, m.depois)]))} />
        </div>
      )}

      {sim.novos.length > 0 && (
        <div className={`${CARTAO} space-y-2`}>
          <h3 className="font-semibold">Processos novos {sim.novos.length > 50 ? "(primeiros 50)" : ""}</h3>
          <Tabela cab={["Linha", "Processo", "Classe", "Réu"]} linhas={sim.novos.slice(0, 50).map((n) => [n.linha, n.numero, n.classe ?? "—", n.reu ?? "—"])} />
        </div>
      )}

      {analise.erros.length + analise.duplicados.length > 0 && (
        <div className={`${CARTAO} space-y-2`}>
          <h3 className="font-semibold">Linhas que não serão importadas</h3>
          <Tabela cab={["Linha", "Processo", "Motivo"]} linhas={[...analise.erros, ...analise.duplicados].sort((a, b) => a.linha - b.linha).map((e) => [e.linha, e.numero || "—", e.motivo])} />
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button className={BOTAO_SEC} disabled={ocupado} onClick={onCancelar}>Cancelar</button>
        <button className={BOTAO} disabled={ocupado || sim.novos.length + sim.atualizados.length === 0} onClick={onConfirmar}>
          {ocupado ? "Processando…" : "Confirmar importação"}
        </button>
      </div>
    </div>
  );
}

function Tabela({ cab, linhas }: { cab: string[]; linhas: (string | number)[][] }) {
  return (
    <div className="max-h-96 overflow-auto rounded-md border border-border">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground"><tr>{cab.map((h) => <th key={h} className="px-2 py-1.5 font-medium">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-border">{linhas.map((l, i) => <tr key={i}>{l.map((c, j) => <td key={j} className="px-2 py-1.5 align-top">{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

function Resumo({ imp }: { imp: Importacao }) {
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-7">
      <Numero n={imp.analisados} r="Analisados" /><Numero n={imp.novos} r="Novos" /><Numero n={imp.atualizados} r="Atualizados" />
      <Numero n={imp.sem_alteracao} r="Sem alteração" /><Numero n={imp.ignorados} r="Ignorados (duplicidade)" />
      <Numero n={imp.conflitos} r="Conflitos" /><Numero n={imp.erros} r="Erros" />
    </div>
  );
}

function ListaProblemas({ imp }: { imp: Importacao }) {
  const lista = [...(imp.detalhes.erros ?? []).map((e) => ({ ...e, t: "Erro" })), ...(imp.detalhes.ignorados ?? []).map((e) => ({ ...e, t: "Ignorado" }))].sort((a, b) => a.linha - b.linha);
  if (!lista.length) return null;
  const linhas = lista.map((e) => [e.linha, e.numero || "—", e.t, e.motivo]);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Registros com erro ou ignorados</h3>
        <button className={BOTAO_SEC} onClick={() => baixarCSV(`importacao-${imp.numero}-erros.csv`, ["Linha", "Processo", "Tipo", "Motivo"], linhas)}>
          <Download className="size-4" /> Baixar CSV
        </button>
      </div>
      <Tabela cab={["Linha", "Processo", "Tipo", "Motivo"]} linhas={linhas} />
    </div>
  );
}

interface Item { id: string; numero: string; acao: string; antes: Record<string, string | null>; depois: Record<string, string | null>; desfeito: string | null; processo_id: string | null }

function DetalheImportacao({ imp, onFechar, podeDesfazer, onDesfeita }: { imp: Importacao | null; onFechar: () => void; podeDesfazer: boolean; onDesfeita: () => void }) {
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState("");
  const itens = useQuery({
    queryKey: ["importacao-itens", imp?.id],
    enabled: !!imp,
    queryFn: async () => {
      const { data, error } = await supabase.from("importacao_itens").select("*").eq("importacao_id", imp!.id).order("numero");
      if (error) throw error;
      return data as unknown as Item[];
    },
  });
  async function desfazer() {
    if (!imp) return;
    const { error } = await supabase.rpc("desfazer_importacao", { p_id: imp.id });
    setConfirmando(false);
    if (error) { setErro(error.message); return; }
    onDesfeita();
  }
  return (
    <Dialog open={!!imp} onOpenChange={(o) => { if (!o) { onFechar(); setErro(""); } }}>
      <DialogContent className="max-w-4xl">
        {imp && (
          <>
            <DialogHeader><DialogTitle>Importação #{String(imp.numero).padStart(3, "0")} — {imp.arquivo}</DialogTitle></DialogHeader>
            <div className="max-h-[70vh] space-y-4 overflow-y-auto text-sm">
              <p className="text-muted-foreground">
                {dataHora(imp.criado_em)} por {imp.usuario_nome || "—"} · <EtiquetaStatus s={imp.status} />
                {imp.desfeita_em ? ` · desfeita em ${dataHora(imp.desfeita_em)} por ${imp.desfeita_por}` : ""}
              </p>
              <Resumo imp={imp} />
              {!!imp.detalhes.conflitos?.length && (
                <div className="space-y-2">
                  <h3 className="font-semibold">Conflitos {imp.detalhes && (imp as unknown as { detalhes: { conflitos_aplicados?: boolean } }).detalhes.conflitos_aplicados ? "(aplicados)" : "(valor atual mantido)"}</h3>
                  <Tabela cab={["Processo", "Campo", "Valor no sistema", "Valor da planilha"]}
                    linhas={imp.detalhes.conflitos.map((c) => [c.numero, rotuloCampo(c.campo), formatarValor(c.campo, String(c.atual)), formatarValor(c.campo, c.novo)])} />
                </div>
              )}
              <ListaProblemas imp={imp} />
              <div className="space-y-2">
                <h3 className="font-semibold">Processos criados ou alterados</h3>
                <Tabela cab={["Processo", "Ação", "Alterações", "Desfazer"]}
                  linhas={(itens.data ?? []).map((i) => [
                    i.numero, i.acao === "criado" ? "Criado" : "Atualizado",
                    i.acao === "criado" ? "—" : Object.keys(i.depois).map((c) => `${rotuloCampo(c)}: ${formatarValor(c, i.antes[c])} → ${formatarValor(c, i.depois[c])}`).join(" · "),
                    i.desfeito ?? "—",
                  ])} />
              </div>
              {erro && <p className="text-urgente">{erro}</p>}
              {podeDesfazer && (
                <div className="flex justify-end">
                  <button className={BOTAO_SEC} onClick={() => setConfirmando(true)}><Undo2 className="size-4" /> Desfazer esta importação</button>
                </div>
              )}
            </div>
            <AlertDialog open={confirmando} onOpenChange={setConfirmando}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Desfazer a Importação #{imp.numero}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Processos criados por ela serão removidos (exceto os que já receberam dados cadastrados manualmente) e os campos alterados voltarão aos valores anteriores,
                    salvo os que foram modificados depois. Audiências, pendências, prioridades e observações não são afetadas.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={desfazer}>Confirmar e desfazer</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
