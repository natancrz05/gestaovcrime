import { formatarData, type Processo } from "@/lib/dominio";
import { Etiqueta } from "./Etiqueta";
import { EstadoVazio } from "./Cabecalho";

export function CartaoProcesso({ processo }: { processo: Processo }) {
  return (
    <article className="rounded-lg border border-border bg-card p-4 shadow-card transition-shadow hover:shadow-card-hover">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="numero-processo text-sm font-semibold text-foreground">
            {processo.numero}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {processo.classe} · {processo.assunto} · Fase: {processo.fase}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {processo.sinalizadores.map((s) => (
            <Etiqueta key={s.tipo} severidade={s.severidade}>
              {s.rotulo}
            </Etiqueta>
          ))}
        </div>
      </div>

      <dl className="mt-4 grid gap-3 border-t border-border pt-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">Última movimentação</dt>
          <dd className="mt-0.5 font-medium text-foreground">
            {formatarData(processo.ultimaMovimentacao)}
          </dd>
          <dd className="text-muted-foreground">{processo.descricaoUltimaMovimentacao}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Dias sem movimentação</dt>
          <dd
            className={
              processo.diasSemMovimentacao > 100
                ? "mt-0.5 font-semibold text-atencao"
                : "mt-0.5 font-medium text-foreground"
            }
          >
            {processo.diasSemMovimentacao} dias
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Próxima audiência</dt>
          <dd className="mt-0.5 font-medium text-foreground">
            {formatarData(processo.proximaAudiencia)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Próxima providência</dt>
          <dd className="mt-0.5 font-medium text-foreground">
            {processo.proximaProvidencia}
          </dd>
        </div>
      </dl>
    </article>
  );
}

export function ListaProcessos({
  processos,
  vazioTitulo = "Nenhum processo nesta lista",
  vazioDescricao = "Quando houver processos com este critério, eles aparecerão aqui.",
}: {
  processos: Processo[];
  vazioTitulo?: string;
  vazioDescricao?: string;
}) {
  if (processos.length === 0) {
    return <EstadoVazio titulo={vazioTitulo} descricao={vazioDescricao} />;
  }
  return (
    <div className="space-y-3">
      {processos.map((p) => (
        <CartaoProcesso key={p.id} processo={p} />
      ))}
    </div>
  );
}
