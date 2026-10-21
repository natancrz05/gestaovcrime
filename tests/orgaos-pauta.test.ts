import { describe, expect, test } from "bun:test";
import { chaveOrgaoPauta, orgaosDistintosDaPauta } from "../src/lib/processos/orgaos-pauta";

describe("órgão julgador da pauta", () => {
  test("trata variações da Vara Criminal de Coração de Maria como a mesma unidade", () => {
    const variacoes = [
      "VARA CRIMINAL DE CORAÇÃO DE MARIA",
      "Vara Criminal de Coração de Maria - BA",
      "VARA CRIMINAL DE CORAÇÃO DE MARIA MARIA",
      "VARA  CRIMINAL   DE   CORACAO DE MARIA",
    ];

    expect(new Set(variacoes.map(chaveOrgaoPauta)).size).toBe(1);
    expect(orgaosDistintosDaPauta(variacoes)).toHaveLength(1);
  });

  test("mantém unidade realmente diferente como órgão distinto", () => {
    const orgaos = orgaosDistintosDaPauta([
      "VARA CRIMINAL DE CORAÇÃO DE MARIA",
      "3ª VARA CRIMINAL DA COMARCA DE FEIRA DE SANTANA",
    ]);

    expect(orgaos).toHaveLength(2);
  });

  test("normaliza apenas formatação para outras unidades", () => {
    expect(chaveOrgaoPauta("  1ª Vara Criminal - Feira de Santana  "))
      .toBe(chaveOrgaoPauta("1ª VARA CRIMINAL / FEIRA DE SANTANA"));
  });
});
