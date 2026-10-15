import type { ReactNode } from "react";
import { CheckCircle2, LoaderCircle, XCircle } from "lucide-react";

const BOTAO =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60";
const BOTAO_SEC =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-border bg-background px-4 text-sm font-medium hover:bg-muted disabled:opacity-60";

export interface ProgressoVisualImportacao {
  concluidas: number;
  total: number;
  etapa: string;
}

export function percentualProgresso(progresso: ProgressoVisualImportacao | null | undefined) {
  if (!progresso?.total) return 0;
  return Math.min(100, Math.round((progresso.concluidas / progresso.total) * 100));
}

export function TelaProcessandoImportacao({
  progresso,
  arquivo,
  titulo = "Atualizando o sistema",
}: {
  progresso: ProgressoVisualImportacao | null;
  arquivo?: string | undefined;
  titulo?: string;
}) {
  const percentual = percentualProgresso(progresso);
  return (
    <div className="flex min-h-[340px] flex-col items-center justify-center gap-6 py-10 text-center">
      <LoaderCircle className="size-10 animate-spin text-primary" />
      <div className="w-full max-w-2xl space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div className="text-left">
            <p className="text-lg font-semibold">{titulo}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {progresso?.etapa ?? "Preparando processamento..."}
            </p>
          </div>
          <span className="text-3xl font-semibold tabular-nums text-primary">{percentual}%</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-200"
            style={{ width: `${percentual}%` }}
          />
        </div>
        <div className="flex justify-between gap-3 text-xs text-muted-foreground">
          <span className="truncate">{arquivo ? `Arquivo: ${arquivo}` : "Importação em andamento"}</span>
          {progresso?.total ? (
            <span className="shrink-0">{progresso.concluidas} de {progresso.total} etapas concluídas</span>
          ) : (
            <span className="shrink-0">Preparando…</span>
          )}
        </div>
      </div>
      <p className="max-w-xl text-xs text-muted-foreground">
        Não feche esta janela enquanto o processamento estiver em andamento.
      </p>
    </div>
  );
}

export function TelaImportacaoConcluida({
  resumo,
  onFechar,
  rotuloFechar = "Fechar importador",
  titulo = "Importação concluída",
}: {
  resumo?: ReactNode;
  onFechar: () => void;
  rotuloFechar?: string;
  titulo?: string;
}) {
  return (
    <div className="flex min-h-[340px] flex-col items-center justify-center gap-5 py-10 text-center">
      <CheckCircle2 className="size-12 text-concluido" />
      <div>
        <p className="text-xl font-semibold text-concluido">{titulo}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          O sistema terminou de processar o arquivo e atualizar os módulos.
        </p>
      </div>
      <div className="w-full max-w-2xl">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium">Progresso</span>
          <span className="font-semibold tabular-nums text-concluido">100%</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-muted">
          <div className="h-full w-full rounded-full bg-concluido" />
        </div>
      </div>
      {resumo ? (
        <div className="w-full max-w-2xl rounded-md border border-concluido/25 bg-concluido-suave p-4 text-left text-sm">
          {resumo}
        </div>
      ) : null}
      <button className={BOTAO} onClick={onFechar}>{rotuloFechar}</button>
    </div>
  );
}

export function TelaImportacaoFalhou({
  progresso,
  erro,
  onVoltar,
  onFechar,
  titulo = "Importação não concluída",
}: {
  progresso: ProgressoVisualImportacao | null;
  erro: string;
  onVoltar: () => void;
  onFechar: () => void;
  titulo?: string;
}) {
  const percentual = percentualProgresso(progresso);
  return (
    <div className="flex min-h-[340px] flex-col items-center justify-center gap-5 py-10 text-center">
      <XCircle className="size-12 text-urgente" />
      <div>
        <p className="text-xl font-semibold text-urgente">{titulo}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          O processamento foi interrompido antes da conclusão.
        </p>
      </div>
      <div className="w-full max-w-2xl">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium">Ponto alcançado</span>
          <span className="font-semibold tabular-nums text-urgente">{percentual}%</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-urgente" style={{ width: `${percentual}%` }} />
        </div>
        <p className="mt-3 rounded-md border border-urgente/25 bg-urgente-suave p-3 text-left text-sm text-urgente">
          {erro || "Não foi possível concluir a importação."}
        </p>
        {progresso?.etapa ? (
          <p className="mt-2 text-xs text-muted-foreground">Última etapa: {progresso.etapa}</p>
        ) : null}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <button className={BOTAO_SEC} onClick={onVoltar}>Voltar para conferência</button>
        <button className={BOTAO} onClick={onFechar}>Fechar importador</button>
      </div>
    </div>
  );
}
