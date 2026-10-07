import { LoaderCircle } from "lucide-react";

function Bloco({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className}`} />;
}

export function CarregandoPagina() {
  return (
    <div
      className="space-y-6"
      role="status"
      aria-live="polite"
      aria-label="Carregando página"
    >
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin text-primary" />
        <span>Carregando informações…</span>
      </div>

      <div className="space-y-3 border-b border-border pb-5">
        <Bloco className="h-7 w-48 max-w-full" />
        <Bloco className="h-4 w-80 max-w-[75%]" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="rounded-lg border border-border bg-card p-4">
            <Bloco className="h-3 w-24" />
            <Bloco className="mt-3 h-6 w-20" />
            <Bloco className="mt-2 h-3 w-32 max-w-full" />
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="space-y-3">
          <Bloco className="h-4 w-40" />
          <Bloco className="h-10 w-full" />
          <Bloco className="h-10 w-full" />
          <Bloco className="h-10 w-4/5" />
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
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin text-primary" />
        <span>Carregando processo…</span>
      </div>

      <div className="space-y-3 border-b border-border pb-5">
        <Bloco className="h-4 w-28" />
        <Bloco className="h-8 w-72 max-w-[80%]" />
        <Bloco className="h-4 w-96 max-w-[90%]" />
      </div>

      <div className="flex flex-wrap gap-2">
        <Bloco className="h-6 w-20 rounded-full" />
        <Bloco className="h-6 w-24 rounded-full" />
      </div>

      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="rounded-lg border border-border bg-card p-3">
            <Bloco className="h-3 w-20 max-w-full" />
            <Bloco className="mt-2 h-5 w-24 max-w-full" />
          </div>
        ))}
      </div>

      <div className="flex gap-2 overflow-hidden border-b border-border pb-2">
        {Array.from({ length: 5 }, (_, i) => (
          <Bloco key={i} className="h-8 w-24 shrink-0" />
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
