import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { diasEntre, hojeISO, type ProcessoCompleto } from "./modelo";
import { somarMeses, type Comparecimento } from "./comparecimentos";
import { tipoPrisaoDe } from "./importacao-reus";
import { normalizarCorEtiqueta } from "./etiquetas-niveis";
import { alertasDoProcesso, type EtiquetasPorProcesso } from "./prioridades";

export type NivelAtencaoBeta =
  | "critico"
  | "urgente"
  | "atencao"
  | "informativo"
  | "conferir"
  | "administrativo";

export type OrigemAtencaoBeta = "Automático" | "Manual" | "Etiqueta" | "Administrativo";

export interface ItemAtencaoBeta {
  id: string;
  processoId: string | null;
  processoNumero: string | null;
  pessoa: string | null;
  categoria: string;
  titulo: string;
  descricao: string;
  nivel: NivelAtencaoBeta;
  origem: OrigemAtencaoBeta;
  modulo: string;
  dataLimite: string | null;
  diasRestantes: number | null;
}

export interface ReuPresoBeta {
  id: string;
  processo_id: string | null;
  nome: string;
  preso: boolean;
  tipo_prisao: string;
  especie_cautelar: string;
  data_prisao: string | null;
  situacao: string;
  observacoes: string;
  dados_planilha: unknown;
  processos: { numero: string } | null;
}

export interface ReavaliacaoBeta {
  reu_id: string;
  data_reavaliacao: string;
  proxima_data: string | null;
}

export interface PrisaoEncerradaBeta {
  reu_id: string;
  data_encerramento: string;
  data_prisao: string | null;
}

export interface ImportacaoBeta {
  id: string;
  criado_em: string;
  arquivo: string;
  status: string;
}

export interface DadosAuxiliaresAlertasBeta {
  reavaliacoes: ReavaliacaoBeta[];
  encerramentos: PrisaoEncerradaBeta[];
  ultimaImportacao: ImportacaoBeta | null;
  reavaliacoesDisponiveis: boolean;
  encerramentosDisponiveis: boolean;
  importacoesDisponiveis: boolean;
}

export const DADOS_VAZIOS_ALERTAS_BETA: DadosAuxiliaresAlertasBeta = {
  reavaliacoes: [],
  encerramentos: [],
  ultimaImportacao: null,
  reavaliacoesDisponiveis: true,
  encerramentosDisponiveis: true,
  importacoesDisponiveis: true,
};

export const alertasOcultosBetaQuery = () =>
  queryOptions({
    queryKey: ["alertas-beta", "ocultos"],
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from("alertas_ocultos")
        .select("alerta_chave");
      if (error) throw error;
      return (data ?? []).map((x) => x.alerta_chave);
    },
  });

export async function ocultarAlertaBeta(alertaChave: string) {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("alertas_ocultos")
    .upsert(
      {
        alerta_chave: alertaChave,
        criado_por: userData.user?.id ?? null,
      },
      { onConflict: "alerta_chave", ignoreDuplicates: true },
    );
  if (error) throw error;
}

export function chaveOcultacaoAlertaBeta(item: ItemAtencaoBeta): string {
  if (item.dataLimite) return `${item.id}|${item.dataLimite}`;
  if (item.id === "base-pje") return `${item.id}|${item.descricao}`;
  return item.id;
}

async function consultarReavaliacoesBeta(reuIds?: string[]) {
  if (reuIds?.length === 0) {
    return { data: [] as ReavaliacaoBeta[], error: null };
  }
  let consulta = supabase
    .from("reu_reavaliacoes")
    .select("reu_id, data_reavaliacao, proxima_data")
    .order("data_reavaliacao", { ascending: false });
  if (reuIds) consulta = consulta.in("reu_id", reuIds);
  const { data, error } = await consulta;
  return { data: (data ?? []) as ReavaliacaoBeta[], error };
}

