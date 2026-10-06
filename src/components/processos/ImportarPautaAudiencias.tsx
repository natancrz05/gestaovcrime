import { useRef, useState } from "react";
import { AlertTriangle, FileCheck2, Upload } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatarData } from "@/lib/dominio";
import type {
  AnalisePautaAudiencias,
  LinhaPautaAudiencia,
  ProblemaPauta,
  ResultadoImportacaoPauta,
} from "@/lib/processos/importacao-pauta-audiencias";
import type { ProcessoCompleto } from "@/lib/processos/modelo";

const BOTAO =
  "inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-4 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60";
const BOTAO_PRIMARIO =
  "inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60";

function Resumo({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <p className="text-2xl font-semibold tabular-nums">{valor}</p>
      <p className="text-xs text-muted-foreground">{rotulo}</p>
    </div>
  );
}

function Problemas({ titulo, itens }: { titulo: string; itens: ProblemaPauta[] }) {
  if (!itens.length) return null;
  return (
    <div className="rounded-md border border-urgente/25 bg-urgente-suave p-3">
      <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-urgente">
        <AlertTriangle className="size-4" /> {titulo}
      </p>
      <ul className="space-y-1 text-xs text-foreground">
        {itens.map((e, i) => (
          <li key={i}>
            {e.pagina > 0 ? `Página ${e.pagina}` : "Pauta"}
            {e.numero ? ` · ${e.numero}` : ""}: {e.motivo}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ImportarPautaAudiencias({
  onConcluido,
  processos,
}: {
  onConcluido: () => Promise<void> | void;
  processos: ProcessoCompleto[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [aberto, setAberto] = useState(false);
  const [arquivo, setArquivo] = useState("");
  const [linhas, setLinhas] = useState<LinhaPautaAudiencia[]>([]);
  const [errosLeitura, setErrosLeitura] = useState<ProblemaPauta[]>([]);
  const [analise, setAnalise] = useState<AnalisePautaAudiencias | null>(null);
  const [resultado, setResultado] = useState<ResultadoImportacaoPauta | null>(null);
  const [erro, setErro] = useState("");
  const [lendo, setLendo] = useState(false);
  const [importando, setImportando] = useState(false);

  function limpar() {
    setArquivo("");
    setLinhas([]);
    setErrosLeitura([]);
    setAnalise(null);
    setResultado(null);
    setErro("");
    setLendo(false);
    setImportando(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function ler(arquivoSelecionado: File | undefined) {
    limpar();
    if (!arquivoSelecionado) return;
    setArquivo(arquivoSelecionado.name);
    setLendo(true);
    try {
      const { lerPautaAudiencias, analisarPautaAudiencias } = await import(
        "@/lib/processos/importacao-pauta-audiencias"
      );
      const leitura = await lerPautaAudiencias(arquivoSelecionado);
      setLinhas(leitura.linhas);
      setErrosLeitura(leitura.erros);
      setAnalise(analisarPautaAudiencias(leitura.linhas, processos, leitura.erros));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível ler a pauta.");
    } finally {
      setLendo(false);
    }
  }

  async function importar() {
    if (!analise || analise.erros.length || analise.conflitos || !linhas.length) return;
    setImportando(true);
    setErro("");
    try {
      const { executarImportacaoPauta } = await import(
        "@/lib/processos/importacao-pauta-audiencias"
      );
      const r = await executarImportacaoPauta(linhas, errosLeitura);
      await onConcluido();
      setResultado(r);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível importar a pauta.");
    } finally {
      setImportando(false);
    }
  }

  const bloqueada = !analise || analise.erros.length > 0 || analise.conflitos > 0 || !linhas.length;
  const conflitos = analise?.itens
    .filter((i) => i.estado === "conflito")
    .map((i) => ({ pagina: i.pagina, numero: i.numero, motivo: i.motivo ?? "Conflito não identificado." })) ?? [];

  return (
    <Dialog
      open={aberto}
      onOpenChange={(v) => {
        if (!v && (lendo || importando)) return;
        setAberto(v);
        if (!v) limpar();
      }}
    >
      <DialogTrigger asChild>
        <button className={BOTAO}>
          <Upload className="size-4" /> Ler pauta PJe
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[88vh] max-w-6xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Leitor da pauta de audiências do PJe</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border border-border bg-muted/20 p-4">
            <p className="text-sm font-medium">Selecione o PDF da pauta de audiências</p>
            <p className="mt-1 text-xs text-muted-foreground">
              A leitura é feita antes de qualquer gravação. Processos e audiências existentes são reaproveitados; conflitos bloqueiam a importação.
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="mt-3 block w-full text-sm"
              disabled={lendo || importando}
              onChange={(e) => void ler(e.target.files?.[0])}
            />
            {arquivo ? <p className="mt-2 text-xs text-muted-foreground">Arquivo: {arquivo}</p> : null}
          </div>

          {lendo ? <p className="text-sm text-muted-foreground">Lendo e conferindo a pauta…</p> : null}
          {erro ? <p className="rounded-md border border-urgente/25 bg-urgente-suave p-3 text-sm text-urgente">{erro}</p> : null}

          {resultado ? (
            <div className="rounded-md border border-concluido/25 bg-concluido-suave p-4">
              <p className="flex items-center gap-2 font-semibold text-concluido">
                <FileCheck2 className="size-4" /> Pauta processada
              </p>
              <p className="mt-2 text-sm">
                {resultado.audienciasCriadas} audiência(s) criada(s), {resultado.audienciasAtualizadas} audiência(s) manual(is) sincronizada(s),
                {" "}{resultado.audienciasJaExistentes} já existente(s), {resultado.processosCriados} processo(s) novo(s),
                {" "}{resultado.reusCriados} réu(s) acrescentado(s) e {resultado.reusAtualizados} cadastro(s) de réu enriquecido(s) com CPF da pauta.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Processos já existentes foram reutilizados. Reprocessar o mesmo PDF não deve recriar as audiências já identificadas.
              </p>
            </div>
          ) : null}

          {analise ? (
            <>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <Resumo rotulo="Linhas reconhecidas" valor={analise.total} />
                <Resumo rotulo="Audiências novas" valor={analise.audienciasNovas} />
                <Resumo rotulo="Audiências já cadastradas" valor={analise.audienciasExistentes} />
                <Resumo rotulo="Audiências manuais a sincronizar" valor={analise.audienciasSincronizar} />
                <Resumo rotulo="Réus a acrescentar" valor={analise.reusNovos} />
                <Resumo rotulo="Processos novos" valor={analise.processosNovos} />
                <Resumo rotulo="Processos já existentes" valor={analise.processosExistentes} />
                <Resumo rotulo="Conflitos" valor={analise.conflitos} />
                <Resumo rotulo="Linhas repetidas ignoradas" valor={analise.duplicadasArquivo.length} />
              </div>

              <Problemas titulo="Erros de leitura — a importação está bloqueada" itens={analise.erros} />
              <Problemas titulo="Conflitos — a importação está bloqueada" itens={conflitos} />

              {analise.duplicadasArquivo.length ? (
                <div className="rounded-md border border-atencao/25 bg-atencao-suave p-3 text-xs">
                  <p className="font-semibold text-atencao">Linhas duplicadas na própria pauta</p>
                  <p className="mt-1 text-muted-foreground">
                    Foram identificadas {analise.duplicadasArquivo.length} repetição(ões). Elas serão ignoradas e não gerarão nova audiência.
                  </p>
                </div>
              ) : null}

              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full min-w-[900px] text-xs">
                  <thead className="bg-muted/50 text-left text-muted-foreground">
                    <tr>
                      <th className="px-2 py-2 font-medium">Data</th>
                      <th className="px-2 py-2 font-medium">Processo</th>
                      <th className="px-2 py-2 font-medium">Classe</th>
                      <th className="px-2 py-2 font-medium">Finalidade</th>
                      <th className="px-2 py-2 font-medium">Sala/local</th>
                      <th className="px-2 py-2 font-medium">Situação</th>
                      <th className="px-2 py-2 font-medium">Réu(s)</th>
                      <th className="px-2 py-2 font-medium">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {analise.itens.map((i, n) => (
                      <tr key={`${i.numero}-${i.data}-${i.horario}-${n}`}>
                        <td className="whitespace-nowrap px-2 py-2">{formatarData(i.data)} {i.horario}</td>
                        <td className="numero-processo whitespace-nowrap px-2 py-2">{i.numero}</td>
                        <td className="px-2 py-2">{i.classe}</td>
                        <td className="px-2 py-2">{i.tipo}</td>
                        <td className="px-2 py-2">
                          <span>{i.local}</span>
                          {i.salaOriginal && i.salaOriginal !== i.local ? (
                            <span className="block text-[10px] text-muted-foreground">PJe: {i.salaOriginal}</span>
                          ) : null}
                        </td>
                        <td className="px-2 py-2">
                          <span>{i.situacao}</span>
                          {i.situacaoOriginal && i.situacaoOriginal.toLowerCase() !== i.situacao.toLowerCase() ? (
                            <span className="block text-[10px] text-muted-foreground">PJe: {i.situacaoOriginal}</span>
                          ) : null}
                        </td>
                        <td className="px-2 py-2">
                          <div className="space-y-1">
                            {i.reus.map((r) => (
                              <div key={`${r.nome}-${r.cpf}`}>
                                <span>{r.nome}</span>
                                <span className="block text-[10px] text-muted-foreground">{r.cpf ? `CPF: ${r.cpf}` : "CPF não informado na pauta"}</span>
                              </div>
                            ))}
                          </div>
                          {i.reusNovos.length ? <span className="mt-1 block text-[11px] text-atencao">+ {i.reusNovos.length} a cadastrar</span> : null}
                        </td>
                        <td className="px-2 py-2">
                          {i.estado === "nova" ? (
                            <span className="font-medium text-concluido">
                              {i.processoNovo ? "Criar processo + audiência" : "Cadastrar audiência"}
                            </span>
                          ) : i.estado === "ja-cadastrada" ? (
                            <span className="font-medium text-info">Já cadastrada — não duplicar</span>
                          ) : i.estado === "sincronizar" ? (
                            <span className="font-medium text-atencao">Audiência manual localizada — sincronizar com PJe</span>
                          ) : (
                            <span className="font-medium text-urgente">{i.motivo}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                <p className="max-w-2xl text-xs text-muted-foreground">
                  A importação só é liberada quando todas as linhas estão legíveis e sem conflito real.
                  Se já houver audiência manual no mesmo processo, data e horário, ela é reutilizada e sincronizada com os dados da pauta, sem duplicação.
                </p>
                <button className={BOTAO_PRIMARIO} disabled={bloqueada || importando || !!resultado} onClick={() => void importar()}>
                  <Upload className="size-4" /> {importando ? "Importando…" : "Importar pauta conferida"}
                </button>
              </div>
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
