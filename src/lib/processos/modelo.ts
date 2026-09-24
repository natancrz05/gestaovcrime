/**
 * Modelo de dados do módulo de Processos.
 * Apenas registra informações fornecidas pelo servidor — nenhuma conclusão
 * jurídica é derivada automaticamente destes dados.
 */

export const STATUS_PROCESSO = [
  "Ativo",
  "Suspenso",
  "Arquivado",
  "Baixado",
  "Aguardando providência",
  "Outro",
] as const;
export type StatusProcesso = (typeof STATUS_PROCESSO)[number];

export const TIPOS_PARTE = [
  "Réu",
  "Vítima",
  "Ministério Público",
  "Assistente de acusação",
  "Defesa",
  "Outro",
] as const;
export type TipoParte = (typeof TIPOS_PARTE)[number];

export const TIPOS_PRISAO = [
  "Prisão preventiva",
  "Prisão temporária",
  "Prisão em flagrante",
  "Outra",
  "Não preso",
] as const;
export type TipoPrisao = (typeof TIPOS_PRISAO)[number];

export const TIPOS_MOVIMENTACAO = [
  "Despacho",
  "Decisão",
  "Sentença",
  "Petição",
  "Manifestação",
  "Intimação",
  "Certidão",
  "Audiência",
  "Mandado",
  "Carta precatória",
  "Juntada",
  "Outro",
] as const;
export type TipoMovimentacao = (typeof TIPOS_MOVIMENTACAO)[number];

export interface Parte {
  id: string;
  processo_id: string;
  nome: string;
  tipo: string;
  observacao: string;
}

export interface Reu {
  id: string;
  processo_id: string;
  nome: string;
  situacao: string;
  preso: boolean;
  tipo_prisao: string;
  data_prisao: string | null;
  observacoes: string;
  ordem: number;
}

export interface Movimentacao {
  id: string;
  processo_id: string;
  data: string;
  descricao: string;
  tipo: string;
  observacao: string;
  criado_em: string;
}

export interface ObservacaoInterna {
  id: string;
  processo_id: string;
  texto: string;
  criado_em: string;
}

export interface AudienciaProcesso {
  id: string;
  processo_id: string;
  data: string;
  tipo: string;
  local: string;
  situacao: string;
  horario: string | null;
  modalidade: string;
  observacao: string;
  criado_em: string;
}

export interface PendenciaProcesso {
  id: string;
  processo_id: string;
  titulo: string;
  descricao: string;
  tipo: string;
  prazo: string | null;
  prioridade: "baixa" | "media" | "alta";
  status: string;
  responsavel: string;
  observacoes: string;
  criado_em: string;
  data_conclusao: string | null;
  concluida: boolean;
}

export interface PrioridadeProcesso {
  id: string;
  processo_id: string;
  motivo: string;
  titulo: string;
  nivel: "alta" | "media" | "baixa";
  observacao: string;
  criado_em: string;
}

export interface ProcessoCompleto {
  id: string;
  numero: string;
  classe: string;
  assunto: string;
  comarca: string;
  unidade: string;
  data_distribuicao: string | null;
  status: string;
  fase: string;
  observacao_geral: string;
  responsavel: string;
  criado_em: string;
  /** Preparação para integração futura com PJe/TJBA. */
  origem?: string;
  id_externo?: string | null;
  sync_status?: string;
  ultima_sincronizacao?: string | null;
  ultima_alteracao_externa?: string | null;
  sync_erro?: string | null;
  partes: Parte[];
  reus: Reu[];
  movimentacoes: Movimentacao[];
  observacoes_internas: ObservacaoInterna[];
  audiencias: AudienciaProcesso[];
  pendencias: PendenciaProcesso[];
  prioridades: PrioridadeProcesso[];
}

/** Data de hoje no formato ISO (AAAA-MM-DD), no fuso local. */
export function hojeISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${dia}`;
}

/** Dias corridos entre duas datas ISO (sem horário). */
export function diasEntre(inicioISO: string, fimISO: string): number {
  const a = Date.UTC(+inicioISO.slice(0, 4), +inicioISO.slice(5, 7) - 1, +inicioISO.slice(8, 10));
  const b = Date.UTC(+fimISO.slice(0, 4), +fimISO.slice(5, 7) - 1, +fimISO.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

export function ultimaMovimentacao(p: ProcessoCompleto): Movimentacao | null {
  if (p.movimentacoes.length === 0) return null;
  return (
    [...p.movimentacoes].sort(
      (a, b) => b.data.localeCompare(a.data) || b.criado_em.localeCompare(a.criado_em),
    )[0] ?? null
  );
}

/** "X dias sem movimentação" — calculado a partir da última movimentação e da data atual. */
export function diasSemMovimentacao(p: ProcessoCompleto, hoje = hojeISO()): number | null {
  const u = ultimaMovimentacao(p);
  return u ? diasEntre(u.data, hoje) : null;
}

export function reuPrincipal(p: ProcessoCompleto): Reu | null {
  return [...p.reus].sort((a, b) => a.ordem - b.ordem)[0] ?? null;
}

export function proximaAudiencia(p: ProcessoCompleto, hoje = hojeISO()): AudienciaProcesso | null {
  return (
    p.audiencias.filter((a) => a.data >= hoje).sort((a, b) => a.data.localeCompare(b.data))[0] ??
    null
  );
}

export function pendenciasAbertas(p: ProcessoCompleto): PendenciaProcesso[] {
  return p.pendencias.filter((x) => !x.concluida);
}
