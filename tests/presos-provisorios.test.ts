import { describe, expect, test } from "bun:test";
import { baseReavaliacaoPreventiva } from "../src/lib/processos/reus-presos";

describe("Presos provisórios — preventiva", () => {
  test("usa a data da prisão como primeiro marco dos 90 dias", () => {
    expect(
      baseReavaliacaoPreventiva({
        dataPrisao: "2026-11-01",
        ultimaReavaliacaoHistorico: null,
        dadosPlanilha: {},
      }),
    ).toBe("2026-11-01");
  });

  test("reavaliação posterior substitui a data da prisão", () => {
    expect(
      baseReavaliacaoPreventiva({
        dataPrisao: "2026-08-01",
        ultimaReavaliacaoHistorico: "2026-10-20",
        dadosPlanilha: {},
      }),
    ).toBe("2026-10-20");
  });

  test("usa o marco mais recente disponível entre prisão e reavaliações", () => {
    expect(
      baseReavaliacaoPreventiva({
        dataPrisao: "2026-06-01",
        ultimaReavaliacaoHistorico: "2026-08-20",
        dadosPlanilha: {
          "Data da última reavaliação": "15/09/2026",
          "Data da decisão da preventiva": "2026-06-01",
        },
      }),
    ).toBe("2026-09-15");
  });

  test("sem qualquer data mantém a necessidade de conferência", () => {
    expect(
      baseReavaliacaoPreventiva({
        dataPrisao: null,
        ultimaReavaliacaoHistorico: null,
        dadosPlanilha: {},
      }),
    ).toBeNull();
  });
});
