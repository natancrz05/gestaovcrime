import type { ProcessoCompleto } from "./processos/modelo";
import type { ComparecimentoListado } from "./processos/comparecimentos";
import type { ReuPresoBeta, ReavaliacaoBeta } from "./processos/alertas-beta";
import type { ControleOficio } from "./controle-oficios";
import type { GrupoAtencaoBeta } from "./processos/agrupamento-alertas";
import type { ValorCSV } from "./relatorios-csv";

export type TipoRelatorioCSV =
  | "processos" | "presos-provisorios" | "sem-movimentacao" | "audiencias"
  | "comparecimentos" | "pendencias" | "oficios" | "prioridades";

export interface LinhaParaCSV {
  chave: string;
  processoId?: string | null;
  celulas: (string | number)[];
}

export interface FontesDetalhesCSV {
  processos: readonly ProcessoCompleto[];
  presos: readonly ReuPresoBeta[];
  comparecimentos: readonly ComparecimentoListado[];
  oficios: readonly ControleOficio[];
  prioridades: readonly GrupoAtencaoBeta[];
  reavaliacoes?: readonly ReavaliacaoBeta[];
}

function data(valor: string | null | undefined): string {
  const textoData = valor?.trim() ?? "";
  if (!textoData) return "";
  const iso = /^\d{4}-\d{2}-\d{2}/.test(textoData)
    ? textoData.slice(0, 10)
    : /^\d{2}\/\d{2}\/\d{4}$/.test(textoData)
      ? textoData.slice(6) + "-" + textoData.slice(3, 5) + "-" + textoData.slice(0, 2)
      : "";
  if (!iso) return "";
  const ano = Number(iso.slice(0, 4));
  const mes = Number(iso.slice(5, 7));
  const dia = Number(iso.slice(8, 10));
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  if (d.getUTCFullYear() !== ano || d.getUTCMonth() + 1 !== mes || d.getUTCDate() !== dia) return "";
  return String(dia).padStart(2, "0") + "/" + String(mes).padStart(2, "0") + "/" + ano;
}

const texto = (v: unknown): string =>
  v === null || v === undefined || v === "—" ? "" : String(v);

const lista = (valores: Array<string | null | undefined>) =>
  [...new Set(valores.map((v) => v?.trim() ?? "").filter(Boolean))].join(" | ");

const resumoReus = (p: ProcessoCompleto) => lista(p.reus.map((r) => r.nome));
const presosDoProcesso = (p: ProcessoCompleto) => lista(p.reus.filter((r) => r.preso).map((r) => r.nome));

function campoPlanilha(dados: unknown, nomes: string[]): string {
  if (!dados || typeof dados !== "object" || Array.isArray(dados)) return "";
  const d = dados as Record<string, unknown>;
  for (const nome of nomes) {
    const valor = d[nome];
    if (typeof valor === "string" && valor.trim()) return valor.trim();
  }
  return "";
}

function diasAte(iso: string | null): number | "" {
  if (!iso) return "";
  const hoje = new Date();
  const ref = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return Math.round((Date.parse(iso.slice(0, 10) + "T00:00:00Z") - ref) / 86400000);
}

function diasEmCustodia(valor: string | null): number | "" {
  const brasileira = data(valor);
  if (!brasileira) return "";
  const iso = brasileira.slice(6) + "-" + brasileira.slice(3, 5) + "-" + brasileira.slice(0, 2);
  const dias = diasAte(iso);
  return dias === "" ? "" : -dias;
}

