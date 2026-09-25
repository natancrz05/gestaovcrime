import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

  const limpar = () => { setArquivo(null); setAnalise(null); setPrevia(null); setFinal(null); setErro(""); };
  const fechar = () => { limpar(); onFechar(); };

  async function analisar() {
    if (!arquivo) return;
    setOcupado(true); setErro(""); setPrevia(null);
    try {
      const a = await lerPlanilhaComparecimentos(arquivo);
      setAnalise(a);
      setPrevia(await executarImportacaoComparecimentos(arquivo.name, a.validas, true));
    } catch (e) { setErro(e instanceof Error ? e.message : "Falha ao analisar"); }
    setOcupado(false);
  }
  async function confirmar() {
    if (!arquivo || !analise) return;
    setOcupado(true); setErro("");
    try {
      setFinal(await executarImportacaoComparecimentos(arquivo.name, analise.validas, false));
      await onConcluir();
    } catch (e) { setErro(e instanceof Error ? e.message : "Falha na importação. Nada foi gravado."); }
    setOcupado(false);
  }

  const r = final ?? previa;
  const naoVinc = r?.nao_vinculados ?? [];
  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && fechar()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>Importar planilha de comparecimentos</DialogTitle></DialogHeader>
        {!final ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <input type="file" accept=".xlsx,.csv" onChange={(e) => { limpar(); setArquivo(e.target.files?.[0] ?? null); }} />
            <button className={BOTAO_SEC} disabled={!arquivo || ocupado} onClick={analisar}>{ocupado && !previa ? "Analisando…" : "Analisar arquivo"}</button>
          </div>
        ) : null}
        <p className="text-xs text-muted-foreground">
          Colunas reconhecidas pelo nome, em qualquer ordem. A pessoa é identificada pelo processo + CPF ou nome. Processo não cadastrado é criado com o número informado e sinalizado; sem número utilizável, a pessoa entra como "Não vinculado". Registros ausentes da planilha não são alterados, e o histórico não é tocado.
        </p>
        {erro ? <p className="text-sm text-urgente">{erro}</p> : null}

        {r && analise ? (
          <div className="space-y-4 text-sm">
            {final ? <p className="rounded-md bg-concluido-suave p-2 font-medium text-concluido">Importação concluída e registrada na auditoria.</p> : null}
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
              {final ? <button className={BOTAO} onClick={fechar}>Fechar</button> : <>
                <button className={BOTAO_SEC} onClick={fechar}>Cancelar</button>
                <button className={BOTAO} disabled={ocupado || r.novos.length + r.atualizados.length === 0} onClick={confirmar}>{ocupado ? "Importando…" : "Confirmar importação"}</button>
              </>}
            </div>
          </div>
        ) : null}
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
