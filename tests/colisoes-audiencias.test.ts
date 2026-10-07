import { describe, expect, test } from "bun:test";
import { avaliarColisaoHorarioPauta } from "../src/lib/processos/colisoes-audiencias";

describe("Colisão de horário na importação da pauta", () => {
  test("permite processos diferentes no mesmo horário e mesma finalidade", () => {
    expect(
      avaliarColisaoHorarioPauta(
        [{ processo_id: "processo-a", tipo: "Audiência de instrução e julgamento" }],
        "processo-b",
        "Audiência de instrução e julgamento",
      ),
    ).toBe("livre");
  });

  test("trata a mesma finalidade do mesmo processo como já existente", () => {
    expect(
      avaliarColisaoHorarioPauta(
        [{ processo_id: "processo-a", tipo: "Audiência de instrução e julgamento" }],
        "processo-a",
        "Audiência de instrução e julgamento",
      ),
    ).toBe("ja-existente");
  });

  test("bloqueia finalidades diferentes no mesmo processo e horário", () => {
    expect(
      avaliarColisaoHorarioPauta(
        [{ processo_id: "processo-a", tipo: "Audiência preliminar" }],
        "processo-a",
        "Audiência de instrução e julgamento",
      ),
    ).toBe("conflito-mesmo-processo");
  });
});
