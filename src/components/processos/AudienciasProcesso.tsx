import { useMemo, useState } from "react";
import {
  CalendarPlus,
  CheckCircle2,
  Pencil,
  RotateCcw,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CLASSE_CAMPO, Campo, Opcoes } from "@/components/processos/campos";
import { formatarData } from "@/lib/dominio";
import {
  MODALIDADES,
  SITUACOES_AUDIENCIA,
  TIPOS_AUDIENCIA,
  confirmarAudiencia,
  estaPendente,
  horaCurta,
  tipoAudienciaCanonico,
} from "@/lib/processos/audiencias";
import {
  removerAudiencia,
  salvarAudiencia,
  type AudienciaEntrada,
} from "@/lib/processos/repositorio";
import { hojeISO, type AudienciaProcesso } from "@/lib/processos/modelo";
import { cn } from "@/lib/utils";

const BOTAO =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60";
const BOTAO_SEC =
  "inline-flex h-8 items-center justify-center gap-1 rounded-md border border-border bg-background px-3 text-xs font-medium hover:bg-muted disabled:opacity-60";
const BOTAO_PERIGO =
  "inline-flex h-8 items-center justify-center gap-1 rounded-md border border-urgente/35 bg-background px-3 text-xs font-medium text-urgente hover:bg-urgente-suave disabled:opacity-60";

interface Props {
  processoId: string;
  numero: string;
  audiencias: AudienciaProcesso[];
  podeEditar: boolean;
  onAtualizar: () => Promise<unknown> | unknown;
}

type Edicao = {
  id?: string;
  inicial: AudienciaEntrada;
};

type Confirmacao = {
  audiencia: AudienciaProcesso;
  data: string;
  observacao: string;
  salvando?: boolean;
};

function entradaDe(a: AudienciaProcesso): AudienciaEntrada {
  return {
    processo_id: a.processo_id,
    tipo: tipoAudienciaCanonico(a.tipo),
    data: a.data,
    horario: a.horario ? a.horario.slice(0, 5) : null,
    modalidade: a.modalidade,
    local: a.local,
    situacao: a.situacao === "Designada" ? "Agendada" : a.situacao,
    observacao: a.observacao,
    aguardando_nova_data: !!a.aguardando_nova_data,
  };
}

function novaEntrada(processoId: string): AudienciaEntrada {
  return {
    processo_id: processoId,
    tipo: "Audiência de instrução e julgamento",
    data: hojeISO(),
    horario: "09:00",
    modalidade: "Presencial",
    local: "Sala de Audiências",
    situacao: "Agendada",
    observacao: "",
    aguardando_nova_data: false,
  };
}

