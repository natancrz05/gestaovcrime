import { describe, expect, test } from "bun:test";
import { calcularPrazoProcessual } from "../src/lib/prazos/calculo";
import { ESTADOS_BRASIL, QUANTIDADE_MUNICIPIOS, municipiosDaUf } from "../src/lib/prazos/localidades-brasil";

describe("Contagem de prazos TJBA — Coração de Maria", () => {
  test("civil usa dias úteis e exclui o dia da publicação", () => {
    const r = calcularPrazoProcessual({
      publicacao: "2026-11-10", prazoDias: 5, materia: "civil",
    });
    expect(r.contagem).toBe("uteis");
    expect(r.primeiroDia).toBe("2026-11-11");
    expect(r.vencimento).toBe("2026-11-17");
  });

  test("penal comum usa dias corridos e prorroga vencimento dominical", () => {
    const r = calcularPrazoProcessual({
      publicacao: "2026-11-10", prazoDias: 5, materia: "penal",
    });
    expect(r.contagem).toBe("corridos");
    expect(r.vencimentoCalculado).toBe("2026-11-15");
    expect(r.vencimento).toBe("2026-11-16");
    expect(r.prorrogado).toBe(true);
  });

  test("Juizado Especial Criminal aplica dias úteis", () => {
    const r = calcularPrazoProcessual({
      publicacao: "2026-11-10", prazoDias: 5, materia: "jec_criminal",
    });
    expect(r.contagem).toBe("uteis");
    expect(r.vencimento).toBe("2026-11-17");
  });

  test("feriado municipal de Coração de Maria em 29/06/2026", () => {
    const r = calcularPrazoProcessual({
      publicacao: "2026-06-26", prazoDias: 1, materia: "civil",
    });
    expect(r.primeiroDia).toBe("2026-06-30");
    expect(r.vencimento).toBe("2026-06-30");
  });

  test("suspensão penal do art. 798-A protege a contagem entre 20/12 e 20/01", () => {
    const r = calcularPrazoProcessual({
      publicacao: "2026-12-18", prazoDias: 1, materia: "penal",
    });
    expect(r.primeiroDia).toBe("2027-01-21");
    expect(r.vencimento).toBe("2027-01-21");
    expect(r.avisoCalendario.length).toBeGreaterThan(0);
  });

  test("exceção de réu preso dispensa suspensão de 20/12 a 20/01", () => {
    const r = calcularPrazoProcessual({
      publicacao: "2026-12-18", prazoDias: 1, materia: "penal", excecaoRecesso: "reu_preso",
    });
    expect(r.primeiroDia).toBe("2027-01-07");
    expect(r.vencimento).toBe("2027-01-07");
  });

  test("permite feriado manual sem depender do gateway IA", () => {
    const r = calcularPrazoProcessual({
      publicacao: "2026-11-10", prazoDias: 1, materia: "civil",
      diasSemExpediente: ["2026-11-11"],
    });
    expect(r.vencimento).toBe("2026-11-12");
  });

  test("suspensão individual do processo interrompe contagem", () => {
    const r = calcularPrazoProcessual({
      publicacao: "2026-11-10", prazoDias: 3, materia: "penal",
      suspensoesEspecificas: [{ inicio: "2026-11-12", fim: "2026-11-13" }],
    });
    expect(r.diasSuspensos).toBe(2);
    expect(r.vencimento).toBe("2026-11-16");
  });

  test("datas inválidas e prazos negativos são bloqueados", () => {
    expect(() => calcularPrazoProcessual({
      publicacao: "2026-02-30", prazoDias: 3, materia: "civil",
    })).toThrow();
    expect(() => calcularPrazoProcessual({
      publicacao: "2026-11-10", prazoDias: -3, materia: "penal",
    })).toThrow();
  });
});

describe("Localidades e feriados específicos", () => {
  test("catálogo próprio disponibiliza 27 estados e municípios brasileiros", () => {
    expect(ESTADOS_BRASIL).toHaveLength(27);
    expect(QUANTIDADE_MUNICIPIOS).toBeGreaterThanOrEqual(5570);
    expect(municipiosDaUf("BA")).toContain("Coração de Maria");
    expect(municipiosDaUf("SP")).toContain("São Paulo");
    expect(municipiosDaUf("AC")).not.toContain("Coração de Maria");
  });

  test("feriado de Coração de Maria não se aplica a município de outra UF", () => {
    const coracao = calcularPrazoProcessual({
      publicacao: "2026-06-26", prazoDias: 1, materia: "civil",
      uf: "BA", municipio: "Coração de Maria",
    });
    const saoPaulo = calcularPrazoProcessual({
      publicacao: "2026-06-26", prazoDias: 1, materia: "civil",
      uf: "SP", municipio: "São Paulo",
    });
    expect(coracao.vencimento).toBe("2026-06-30");
    expect(saoPaulo.vencimento).toBe("2026-06-29");
    expect(saoPaulo.avisoCalendario.some((msg) => msg.includes("outra UF"))).toBe(true);
  });

  test("outro município da Bahia solicita conferência de feriados locais", () => {
    const r = calcularPrazoProcessual({
      publicacao: "2026-11-10", prazoDias: 2, materia: "civil",
      uf: "BA", municipio: "Feira de Santana",
    });
    expect(r.avisoCalendario.some((msg) => msg.includes("Feira de Santana"))).toBe(true);
  });

  test("estado e município incompatíveis são rejeitados", () => {
    expect(() => calcularPrazoProcessual({
      publicacao: "2026-11-10", prazoDias: 5, materia: "penal",
      uf: "SP", municipio: "Coração de Maria",
    })).toThrow();
  });

  test("suspensão prevista no art. 798-A CPP permanece no padrão", () => {
    const r = calcularPrazoProcessual({
      publicacao: "2026-12-18", prazoDias: 2, materia: "penal",
      uf: "BA", municipio: "Coração de Maria",
    });
    expect(r.primeiroDia).toBe("2027-01-21");
    expect(r.vencimento).toBe("2027-01-22");
    expect(r.avisoCalendario.some((msg) => msg.includes("798-A"))).toBe(true);
  });
});
