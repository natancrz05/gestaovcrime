import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AcoesEtiquetasProcesso, EtiquetasProcesso } from "@/components/processos/GerenciarEtiquetas";
import { Cabecalho, EstadoVazio } from "@/components/ui-serventia/Cabecalho";
import { formatarData } from "@/lib/dominio";
import { diasSemMovimentacao, hojeISO, proximaAudiencia, ultimaMovimentacao } from "@/lib/processos/modelo";
import { processosQuery } from "@/lib/processos/repositorio";
import { usePode } from "@/lib/sessao";

export const Route = createFileRoute("/_authenticated/sem-movimentacao")({
  head: () => ({
    meta: [
      { title: "Sem Movimentação — Gestão da Vara Criminal" },
      { name: "description", content: "Processos parados há mais de 100 dias no acervo da serventia." },
      { property: "og:title", content: "Sem Movimentação — Gestão da Vara Criminal" },
      { property: "og:description", content: "Processos parados há mais de 100 dias no acervo da serventia." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(processosQuery()),
  errorComponent: ({ error }) => <EstadoVazio titulo="Erro ao carregar processos" descricao={error.message} />,
  component: Pagina,
});

function Pagina() {
  const { data: processos } = useSuspenseQuery(processosQuery());
  const podeEditar = usePode("editar");
  const hoje = hojeISO();
  const parados = processos
    .filter((p) => {
      const d = diasSemMovimentacao(p, hoje);
      return d !== null && d > 100;
    })
    .sort((a, b) => (diasSemMovimentacao(b, hoje) ?? 0) - (diasSemMovimentacao(a, hoje) ?? 0));

  return (
    <div className="space-y-6">
      <Cabecalho titulo="Sem Movimentação" subtitulo={`${parados.length} processos com mais de 100 dias sem movimentação`} />
      {parados.length === 0 ? <EstadoVazio titulo="Nenhum processo nesta lista" descricao="Quando houver processos com mais de 100 dias sem movimentação, eles aparecerão aqui." /> : (
        <div className="space-y-3">
          {parados.map((p) => {
            const ult = ultimaMovimentacao(p);
            const aud = proximaAudiencia(p, hoje);
            const dias = diasSemMovimentacao(p, hoje) ?? 0;
            return (
              <article key={p.id} className="rounded-lg border border-border bg-card p-4 shadow-card transition-shadow hover:shadow-card-hover">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link to="/processos/$id" params={{ id: p.id }} className="numero-processo text-sm font-semibold text-primary hover:underline">{p.numero}</Link>
                      <EtiquetasProcesso etiquetas={p.etiquetas} compact />
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{p.classe} · {p.assunto || "Sem assunto"} · Fase: {p.fase || "—"}</p>
                  </div>
                  {podeEditar ? <AcoesEtiquetasProcesso processoId={p.id} etiquetas={p.etiquetas} /> : null}
                </div>
                <dl className="mt-4 grid gap-3 border-t border-border pt-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <dt className="text-muted-foreground">Última movimentação</dt>
                    <dd className="mt-0.5 font-medium text-foreground">{formatarData(ult?.data ?? null)}</dd>
                    <dd className="text-muted-foreground">{ult?.descricao || "Nenhuma registrada"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Dias sem movimentação</dt>
                    <dd className="mt-0.5 font-semibold text-atencao">{dias} dias</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Próxima audiência</dt>
                    <dd className="mt-0.5 font-medium text-foreground">{formatarData(aud?.data ?? null)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Responsável</dt>
                    <dd className="mt-0.5 font-medium text-foreground">{p.responsavel || "—"}</dd>
                  </div>
                </dl>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