export function AudienciasProcesso({
  processoId,
  numero,
  audiencias,
  podeEditar,
  onAtualizar,
}: Props) {
  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const [confirmacao, setConfirmacao] = useState<Confirmacao | null>(null);
  const [ocupadoId, setOcupadoId] = useState<string | null>(null);

  const ordenadas = useMemo(
    () =>
      [...audiencias].sort(
        (a, b) =>
          b.data.localeCompare(a.data) ||
          (b.horario ?? "").localeCompare(a.horario ?? ""),
      ),
    [audiencias],
  );

  async function atualizar() {
    await onAtualizar();
  }

  async function cancelar(a: AudienciaProcesso) {
    if (!window.confirm("Cancelar esta audiência? Ela permanecerá registrada no histórico.")) return;
    setOcupadoId(a.id);
    try {
      await salvarAudiencia({ ...entradaDe(a), situacao: "Cancelada", aguardando_nova_data: false }, a.id);
      await atualizar();
      toast.success("Audiência cancelada.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível cancelar a audiência.");
    } finally {
      setOcupadoId(null);
    }
  }

  async function excluir(a: AudienciaProcesso) {
    if (!window.confirm("Excluir definitivamente esta audiência?")) return;
    setOcupadoId(a.id);
    try {
      await removerAudiencia(a.id);
      await atualizar();
      toast.success("Audiência excluída.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível excluir a audiência.");
    } finally {
      setOcupadoId(null);
    }
  }

  function redesignar(a: AudienciaProcesso) {
    setEdicao({
      id: a.id,
      inicial: {
        ...entradaDe(a),
        situacao: "Redesignada",
        aguardando_nova_data: true,
      },
    });
  }

  async function confirmarRealizacao() {
    if (!confirmacao?.data) return;
    setConfirmacao({ ...confirmacao, salvando: true });
    try {
      await confirmarAudiencia(
        confirmacao.audiencia.id,
        confirmacao.data,
        confirmacao.observacao,
      );
      await atualizar();
      setConfirmacao(null);
      toast.success("Realização da audiência confirmada.");
    } catch (e) {
      setConfirmacao({ ...confirmacao, salvando: false });
      toast.error(e instanceof Error ? e.message : "Não foi possível confirmar a audiência.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm text-muted-foreground">
            {audiencias.length
              ? `${audiencias.length} audiência${audiencias.length === 1 ? "" : "s"} registrada${audiencias.length === 1 ? "" : "s"} neste processo.`
              : "Nenhuma audiência registrada neste processo."}
          </p>
        </div>
        {podeEditar ? (
          <button
            className={BOTAO}
            onClick={() => setEdicao({ inicial: novaEntrada(processoId) })}
          >
            <CalendarPlus className="size-4" /> Nova audiência
          </button>
        ) : null}
      </div>

      {ordenadas.length ? (
        <div className="space-y-2">
          {ordenadas.map((a) => {
            const pendente = estaPendente(a);
            const aguardando = !!a.aguardando_nova_data;
            return (
              <div
                key={a.id}
                className={cn(
                  "rounded-lg border border-border bg-card p-4",
                  a.situacao === "Cancelada" && "opacity-70",
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-foreground">{a.tipo}</p>
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[11px] font-medium",
                          a.situacao === "Realizada" && "border-sucesso/30 bg-sucesso-suave text-sucesso",
                          a.situacao === "Cancelada" && "border-border bg-muted text-muted-foreground",
                          pendente && a.situacao !== "Realizada" && "border-info/25 bg-info-suave text-info",
                        )}
                      >
                        {a.situacao === "Designada" ? "Agendada" : a.situacao}
                      </span>
                      {aguardando ? (
                        <span className="rounded-full border border-atencao/25 bg-atencao-suave px-2 py-0.5 text-[11px] font-medium text-atencao">
                          Aguardando nova data
                        </span>
                      ) : null}
                    </div>

                    <p className="mt-1 text-sm text-foreground">
                      {formatarData(a.data)} · {horaCurta(a.horario)}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {[a.modalidade, a.local].filter(Boolean).join(" · ") || "Local não informado"}
                    </p>
                    {a.data_realizacao ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Realizada em {formatarData(a.data_realizacao)}
                      </p>
                    ) : null}
                    {a.observacao ? (
                      <p className="mt-2 text-sm text-muted-foreground">{a.observacao}</p>
                    ) : null}
                    {a.datas_anteriores?.length ? (
                      <details className="mt-2 text-xs text-muted-foreground">
                        <summary className="cursor-pointer font-medium">Histórico de redesignações</summary>
                        <ul className="mt-1 space-y-1 pl-4">
                          {a.datas_anteriores.map((d, i) => (
                            <li key={i}>
                              {formatarData(d.data)} · {horaCurta(d.horario)} · {d.situacao}
                            </li>
                          ))}
                        </ul>
                      </details>
                    ) : null}
                  </div>

                  {podeEditar ? (
                    <div className="flex flex-wrap justify-end gap-2">
                      {pendente ? (
                        <button
                          className={BOTAO_SEC}
                          disabled={ocupadoId === a.id}
                          onClick={() =>
                            setConfirmacao({
                              audiencia: a,
                              data: hojeISO(),
                              observacao: "",
                            })
                          }
                        >
                          <CheckCircle2 className="size-3.5" /> Realizada
                        </button>
                      ) : null}

                      {pendente ? (
                        <button
                          className={BOTAO_SEC}
                          disabled={ocupadoId === a.id}
                          onClick={() => redesignar(a)}
                        >
                          <RotateCcw className="size-3.5" /> Redesignar
                        </button>
                      ) : null}

                      <button
                        className={BOTAO_SEC}
                        disabled={ocupadoId === a.id}
                        onClick={() => setEdicao({ id: a.id, inicial: entradaDe(a) })}
                      >
                        <Pencil className="size-3.5" /> Editar
                      </button>

                      {pendente ? (
                        <button
                          className={BOTAO_PERIGO}
                          disabled={ocupadoId === a.id}
                          onClick={() => cancelar(a)}
                        >
                          <XCircle className="size-3.5" /> Cancelar
                        </button>
                      ) : null}

                      <button
                        className={BOTAO_PERIGO}
                        disabled={ocupadoId === a.id}
                        onClick={() => excluir(a)}
                      >
                        <Trash2 className="size-3.5" /> Excluir
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      <Dialog open={!!edicao} onOpenChange={(aberto) => !aberto && setEdicao(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{edicao?.id ? "Editar audiência" : "Nova audiência"}</DialogTitle>
          </DialogHeader>
          {edicao ? (
            <FormAudienciaProcesso
              numero={numero}
              inicial={edicao.inicial}
              onSalvar={async (valores) => {
                await salvarAudiencia(valores, edicao.id);
                await atualizar();
                setEdicao(null);
                toast.success(edicao.id ? "Audiência atualizada." : "Audiência adicionada.");
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!confirmacao}
        onOpenChange={(aberto) => !aberto && setConfirmacao(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar realização da audiência</DialogTitle>
          </DialogHeader>
          {confirmacao ? (
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                {numero} · {confirmacao.audiencia.tipo} · agendada para{" "}
                {formatarData(confirmacao.audiencia.data)}{" "}
                {horaCurta(confirmacao.audiencia.horario)}.
              </p>
              <Campo rotulo="Data efetiva da realização">
                <input
                  type="date"
                  className={CLASSE_CAMPO}
                  value={confirmacao.data}
                  onChange={(e) =>
                    setConfirmacao({ ...confirmacao, data: e.target.value })
                  }
                />
              </Campo>
              <Campo rotulo="Observação (opcional)">
                <textarea
                  rows={3}
                  className={`${CLASSE_CAMPO} h-auto py-2`}
                  value={confirmacao.observacao}
                  onChange={(e) =>
                    setConfirmacao({ ...confirmacao, observacao: e.target.value })
                  }
                />
              </Campo>
              <div className="flex justify-end gap-2">
                <button className={BOTAO_SEC} onClick={() => setConfirmacao(null)}>
                  Voltar
                </button>
                <button
                  className={BOTAO}
                  disabled={!confirmacao.data || confirmacao.salvando}
                  onClick={confirmarRealizacao}
                >
                  {confirmacao.salvando ? "Confirmando…" : "Confirmar realização"}
                </button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FormAudienciaProcesso({
  numero,
  inicial,
  onSalvar,
}: {
  numero: string;
  inicial: AudienciaEntrada;
  onSalvar: (valores: AudienciaEntrada) => Promise<void>;
}) {
  const [v, setV] = useState(inicial);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  return (
    <form
      className="grid gap-3 md:grid-cols-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!v.data) {
          setErro("Informe a data da audiência.");
          return;
        }

        const aguardando =
          v.situacao === "Redesignada" &&
          !!v.aguardando_nova_data &&
          v.data === inicial.data &&
          (v.horario || "") === (inicial.horario || "");

        setSalvando(true);
        setErro("");
        try {
          await onSalvar({
            ...v,
            processo_id: inicial.processo_id,
            horario: v.horario || null,
            aguardando_nova_data: aguardando,
          });
        } catch (e) {
          setErro(e instanceof Error ? e.message : "Erro ao salvar a audiência.");
          setSalvando(false);
        }
      }}
    >
      <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm md:col-span-3">
        <span className="text-muted-foreground">Processo: </span>
        <span className="numero-processo font-medium">{numero}</span>
      </div>

      <Campo rotulo="Tipo de audiência">
        <select
          className={CLASSE_CAMPO}
          value={v.tipo}
          onChange={(e) => setV({ ...v, tipo: e.target.value })}
        >
          <Opcoes valores={TIPOS_AUDIENCIA} />
        </select>
      </Campo>

      <Campo rotulo="Data">
        <input
          type="date"
          className={CLASSE_CAMPO}
          value={v.data}
          onChange={(e) =>
            setV({ ...v, data: e.target.value, aguardando_nova_data: false })
          }
        />
      </Campo>

      <Campo rotulo="Horário">
        <input
          type="time"
          className={CLASSE_CAMPO}
          value={v.horario ?? ""}
          onChange={(e) => setV({ ...v, horario: e.target.value })}
        />
      </Campo>

      <Campo rotulo="Modalidade">
        <select
          className={CLASSE_CAMPO}
          value={v.modalidade}
          onChange={(e) => setV({ ...v, modalidade: e.target.value })}
        >
          <Opcoes valores={MODALIDADES} />
        </select>
      </Campo>

      <Campo rotulo="Local/sala">
        <select
          className={CLASSE_CAMPO}
          value={v.local}
          onChange={(e) => setV({ ...v, local: e.target.value })}
        >
          <option value="">Selecione</option>
          <option value="Sala de Audiências">Sala de Audiências</option>
          <option value="Sala do Júri">Sala do Júri</option>
          <option value="Videoconferência">Videoconferência</option>
          <option value="Outro">Outro</option>
        </select>
      </Campo>

      <Campo rotulo="Situação">
        <select
          className={CLASSE_CAMPO}
          value={v.situacao}
          onChange={(e) =>
            setV({
              ...v,
              situacao: e.target.value,
              aguardando_nova_data:
                e.target.value === "Redesignada" ? v.aguardando_nova_data : false,
            })
          }
        >
          <Opcoes valores={SITUACOES_AUDIENCIA} />
        </select>
      </Campo>

      {v.situacao === "Redesignada" ? (
        <div className="space-y-1 rounded-md border border-border bg-muted/30 p-3 text-sm md:col-span-3">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={!v.aguardando_nova_data}
              onChange={() => setV({ ...v, aguardando_nova_data: false })}
            />
            Informar nova data e horário
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={!!v.aguardando_nova_data}
              onChange={() =>
                setV({
                  ...v,
                  aguardando_nova_data: true,
                  data: inicial.data,
                  horario: inicial.horario,
                })
              }
            />
            Redesignada — aguardando nova data
          </label>
          <p className="text-xs text-muted-foreground">
            A audiência permanece no fluxo e as datas anteriores ficam preservadas.
          </p>
        </div>
      ) : null}

      <div className="md:col-span-3">
        <Campo rotulo="Observação">
          <textarea
            rows={3}
            className={`${CLASSE_CAMPO} h-auto py-2`}
            value={v.observacao}
            onChange={(e) => setV({ ...v, observacao: e.target.value })}
          />
        </Campo>
      </div>

      {erro ? <p className="text-sm text-urgente md:col-span-3">{erro}</p> : null}

      <div className="flex justify-end md:col-span-3">
        <button className={BOTAO} disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar audiência"}
        </button>
      </div>
    </form>
  );
}
