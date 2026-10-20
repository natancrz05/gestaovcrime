import { LoaderCircle } from "lucide-react";

function Bloco({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className}`} />;
}

function CabecalhoCarregamento({ texto }: { texto: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <div className="h-1 w-full bg-primary/70" />
      <div className="flex items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-full bg-primary/10">
            <LoaderCircle className="size-4 animate-spin text-primary" />
          </span>
          <div>
            <p className="text-sm font-medium">{texto}</p>
            <p className="text-xs text-muted-foreground">Preparando as informações para exibição.</p>
          </div>
        </div>
        <span className="hidden text-xs font-medium text-muted-foreground sm:inline">Aguarde um instante</span>
      </div>
    </div>
  );
}

export function CarregandoPagina() {
  return (
    <div
      className="space-y-5"
      role="status"
      aria-live="polite"
      aria-label="Carregando página"
    >
      <CabecalhoCarregamento texto="Carregando informações" />

      <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="space-y-3">
          <Bloco className="h-7 w-52 max-w-full" />
          <Bloco className="h-4 w-96 max-w-[80%]" />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <Bloco className="h-3 w-24" />
            <Bloco className="mt-3 h-7 w-16" />
            <Bloco className="mt-3 h-3 w-32 max-w-full" />
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-3">
          <Bloco className="h-4 w-44" />
        </div>
        <div className="space-y-3 p-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="grid gap-3 sm:grid-cols-[1.1fr_.8fr_.7fr]">
              <Bloco className="h-9 w-full" />
              <Bloco className="h-9 w-full" />
              <Bloco className="h-9 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function CarregandoProcesso() {
  return (
    <div
      className="space-y-5"
      role="status"
      aria-live="polite"
      aria-label="Carregando processo"
    >
      <CabecalhoCarregamento texto="Carregando processo" />

      <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="space-y-3">
          <Bloco className="h-3 w-28" />
          <Bloco className="h-8 w-72 max-w-[80%]" />
          <Bloco className="h-4 w-96 max-w-[90%]" />
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Bloco className="h-6 w-20 rounded-full" />
          <Bloco className="h-6 w-24 rounded-full" />
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="rounded-lg border border-border bg-card p-3 shadow-sm">
            <Bloco className="h-3 w-20 max-w-full" />
            <Bloco className="mt-2 h-6 w-24 max-w-full" />
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card shadow-sm">
        <div className="flex gap-2 overflow-hidden border-b border-border px-4 py-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Bloco key={i} className="h-8 w-24 shrink-0" />
          ))}
        </div>

        <div className="grid gap-5 p-5 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="space-y-2">
              <Bloco className="h-3 w-24 max-w-full" />
              <Bloco className="h-5 w-32 max-w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function CarregandoBloco({ texto = "Carregando informações..." }: { texto?: string }) {
  return (
    <div
      className="flex min-h-32 items-center justify-center rounded-lg border border-border bg-card p-6 text-center shadow-sm"
      role="status"
      aria-live="polite"
    >
      <div className="space-y-3">
        <span className="mx-auto flex size-9 items-center justify-center rounded-full bg-primary/10">
          <LoaderCircle className="size-4 animate-spin text-primary" />
        </span>
        <p className="text-sm font-medium">{texto}</p>
        <div className="mx-auto h-1.5 w-32 overflow-hidden rounded-full bg-muted">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-primary" />
        </div>
      </div>
    </div>
  );
}