export const COLUNAS_CSV_EXTRAS: Record<TipoRelatorioCSV, readonly string[]> = {
  processos: [
    "Comarca", "Unidade", "Fase", "Responsável", "Réus cadastrados", "Qtd. réus",
    "Réus presos", "Qtd. presos", "Data da última movimentação", "Tipo da última movimentação",
    "Origem do cadastro", "Situação PJe", "Localização PJe", "Tarefas PJe",
    "Conclusão PJe", "Data da última movimentação PJe", "Descrição da movimentação PJe",
    "Data de cadastro no sistema",
  ],
  "presos-provisorios": [
    "Espécie cautelar informada", "Data da última reavaliação registrada",
    "Data de próxima revisão registrada", "Término da temporária informado",
    "Situação cadastral do réu", "Dias em custódia (contagem administrativa)", "Observações da prisão", "Cadastro do processo",
  ],
  "sem-movimentacao": [
    "Classe", "Assunto", "Status processual", "Fase", "Responsável", "Réus cadastrados",
    "Réus presos", "Distribuição", "Tipo da última movimentação", "Situação PJe",
    "Tarefas PJe", "Última movimentação PJe (data)",
  ],
  audiencias: [
    "Local / sala", "Data de realização", "Aguardando redesignação",
    "Observações da audiência", "Histórico de redesignações",
    "Réus cadastrados no processo", "Há preso provisório no processo",
    "Classe processual", "Fase processual",
  ],
  comparecimentos: [
    "Data de início", "Intervalo (meses)", "Dias até o próximo",
    "Exige conferência", "Motivo da conferência", "Processos informados",
    "Observações do cadastro", "Data de cadastro", "Último registro carregado (situação)",
    "Último registro carregado (observação)",
  ],
  pendencias: [
    "Tipo de pendência", "Descrição completa", "Dias até o prazo",
    "Atrasada", "Concluída", "Data de conclusão", "Data de cadastro",
    "Observações", "Classe processual",
  ],
  oficios: [
    "Ano", "Sequencial", "Data de expedição válida", "Data original informada",
    "Número original", "Processo original", "Histórico importado",
    "Fonte de importação", "Data de cadastro", "Última atualização",
  ],
  prioridades: [
    "Categoria principal", "Descrição principal", "Data limite prioritária",
    "Dias restantes", "Quantidade de motivos",
    "Detalhamento de todos os motivos", "Datas limite por motivo", "Categorias dos motivos",
  ],
};

