import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

  const limpar = () => { setArquivo(null); setAnalise(null); setPrevia(null); setFinal(null); setErro(""); };
  const fechar = () => { limpar(); onFechar(); };

  async function analisar() {
    if (!arquivo) return;
    setOcupado(true); setErro(""); setPrevia(null);
    try {
      const a = await lerPlanilhaReus(arquivo);
      setAnalise(a);
      setPrevia(await executarImportacaoReus(arquivo.name, a.validas, a.erros.length, true));
    } catch (e) { setErro(e instanceof Error ? e.message : "Falha ao analisar"); }
    setOcupado(false);
  }
  async function confirmar() {
    if (!arquivo || !analise) return;
    setOcupado(true); setErro("");
    try {
      setFinal(await executarImportacaoReus(arquivo.name, analise.validas, analise.erros.length, false));
      await onConcluir();
    } catch (e) { setErro(e instanceof Error ? e.message : "Falha na importação. Nada foi gravado."); }
    setOcupado(false);
  }

  const r = final ?? previa;
  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && fechar()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>Importar planilha de presos provisórios</DialogTitle></DialogHeader>
        {!final ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <input type="file" accept=".xlsx,.csv" onChange={(e) => { limpar(); setArquivo(e.target.files?.[0] ?? null); }} />
            <button className={BOTAO_SEC} disabled={!arquivo || ocupado} onClick={analisar}>{ocupado && !previa ? "Analisando…" : "Analisar arquivo"}</button>
          </div>
        ) : null}
        <p className="text-xs text-muted-foreground">
          Colunas reconhecidas pelo nome, em qualquer ordem. O preso é identificado pelo RJI ou, na falta dele, pelo nome junto com os processos informados. Processos cautelar, IP e ação penal são guardados separadamente; processo não cadastrado é criado só com o número e sinalizado para conferência. Presos ausentes da planilha e dados manuais não são alterados.
        </p>
        {erro ? <p className="text-sm text-urgente">{erro}</p> : null}

        {r && analise ? (
          <div className="space-y-4 text-sm">
            {final ? <p className="rounded-md bg-concluido-suave p-2 font-medium text-concluido">Importação concluída e registrada na auditoria.</p> : null}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ["Presos provisórios encontrados", analise.total], [final ? "Novos criados" : "Novos presos provisórios", r.novos.length],
                [final ? "Atualizados" : "Serão atualizados", r.atualizados.length], ["Sem alteração", r.sem_alteracao],
                ["Processos encontrados", r.processos_encontrados], [final ? "Processos criados" : "Processos a criar", r.processos_criados.length],
                ["Processos não vinculados", r.nao_vinculados.length], ["Possíveis duplicidades", analise.duplicados.length],
                ["Linhas com erro", analise.erros.length],
              ].map(([k, v]) => (
                <div key={k} className="rounded-md border border-border p-2"><div className="text-xs text-muted-foreground">{k}</div><div className="text-xl font-semibold tabular-nums">{v}</div></div>
              ))}
            </div>
            <Lista titulo="Novos presos provisórios" itens={r.novos} />
            <Lista titulo="Atualizações" itens={r.atualizados} />
            {r.processos_criados.length ? (
              <Bloco titulo={`Processos ${final ? "criados" : "que serão criados"} (sinalizados para conferência)`}
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
