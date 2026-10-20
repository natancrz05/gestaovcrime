import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, ShieldCheck, Tags, Users } from "lucide-react";
import { usePode } from "@/lib/sessao";
import { CONFIG_INTEGRACAO_PJE } from "@/lib/integracao/pje";
import { Cabecalho } from "@/components/ui-serventia/Cabecalho";

export const Route = createFileRoute("/_authenticated/configuracoes/")({
  head: () => ({
    meta: [
      { title: "Configurações — Gestão da Vara Criminal" },
      {
        name: "description",
        content: "Configurações de acesso, etiquetas, auditoria e integrações do sistema.",
      },
      { property: "og:title", content: "Configurações — Gestão da Vara Criminal" },
      {
        property: "og:description",
        content: "Configurações de acesso, etiquetas, auditoria e integrações do sistema.",
      },
    ],
  }),
  component: Pagina,
});

function Pagina() {
  const admin = usePode("gerenciar-usuarios");
  return (
    <div className="space-y-6">
      <Cabecalho
        titulo="Configurações"
        subtitulo="Gerencie acessos, etiquetas, auditoria e integrações do sistema"
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
      <Link
        to="/configuracoes/etiquetas"
        className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 shadow-card hover:shadow-card-hover"
      >
        <Tags className="size-5 text-primary" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">Etiquetas</p>
          <p className="text-xs text-muted-foreground">Cadastrar e organizar etiquetas utilizadas na gestão dos processos</p>
        </div>
        <ChevronRight className="size-4 text-muted-foreground" />
      </Link>
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
