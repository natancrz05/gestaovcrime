import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, FlaskConical, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import { Cabecalho } from "@/components/ui-serventia/Cabecalho";
import { formatarData } from "@/lib/dominio";
import { processosAudienciasQuery } from "@/lib/processos/repositorio";
import {
  analisarSincronizacaoPautaBeta,
  type AcaoSincronizacaoBeta,
  type AnaliseSincronizacaoBeta,
} from "@/lib/processos/sincronizacao-pauta-beta-core";
import { cn } from "@/lib/utils";

export const Route = createFileRoute(
  "/_authenticated/audiencias-sincronizacao-beta",
)({
  head: () => ({
    meta: [
      { title: "Sincronização de pautas BETA — Gestão da Vara Criminal" },
      {
        name: "description",
        content: "Simulador isolado de reconciliação de pautas de audiência do PJe.",
      },
    ],
  }),
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(processosAudienciasQuery()),
  component: Pagina,
});

const ACAO_META: Record<
  AcaoSincronizacaoBeta,
  { rotulo: string; classe: string }
> = {
  "atualizacao-segura": {
    rotulo: "Atualização segura",
    classe: "border-concluido/30 bg-concluido-suave text-concluido",
  },
  "nova-candidata": {
    rotulo: "Nova candidata",
    classe: "border-info/30 bg-info-suave text-info",
  },
  "sem-alteracao": {
    rotulo: "Sem alteração",
    classe: "border-border bg-muted text-muted-foreground",
  },
  conferir: {
    rotulo: "Conferir",
    classe: "border-urgente/30 bg-urgente-suave text-urgente",
  },
  "processo-ausente": {
    rotulo: "Processo ausente",
    classe: "border-atencao/30 bg-atencao-suave text-atencao",
  },
  "resultado-complementar": {
    rotulo: "Resultado complementar",
    classe: "border-temporaria/30 bg-temporaria-suave text-temporaria",
  },
};

