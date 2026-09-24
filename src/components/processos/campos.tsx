import type { ReactNode } from "react";

export const CLASSE_CAMPO =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

export function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{rotulo}</span>
      {children}
    </label>
  );
}

export function Secao({
  titulo,
  acao,
  children,
}: {
  titulo: string;
  acao?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-5 shadow-card">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">{titulo}</h2>
        {acao}
      </div>
      {children}
    </section>
  );
}

export function Opcoes({ valores }: { valores: readonly string[] }) {
  return (
    <>
      {valores.map((v) => (
        <option key={v} value={v}>
          {v}
        </option>
      ))}
    </>
  );
}
