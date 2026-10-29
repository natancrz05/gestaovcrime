import { describe, expect, test } from "bun:test";
import {
  cpfValido,
  dataPorExtenso,
  formatarCpf,
  montarHtmlCertidaoComparecimento,
} from "../src/lib/processos/certidao-comparecimento";

describe("Certidão de comparecimento", () => {
  test("formata e valida CPF", () => {
    expect(formatarCpf("52998224725")).toBe("529.982.247-25");
    expect(cpfValido("529.982.247-25")).toBe(true);
    expect(cpfValido("111.111.111-11")).toBe(false);
    expect(cpfValido("123")).toBe(false);
  });

  test("escreve a data por extenso", () => {
    expect(dataPorExtenso("2026-10-29")).toBe("29 de outubro de 2026");
  });

  test("gera duas vias com os dados informados", () => {
    const html = montarHtmlCertidaoComparecimento({
      numero: "9999999-99.2099.8.05.0067",
      pessoa: "Pessoa de Teste",
      cpf: "52998224725",
      data: "2026-10-29",
      analista: "Analista de Teste",
    });

    expect((html.match(/CERTIDÃO DE COMPARECIMENTO/g) ?? []).length).toBe(2);
    expect((html.match(/PESSOA DE TESTE/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(html).toContain("529.982.247-25");
    expect(html).toContain("29 de outubro de 2026");
    expect(html).toContain("ANALISTA DE TESTE");
  });
});
