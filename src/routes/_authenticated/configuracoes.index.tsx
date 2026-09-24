import { createFileRoute } from "@tanstack/react-router";
import { AvisoEtapa, Cabecalho } from "@/components/ui-serventia/Cabecalho";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — Gestão da Vara Criminal" },
      {
        name: "description",
        content: "Parâmetros de funcionamento do sistema de gestão da serventia.",
      },
      { property: "og:title", content: "Configurações — Gestão da Vara Criminal" },
      {
        property: "og:description",
        content: "Parâmetros de funcionamento do sistema de gestão da serventia.",
      },
    ],
  }),
  component: Pagina,
});

const PARAMETROS = [
  {
    titulo: "Limite de dias sem movimentação",
    valor: "100 dias",
    descricao: "Critério para destacar processos parados no acervo.",
  },
  {
    titulo: "Janela de audiência próxima",
    valor: "30 dias",
    descricao: "Prazo em que a audiência passa a ser sinalizada como próxima.",
  },
  {
    titulo: "Janela de prazo próximo",
    valor: "7 dias",
    descricao: "Prazo em que a providência passa a ser sinalizada como urgente.",
  },
  {
    titulo: "Unidade judicial",
    valor: "Vara Criminal — Coração de Maria/BA",
    descricao: "Identificação exibida no cabeçalho do sistema.",
  },
];

function Pagina() {
  return (
    <div className="space-y-6">
      <Cabecalho
        titulo="Configurações"
        subtitulo="Parâmetros utilizados para classificar prioridades e alertas"
      />
      <AvisoEtapa>
        Nesta etapa os parâmetros são apenas exibidos. A edição, o controle de usuários e as
        permissões serão implementados posteriormente.
      </AvisoEtapa>

      <dl className="grid gap-3 md:grid-cols-2">
        {PARAMETROS.map((p) => (
          <div key={p.titulo} className="rounded-lg border border-border bg-card p-4 shadow-card">
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">{p.titulo}</dt>
            <dd className="mt-1 text-sm font-semibold text-foreground">{p.valor}</dd>
            <dd className="mt-1 text-xs text-muted-foreground">{p.descricao}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
