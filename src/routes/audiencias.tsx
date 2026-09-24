import { createFileRoute } from "@tanstack/react-router";
import { Cabecalho } from "@/components/ui-serventia/Cabecalho";
import { Etiqueta } from "@/components/ui-serventia/Etiqueta";
import { diasAte, formatarData } from "@/lib/dominio";
import { listarAudiencias } from "@/lib/repositorio";

export const Route = createFileRoute("/audiencias")({
  head: () => ({
    meta: [
      { title: "Audiências — Gestão da Vara Criminal" },
      {
        name: "description",
        content: "Pauta de audiências designadas na Vara Criminal de Coração de Maria/BA.",
      },
      { property: "og:title", content: "Audiências — Gestão da Vara Criminal" },
      {
        property: "og:description",
        content: "Pauta de audiências designadas na Vara Criminal de Coração de Maria/BA.",
      },
    ],
  }),
  component: Pagina,
});

function Pagina() {
  const audiencias = listarAudiencias();

  return (
    <div className="space-y-6">
      <Cabecalho
        titulo="Audiências"
        subtitulo="Pauta em ordem cronológica, com destaque para as datas próximas"
      />

      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-card">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Processo</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium">Data</th>
              <th className="px-4 py-3 font-medium">Local</th>
              <th className="px-4 py-3 font-medium">Situação</th>
              <th className="px-4 py-3 font-medium">Prazo</th>
            </tr>
          </thead>
          <tbody>
            {audiencias.map((a) => {
              const dias = diasAte(a.data) ?? 0;
              const proxima = dias <= 30;
              return (
                <tr key={a.id} className="border-t border-border">
                  <td className="numero-processo px-4 py-3 font-medium">{a.processoNumero}</td>
                  <td className="px-4 py-3 text-muted-foreground">{a.tipo}</td>
                  <td className="px-4 py-3 font-medium">{formatarData(a.data)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{a.local}</td>
                  <td className="px-4 py-3 text-muted-foreground">{a.situacao}</td>
                  <td className="px-4 py-3">
                    <Etiqueta severidade={proxima ? "alerta" : "info"}>
                      {proxima ? `Em ${dias} dias` : "Data distante"}
                    </Etiqueta>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
