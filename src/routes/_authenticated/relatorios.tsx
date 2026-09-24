import { createFileRoute } from "@tanstack/react-router";
import { AvisoEtapa, Cabecalho, EstadoVazio } from "@/components/ui-serventia/Cabecalho";
import { obterIndicadores } from "@/lib/repositorio";

export const Route = createFileRoute("/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios — Gestão da Vara Criminal" },
      {
        name: "description",
        content: "Resumo quantitativo do acervo da Vara Criminal de Coração de Maria/BA.",
      },
      { property: "og:title", content: "Relatórios — Gestão da Vara Criminal" },
      {
        property: "og:description",
        content: "Resumo quantitativo do acervo da Vara Criminal de Coração de Maria/BA.",
      },
    ],
  }),
  component: Pagina,
});

function Pagina() {
  const indicadores = obterIndicadores();
  return (
    <div className="space-y-6">
      <Cabecalho
        titulo="Relatórios"
        subtitulo="Resumo quantitativo do acervo — dados fictícios de demonstração"
      />
      <AvisoEtapa>
        Exportação e relatórios detalhados serão desenvolvidos nas próximas etapas.
      </AvisoEtapa>

      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-card">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Indicador</th>
              <th className="px-4 py-3 font-medium">Descrição</th>
              <th className="px-4 py-3 text-right font-medium">Quantidade</th>
            </tr>
          </thead>
          <tbody>
            {indicadores.map((i) => (
              <tr key={i.chave} className="border-t border-border">
                <td className="px-4 py-3 font-medium">{i.titulo}</td>
                <td className="px-4 py-3 text-muted-foreground">{i.descricao}</td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums">{i.valor}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <EstadoVazio
        titulo="Relatórios periódicos"
        descricao="Aqui serão disponibilizados relatórios por período, por servidor responsável e por tipo de pendência, com exportação em planilha e PDF."
      />
    </div>
  );
}
