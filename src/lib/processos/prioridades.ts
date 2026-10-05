/**
 * Prioridades de gestão. Geram apenas ALERTAS DE GESTÃO — nunca afirmam
 * excesso de prazo, irregularidade ou qualquer conclusão jurídica.
 */
import {
  diasSemMovimentacao,
  estadoContagem100Dias,
  hojeISO,
  type PrioridadeProcesso,
  type ProcessoCompleto,
} from "./modelo";
import { itemCentral } from "./central";

/** Parâmetros ajustáveis. Futuramente poderão vir da tela de Configurações. */
export const CONFIG_PRIORIDADES = {
  limiteDiasSemMovimentacao: 100,
};

export type CategoriaPrioridade = "reu-preso" | "prisao-temporaria" | "sem-movimentacao" | "urgencia-audiencia" | "etiqueta-urgente" | "manual";

export const CATEGORIAS: {
  chave: CategoriaPrioridade;
  titulo: string;
  descricao: string;
  cor: "urgente" | "temporaria" | "atencao" | "alerta";
}[] = [
  { chave: "reu-preso", titulo: "Réus presos", descricao: "Pessoas atualmente custodiadas", cor: "urgente" },
  { chave: "prisao-temporaria", titulo: "Prisões temporárias", descricao: "Pessoas com prisão temporária registrada", cor: "temporaria" },
  {
    chave: "sem-movimentacao",
    titulo: `+${CONFIG_PRIORIDADES.limiteDiasSemMovimentacao} dias sem movimentação`,
    descricao: "Tempo desde a última movimentação registrada",
    cor: "atencao",
  },
  { chave: "etiqueta-urgente", titulo: "Alertas urgentes", descricao: "Processos marcados com etiqueta de nível urgente", cor: "urgente" },
  { chave: "manual", titulo: "Prioridades manuais", descricao: "Marcadas pelo servidor", cor: "alerta" },
];

export const COR_CLASSES = {
  urgente: { texto: "text-urgente", etiqueta: "bg-urgente-suave text-urgente border-urgente/25" },
  temporaria: { texto: "text-temporaria", etiqueta: "bg-temporaria-suave text-temporaria border-temporaria/25" },
  atencao: { texto: "text-atencao", etiqueta: "bg-atencao-suave text-atencao border-atencao/25" },
  alerta: { texto: "text-alerta", etiqueta: "bg-alerta-suave text-alerta border-alerta/30" },
} as const;

export const NIVEIS = [
  { v: "critico", r: "Crítico" },
  { v: "alta", r: "Urgente" },
  { v: "media", r: "Atenção" },
  { v: "conferir", r: "Conferir" },
  { v: "baixa", r: "Informativo" },
] as const;

export type EtiquetasPorProcesso = Record<string, { id: string; nome: string; cor: string; favorita: boolean }[]>;

export interface AlertaGestao {
  categoria: CategoriaPrioridade;
  rotulo: string;
  cor: keyof typeof COR_CLASSES;
  manual?: PrioridadeProcesso;
}

export function alertasDoProcesso(p: ProcessoCompleto, hoje = hojeISO(), etiquetasPorProcesso: EtiquetasPorProcesso = {}): AlertaGestao[] {
  const a: AlertaGestao[] = [];
  if (p.reus.some((r) => r.preso)) a.push({ categoria: "reu-preso", rotulo: "Réu preso", cor: "urgente" });
  if (p.reus.some((r) => r.preso && r.tipo_prisao === "Prisão temporária"))
    a.push({ categoria: "prisao-temporaria", rotulo: "Prisão temporária", cor: "temporaria" });
  const dias = diasSemMovimentacao(p, hoje);
  const contagem100 = estadoContagem100Dias(p);
  if (!contagem100.pausada && dias !== null && dias > CONFIG_PRIORIDADES.limiteDiasSemMovimentacao)
    a.push({ categoria: "sem-movimentacao", rotulo: `${dias} dias sem movimentação`, cor: "atencao" });
  const etiquetasUrgentes = (etiquetasPorProcesso[p.id] ?? []).filter((e) => e.cor === "urgente");
  if (etiquetasUrgentes.length)
    a.push({ categoria: "etiqueta-urgente", rotulo: `Alerta urgente — ${etiquetasUrgentes.map((e) => e.nome).join(", ")}`, cor: "urgente" });
  const c = itemCentral(p, hoje);
  if (c && c.dias !== null && c.nivel !== "normal")
    a.push({ categoria: "urgencia-audiencia", rotulo: `Urgência de audiência — ${c.dias} dias sem movimentação`, cor: c.nivel === "critica" ? "urgente" : "atencao" });
  const nivelRotulo = {
    critico: "crítico",
    alta: "urgente",
    media: "atenção",
    conferir: "conferir",
    baixa: "informativo",
  };
  for (const m of p.prioridades)
    a.push({ categoria: "manual", rotulo: `${m.titulo || m.motivo} (${nivelRotulo[m.nivel] ?? m.nivel})`, cor: "alerta", manual: m });
  return a;
}

export function temCategoria(p: ProcessoCompleto, c: CategoriaPrioridade, hoje = hojeISO(), etiquetasPorProcesso: EtiquetasPorProcesso = {}) {
  return alertasDoProcesso(p, hoje, etiquetasPorProcesso).some((a) => a.categoria === c);
}

const ORDEM: CategoriaPrioridade[] = ["reu-preso", "prisao-temporaria", "etiqueta-urgente", "sem-movimentacao", "urgencia-audiencia", "manual"];

/**
 * Ordena pela existência de alertas, na ordem fixa das categorias
 * (sem pontuação ou ranking jurídico).
 */
export function processosQueRequeremAtencao(lista: ProcessoCompleto[], hoje = hojeISO(), etiquetasPorProcesso: EtiquetasPorProcesso = {}) {
  return lista
    .map((p) => ({ processo: p, alertas: alertasDoProcesso(p, hoje, etiquetasPorProcesso) }))
    .filter((x) => x.alertas.length > 0)
    .sort((a, b) => {
      for (const c of ORDEM) {
        const d = Number(b.alertas.some((x) => x.categoria === c)) - Number(a.alertas.some((x) => x.categoria === c));
        if (d) return d;
      }
      return a.processo.numero.localeCompare(b.processo.numero);
    });
}
