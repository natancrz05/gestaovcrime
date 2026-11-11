import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  DIAS_REUSO_IA, elegivelParaReuso, numeroUnicoDoPdf, type ReferenciaRelatorio,
} from "../src/lib/prazos/reuso-calculos";

const caso = "8000373-72.2020.8.05.0067";
const outro = "8001226-71.2026.8.05.0067";
const base: ReferenciaRelatorio = {
  id: "7b138c14-49bf-4798-b92a-1fed5762f49b",
  processo_numero: caso,
  tipo_analise: "prescricao",
  modalidade_prisao: null,
  nome_reu: "JAILTON SANTOS DAMASCENO",
  data_referencia: "2026-11-01",
  criado_em: "2026-11-01T12:00:00.000Z",
};
const consulta = {
  numero: caso,
  tipo: "prescricao" as const,
  modalidade: null,
  nomeReu: "Jailton Santos Damasceno",
  dataReferencia: "2026-11-10",
  agora: new Date("2026-11-10T12:00:00Z"),
};

describe("Reaproveitamento de análises já realizadas", () => {
  test("01/11 e 10/11: avaliação anterior do mesmo processo é elegível", () => {
    expect(DIAS_REUSO_IA).toBe(30);
    expect(elegivelParaReuso(base, consulta)).toBe(true);
  });
  test("nunca mistura processos ou modalidades diferentes", () => {
    expect(elegivelParaReuso(base, { ...consulta, numero: outro })).toBe(false);
    expect(elegivelParaReuso(base, { ...consulta, tipo: "excesso" })).toBe(false);
  });
  test("não reutiliza decisão posterior à data selecionada nem relatório com mais de 30 dias", () => {
    expect(elegivelParaReuso(base, { ...consulta, dataReferencia: "2026-10-31" })).toBe(false);
    expect(elegivelParaReuso(base, { ...consulta, agora: new Date("2027-01-02T12:00:00Z") })).toBe(false);
  });
  test("réus distintos no mesmo processo exigem avaliações separadas", () => {
    expect(elegivelParaReuso(base, { ...consulta, nomeReu: "Outra Pessoa" })).toBe(false);
    expect(elegivelParaReuso(base, { ...consulta, nomeReu: "JAILTON SANTOS DAMASCENO" })).toBe(true);
  });
  test("prisão temporária não recebe avaliação marcada como preventiva", () => {
    const antiga: ReferenciaRelatorio = {
      ...base, tipo_analise: "prisao_provisoria", modalidade_prisao: "preventiva",
    };
    expect(elegivelParaReuso(antiga, { ...consulta, tipo: "prisao_provisoria", modalidade: "temporaria" })).toBe(false);
    expect(elegivelParaReuso(antiga, { ...consulta, tipo: "prisao_provisoria", modalidade: "preventiva" })).toBe(true);
  });
  test("somente número inequívoco extraído do conteúdo pode alimentar o reuso", () => {
    expect(numeroUnicoDoPdf("[Página 1] Processo " + caso + "\nRéu: Jailton Santos")).toBe(caso);
    expect(numeroUnicoDoPdf("Nenhuma numeração informada")).toBeNull();
    expect(numeroUnicoDoPdf("[Página 1] Processo " + caso + " — apenso " + outro)).toBeNull();
  });
});

describe("Separação entre relatórios institucionais e chats particulares", () => {
  const sql = readFileSync(new URL(
    "../supabase/migrations/20261111110000_calculos_ia_relatorios_compartilhados.sql", import.meta.url,
  ), "utf8");
  const tabela = sql.slice(sql.indexOf("create table"), sql.indexOf("create index"));
  test("tabela compartilhada não guarda IDs de chats, mensagens, prompts ou PDF", () => {
    expect(tabela).not.toMatch(/conversa_id|mensagem_id|prompt|arquivo_pdf|arquivo_original/i);
    expect(tabela).toContain("relatorio text");
    expect(tabela).toContain("autor_id uuid");
  });
  test("RLS exige usuário ativo, aprovado e função de servidor ou administrador", () => {
    expect(sql).toContain("enable row level security");
    expect(sql).toContain("status_cadastro = 'aprovado'");
    expect(sql).toContain("u.ativo = true");
    expect(sql).toContain("ur.role in ('administrador', 'servidor')");
    expect(sql).toContain("autor_id = (select auth.uid())");
  });
  test("sem UPDATE/DELETE e sem vazamento de autor_id nas colunas consultáveis", () => {
    const select = sql.match(/grant select \(([\s\S]*?)\)\s+on public.calculos_ia_relatorios to authenticated/i)?.[1] ?? "";
    expect(select).not.toContain("autor_id");
    expect(sql).not.toMatch(/grant\s+(?:update|delete)\b/i);
  });
});
