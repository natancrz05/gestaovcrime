import type { ReactNode } from "react";
import {
  CheckCircle2,
  FileText,
  LoaderCircle,
  ShieldCheck,
  XCircle,
} from "lucide-react";

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

function MolduraProcessamento({ children }: { children: ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="absolute inset-x-0 top-0 h-1 bg-primary/80" />
      <div className="p-5 sm:p-7">{children}</div>
    </div>
  );
}

function BarraProgresso({
  percentual,
  indeterminado = false,
  tom = "primary",
}: {
  percentual: number;
  indeterminado?: boolean;
  tom?: "primary" | "concluido" | "urgente";
}) {
  const cor =
    tom === "concluido"
      ? "bg-concluido"
      : tom === "urgente"
        ? "bg-urgente"
        : "bg-primary";

  return (
    <div
      className="h-2.5 overflow-hidden rounded-full bg-muted"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={indeterminado ? undefined : percentual}
    >
      {indeterminado ? (
        <div className={`h-full w-1/3 animate-pulse rounded-full ${cor}`} />
      ) : (
        <div
          className={`h-full rounded-full transition-[width] duration-300 ease-out ${cor}`}
          style={{ width: `${percentual}%` }}
        />
      )}
    </div>
  );
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
  const indeterminado = !progresso?.total;

  return (
    <div className="mx-auto w-full max-w-3xl py-5 sm:py-8" role="status" aria-live="polite">
      <MolduraProcessamento>
        <div className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10">
                <LoaderCircle className="size-5 animate-spin text-primary" />
              </span>
              <div className="min-w-0">
                <div className="mb-1.5 inline-flex rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
                  Processamento em andamento
                </div>
                <h3 className="text-lg font-semibold tracking-tight">{titulo}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {progresso?.etapa ?? "Preparando o processamento..."}
                </p>
              </div>
            </div>

            <div className="shrink-0 text-left sm:text-right">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Progresso</p>
              <p className="mt-0.5 text-3xl font-semibold tabular-nums text-primary">
                {indeterminado ? "…" : `${percentual}%`}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <BarraProgresso percentual={percentual} indeterminado={indeterminado} />
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>
                {indeterminado
                  ? "Preparando as etapas do processamento"
                  : `${progresso?.concluidas ?? 0} de ${progresso?.total ?? 0} etapas concluídas`}
              </span>
              {!indeterminado ? <span className="font-medium tabular-nums">{percentual}% concluído</span> : null}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-muted/25 p-3">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <FileText className="size-4" />
                Arquivo
              </div>
              <p className="mt-1.5 truncate text-sm font-medium" title={arquivo}>
                {arquivo || "Dados do sistema"}
              </p>
            </div>

            <div className="rounded-lg border border-border bg-muted/25 p-3">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <ShieldCheck className="size-4" />
                Etapa atual
              </div>
              <p className="mt-1.5 line-clamp-2 text-sm font-medium">
                {progresso?.etapa ?? "Preparando processamento"}
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/15 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
            O sistema está trabalhando nesta operação. Aguarde a conclusão antes de fechar esta janela.
          </div>
        </div>
      </MolduraProcessamento>
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
    <div className="mx-auto w-full max-w-3xl py-5 sm:py-8">
      <MolduraProcessamento>
        <div className="space-y-6">
          <div className="flex flex-col items-center text-center">
            <span className="flex size-14 items-center justify-center rounded-full border border-concluido/25 bg-concluido-suave">
              <CheckCircle2 className="size-7 text-concluido" />
            </span>
            <div className="mt-4 inline-flex rounded-full border border-concluido/25 bg-concluido-suave px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-concluido">
              Concluído
            </div>
            <h3 className="mt-2 text-xl font-semibold tracking-tight">{titulo}</h3>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
              O processamento terminou e as informações já foram atualizadas no sistema.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-end justify-between gap-3">
              <span className="text-sm font-medium">Progresso da operação</span>
              <span className="text-2xl font-semibold tabular-nums text-concluido">100%</span>
            </div>
            <BarraProgresso percentual={100} tom="concluido" />
          </div>

          {resumo ? (
            <div className="rounded-lg border border-concluido/25 bg-concluido-suave/60 p-4 text-left text-sm leading-relaxed">
              {resumo}
            </div>
          ) : null}

          <div className="flex justify-center border-t border-border pt-4">
            <button className={BOTAO} onClick={onFechar}>
              {rotuloFechar}
            </button>
          </div>
        </div>
      </MolduraProcessamento>
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
  const indeterminado = !progresso?.total;

  return (
    <div className="mx-auto w-full max-w-3xl py-5 sm:py-8" role="alert">
      <MolduraProcessamento>
        <div className="space-y-6">
          <div className="flex flex-col items-center text-center">
            <span className="flex size-14 items-center justify-center rounded-full border border-urgente/25 bg-urgente-suave">
              <XCircle className="size-7 text-urgente" />
            </span>
            <div className="mt-4 inline-flex rounded-full border border-urgente/25 bg-urgente-suave px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-urgente">
              Operação interrompida
            </div>
            <h3 className="mt-2 text-xl font-semibold tracking-tight">{titulo}</h3>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
              O sistema interrompeu o processamento antes da conclusão.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-end justify-between gap-3">
              <span className="text-sm font-medium">Ponto alcançado</span>
              <span className="text-2xl font-semibold tabular-nums text-urgente">
                {indeterminado ? "—" : `${percentual}%`}
              </span>
            </div>
            <BarraProgresso percentual={percentual} indeterminado={indeterminado} tom="urgente" />
          </div>

          <div className="rounded-lg border border-urgente/25 bg-urgente-suave p-4 text-left">
            <p className="text-xs font-semibold uppercase tracking-wide text-urgente">Motivo</p>
            <p className="mt-1 text-sm leading-relaxed text-urgente">
              {erro || "Não foi possível concluir a importação."}
            </p>
          </div>

          {progresso?.etapa ? (
            <div className="rounded-lg border border-border bg-muted/25 p-3 text-sm">
              <span className="text-xs font-medium text-muted-foreground">Última etapa alcançada</span>
              <p className="mt-1 font-medium">{progresso.etapa}</p>
            </div>
          ) : null}

          <div className="flex flex-wrap justify-center gap-2 border-t border-border pt-4">
            <button className={BOTAO_SEC} onClick={onVoltar}>Voltar para conferência</button>
            <button className={BOTAO} onClick={onFechar}>Fechar importador</button>
          </div>
        </div>
      </MolduraProcessamento>
    </div>
  );
}