async function consultarEncerramentosBeta(reuIds?: string[]) {
  if (reuIds?.length === 0) {
    return { data: [] as PrisaoEncerradaBeta[], error: null };
  }
  let consulta = supabase
    .from("reu_prisoes_encerradas")
    .select("reu_id, data_encerramento, data_prisao")
    .order("data_encerramento", { ascending: false });
  if (reuIds) consulta = consulta.in("reu_id", reuIds);
  const { data, error } = await consulta;
  return { data: (data ?? []) as PrisaoEncerradaBeta[], error };
}

export const dadosAuxiliaresAlertasBetaQuery = (reuIds?: string[] | null) => {
  const ids = reuIds === null ? null : reuIds ? [...new Set(reuIds.filter(Boolean))].sort() : undefined;
  return queryOptions({
    queryKey: ["alertas-beta", "dados-auxiliares", ids ?? "todos"],
    enabled: reuIds !== null,
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: async (): Promise<DadosAuxiliaresAlertasBeta> => {
      const idsConsulta = ids ?? undefined;
      const [reavaliacoes, encerramentos, importacao] = await Promise.all([
        consultarReavaliacoesBeta(idsConsulta),
        consultarEncerramentosBeta(idsConsulta),
        supabase
          .from("importacoes")
          .select("id, criado_em, arquivo, status")
          .is("desfeita_em", null)
          .neq("status", "Falhou")
          .order("criado_em", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      return {
        reavaliacoes: reavaliacoes.error ? [] : reavaliacoes.data,
        encerramentos: encerramentos.error ? [] : encerramentos.data,
        ultimaImportacao: importacao.error ? null : ((importacao.data ?? null) as ImportacaoBeta | null),
        reavaliacoesDisponiveis: !reavaliacoes.error,
        encerramentosDisponiveis: !encerramentos.error,
        importacoesDisponiveis: !importacao.error,
      };
    },
  });
};

const semAcento = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();

function objeto(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function normalizarData(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  let iso = "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) iso = s;
  else {
    const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) iso = `${m[3]}-${m[2]}-${m[1]}`;
  }
  if (!iso) return null;
  const partes = iso.split("-").map(Number);
  const a = partes[0];
  const m = partes[1];
  const d = partes[2];
  if (a === undefined || m === undefined || d === undefined) return null;
  const dt = new Date(Date.UTC(a, m - 1, d));
  if (dt.getUTCFullYear() !== a || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return iso;
}

function somarDiasISO(iso: string, dias: number): string {
  const partes = iso.split("-").map(Number);
  const a = partes[0];
  const m = partes[1];
  const d = partes[2];
  if (a === undefined || m === undefined || d === undefined) {
    throw new Error("Data ISO inválida.");
  }
  const dt = new Date(Date.UTC(a, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + dias);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

function dataLocalDeTimestamp(timestamp: string): string {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function maiorData(datas: Array<string | null | undefined>): string | null {
  const validas = datas.filter((d): d is string => Boolean(d)).sort();
  return validas.length ? validas[validas.length - 1] ?? null : null;
}

function tipoCustodia(p: ReuPresoBeta) {
  return p.especie_cautelar?.trim() ? tipoPrisaoDe(p.especie_cautelar) : p.tipo_prisao;
}

function origemDoAlerta(categoria: string): OrigemAtencaoBeta {
  if (categoria === "manual") return "Manual";
  if (categoria === "etiqueta-urgente") return "Etiqueta";
  return "Automático";
}

function moduloDoAlerta(categoria: string): string {
  if (categoria === "reu-preso" || categoria === "prisao-temporaria") return "Presos Provisórios";
  if (categoria === "urgencia-audiencia") return "Audiências";
  return "Processos";
}

function categoriaExistente(categoria: string): string {
  const mapa: Record<string, string> = {
    "reu-preso": "Réu preso",
    "prisao-temporaria": "Prisão temporária",
    "sem-movimentacao": "+100 dias",
    "urgencia-audiencia": "Audiência",
    "etiqueta-urgente": "Alerta urgente",
    manual: "Prioridade manual",
  };
  return mapa[categoria] ?? categoria;
}

function nivelDoAlertaExistente(
  categoria: string,
  cor: "urgente" | "temporaria" | "atencao" | "alerta",
  manual?: { nivel: "critico" | "alta" | "media" | "conferir" | "baixa" },
): NivelAtencaoBeta {
  // +100 dias e audiência permanecem consultáveis, mas não ocupam
  // as faixas de Atenção/Urgente, reservadas a providências com prazo próximo.
  if (categoria === "sem-movimentacao" || categoria === "urgencia-audiencia") return "informativo";
  if (manual) {
    if (manual.nivel === "critico") return "critico";
    if (manual.nivel === "alta") return "urgente";
    if (manual.nivel === "media") return "atencao";
    if (manual.nivel === "conferir") return "conferir";
    return "informativo";
  }
  if (cor === "urgente") return "urgente";
  if (cor === "atencao" || cor === "temporaria") return "atencao";
  return "informativo";
}

function item(
  parcial: Omit<ItemAtencaoBeta, "descricao" | "dataLimite" | "diasRestantes"> &
    Partial<Pick<ItemAtencaoBeta, "descricao" | "dataLimite" | "diasRestantes">>,
): ItemAtencaoBeta {
  return {
    descricao: "",
    dataLimite: null,
    diasRestantes: null,
    ...parcial,
  };
}

export interface StatusBasePjeBeta {
  atualizadoHoje: boolean;
  diasSemAtualizacao: number | null;
  rotulo: string;
  detalhe: string;
}

export function statusBasePjeBeta(
  dados: DadosAuxiliaresAlertasBeta,
  hoje = hojeISO(),
): StatusBasePjeBeta {
  if (!dados.importacoesDisponiveis) {
    return {
      atualizadoHoje: false,
      diasSemAtualizacao: null,
      rotulo: "Não foi possível conferir a atualização",
      detalhe: "O histórico de importações não está disponível para esta sessão.",
    };
  }
  if (!dados.ultimaImportacao) {
    return {
      atualizadoHoje: false,
      diasSemAtualizacao: null,
      rotulo: "Sem atualização registrada",
      detalhe: "Nenhuma importação válida do acervo foi localizada.",
    };
  }
  const data = dataLocalDeTimestamp(dados.ultimaImportacao.criado_em);
  const dias = Math.max(0, diasEntre(data, hoje));
  return {
    atualizadoHoje: dias === 0,
    diasSemAtualizacao: dias,
    rotulo: dias === 0 ? "Base PJe atualizada hoje" : `${dias} dia${dias === 1 ? "" : "s"} sem atualização`,
    detalhe: `Última importação: ${data} · ${dados.ultimaImportacao.arquivo || "arquivo não informado"}`,
  };
}

export function montarItensAtencaoBeta(params: {
  processos: ProcessoCompleto[];
  presos: ReuPresoBeta[];
  comparecimentos: Comparecimento[];
  etiquetasPorProcesso?: EtiquetasPorProcesso;
  auxiliares?: DadosAuxiliaresAlertasBeta;
  hoje?: string;
}): ItemAtencaoBeta[] {
  const {
    processos,
    presos,
    comparecimentos,
    etiquetasPorProcesso = {},
    auxiliares = DADOS_VAZIOS_ALERTAS_BETA,
    hoje = hojeISO(),
  } = params;

  const itens: ItemAtencaoBeta[] = [];

  // Mantém as prioridades já existentes no sistema dentro da visão beta,
  // sem alterar o motor consolidado atual.
  for (const processo of processos) {
    const alertas = alertasDoProcesso(processo, hoje, etiquetasPorProcesso);
    alertas.forEach((a, indice) => {
      // O beta não transforma a simples condição de "réu preso" ou "prisão temporária"
      // em alerta. Prisões entram pela regra específica de prazo/revisão abaixo.
      if (
        a.categoria === "reu-preso" ||
        a.categoria === "prisao-temporaria" ||
        a.categoria === "etiqueta-urgente"
      ) return;
      itens.push(
        item({
          id: `existente:${processo.id}:${a.categoria}:${a.manual?.id ?? indice}`,
          processoId: processo.id,
          processoNumero: processo.numero,
          pessoa: processo.reus.find((r) => r.preso)?.nome ?? processo.reus[0]?.nome ?? null,
          categoria: categoriaExistente(a.categoria),
          titulo: a.rotulo,
          nivel: nivelDoAlertaExistente(a.categoria, a.cor, a.manual),
          origem: origemDoAlerta(a.categoria),
          modulo: moduloDoAlerta(a.categoria),
          descricao: a.manual?.observacao ?? "",
        }),
      );
    });

    for (const etiqueta of etiquetasPorProcesso[processo.id] ?? []) {
      const cor = normalizarCorEtiqueta(etiqueta.cor);
      if (cor === "concluido") continue;

      const nivelEtiqueta: Record<
        Exclude<typeof cor, "concluido">,
        NivelAtencaoBeta
      > = {
        critico: "critico",
        urgente: "urgente",
        atencao: "atencao",
        conferir: "conferir",
        informativo: "informativo",
      };

      itens.push(
        item({
          id: `etiqueta:${processo.id}:${etiqueta.id}`,
          processoId: processo.id,
          processoNumero: processo.numero,
          pessoa: processo.reus.find((r) => r.preso)?.nome ?? processo.reus[0]?.nome ?? null,
          categoria: "Etiqueta",
          titulo: etiqueta.nome,
          descricao: "Etiqueta aplicada ao processo.",
          nivel: nivelEtiqueta[cor],
          origem: "Etiqueta",
          modulo: "Processos",
        }),
      );
    }
  }

  const reavaliacoesPorReu = new Map<string, string>();
  for (const r of auxiliares.reavaliacoes) {
    const data = normalizarData(r.data_reavaliacao);
    if (!data) continue;
    const atual = reavaliacoesPorReu.get(r.reu_id);
    if (!atual || data > atual) reavaliacoesPorReu.set(r.reu_id, data);
  }

  const encerramentosPorReu = new Map<string, string>();
  for (const e of auxiliares.encerramentos) {
    const data = normalizarData(e.data_encerramento);
    if (!data) continue;
    const atual = encerramentosPorReu.get(e.reu_id);
    if (!atual || data > atual) encerramentosPorReu.set(e.reu_id, data);
  }

  for (const preso of presos) {
    if (!preso.preso) continue;
    const numero = preso.processos?.numero ?? null;
    const dados = objeto(preso.dados_planilha);
    const tipo = tipoCustodia(preso);

    if (!preso.processo_id || !numero) {
      itens.push(
        item({
          id: `preso-sem-processo:${preso.id}`,
          processoId: preso.processo_id ?? null,
          processoNumero: numero,
          pessoa: preso.nome,
          categoria: "Preso sem processo vinculado",
          titulo: "Preso provisório sem processo principal corretamente vinculado",
          descricao: "O cadastro está ativo como preso provisório, mas o processo principal não foi localizado/vinculado.",
          nivel: "conferir",
          origem: "Automático",
          modulo: "Presos Provisórios",
        }),
      );
    }

    const ultimaEncerrada = encerramentosPorReu.get(preso.id) ?? null;
    const textoSituacao = semAcento(
      [preso.situacao, preso.observacoes, dados["Situação"], dados["Situacao"]]
        .filter(Boolean)
        .join(" "),
    );
    const textoContraditorio = /\b(SOLT[OA]?|LIBERAD[OA]?|REVOGAD[OA]?|RELAXAD[OA]?|ENCERRAD[OA]?)\b/.test(textoSituacao);
    const historicoContraditorio =
      Boolean(ultimaEncerrada) &&
      (!preso.data_prisao || (ultimaEncerrada as string) >= preso.data_prisao);

    if (textoContraditorio || historicoContraditorio) {
      itens.push(
        item({
          id: `inconsistencia-prisional:${preso.id}`,
          processoId: preso.processo_id,
          processoNumero: numero,
          pessoa: preso.nome,
          categoria: "Inconsistência prisional",
          titulo: "Conferir situação prisional",
          descricao: historicoContraditorio
            ? `O cadastro consta como preso, mas há encerramento registrado em ${ultimaEncerrada} sem prisão posterior identificada.`
            : "O cadastro consta como preso, mas a situação/observação contém indicação de soltura, liberação, revogação, relaxamento ou encerramento.",
          nivel: "conferir",
          origem: "Automático",
          modulo: "Presos Provisórios",
        }),
      );
    }

    if (tipo === "Prisão preventiva") {
      const chavesBase = [
        "Última reavaliação",
        "Data da última reavaliação",
        "Data da decisão da preventiva",
        "Data da decisão preventiva",
      ];
      const dataPlanilha = maiorData(chavesBase.map((k) => normalizarData(dados[k])));
      const dataHistorico = reavaliacoesPorReu.get(preso.id) ?? null;
      const base = maiorData([dataHistorico, dataPlanilha]);

      if (!base) {
        itens.push(
          item({
            id: `preventiva-sem-base:${preso.id}`,
            processoId: preso.processo_id,
            processoNumero: numero,
            pessoa: preso.nome,
            categoria: "Revisão da preventiva",
            titulo: "Preventiva sem data-base confiável",
            descricao: auxiliares.reavaliacoesDisponiveis
              ? "Não há decisão/reavaliação registrada que permita calcular com segurança o controle de 90 dias."
              : "O histórico de reavaliações não pôde ser consultado e não há data-base confiável nos dados disponíveis.",
            nivel: "conferir",
            origem: "Automático",
            modulo: "Presos Provisórios",
          }),
        );
      } else {
        const limite = somarDiasISO(base, 90);
        const dias = diasEntre(hoje, limite);
        let nivel: NivelAtencaoBeta | null = null;
        if (dias <= 0) nivel = "critico";
        else if (dias <= 5) nivel = "urgente";
        else if (dias <= 15) nivel = "atencao";

        if (nivel) {
          const descricao =
            dias < 0
              ? `O marco de 90 dias foi ultrapassado há ${Math.abs(dias)} dia${Math.abs(dias) === 1 ? "" : "s"} sem nova reavaliação registrada.`
              : dias === 0
                ? "O controle de 90 dias é atingido hoje."
                : `Faltam ${dias} dias para o marco de 90 dias.`;
          itens.push(
            item({
              id: `revisao-preventiva:${preso.id}`,
              processoId: preso.processo_id,
              processoNumero: numero,
              pessoa: preso.nome,
              categoria: "Revisão da preventiva",
              titulo: "Revisão da prisão preventiva",
              descricao: `${descricao} Data-base utilizada: ${base}.`,
              nivel,
              origem: "Automático",
              modulo: "Presos Provisórios",
              dataLimite: limite,
              diasRestantes: dias,
            }),
          );
        }
      }
    }

    if (tipo === "Prisão temporária") {
      const termino = maiorData([
        normalizarData(dados["Término de eventual prazo"]),
        normalizarData(dados["Termino de eventual prazo"]),
        normalizarData(dados["Término do prazo"]),
        normalizarData(dados["Termino do prazo"]),
      ]);
      if (termino) {
        const dias = diasEntre(hoje, termino);
        let nivel: NivelAtencaoBeta | null = null;
        if (dias <= 1) nivel = "critico";
        else if (dias <= 5) nivel = "urgente";
        else if (dias <= 15) nivel = "atencao";

        if (nivel) {
          itens.push(
            item({
              id: `prisao-temporaria-prazo:${preso.id}`,
              processoId: preso.processo_id,
              processoNumero: numero,
              pessoa: preso.nome,
              categoria: "Prisão temporária",
              titulo: "Término da prisão temporária",
              descricao:
                dias < 0
                  ? `O término registrado foi ultrapassado há ${Math.abs(dias)} dia${Math.abs(dias) === 1 ? "" : "s"}.`
                  : dias === 0
                    ? "O término registrado é hoje."
                    : `Faltam ${dias} dia${dias === 1 ? "" : "s"} para o término registrado.`,
              nivel,
              origem: "Automático",
              modulo: "Presos Provisórios",
              dataLimite: termino,
              diasRestantes: dias,
            }),
          );
        }
      }
    }
  }

  for (const processo of processos) {
    for (const pendencia of processo.pendencias) {
      if (pendencia.concluida || pendencia.status === "Concluída" || !pendencia.prazo) continue;
      const prazo = normalizarData(pendencia.prazo);
      if (!prazo) continue;
      const dias = diasEntre(hoje, prazo);
      let nivel: NivelAtencaoBeta | null = null;
      if (dias < 0) nivel = "critico";
      else if (dias <= 1) nivel = "urgente";
      else if (dias <= 3) nivel = "atencao";
      if (!nivel) continue;

      itens.push(
        item({
          id: `pendencia-prazo:${pendencia.id}`,
          processoId: processo.id,
          processoNumero: processo.numero,
          pessoa: processo.reus[0]?.nome ?? null,
          categoria: "Pendência com prazo",
          titulo: pendencia.titulo || pendencia.descricao || "Pendência processual",
          descricao:
            dias < 0
              ? `Prazo ultrapassado há ${Math.abs(dias)} dia${Math.abs(dias) === 1 ? "" : "s"}.`
              : dias === 0
                ? "Prazo vence hoje."
                : `Prazo vence em ${dias} dia${dias === 1 ? "" : "s"}.`,
          nivel,
          origem: "Automático",
          modulo: "Pendências",
          dataLimite: prazo,
          diasRestantes: dias,
        }),
      );
    }
  }

  for (const comparecimento of comparecimentos) {
    if (comparecimento.situacao === "Encerrado") continue;
    const proximo = normalizarData(comparecimento.proximo);
    if (!proximo || proximo >= hoje) continue;
    const houveRegistroPosterior = comparecimento.comparecimento_registros.some((r) => {
      const realizada = normalizarData(r.data_realizada);
      return Boolean(realizada && realizada >= proximo);
    });
    if (houveRegistroPosterior) continue;

    const disparo = somarMeses(proximo, 1);
    if (hoje < disparo) continue;
    const atraso = diasEntre(proximo, hoje);

    itens.push(
      item({
        id: `comparecimento-inadimplente:${comparecimento.id}`,
        processoId: comparecimento.processo_id,
        processoNumero: comparecimento.processos?.numero ?? comparecimento.numeros_informados?.[0] ?? null,
        pessoa: comparecimento.pessoa,
        categoria: "Comparecimento não registrado",
        titulo: "Comparecimento sem registro após 1 mês de inadimplência",
        descricao: `Comparecimento previsto para ${proximo}; não há registro posterior nem encerramento do acompanhamento.`,
        nivel: "critico",
        origem: "Automático",
        modulo: "Comparecimentos",
        dataLimite: proximo,
        diasRestantes: -atraso,
      }),
    );
  }

  const base = statusBasePjeBeta(auxiliares, hoje);
  if (!base.atualizadoHoje) {
    itens.push(
      item({
        id: "base-pje",
        processoId: null,
        processoNumero: null,
        pessoa: null,
        categoria: "Base PJe",
        titulo: base.rotulo,
        descricao: base.detalhe,
        nivel: "administrativo",
        origem: "Administrativo",
        modulo: "Processos",
      }),
    );
  }

  const ordemNivel: Record<NivelAtencaoBeta, number> = {
    critico: 0,
    urgente: 1,
    atencao: 2,
    conferir: 3,
    informativo: 4,
    administrativo: 5,
  };

  return itens.sort(
    (a, b) =>
      ordemNivel[a.nivel] - ordemNivel[b.nivel] ||
      (a.dataLimite ?? "9999-12-31").localeCompare(b.dataLimite ?? "9999-12-31") ||
      (a.processoNumero ?? a.pessoa ?? a.titulo).localeCompare(
        b.processoNumero ?? b.pessoa ?? b.titulo,
        "pt-BR",
      ),
  );
}
