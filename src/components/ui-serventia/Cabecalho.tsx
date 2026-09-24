export function Cabecalho({
  titulo,
  subtitulo,
  acao,
}: {
  titulo: string;
  subtitulo?: string;
  acao?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{titulo}</h1>
        {subtitulo ? (
          <p className="mt-1 text-sm text-muted-foreground">{subtitulo}</p>
        ) : null}
      </div>
      {acao}
    </header>
  );
}

export function EstadoVazio({
  titulo,
  descricao,
}: {
  titulo: string;
  descricao: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center">
      <p className="text-sm font-medium text-foreground">{titulo}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{descricao}</p>
    </div>
  );
}

export function AvisoEtapa({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md border border-info/20 bg-info-suave px-3 py-2 text-xs text-info">
      {children}
    </p>
  );
}
