import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatarData } from "@/lib/dominio";
import type {
  ItemAtencaoBeta,
  NivelAtencaoBeta,
} from "@/lib/processos/alertas-beta";
import { cn } from "@/lib/utils";

type ItemComData = ItemAtencaoBeta & { dataLimite: string };

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

const ORDEM_NIVEL: Record<NivelAtencaoBeta, number> = {
  critico: 0,
  urgente: 1,
  atencao: 2,
  conferir: 3,
  informativo: 4,
  administrativo: 5,
};

function classeNivel(nivel: NivelAtencaoBeta) {
  if (nivel === "critico") return "border-urgente/35 bg-urgente-suave text-urgente";
  if (nivel === "urgente") return "border-alerta/35 bg-alerta-suave text-alerta";
  if (nivel === "atencao") return "border-atencao/35 bg-atencao-suave text-atencao";
  if (nivel === "conferir") return "border-temporaria/35 bg-temporaria-suave text-temporaria";
  if (nivel === "informativo") return "border-info/30 bg-info/10 text-info";
  return "border-border bg-muted text-muted-foreground";
}

function rotuloNivel(nivel: NivelAtencaoBeta) {
  const mapa: Record<NivelAtencaoBeta, string> = {
    critico: "Crítico",
    urgente: "Urgente",
    atencao: "Atenção",
    conferir: "Conferir",
    informativo: "Informativo",
    administrativo: "Administrativo",
  };
  return mapa[nivel];
}

function mesAnterior(mes: string) {
  const [ano, numero] = mes.split("-").map(Number);
  const data = new Date(ano, numero - 2, 1);
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
}

function mesSeguinte(mes: string) {
  const [ano, numero] = mes.split("-").map(Number);
  const data = new Date(ano, numero, 1);
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
}

function textoSituacao(item: ItemAtencaoBeta) {
  if (item.diasRestantes === null) return "Data registrada";
  if (item.diasRestantes < 0) {
    const dias = Math.abs(item.diasRestantes);
    return `${dias} dia${dias === 1 ? "" : "s"} em atraso`;
  }
  if (item.diasRestantes === 0) return "Vence hoje";
  return `Faltam ${item.diasRestantes} dia${item.diasRestantes === 1 ? "" : "s"}`;
}

