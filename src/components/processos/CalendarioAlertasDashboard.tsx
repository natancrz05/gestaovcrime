import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatarData } from "@/lib/dominio";
import type { ItemAtencaoBeta, NivelAtencaoBeta } from "@/lib/processos/alertas-beta";
import { cn } from "@/lib/utils";

type ItemComData = ItemAtencaoBeta & { dataLimite: string };

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const DIAS = ["S", "T", "Q", "Q", "S", "S", "D"];

const ORDEM: Record<NivelAtencaoBeta, number> = {
  critico: 0,
  urgente: 1,
  atencao: 2,
  conferir: 3,
  informativo: 4,
  administrativo: 5,
};

function partesDoMes(mes: string) {
  const partes = mes.split("-");
  const ano = Number(partes[0]);
  const numero = Number(partes[1]);
  return {
    ano: Number.isFinite(ano) && ano > 0 ? ano : 2000,
    numero: Number.isFinite(numero) && numero >= 1 && numero <= 12 ? numero : 1,
  };
}

function deslocarMes(mes: string, delta: number) {
  const partes = partesDoMes(mes);
  const data = new Date(partes.ano, partes.numero - 1 + delta, 1);
  return String(data.getFullYear()) + "-" + String(data.getMonth() + 1).padStart(2, "0");
}