function Pagina() {
  const { data: processos } = useSuspenseQuery(processosAudienciasQuery());
  const [arquivo, setArquivo] = useState("");
  const [analise, setAnalise] = useState<AnaliseSincronizacaoBeta | null>(null);
  const [filtro, setFiltro] = useState<AcaoSincronizacaoBeta | "todos">("todos");
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState("");

  async function ler(file: File | undefined) {
    if (!file) return;
    setArquivo(file.name);
    setAnalise(null);
    setErro("");
    setLendo(true);
    try {
      const { lerPautaSincronizacaoBeta } = await import(
        "@/lib/processos/sincronizacao-pauta-beta"
      );
      const leitura = await lerPautaSincronizacaoBeta(file);
      setAnalise(
        analisarSincronizacaoPautaBeta(
          leitura.linhas,
          processos,
          leitura.erros,
        ),
      );
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao analisar a pauta.");
    } finally {
      setLendo(false);
    }
  }

  const exibidos = useMemo(() => {
    if (!analise) return [];
    return filtro === "todos"
      ? analise.itens
      : analise.itens.filter((item) => item.acao === filtro);
  }, [analise, filtro]);

  return (
    <div className="space-y-6">
      <Cabecalho
        titulo="Sincronização de pautas"
        subtitulo="BETA isolada · análise e reconciliação sem gravação"
        acao={
          <Link
            to="/audiencias"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-muted"
          >
            <ArrowLeft className="size-4" />
            Voltar para Audiências
          </Link>
        }
      />

      <div className="rounded-lg border border-atencao/30 bg-atencao-suave p-4">
        <div className="flex items-start gap-3">
          <FlaskConical className="mt-0.5 size-5 shrink-0 text-atencao" />
          <div>
            <p className="font-semibold text-foreground">
              Ambiente de teste — somente leitura
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Esta tela não cria processos, não cadastra audiências e não altera
              situações. Ela apenas compara a pauta com a base atual e mostra o
              que uma futura sincronização faria.
            </p>
          </div>
        </div>
      </div>

      <section className="rounded-lg border border-border bg-card p-4 shadow-card">
        <p className="font-medium text-foreground">Pauta do PJe</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Pode ser uma pauta extensa, inclusive anual. Conflitos de uma linha não
          bloqueiam a análise das demais.
        </p>
        <input
          type="file"
          accept=".pdf,application/pdf"
          disabled={lendo}
          onChange={(e) => void ler(e.target.files?.[0])}
          className="mt-3 block w-full text-sm"
        />
        {arquivo ? (
          <p className="mt-2 text-xs text-muted-foreground">Arquivo: {arquivo}</p>
        ) : null}
        {lendo ? (
          <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <Upload className="size-4" /> Lendo e reconciliando a pauta…
          </p>
        ) : null}
        {erro ? (
          <p className="mt-3 rounded-md border border-urgente/25 bg-urgente-suave p-3 text-sm text-urgente">
            {erro}
          </p>
        ) : null}
      </section>

      {analise ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <Resumo rotulo="Linhas lidas" valor={analise.totalLido} />
            <Resumo
              rotulo="Atualizações seguras"
              valor={analise.contagens["atualizacao-segura"]}
            />
            <Resumo
              rotulo="Novas candidatas"
              valor={analise.contagens["nova-candidata"]}
            />
            <Resumo
              rotulo="Sem alteração"
              valor={analise.contagens["sem-alteracao"]}
            />
            <Resumo rotulo="Conferir" valor={analise.contagens.conferir} />
            <Resumo
              rotulo="Processos ausentes"
              valor={analise.contagens["processo-ausente"]}
            />
          </section>

          <section className="rounded-lg border border-border bg-card p-4 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-foreground">
                  Resultado da simulação
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {analise.totalAnalisado} ocorrência(s) analisada(s)
                  {analise.duplicadasExatasIgnoradas
                    ? " · " +
                      analise.duplicadasExatasIgnoradas +
                      " repetição(ões) idêntica(s) ignorada(s)"
                    : ""}
                  {analise.errosLeitura.length
                    ? " · " + analise.errosLeitura.length + " erro(s) de leitura"
                    : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Filtro
                  ativo={filtro === "todos"}
                  onClick={() => setFiltro("todos")}
                  texto={"Todos (" + analise.itens.length + ")"}
                />
                {(Object.keys(ACAO_META) as AcaoSincronizacaoBeta[]).map(
                  (acao) => (
                    <Filtro
                      key={acao}
                      ativo={filtro === acao}
                      onClick={() => setFiltro(acao)}
                      texto={
                        ACAO_META[acao].rotulo +
                        " (" +
                        analise.contagens[acao] +
                        ")"
                      }
                    />
                  ),
                )}
              </div>
            </div>
          </section>

          {analise.errosLeitura.length ? (
            <section className="rounded-lg border border-urgente/25 bg-urgente-suave p-4">
              <p className="flex items-center gap-2 font-semibold text-urgente">
                <AlertTriangle className="size-4" />
                Pontos que o leitor não conseguiu interpretar
              </p>
              <ul className="mt-2 space-y-1 text-xs text-foreground">
                {analise.errosLeitura.slice(0, 30).map((item, i) => (
                  <li key={i}>
                    Página {item.pagina}
                    {item.numero ? " · " + item.numero : ""}: {item.motivo}
                  </li>
                ))}
              </ul>
              {analise.errosLeitura.length > 30 ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  +{analise.errosLeitura.length - 30} ocorrência(s) não exibida(s).
                </p>
              ) : null}
            </section>
          ) : null}

          <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-card">
            <table className="w-full min-w-[1180px] text-xs">
              <thead className="bg-muted/50 text-left text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Data</th>
                  <th className="px-3 py-2 font-medium">Processo</th>
                  <th className="px-3 py-2 font-medium">Audiência</th>
                  <th className="px-3 py-2 font-medium">PJe</th>
                  <th className="px-3 py-2 font-medium">Sistema</th>
                  <th className="px-3 py-2 font-medium">Classificação</th>
                  <th className="px-3 py-2 font-medium">Ação sugerida</th>
                  <th className="px-3 py-2 font-medium">Motivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {exibidos.map((item, i) => {
                  const meta = ACAO_META[item.acao];
                  return (
                    <tr
                      key={
                        item.numero +
                        "-" +
                        item.data +
                        "-" +
                        item.horario +
                        "-" +
                        item.tipo +
                        "-" +
                        item.situacao +
                        "-" +
                        i
                      }
                      className="align-top hover:bg-muted/30"
                    >
                      <td className="whitespace-nowrap px-3 py-2">
                        {formatarData(item.data)} {item.horario}
                        <span className="block text-[10px] text-muted-foreground">
                          pág. {item.pagina}
                        </span>
                      </td>
                      <td className="numero-processo whitespace-nowrap px-3 py-2 font-medium">
                        {item.processoId ? (
                          <Link
                            to="/processos/$id"
                            params={{ id: item.processoId }}
                            className="hover:underline"
                          >
                            {item.numero}
                          </Link>
                        ) : (
                          item.numero
                        )}
                      </td>
                      <td className="max-w-48 px-3 py-2">
                        {item.tipo}
                        {item.tipoOriginal !== item.tipo ? (
                          <span className="block text-[10px] text-muted-foreground">
                            PJe: {item.tipoOriginal}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 font-medium">
                        {item.situacaoOriginal}
                      </td>
                      <td className="px-3 py-2">
                        {item.situacaoSistema ?? "—"}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={cn(
                            "inline-flex rounded-full border px-2 py-0.5 font-medium",
                            meta.classe,
                          )}
                        >
                          {meta.rotulo}
                        </span>
                      </td>
                      <td className="max-w-64 px-3 py-2 font-medium">
                        {item.sugestao}
                      </td>
                      <td className="max-w-96 px-3 py-2 text-muted-foreground">
                        {item.motivo}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!exibidos.length ? (
              <p className="p-4 text-sm text-muted-foreground">
                Nenhuma ocorrência com este filtro.
              </p>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

function Resumo({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-card">
      <p className="text-2xl font-semibold tabular-nums text-foreground">{valor}</p>
      <p className="mt-1 text-xs text-muted-foreground">{rotulo}</p>
    </div>
  );
}

function Filtro({
  ativo,
  onClick,
  texto,
}: {
  ativo: boolean;
  onClick: () => void;
  texto: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={cn(
        "rounded-full border border-border px-3 py-1 text-xs",
        ativo ? "bg-primary text-primary-foreground" : "hover:bg-muted",
      )}
    >
      {texto}
    </button>
  );
}
