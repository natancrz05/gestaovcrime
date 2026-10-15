import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  TelaImportacaoConcluida,
  TelaImportacaoFalhou,
  TelaProcessandoImportacao,
  type ProgressoVisualImportacao,
} from "@/components/processos/EstadoProcessamentoImportacao";
import { baixarCSV } from "@/lib/processos/importacao";
import {
  executarImportacaoReus, lerPlanilhaReus, ROTULO_TIPO_PROC,
  type AnaliseReu, type ItemReu, type ResultadoReu,
} from "@/lib/processos/importacao-reus";

const BOTAO = "inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60";
const BOTAO_SEC = "inline-flex h-8 items-center gap-1 rounded-md border border-border bg-background px-3 text-xs font-medium hover:bg-muted";

/** Importar planilha de presos → prévia → confirmar. Nada é gravado antes da confirmação. */
export function ImportarReusPresos({ aberto, onFechar, onConcluir }: { aberto: boolean; onFechar: () => void; onConcluir: () => Promise<unknown> }) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [analise, setAnalise] = useState<AnaliseReu | null>(null);
  const [previa, setPrevia] = useState<ResultadoReu | null>(null);
  const [final, setFinal] = useState<ResultadoReu | null>(null);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [fase, setFase] = useState<"idle" | "analisando" | "importando" | "falha">("idle");
  const [progresso, setProgresso] = useState<ProgressoVisualImportacao | null>(null);

  const limpar = () => {
    setArquivo(null); setAnalise(null); setPrevia(null); setFinal(null); setErro("");
    setOcupado(false); setFase("idle"); setProgresso(null);
  };
  const fechar = () => { limpar(); onFechar(); };

  async function analisar() {
    if (!arquivo) return;
    setOcupado(true); setErro(""); setPrevia(null); setFase("analisando");
    setProgresso({ concluidas: 0, total: 2, etapa: "Lendo e validando a planilha..." });
    try {
      const a = await lerPlanilhaReus(arquivo);
      setAnalise(a);
      setProgresso({ concluidas: 1, total: 2, etapa: "Conferindo presos, processos e vínculos..." });
      const p = await executarImportacaoReus(arquivo.name, a.validas, a.erros.length, true);
      setPrevia(p);
      setProgresso({ concluidas: 2, total: 2, etapa: "Análise concluída." });
      setFase("idle");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao analisar");
      setFase("idle");
    } finally {
      setOcupado(false);
    }
  }
  async function confirmar() {
    if (!arquivo || !analise) return;
    setOcupado(true); setErro(""); setFase("importando");
    setProgresso({ concluidas: 0, total: 2, etapa: "Gravando presos provisórios e vínculos..." });
    try {
      const r = await executarImportacaoReus(arquivo.name, analise.validas, analise.erros.length, false);
      setProgresso({ concluidas: 1, total: 2, etapa: "Atualizando o módulo de presos provisórios..." });
      await onConcluir();
      setFinal(r);
      setProgresso({ concluidas: 2, total: 2, etapa: "Importação concluída." });
      setFase("idle");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha na importação. Nada foi gravado.");
      setFase("falha");
    } finally {
      setOcupado(false);
    }
  }

  const r = final ?? previa;
  return (
    <Dialog open={aberto} onOpenChange={(o) => { if (!o && ocupado) return; if (!o) fechar(); }}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>Importar planilha de presos provisórios</DialogTitle></DialogHeader>
        {fase === "analisando" || fase === "importando" ? (
          <TelaProcessandoImportacao
            progresso={progresso}
            arquivo={arquivo?.name}
            titulo={fase === "analisando" ? "Analisando planilha" : "Atualizando o sistema"}
          />
        ) : final ? (
          <TelaImportacaoConcluida
            onFechar={fechar}
            resumo={
              <p>
                {final.novos.length} novo(s) preso(s) provisório(s), {final.atualizados.length} atualizado(s),
                {" "}{final.sem_alteracao} sem alteração, {final.processos_criados.length} processo(s) criado(s)
                e {final.nao_vinculados.length} número(s) mantido(s) para conferência.
              </p>
            }
          />
        ) : fase === "falha" ? (
          <TelaImportacaoFalhou
            progresso={progresso}
            erro={erro}
            onVoltar={() => { setFase("idle"); setErro(""); }}
            onFechar={fechar}
          />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <input type="file" accept=".xlsx,.csv" onChange={(e) => { limpar(); setArquivo(e.target.files?.[0] ?? null); }} />
              <button className={BOTAO_SEC} disabled={!arquivo || ocupado} onClick={analisar}>Analisar arquivo</button>
            </div>
            <p className="text-xs text-muted-foreground">
              Colunas reconhecidas pelo nome, em qualquer ordem. O preso é identificado pelo RJI ou, na falta dele, pelo nome junto com os processos informados. Processos cautelar, IP e ação penal são guardados separadamente; processo não cadastrado é criado só com o número e sinalizado para conferência. Presos ausentes da planilha e dados manuais não são alterados.
            </p>
            {erro ? <p className="text-sm text-urgente">{erro}</p> : null}

            {r && analise ? (
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    ["Presos provisórios encontrados", analise.total], ["Novos presos provisórios", r.novos.length],
                    ["Serão atualizados", r.atualizados.length], ["Sem alteração", r.sem_alteracao],
                    ["Processos encontrados", r.processos_encontrados], ["Processos a criar", r.processos_criados.length],
                    ["Processos não vinculados", r.nao_vinculados.length], ["Possíveis duplicidades", analise.duplicados.length],
                    ["Linhas com erro", analise.erros.length],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-md border border-border p-2"><div className="text-xs text-muted-foreground">{k}</div><div className="text-xl font-semibold tabular-nums">{v}</div></div>
                  ))}
                </div>
                <Lista titulo="Novos presos provisórios" itens={r.novos} />
                <Lista titulo="Atualizações" itens={r.atualizados} />
                {r.processos_criados.length ? (
                  <Bloco titulo="Processos que serão criados (sinalizados para conferência)"
                    linhas={r.processos_criados.map((x) => `Linha ${x.linha} · ${ROTULO_TIPO_PROC[x.tipo]} ${x.numero} · ${x.preso}`)} />
                ) : null}
                {r.nao_vinculados.length ? (
                  <div>
                    <div className="mb-1 flex justify-end"><button className={BOTAO_SEC} onClick={() => baixarCSV("reus-processos-nao-vinculados", ["Linha", "Preso", "Tipo", "Número"], r.nao_vinculados.map((x) => [x.linha, x.preso, ROTULO_TIPO_PROC[x.tipo] ?? x.tipo, x.numero]))}>Baixar CSV</button></div>
                    <Bloco titulo="Números não vinculados (o preso é importado e o número é guardado para conferência)"
                      linhas={r.nao_vinculados.map((x) => `Linha ${x.linha} · ${x.preso} · ${ROTULO_TIPO_PROC[x.tipo]}: ${x.numero}`)} />
                  </div>
                ) : null}
                {analise.duplicados.length + analise.erros.length ? (
                  <Bloco titulo="Duplicidades e linhas com erro (ignoradas)" linhas={[...analise.duplicados, ...analise.erros].map((x) => `Linha ${x.linha} · ${x.nome}: ${x.motivo}`)} />
                ) : null}
                {analise.avisos.length ? <Bloco titulo="Avisos (o preso é importado)" linhas={analise.avisos.map((x) => `Linha ${x.linha} · ${x.nome}: ${x.motivo}`)} /> : null}
                <div className="flex justify-end gap-2 border-t border-border pt-3">
                  <button className={BOTAO_SEC} onClick={fechar}>Cancelar</button>
                  <button className={BOTAO} disabled={ocupado || r.novos.length + r.atualizados.length === 0} onClick={confirmar}>
                    Confirmar importação
                  </button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Bloco({ titulo, linhas }: { titulo: string; linhas: string[] }) {
  return (
    <div>
      <h4 className="mb-1 font-medium">{titulo}</h4>
      <ul className="max-h-40 overflow-y-auto rounded-md border border-border text-xs">{linhas.map((t, i) => <li key={i} className="border-b border-border px-2 py-1 last:border-0">{t}</li>)}</ul>
    </div>
  );
}

function Lista({ titulo, itens }: { titulo: string; itens: ItemReu[] }) {
  if (!itens.length) return null;
  return (
    <Bloco titulo={`${titulo} (${itens.length})`} linhas={itens.map((x) =>
      `Linha ${x.linha} · ${x.nome}${x.rji ? ` · RJI ${x.rji}` : ""}${x.especie ? ` · ${x.especie}` : ""} · ${x.processos.map((p) => `${ROTULO_TIPO_PROC[p.tipo]} ${p.numero}`).join(" | ") || "sem processo"}`)} />
  );
}
