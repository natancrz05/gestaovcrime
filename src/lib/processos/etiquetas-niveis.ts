import type { Severidade } from "@/lib/dominio";

export type NivelCorEtiqueta =
  | "critico"
  | "urgente"
  | "atencao"
  | "conferir"
  | "informativo"
  | "concluido";

export const OPCOES_COR_ETIQUETA: {
  valor: NivelCorEtiqueta;
  rotulo: string;
  severidade: Severidade;
}[] = [
  { valor: "critico", rotulo: "Crítico", severidade: "urgente" },
  { valor: "urgente", rotulo: "Urgente", severidade: "alerta" },
  { valor: "atencao", rotulo: "Atenção", severidade: "atencao" },
  { valor: "conferir", rotulo: "Conferir", severidade: "conferir" },
  { valor: "informativo", rotulo: "Informativo", severidade: "info" },
  { valor: "concluido", rotulo: "Concluído", severidade: "concluido" },
];

export function normalizarCorEtiqueta(cor: string): NivelCorEtiqueta {
  if (cor === "default" || cor === "info") return "informativo";
  if (cor === "alerta") return "atencao";
  if (OPCOES_COR_ETIQUETA.some((opcao) => opcao.valor === cor)) return cor as NivelCorEtiqueta;
  return "informativo";
}

export function opcaoCorEtiqueta(cor: string) {
  const normalizada = normalizarCorEtiqueta(cor);
  return OPCOES_COR_ETIQUETA.find((opcao) => opcao.valor === normalizada) ?? OPCOES_COR_ETIQUETA[4];
}

export function severidadeDaCorEtiqueta(cor: string): Severidade {
  return opcaoCorEtiqueta(cor).severidade;
}
