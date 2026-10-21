import { describe, expect, test } from "bun:test";
import { papelEhReu } from "../src/lib/processos/importacao-pauta-audiencias";

describe("papéis das Partes na pauta do PJe", () => {
  test("reconhece nomenclaturas passivas de APF e cautelares", () => {
    expect(papelEhReu("FLAGRANTEADO")).toBe(true);
    expect(papelEhReu("Flagranteada")).toBe(true);
    expect(papelEhReu("AUTUADO")).toBe(true);
    expect(papelEhReu("Autuada")).toBe(true);
  });

  test("mantém os demais papéis passivos já suportados", () => {
    for (const papel of [
      "RÉU",
      "ACUSADO",
      "DENUNCIADO",
      "INDICIADO",
      "QUERELADO",
      "EXECUTADO",
      "INVESTIGADO",
      "REQUERIDO",
      "APELADO",
      "AUTOR DO FATO",
    ]) {
      expect(papelEhReu(papel)).toBe(true);
    }
  });

  test("não confunde polo ativo com réu", () => {
    expect(papelEhReu("REQUERENTE")).toBe(false);
    expect(papelEhReu("MINISTÉRIO PÚBLICO")).toBe(false);
    expect(papelEhReu("AUTOR")).toBe(false);
    expect(papelEhReu("VÍTIMA")).toBe(false);
  });
});