/** Os detalhes partem das mesmas linhas já filtradas e autorizadas na tela. */
export function enriquecerRelatorioCSV(
  tipo: TipoRelatorioCSV,
  colunasVisiveis: readonly string[],
  linhasVisiveis: readonly LinhaParaCSV[],
  fontes: FontesDetalhesCSV,
): { colunas: string[]; linhas: ValorCSV[][] } {
  const processos = new Map(fontes.processos.map((p) => [p.id, p]));
  const presos = new Map(fontes.presos.map((p) => [p.id, p]));
  const comparecimentos = new Map(fontes.comparecimentos.map((c) => [c.id, c]));
  const oficios = new Map(fontes.oficios.map((o) => [o.id, o]));
  const prioridades = new Map(fontes.prioridades.map((g) => [g.id, g]));
  const audiencias = new Map(fontes.processos.flatMap((p) => p.audiencias.map((a) => [a.id, { a, p }] as const)));
  const pendencias = new Map(fontes.processos.flatMap((p) => p.pendencias.map((x) => [x.id, { x, p }] as const)));
  const revisoes = new Map<string, ReavaliacaoBeta>();
  for (const rev of fontes.reavaliacoes ?? []) {
    const anterior = revisoes.get(rev.reu_id);
    if (!anterior || rev.data_reavaliacao > anterior.data_reavaliacao) revisoes.set(rev.reu_id, rev);
  }

  const novasLinhas = linhasVisiveis.map((linha) => {
    let extras: ValorCSV[];
    const processo = processos.get(linha.processoId ?? linha.chave);
    switch (tipo) {
      case "processos": {
        const p = processo;
        extras = p ? [
          p.comarca, p.unidade, p.fase, p.responsavel, resumoReus(p), p.reus.length,
          presosDoProcesso(p), p.reus.filter((r) => r.preso).length,
          data(p.movimentacoes[0]?.data), p.movimentacoes[0]?.tipo,
          p.origem, p.pje_situacao, p.pje_localizacao, p.pje_tarefas,
          p.pje_concluso, data(p.pje_ultima_mov_data), p.pje_ultima_mov_descricao, data(p.criado_em),
        ] : Array(COLUNAS_CSV_EXTRAS[tipo].length).fill("");
        break;
      }
      case "presos-provisorios": {
        const p = presos.get(linha.chave);
        const dp = p?.dados_planilha;
        const ultima = revisoes.get(linha.chave);
        extras = p ? [
          p.especie_cautelar,
          data(ultima?.data_reavaliacao ?? campoPlanilha(dp, ["Última reavaliação", "Data da última reavaliação"])),
          data(ultima?.proxima_data),
          data(campoPlanilha(dp, ["Término de eventual prazo", "Término do prazo", "Termino do prazo"])),
          p.situacao, diasEmCustodia(p.data_prisao), p.observacoes, data(processo?.criado_em),
        ] : Array(COLUNAS_CSV_EXTRAS[tipo].length).fill("");
        break;
      }
      case "sem-movimentacao": {
        const p = processo;
        extras = p ? [
          p.classe, p.assunto, p.status, p.fase, p.responsavel, resumoReus(p),
          presosDoProcesso(p), data(p.data_distribuicao), p.movimentacoes[0]?.tipo,
          p.pje_situacao, p.pje_tarefas, data(p.pje_ultima_mov_data),
        ] : Array(COLUNAS_CSV_EXTRAS[tipo].length).fill("");
        break;
      }
      case "audiencias": {
        const item = audiencias.get(linha.chave);
        const a = item?.a;
        const p = item?.p;
        extras = a && p ? [
          a.local, data(a.data_realizacao), Boolean(a.aguardando_nova_data),
          a.observacao,
          (a.datas_anteriores ?? []).map((d) => data(d.data) + " " + texto(d.horario) + " (" + d.situacao + ")").join(" | "),
          resumoReus(p), p.reus.some((r) => r.preso), p.classe, p.fase,
        ] : Array(COLUNAS_CSV_EXTRAS[tipo].length).fill("");
        break;
      }
      case "comparecimentos": {
        const c = comparecimentos.get(linha.chave);
        extras = c ? [
          data(c.data_inicio), c.intervalo_meses, c.dias, c.conferir,
          c.motivo_conferencia, c.numeros_informados.join(" | "),
          c.observacao, data(c.criado_em), c.historico[0]?.situacao, c.historico[0]?.observacao,
        ] : Array(COLUNAS_CSV_EXTRAS[tipo].length).fill("");
        break;
      }
      case "pendencias": {
        const item = pendencias.get(linha.chave);
        const p = item?.x;
        extras = p ? [
          p.tipo, p.descricao, diasAte(p.prazo),
          !p.concluida && p.prazo !== null && diasAte(p.prazo) !== "" && Number(diasAte(p.prazo)) < 0,
          p.concluida, data(p.data_conclusao), data(p.criado_em),
          p.observacoes, item?.p.classe,
        ] : Array(COLUNAS_CSV_EXTRAS[tipo].length).fill("");
        break;
      }
      case "oficios": {
        const o = oficios.get(linha.chave);
        extras = o ? [
          o.ano, o.sequencial, data(o.data_expedicao), o.data_original,
          o.numero_original, o.processo_original, o.historico_importado,
          o.fonte_importacao, data(o.criado_em), data(o.atualizado_em),
        ] : Array(COLUNAS_CSV_EXTRAS[tipo].length).fill("");
        break;
      }
      case "prioridades": {
        const g = prioridades.get(linha.chave);
        extras = g ? [
          g.categoria, g.descricao, data(g.dataLimite), g.diasRestantes,
          g.motivos.length,
          g.motivos.map((m) => m.nivel + ": " + m.titulo + (m.descricao ? " — " + m.descricao : "")).join(" | "),
          g.motivos.map((m) => m.titulo + ": " + (data(m.dataLimite) || "sem data")).join(" | "),
          lista(g.motivos.map((m) => m.categoria)),
        ] : Array(COLUNAS_CSV_EXTRAS[tipo].length).fill("");
        break;
      }
    }
    if (extras.length !== COLUNAS_CSV_EXTRAS[tipo].length) {
      throw new Error("Inconsistência ao montar relatório detalhado: " + tipo);
    }
    return [...linha.celulas.map((c) => texto(c)), ...extras.map((c) => c ?? "")];
  });
  return { colunas: [...colunasVisiveis, ...COLUNAS_CSV_EXTRAS[tipo]], linhas: novasLinhas };
}
