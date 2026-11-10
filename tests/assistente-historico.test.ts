import { describe, expect, test } from "bun:test";
import { tituloInicialDaConversa } from "../src/lib/assistente-historico";

describe("Histórico privado do Assistente", () => {
  test("gera título curto a partir da primeira pergunta", () => {
    expect(tituloInicialDaConversa("  Analisar   prescrição\nno processo 800...  "))
      .toBe("Analisar prescrição no processo 800...");
  });

  test("usa título padrão quando a primeira mensagem está vazia", () => {
    expect(tituloInicialDaConversa("  \n  ")).toBe("Análise de documento");
  });

  test("limita títulos longos sem excluir o sentido inicial", () => {
    const titulo = tituloInicialDaConversa("A".repeat(160));
    expect(titulo.length).toBeLessThanOrEqual(86);
    expect(titulo.endsWith("…")).toBe(true);
  });
});