function classeDoNivel(nivel: NivelAtencaoBeta) {
  if (nivel === "critico") return "bg-urgente";
  if (nivel === "urgente") return "bg-alerta";
  if (nivel === "atencao") return "bg-atencao";
  if (nivel === "conferir") return "bg-temporaria";
  if (nivel === "informativo") return "bg-info";
  return "bg-muted-foreground";
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

export default function CalendarioAlertasDashboard({
  itens,
  hoje,
}: {
  itens: ItemAtencaoBeta[];
  hoje: string;
}) {
  const [mes, setMes] = useState(hoje.slice(0, 7));
  const [dataSelecionada, setDataSelecionada] = useState(hoje);

  const comData = useMemo(
    () =>
      itens
        .filter((item): item is ItemComData => Boolean(item.dataLimite))
        .sort(
          (a, b) =>
            a.dataLimite.localeCompare(b.dataLimite) ||
            ORDEM[a.nivel] - ORDEM[b.nivel],
        ),
    [itens],
  );

  const porData = useMemo(() => {
    const mapa = new Map<string, ItemComData[]>();
    for (const item of comData) {
      const lista = mapa.get(item.dataLimite) ?? [];
      lista.push(item);
      mapa.set(item.dataLimite, lista);
    }
    return mapa;
  }, [comData]);

  const partes = partesDoMes(mes);
  const ano = partes.ano;
  const numero = partes.numero;
  const diasNoMes = new Date(ano, numero, 0).getDate();
  const primeiroDia = new Date(ano, numero - 1, 1).getDay();
  const deslocamento = (primeiroDia + 6) % 7;
  const totalCelulas = Math.ceil((deslocamento + diasNoMes) / 7) * 7;

  const eventosSelecionados = porData.get(dataSelecionada) ?? [];
  const totalMes = comData.filter((item) => item.dataLimite.startsWith(mes)).length;

  return (
    <section aria-labelledby="calendario-alertas-dashboard" className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 id="calendario-alertas-dashboard" className="text-lg font-semibold text-foreground">
            Calendário de alertas
          </h2>
          <p className="text-sm text-muted-foreground">
            Prazos e ocorrências com data definida
          </p>
        </div>
        <Link to="/prioridades" className="text-xs font-medium text-primary hover:underline">
          Abrir central
        </Link>
      </div>

      <div className="rounded-lg border border-border bg-card p-3 shadow-card">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            aria-label="Mês anterior"
            onClick={() => setMes((atual) => deslocarMes(atual, -1))}
            className="inline-flex size-8 items-center justify-center rounded-md border border-border hover:bg-muted"
          >
            <ChevronLeft className="size-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              setMes(hoje.slice(0, 7));
              setDataSelecionada(hoje);
            }}
            className="text-sm font-semibold text-foreground hover:text-primary"
            title="Voltar para o mês atual"
          >
            {MESES[numero - 1]} {ano}
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {totalMes} alerta{totalMes === 1 ? "" : "s"}
            </span>
          </button>

          <button
            type="button"
            aria-label="Próximo mês"
            onClick={() => setMes((atual) => deslocarMes(atual, 1))}
            className="inline-flex size-8 items-center justify-center rounded-md border border-border hover:bg-muted"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        <div className="mt-3 grid grid-cols-7 text-center text-[10px] font-medium text-muted-foreground">
          {DIAS.map((dia, i) => (
            <div key={dia + "-" + i} className="py-1">
              {dia}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: totalCelulas }, (_, indice) => {
            const dia = indice - deslocamento + 1;
            if (dia < 1 || dia > diasNoMes) {
              return <div key={indice} className="aspect-square" />;
            }

            const data =
              String(ano) +
              "-" +
              String(numero).padStart(2, "0") +
              "-" +
              String(dia).padStart(2, "0");
            const eventos = porData.get(data) ?? [];
            const selecionado = dataSelecionada === data;
            const hojeCelula = data === hoje;
            const nivelMaisAlto = eventos.length
              ? [...eventos].sort((a, b) => ORDEM[a.nivel] - ORDEM[b.nivel])[0]?.nivel
              : null;

            return (
              <button
                key={data}
                type="button"
                onClick={() => setDataSelecionada(data)}
                className={cn(
                  "relative aspect-square rounded-md border text-xs transition-colors",
                  eventos.length
                    ? "border-border bg-background hover:bg-muted"
                    : "border-transparent hover:bg-muted/50",
                  selecionado && "ring-2 ring-primary/35",
                  hojeCelula && "font-semibold text-primary",
                )}
                title={
                  eventos.length
                    ? String(eventos.length) + " alerta(s) em " + formatarData(data)
                    : formatarData(data)
                }
              >
                {dia}
                {eventos.length ? (
                  <span className="absolute bottom-1 left-1/2 flex -translate-x-1/2 items-center gap-0.5">
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        nivelMaisAlto ? classeDoNivel(nivelMaisAlto) : "bg-muted-foreground",
                      )}
                    />
                    {eventos.length > 1 ? (
                      <span className="text-[9px] leading-none text-muted-foreground">
                        {eventos.length}
                      </span>
                    ) : null}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="mt-3 border-t border-border pt-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-foreground">
              {formatarData(dataSelecionada)}
            </p>
            {eventosSelecionados.length ? (
              <span className="text-[10px] text-muted-foreground">
                {eventosSelecionados.length} alerta{eventosSelecionados.length === 1 ? "" : "s"}
              </span>
            ) : null}
          </div>

          {eventosSelecionados.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum alerta nesta data.</p>
          ) : (
            <ul className="space-y-2">
              {eventosSelecionados.slice(0, 3).map((item) => (
                <li key={item.id} className="flex items-start gap-2 text-xs">
                  <span className={cn("mt-1 size-2 shrink-0 rounded-full", classeDoNivel(item.nivel))} />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{item.titulo}</p>
                    <p className="truncate text-muted-foreground">
                      {rotuloNivel(item.nivel)}
                      {item.processoNumero
                        ? " · " + item.processoNumero
                        : item.pessoa
                          ? " · " + item.pessoa
                          : ""}
                    </p>
                    {item.processoId && item.processoNumero ? (
                      <Link
                        to="/processos/$id"
                        params={{ id: item.processoId }}
                        className="mt-0.5 inline-block font-medium text-primary hover:underline"
                      >
                        Abrir processo
                      </Link>
                    ) : null}
                  </div>
                </li>
              ))}
              {eventosSelecionados.length > 3 ? (
                <li className="text-[10px] text-muted-foreground">
                  +{eventosSelecionados.length - 3} alerta
                  {eventosSelecionados.length - 3 === 1 ? "" : "s"} nesta data
                </li>
              ) : null}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