export default function CalendarioAlertas({
  itens,
  hoje,
}: {
  itens: ItemAtencaoBeta[];
  hoje: string;
}) {
  const [mes, setMes] = useState(hoje.slice(0, 7));
  const [selecionado, setSelecionado] = useState<ItemComData | null>(null);

  const comData = useMemo(
    () =>
      itens
        .filter((item): item is ItemComData => Boolean(item.dataLimite))
        .sort(
          (a, b) =>
            a.dataLimite.localeCompare(b.dataLimite) ||
            ORDEM_NIVEL[a.nivel] - ORDEM_NIVEL[b.nivel] ||
            (a.processoNumero ?? a.titulo).localeCompare(
              b.processoNumero ?? b.titulo,
              "pt-BR",
            ),
        ),
    [itens],
  );

  const [ano, numeroMes] = mes.split("-").map(Number);
  const diasNoMes = new Date(ano, numeroMes, 0).getDate();
  const primeiroDia = new Date(ano, numeroMes - 1, 1).getDay();
  const deslocamento = (primeiroDia + 6) % 7;
  const totalCelulas = Math.ceil((deslocamento + diasNoMes) / 7) * 7;

  const itensDoMes = useMemo(
    () => comData.filter((item) => item.dataLimite.startsWith(mes)),
    [comData, mes],
  );

  const porData = useMemo(() => {
    const mapa = new Map<string, ItemComData[]>();
    for (const item of itensDoMes) {
      const lista = mapa.get(item.dataLimite) ?? [];
      lista.push(item);
      mapa.set(item.dataLimite, lista);
    }
    return mapa;
  }, [itensDoMes]);

  const indicadores = useMemo(
    () => ({
      atrasados: comData.filter((item) => (item.diasRestantes ?? 0) < 0).length,
      hoje: comData.filter((item) => item.diasRestantes === 0).length,
      proximos7: comData.filter(
        (item) =>
          item.diasRestantes !== null &&
          item.diasRestantes >= 1 &&
          item.diasRestantes <= 7,
      ).length,
    }),
    [comData],
  );

  return (
    <section className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Resumo rotulo="Atrasados" valor={indicadores.atrasados} />
        <Resumo rotulo="Vencem hoje" valor={indicadores.hoje} />
        <Resumo rotulo="Próximos 7 dias" valor={indicadores.proximos7} />
      </div>

      <div className="rounded-lg border border-border bg-card shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <div className="flex items-center gap-2">
              <CalendarDays className="size-4 text-primary" />
              <h2 className="font-semibold text-foreground">
                {MESES[numeroMes - 1]} de {ano}
              </h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {itensDoMes.length} alerta{itensDoMes.length === 1 ? "" : "s"} com data neste mês
            </p>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setMes(mesAnterior(mes))}
              className="inline-flex size-9 items-center justify-center rounded-md border border-border bg-background hover:bg-muted"
              aria-label="Mês anterior"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setMes(hoje.slice(0, 7))}
              className="inline-flex h-9 items-center rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-muted"
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={() => setMes(mesSeguinte(mes))}
              className="inline-flex size-9 items-center justify-center rounded-md border border-border bg-background hover:bg-muted"
              aria-label="Próximo mês"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[900px]">
            <div className="grid grid-cols-7 border-b border-border bg-muted/40">
              {DIAS.map((dia) => (
                <div
                  key={dia}
                  className="px-2 py-2 text-center text-xs font-medium text-muted-foreground"
                >
                  {dia}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {Array.from({ length: totalCelulas }, (_, indice) => {
                const dia = indice - deslocamento + 1;
                if (dia < 1 || dia > diasNoMes) {
                  return (
                    <div
                      key={indice}
                      className="min-h-32 border-b border-r border-border bg-muted/15"
                    />
                  );
                }

                const data = `${ano}-${String(numeroMes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
                const eventos = porData.get(data) ?? [];
                const hojeCelula = data === hoje;

                return (
                  <div
                    key={data}
                    className={cn(
                      "min-h-32 border-b border-r border-border p-2",
                      hojeCelula && "bg-primary/5",
                    )}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span
                        className={cn(
                          "inline-flex size-6 items-center justify-center rounded-full text-xs font-medium",
                          hojeCelula && "bg-primary text-primary-foreground",
                        )}
                      >
                        {dia}
                      </span>
                      {eventos.length ? (
                        <span className="text-[10px] text-muted-foreground">
                          {eventos.length}
                        </span>
                      ) : null}
                    </div>

                    <div className="space-y-1">
                      {eventos.slice(0, 3).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setSelecionado(item)}
                          title={item.titulo}
                          className={cn(
                            "block w-full rounded border px-1.5 py-1 text-left text-[10px] leading-tight transition-opacity hover:opacity-80",
                            classeNivel(item.nivel),
                          )}
                        >
                          <span className="block truncate font-medium">
                            {item.processoNumero ?? item.pessoa ?? item.categoria}
                          </span>
                          <span className="block truncate opacity-80">{item.titulo}</span>
                        </button>
                      ))}
                      {eventos.length > 3 ? (
                        <p className="px-1 text-[10px] font-medium text-muted-foreground">
                          +{eventos.length - 3} outro{eventos.length - 3 === 1 ? "" : "s"}
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <p className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
        O calendário exibe apenas alertas que possuem uma data concreta. Alertas sem data permanecem disponíveis na Central.
      </p>

      <Dialog
        open={Boolean(selecionado)}
        onOpenChange={(aberto) => !aberto && setSelecionado(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selecionado?.titulo ?? "Alerta"}</DialogTitle>
          </DialogHeader>

          {selecionado ? (
            <div className="space-y-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-xs font-medium",
                    classeNivel(selecionado.nivel),
                  )}
                >
                  {rotuloNivel(selecionado.nivel)}
                </span>
                <span className="text-muted-foreground">
                  {selecionado.categoria} · {selecionado.modulo}
                </span>
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Data
                </p>
                <p className="mt-1 font-medium">
                  {formatarData(selecionado.dataLimite)} · {textoSituacao(selecionado)}
                </p>
              </div>

              {selecionado.processoNumero ? (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Processo
                  </p>
                  {selecionado.processoId ? (
                    <Link
                      to="/processos/$id"
                      params={{ id: selecionado.processoId }}
                      className="numero-processo mt-1 inline-block font-medium text-primary hover:underline"
                    >
                      {selecionado.processoNumero}
                    </Link>
                  ) : (
                    <p className="numero-processo mt-1">{selecionado.processoNumero}</p>
                  )}
                </div>
              ) : null}

              {selecionado.pessoa ? (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Pessoa
                  </p>
                  <p className="mt-1">{selecionado.pessoa}</p>
                </div>
              ) : null}

              {selecionado.descricao ? (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Detalhes
                  </p>
                  <p className="mt-1 leading-relaxed text-muted-foreground">
                    {selecionado.descricao}
                  </p>
                </div>
              ) : null}

              <p className="text-xs text-muted-foreground">
                Origem: {selecionado.origem}
              </p>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function Resumo({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3 shadow-card">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {rotulo}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
        {valor}
      </p>
    </div>
  );
}
