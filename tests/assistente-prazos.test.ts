import { describe, expect, test } from "bun:test";
import { executarCalculoPrazo, FERRAMENTA_CALCULO_PRAZO } from "../src/lib/assistente-prazos";

describe("Ferramenta determinística do Assistente", () => {
  test("o modelo tem acesso a função de prazo, não a prescrição", () => {
    expect(FERRAMENTA_CALCULO_PRAZO.name).toBe("calcular_prazo_processual");
    expect(FERRAMENTA_CALCULO_PRAZO.description).toContain("NÃO serve para prescrição penal");
  });

  test("faz cálculo penal pelo motor jurídico compartilhado", () => {
    const r = executarCalculoPrazo({
      publicacao: "2026-11-10",
      prazoDias: 5,
      materia: "penal",
      excecaoRecesso: "nenhuma",
    });
    expect(r.vencimento).toBe("2026-11-16");
    expect(r.fundamento).toContain("CPP");
  });

  test("bloqueia dados parciais ou matéria desconhecida", () => {
    expect(() => executarCalculoPrazo({
      publicacao: "2026-11-10", prazoDias: 5, materia: "prescricao",
      excecaoRecesso: "nenhuma",
    })).toThrow();
  });
});
