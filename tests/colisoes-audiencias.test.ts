import { describe, expect, test } from "bun:test";
import {
  audienciaOcupaHorario,
  avaliarColisaoHorarioPauta,
} from "../src/lib/processos/colisoes-audiencias";

describe("Colisão de horário na importação da pauta", () => {
  test("permite processos diferentes no mesmo horário e mesma finalidade", () => {
    expect(
      avaliarColisaoHorarioPauta(
        [{ processo_id: "processo-a", tipo: "Audiência de instrução e julgamento", situacao: "Agendada" }],
        "processo-b",
        "Audiência de instrução e julgamento",
      ),
    ).toBe("livre");
  });

  test("trata a mesma finalidade ativa do mesmo processo como já existente", () => {
    expect(
      avaliarColisaoHorarioPauta(
        [{ processo_id: "processo-a", tipo: "Audiência de instrução e julgamento", situacao: "Agendada" }],
        "processo-a",
        "Audiência de instrução e julgamento",
      ),
    ).toBe("ja-existente");
  });

  test("bloqueia finalidades diferentes ativas no mesmo processo e horário", () => {
    expect(
      avaliarColisaoHorarioPauta(
        [{ processo_id: "processo-a", tipo: "Audiência preliminar", situacao: "Agendada" }],
        "processo-a",
        "Audiência de instrução e julgamento",
      ),
    ).toBe("conflito-mesmo-processo");
  });

  test("audiência cancelada não ocupa mais o horário", () => {
    expect(
      avaliarColisaoHorarioPauta(
        [{ processo_id: "processo-a", tipo: "Audiência preliminar", situacao: "Cancelada" }],
        "processo-a",
        "Audiência de instrução e julgamento",
      ),
    ).toBe("livre");
  });

  test("não realizada e convertida em diligência também liberam o horário", () => {
    expect(audienciaOcupaHorario("Não realizada")).toBe(false);
    expect(audienciaOcupaHorario("Convertida em diligência")).toBe(false);
    expect(audienciaOcupaHorario("Cancelada")).toBe(false);
  });

  test("audiência realizada continua ocupando o horário", () => {
    expect(audienciaOcupaHorario("Realizada")).toBe(true);
    expect(
      avaliarColisaoHorarioPauta(
        [{ processo_id: "processo-a", tipo: "Audiência preliminar", situacao: "Realizada" }],
        "processo-a",
        "Audiência de instrução e julgamento",
      ),
    ).toBe("conflito-mesmo-processo");
  });
});
