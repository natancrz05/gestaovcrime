/**
 * Preparação para a futura integração com o PJe/TJBA.
 *
 * NENHUMA conexão é feita nesta etapa. Este módulo apenas define os tipos,
 * rótulos e o contrato que a futura implementação (no servidor) deverá seguir.
 */

export const ORIGENS = [
  { valor: "manual", rotulo: "Cadastro manual" },
  { valor: "pje_tjba", rotulo: "PJe/TJBA" },
  { valor: "importacao_comparecimentos", rotulo: "Importação de comparecimentos (conferir)" },
] as const;
export type Origem = (typeof ORIGENS)[number]["valor"];
export const rotuloOrigem = (v: string | null | undefined) =>
  ORIGENS.find((o) => o.valor === v)?.rotulo ?? "Cadastro manual";

export const STATUS_SINCRONIZACAO = [
  { valor: "nao_sincronizado", rotulo: "Não sincronizado" },
  { valor: "sincronizado", rotulo: "Sincronizado" },
  { valor: "alteracao_pendente", rotulo: "Alteração pendente" },
  { valor: "erro", rotulo: "Erro" },
] as const;
export type StatusSincronizacao = (typeof STATUS_SINCRONIZACAO)[number]["valor"];
export const rotuloStatusSincronizacao = (v: string | null | undefined) =>
  STATUS_SINCRONIZACAO.find((s) => s.valor === v)?.rotulo ?? "Não sincronizado";

/** Situação atual exibida em Configurações. */
export const CONFIG_INTEGRACAO_PJE = {
  status: "Não configurado",
  ambiente: "TJBA — PJe 1º Grau",
  integracao: "Não conectada",
} as const;

/** Registro de auditoria das operações de integração (tabela integracao_log). */
export interface RegistroIntegracao {
  id: string;
  criado_em: string;
  processo_id: string | null;
  operacao: OperacaoIntegracao;
  resultado: "sucesso" | "erro" | "aviso";
  mensagem: string;
}

export type OperacaoIntegracao =
  | "consultar_processo"
  | "importar_processo"
  | "importar_partes"
  | "importar_movimentacoes"
  | "consultar_alteracoes"
  | "atualizar_processo";

/** Dados mínimos que a futura integração deverá devolver. */
export interface ProcessoExterno {
  idExterno: string;
  numero: string;
  classe: string;
  assunto: string;
  dataDistribuicao: string | null;
  ultimaAlteracao: string | null;
  partes: { nome: string; tipo: string }[];
  movimentacoes: { idExterno: string; data: string; descricao: string; tipo: string }[];
}

/**
 * Contrato do futuro conector. A implementação deverá rodar somente no
 * servidor, gravar cada operação em integracao_log e atualizar os campos de
 * sincronização do processo. Não implementado nesta etapa.
 */
export interface ConectorPje {
  consultarProcesso(numero: string): Promise<ProcessoExterno | null>;
  consultarAlteracoes(idExterno: string, desde: string | null): Promise<ProcessoExterno | null>;
}
