import { describe, expect, test } from "bun:test";
import { percentualProgresso } from "../src/components/processos/EstadoProcessamentoImportacao";

describe("Percentual real das importações", () => {
  test("retorna zero antes de conhecer o total", () => {
    expect(percentualProgresso(null)).toBe(0);
    expect(percentualProgresso({ concluidas: 0, total: 0, etapa: "Preparando" })).toBe(0);
  });

  test("calcula o percentual pelas etapas realmente concluídas", () => {
    expect(percentualProgresso({ concluidas: 1, total: 2, etapa: "Etapa 1" })).toBe(50);
    expect(percentualProgresso({ concluidas: 2, total: 3, etapa: "Etapa 2" })).toBe(67);
  });

  test("nunca ultrapassa 100 por inconsistência de contagem", () => {
    expect(percentualProgresso({ concluidas: 4, total: 3, etapa: "Final" })).toBe(100);
  });
});
