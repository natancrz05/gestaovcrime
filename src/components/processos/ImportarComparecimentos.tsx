import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  TelaImportacaoConcluida,
  TelaImportacaoFalhou,
  TelaProcessandoImportacao,
  type ProgressoVisualImportacao,
} from "@/components/processos/EstadoProcessamentoImportacao";
import { formatarData } from "@/lib/dominio";
import { baixarCSV } from "@/lib/processos/importacao";
import {
  executarImportacaoComparecimentos, lerPlanilhaComparecimentos,
  type AnaliseComp, type ItemResultado, type ResultadoComp,
} from "@/lib/processos/importacao-comparecimentos";

const BOTAO = "inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60";
const BOTAO_SEC = "inline-flex h-8 items-center gap-1 rounded-md border border-border bg-background px-3 text-xs font-medium hover:bg-muted";

/** Importar planilha → prévia → confirmar. Nada é gravado antes da confirmação. */
export function ImportarComparecimentos({ aberto, onFechar, onConcluir }: { aberto: boolean; onFechar: () => void; onConcluir: () => Promise<unknown> }) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [analise, setAnalise] = useState<AnaliseComp | null>(null);
  const [previa, setPrevia] = useState<ResultadoComp | null>(null);
  const [final, setFinal] = useState<ResultadoComp | null>(null);
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
      const a = await lerPlanilhaComparecimentos(arquivo);
      setAnalise(a);
      setProgresso({ concluidas: 1, total: 2, etapa: "Conferindo vínculos e preparando a prévia..." });
      const p = await executarImportacaoComparecimentos(arquivo.name, a.validas, true);
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
    setProgresso({ concluidas: 0, total: 2, etapa: "Gravando comparecimentos no sistema..." });
    try {
      const r = await executarImportacaoComparecimentos(arquivo.name, analise.validas, false);
      setProgresso({ concluidas: 1, total: 2, etapa: "Atualizando o módulo de comparecimentos..." });
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
  const naoVinc = r?.nao_vinculados ?? [];
  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && fechar()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>Importar planilha de comparecimentos</DialogTitle></DialogHeader>
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
                {final.novos.length} novo(s) comparecimento(s), {final.atualizados.length} atualizado(s),
                {" "}{final.sem_alteracao} sem alteração, {final.processos_criados?.length ?? 0} processo(s) criado(s)
                e {final.nao_vinculados.length} registro(s) sem processo vinculado.
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
            <button className={BOTAO_SEC} disabled={!arquivo || ocupado} onClick={analisar}>{ocupado && !previa ? "Analisando…" : "Analisar arquivo"}</button>
          </div>
        <p className="text-xs text-muted-foreground">
          Colunas reconhecidas pelo nome, em qualquer ordem. A pessoa é identificada pelo processo + CPF ou nome. Processo não cadastrado é criado com o número informado e sinalizado; sem número utilizável, a pessoa entra como "Não vinculado". Registros ausentes da planilha não são alterados, e o histórico não é tocado.
        </p>
        {erro ? <p className="text-sm text-urgente">{erro}</p> : null}

        {r && analise ? (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ["Pessoas encontradas", analise.total], [final ? "Novos criados" : "Novos comparecimentos", r.novos.length],
                [final ? "Atualizados" : "Serão atualizados", r.atualizados.length], ["Sem alteração", r.sem_alteracao],
                ["Processos encontrados", r.processos_encontrados ?? 0], [final ? "Processos criados" : "Processos a criar", r.processos_criados?.length ?? 0],
                ["Sem processo vinculado", naoVinc.length], ["Possíveis correspondências", r.correspondencias?.length ?? 0],
                ["Possíveis duplicidades", analise.duplicados.length], ["Linhas com erro", analise.erros.length],
              ].map(([k, v]) => (
                <div key={k} className="rounded-md border border-border p-2"><div className="text-xs text-muted-foreground">{k}</div><div className="text-xl font-semibold tabular-nums">{v}</div></div>
              ))}
            </div>
            <Lista titulo="Novos" itens={r.novos} />
            <Lista titulo="Atualizações" itens={r.atualizados} />
            {r.processos_criados?.length ? (
              <div>
                <h4 className="mb-1 font-medium">Processos {final ? "criados" : "que serão criados"} pela importação (sinalizados para conferência)</h4>
                <ul className="max-h-40 overflow-y-auto rounded-md border border-border text-xs">{r.processos_criados.map((x) => <li key={x.numero} className="border-b border-border px-2 py-1 last:border-0">Linha {x.linha} · <span className="numero-processo">{x.numero}</span> · {x.pessoa}</li>)}</ul>
                <p className="mt-1 text-xs text-muted-foreground">Somente o número informado é gravado; nenhum outro dado é presumido.</p>
              </div>
            ) : null}
            {naoVinc.length ? (
              <div>
                <div className="mb-1 flex items-center justify-between"><h4 className="font-medium">Sem processo vinculado (a pessoa será importada e sinalizada)</h4>
                  <button className={BOTAO_SEC} onClick={() => baixarCSV("comparecimentos-nao-vinculados", ["Linha", "Pessoa", "CPF", "Números informados", "Motivo"], naoVinc.map((x) => [x.linha, x.pessoa, x.cpf, x.numeros.join(" / "), x.motivo ?? ""]))}>Baixar CSV</button></div>
                <ul className="max-h-40 overflow-y-auto rounded-md border border-border text-xs">{naoVinc.map((x) => <li key={x.linha} className="border-b border-border px-2 py-1 last:border-0">Linha {x.linha} · {x.pessoa} · {x.numeros.join(" / ") || "sem número"}{x.motivo ? ` — ${x.motivo}` : ""}</li>)}</ul>
              </div>
            ) : null}
            {r.correspondencias?.length ? (
              <div>
                <h4 className="mb-1 font-medium">Possível correspondência — conferir (sem vínculo automático)</h4>
                <ul className="max-h-40 overflow-y-auto rounded-md border border-border text-xs">{r.correspondencias.map((x) => <li key={x.linha} className="border-b border-border px-2 py-1 last:border-0">Linha {x.linha} · {x.pessoa} → {x.sugestoes.join(", ")}</li>)}</ul>
              </div>
            ) : null}
            {analise.duplicados.length + analise.erros.length ? (
              <div>
                <h4 className="mb-1 font-medium">Duplicidades e linhas com erro (ignoradas)</h4>
                <ul className="max-h-40 overflow-y-auto rounded-md border border-border text-xs">{[...analise.duplicados, ...analise.erros].map((x, i) => <li key={i} className="border-b border-border px-2 py-1 last:border-0">Linha {x.linha} · {x.pessoa}: {x.motivo}</li>)}</ul>
              </div>
            ) : null}
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

function Lista({ titulo, itens }: { titulo: string; itens: ItemResultado[] }) {
  if (!itens.length) return null;
  return (
    <div>
      <h4 className="mb-1 font-medium">{titulo} ({itens.length}) {itens.length > 10 ? <span className="text-xs font-normal text-muted-foreground">— primeiros 10</span> : null}</h4>
      <ul className="rounded-md border border-border text-xs">
        {itens.slice(0, 10).map((x) => (
          <li key={x.linha} className="border-b border-border px-2 py-1 last:border-0">
            {x.pessoa} · <span className="numero-processo">{x.numero}</span> · {x.periodicidade}
            {x.ultima ? ` · última assinatura ${formatarData(x.ultima)}` : ""} · próximo {x.proximo_antes ? `${formatarData(x.proximo_antes)} → ` : ""}{x.proximo ? formatarData(x.proximo) : "—"}
          </li>
        ))}
      </ul>
    </div>
  );
}
