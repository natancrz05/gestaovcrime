import { describe, expect, test } from "bun:test";
import {
  devePreservarSituacaoFinalNaImportacao,
  situacaoAudienciaFinal,
} from "../src/lib/processos/audiencias";

describe("Proteção de situação final na importação de pautas", () => {
  test("reimportação não reabre audiência realizada", () => {
    expect(devePreservarSituacaoFinalNaImportacao("Realizada", "Agendada")).toBe(true);
    expect(devePreservarSituacaoFinalNaImportacao("Realizada", "Redesignada")).toBe(true);
  });

  test("reimportação não reabre audiência cancelada", () => {
    expect(devePreservarSituacaoFinalNaImportacao("Cancelada", "Agendada")).toBe(true);
  });

  test("demais situações finais também são protegidas", () => {
    expect(situacaoAudienciaFinal("Não realizada")).toBe(true);
    expect(situacaoAudienciaFinal("Convertida em diligência")).toBe(true);
    expect(devePreservarSituacaoFinalNaImportacao("Não realizada", "Agendada")).toBe(true);
    expect(devePreservarSituacaoFinalNaImportacao("Convertida em diligência", "Redesignada")).toBe(true);
  });

  test("mesma situação final não bloqueia sincronização de outros campos", () => {
    expect(devePreservarSituacaoFinalNaImportacao("Realizada", "Realizada")).toBe(false);
    expect(devePreservarSituacaoFinalNaImportacao("Cancelada", "Cancelada")).toBe(false);
  });

  test("audiência aberta pode avançar normalmente para situação final", () => {
    expect(devePreservarSituacaoFinalNaImportacao("Agendada", "Realizada")).toBe(false);
    expect(devePreservarSituacaoFinalNaImportacao("Redesignada", "Cancelada")).toBe(false);
  });
});
