import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Users } from "lucide-react";
import { usePode } from "@/lib/sessao";
import { CONFIG_INTEGRACAO_PJE } from "@/lib/integracao/pje";
import { AvisoEtapa, Cabecalho } from "@/components/ui-serventia/Cabecalho";

export const Route = createFileRoute("/_authenticated/configuracoes/")({
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
  const admin = usePode("gerenciar-usuarios");
  return (
    <div className="space-y-6">
      <Cabecalho
        titulo="Configurações"
        subtitulo="Parâmetros utilizados para classificar prioridades e alertas"
      />
      {admin ? (
        <Link
          to="/configuracoes/usuarios"
          className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 shadow-card hover:shadow-card-hover"
        >
          <Users className="size-5 text-primary" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">Usuários</p>
            <p className="text-xs text-muted-foreground">
              Cadastrar, editar, ativar/inativar e alterar perfis de acesso
            </p>
          </div>
          <ChevronRight className="size-4 text-muted-foreground" />
        </Link>
      ) : null}
      {admin ? (
        <Link
          to="/configuracoes/auditoria"
          className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 shadow-card hover:shadow-card-hover"
        >
          <ShieldCheck className="size-5 text-primary" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">Auditoria</p>
            <p className="text-xs text-muted-foreground">Consultar quem fez cada alteração, quando e qual ação</p>
          </div>
          <ChevronRight className="size-4 text-muted-foreground" />
        </Link>
      ) : null}
      <AvisoEtapa>Nesta etapa os parâmetros abaixo são apenas exibidos.</AvisoEtapa>

      <dl className="grid gap-3 md:grid-cols-2">
        {PARAMETROS.map((p) => (
          <div key={p.titulo} className="rounded-lg border border-border bg-card p-4 shadow-card">
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">{p.titulo}</dt>
            <dd className="mt-1 text-sm font-semibold text-foreground">{p.valor}</dd>
            <dd className="mt-1 text-xs text-muted-foreground">{p.descricao}</dd>
          </div>
        ))}
      </dl>

      <section className="space-y-3 rounded-lg border border-border bg-card p-4 shadow-card">
        <h2 className="text-base font-semibold text-foreground">Integração com PJe</h2>
        <dl className="grid gap-3 sm:grid-cols-3">
          {[
            ["Status", CONFIG_INTEGRACAO_PJE.status],
            ["Ambiente", CONFIG_INTEGRACAO_PJE.ambiente],
            ["Integração", CONFIG_INTEGRACAO_PJE.integracao],
          ].map(([t, v]) => (
            <div key={t}>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">{t}</dt>
              <dd className="mt-1 text-sm font-semibold text-foreground">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="text-xs text-muted-foreground">
          Estrutura preparada para futura integração oficial com o PJe do TJBA. Nenhuma conexão é realizada nesta etapa.
        </p>
      </section>
    </div>
  );
}
