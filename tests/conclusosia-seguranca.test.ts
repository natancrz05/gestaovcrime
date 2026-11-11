import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { autorizacaoParaReuso, documentoSinalizaSigilo, numeroUnicoDoPdf } from "../src/lib/prazos/reuso-calculos";

const numero = "8000373-72.2020.8.05.0067";
const texto = "[Página 1] Processo " + numero + "\nRÉU: JAILTON SANTOS DAMASCENO";
const base = {
  consentimento: true,
  texto,
  numero,
  nomeReu: "JAILTON SANTOS DAMASCENO",
  truncado: false,
  paginasSemTexto: [] as number[],
  paginas: 2,
  paginasLidas: 2,
};

describe("ConclusosIA — publicação institucional segura", () => {
  test("o padrão sem consentimento nunca compartilha resultado", () => {
    expect(autorizacaoParaReuso({ ...base, consentimento: false })).toBe(false);
    expect(autorizacaoParaReuso({ ...base, consentimento: true })).toBe(true);
  });
  test("PDF incompleto, truncado ou parcialmente ilegível fica privado", () => {
    expect(autorizacaoParaReuso({ ...base, truncado: true })).toBe(false);
    expect(autorizacaoParaReuso({ ...base, paginasSemTexto: [2] })).toBe(false);
    expect(autorizacaoParaReuso({ ...base, paginasLidas: 1 })).toBe(false);
    const { paginas: _paginas, ...semPaginas } = base;
    expect(autorizacaoParaReuso(semPaginas)).toBe(false);
  });
  test("número ou réu incerto bloqueia a publicação", () => {
    expect(autorizacaoParaReuso({ ...base, numero: null })).toBe(false);
    expect(autorizacaoParaReuso({ ...base, nomeReu: null })).toBe(false);
    expect(autorizacaoParaReuso({ ...base, texto: texto + "\n" + "8001226-71.2026.8.05.0067" })).toBe(false);
    expect(numeroUnicoDoPdf(texto)).toBe(numero);
  });
  test("indicadores judiciais de sigilo impedem compartilhamento", () => {
    const sigiloso = texto + "\nProcesso sigiloso";
    expect(documentoSinalizaSigilo(sigiloso)).toBe(true);
    expect(autorizacaoParaReuso({ ...base, texto: sigiloso })).toBe(false);
    expect(documentoSinalizaSigilo("GRAU DE SIGILO: 1")).toBe(true);
  });
  test("o banco exige consentimento em leitura e escrita", () => {
    const initial = readFileSync(new URL("../supabase/migrations/20261111110000_calculos_ia_relatorios_compartilhados.sql", import.meta.url), "utf8");
    const correction = readFileSync(new URL("../supabase/migrations/20261111123000_conclusosia_relatorios_consentimento_rls.sql", import.meta.url), "utf8");
    expect(initial).toContain("compartilhamento_autorizado = true");
    expect(correction).toContain("compartilhamento_autorizado = true");
    expect(correction).toContain("set compartilhamento_autorizado = false");
    expect(correction).toContain("drop policy if exists");
    expect(correction).not.toContain("service_role");
  });
  test("somente o relatório final é enviado à tabela, não o chat ou PDF", () => {
    const functionFile = readFileSync(new URL("../src/lib/assistente.functions.ts", import.meta.url), "utf8");
    expect(functionFile).toContain("autorizacaoParaReuso({");
    expect(functionFile).toContain("compartilhamento_autorizado: true");
    expect(functionFile).toContain("relatorio: resposta");
    const bloco = functionFile.slice(functionFile.indexOf('.from("calculos_ia_relatorios")\n        .insert('));
    expect(bloco).not.toMatch(/conversa_id:|pdf_original:|prompt:/);
  });
});

describe("ConclusosIA — identidade e navegação preservadas", () => {
  test("a marca está presente na página, navegação e chat sem trocar a rota original", () => {
    const sidebar = readFileSync(new URL("../src/components/layout/BarraLateral.tsx", import.meta.url), "utf8");
    const route = readFileSync(new URL("../src/routes/_authenticated/assistente.tsx", import.meta.url), "utf8");
    const chat = readFileSync(new URL("../src/components/assistente/AssistenteChat.tsx", import.meta.url), "utf8");
    expect(sidebar).toContain('rotulo: "ConclusosIA"');
    expect(route).toContain('createFileRoute("/_authenticated/assistente")');
    expect(route).toContain("ConclusosIA");
    expect(chat).toContain("ConclusosIA");
  });
  test("nenhuma resposta de erro do gateway é registrada em logs", () => {
    const gateway = readFileSync(new URL("../src/lib/assistente-lovable.ts", import.meta.url), "utf8");
    expect(gateway).not.toContain("console.error(\"AI gateway\", res.status, t)");
    expect(gateway).toContain('console.error("AI gateway: status HTTP"');
  });
});
