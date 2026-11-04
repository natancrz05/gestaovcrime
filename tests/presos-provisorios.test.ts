import { describe, expect, test } from "bun:test";
import { referenciaPreventiva } from "../src/lib/processos/reus-presos";

describe("Presos provisórios — preventiva", () => {
  test("guarda a data da prisão como fato próprio e usa-a como primeiro marco dos 90 dias", () => {
    expect(
      referenciaPreventiva({
        dataPrisao: "2026-11-01",
        ultimaReavaliacaoHistorico: null,
        dadosPlanilha: {},
      }),
    ).toEqual({
      dataPrisao: "2026-11-01",
      ultimaReavaliacao: null,
      referenciaPrazo: "2026-11-01",
      origemReferencia: "prisao",
    });
  });

  test("reavaliação posterior não altera a data da prisão", () => {
    expect(
      referenciaPreventiva({
        dataPrisao: "2026-08-01",
        ultimaReavaliacaoHistorico: "2026-10-20",
        dadosPlanilha: {},
      }),
    ).toEqual({
      dataPrisao: "2026-08-01",
      ultimaReavaliacao: "2026-10-20",
      referenciaPrazo: "2026-10-20",
      origemReferencia: "reavaliacao",
    });
  });

  test("usa somente eventos de reavaliação para iniciar ciclos posteriores", () => {
    expect(
      referenciaPreventiva({
        dataPrisao: "2026-06-01",
        ultimaReavaliacaoHistorico: "2026-08-20",
        dadosPlanilha: {
          "Data da última reavaliação": "15/09/2026",
          "Data da decisão da preventiva": "2026-10-01",
        },
      }),
    ).toEqual({
      dataPrisao: "2026-06-01",
      ultimaReavaliacao: "2026-09-15",
      referenciaPrazo: "2026-09-15",
      origemReferencia: "reavaliacao",
    });
  });

  test("sem prisão nem reavaliação não há referência para contagem", () => {
    expect(
      referenciaPreventiva({
        dataPrisao: null,
        ultimaReavaliacaoHistorico: null,
        dadosPlanilha: {},
      }),
    ).toEqual({
      dataPrisao: null,
      ultimaReavaliacao: null,
      referenciaPrazo: null,
      origemReferencia: null,
    });
  });
});
