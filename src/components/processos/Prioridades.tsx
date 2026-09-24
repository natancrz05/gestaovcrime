import { Link } from "@tanstack/react-router";
import { formatarData } from "@/lib/dominio";
import { diasSemMovimentacao, hojeISO, reuPrincipal, ultimaMovimentacao, type ProcessoCompleto } from "@/lib/processos/modelo";
import { CATEGORIAS, COR_CLASSES, type AlertaGestao, type CategoriaPrioridade } from "@/lib/processos/prioridades";
import { cn } from "@/lib/utils";

export function EtiquetaAlerta({ alerta }: { alerta: AlertaGestao }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-5", COR_CLASSES[alerta.cor].etiqueta)}>
      <span className="size-1.5 rounded-full bg-current" />
      {alerta.rotulo}
    </span>
  );
}

export function CartoesCategorias({
  contagens,
  selecionada,
  onSelecionar,
}: {
  contagens: Record<CategoriaPrioridade, number>;
  selecionada: CategoriaPrioridade | null;
  onSelecionar: (c: CategoriaPrioridade | null) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {CATEGORIAS.map((c) => {
        const ativo = selecionada === c.chave;
        return (
          <button
            key={c.chave}
            type="button"
            aria-pressed={ativo}
            onClick={() => onSelecionar(ativo ? null : c.chave)}
            className={cn(
              "rounded-lg border bg-card p-4 text-left shadow-card transition-shadow hover:shadow-card-hover",
              ativo ? "border-primary ring-2 ring-primary/30" : "border-border",
            )}
          >
            <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <span className={cn("size-2.5 rounded-full bg-current", COR_CLASSES[c.cor].texto)} />
              {c.titulo}
            </p>
            <p className={cn("mt-3 text-3xl font-semibold tabular-nums", COR_CLASSES[c.cor].texto)}>{contagens[c.chave]}</p>
            <p className="mt-1 text-xs text-muted-foreground">{c.descricao}</p>
          </button>
        );
      })}
    </div>
  );
}

export function ListaAtencao({ itens }: { itens: { processo: ProcessoCompleto; alertas: AlertaGestao[] }[] }) {
  const hoje = hojeISO();
  if (itens.length === 0)
    return <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Nenhum processo nesta categoria.</p>;
  return (
    <ul className="space-y-3">
      {itens.map(({ processo: p, alertas }) => {
        const reu = reuPrincipal(p);
        const presos = p.reus.filter((r) => r.preso);
        const ult = ultimaMovimentacao(p);
        const dias = diasSemMovimentacao(p, hoje);
        const urgente = alertas.some((a) => a.categoria === "reu-preso" || a.categoria === "prisao-temporaria");
        return (
          <li key={p.id} className={cn("rounded-lg border bg-card p-4 shadow-card", urgente ? "border-l-4 border-border border-l-urgente" : "border-border")}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Link to="/processos/$id" params={{ id: p.id }} className="numero-processo text-sm font-semibold text-primary hover:underline">
                  {p.numero}
                </Link>
                <p className="mt-0.5 text-sm text-foreground">
                  {reu?.nome ?? "Sem réu cadastrado"}
                  {p.reus.length > 1 ? <span className="text-xs text-muted-foreground"> +{p.reus.length - 1} réu(s)</span> : null}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {alertas.map((a, i) => <EtiquetaAlerta key={i} alerta={a} />)}
              </div>
            </div>
            <dl className="mt-3 grid gap-3 border-t border-border pt-3 text-xs sm:grid-cols-3">
              <div>
                <dt className="text-muted-foreground">Situação prisional</dt>
                <dd className="mt-0.5 font-medium">
                  {presos.length ? presos.map((r) => `${r.nome}: ${r.tipo_prisao}`).join("; ") : "Nenhum réu preso registrado"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Dias sem movimentação</dt>
                <dd className="mt-0.5 font-medium">{dias === null ? "—" : `${dias} dias`}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Última movimentação</dt>
                <dd className="mt-0.5 font-medium">{ult ? `${formatarData(ult.data)} — ${ult.descricao}` : "—"}</dd>
              </div>
            </dl>
          </li>
        );
      })}
    </ul>
  );
}

export function contarCategorias(itens: { alertas: AlertaGestao[] }[]): Record<CategoriaPrioridade, number> {
  const r: Record<CategoriaPrioridade, number> = { "reu-preso": 0, "prisao-temporaria": 0, "sem-movimentacao": 0, manual: 0 };
  for (const i of itens) for (const c of new Set(i.alertas.map((a) => a.categoria))) r[c]++;
  return r;
}
