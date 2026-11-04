import { describe, expect, test } from "bun:test";
import { mensagemProcessoAusenteComparecimento } from "../src/lib/processos/comparecimentos";

describe("Comparecimentos sem processo vinculado", () => {
  test("explica o motivo e orienta a cadastrar ou vincular o processo cautelar", () => {
    const mensagem = mensagemProcessoAusenteComparecimento("MARIA TESTE");

    expect(mensagem).toContain("não está vinculado a um processo");
    expect(mensagem).toContain("vincule ou cadastre o processo");
    expect(mensagem).toContain("medida cautelar");
    expect(mensagem).toContain("MARIA TESTE");
  });
});
