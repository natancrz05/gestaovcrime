import { describe, expect, test } from "bun:test";
import { cadastroEncerradoPorId, rotaCadastroComparecimento } from "../src/lib/processos/comparecimentos-navegacao";

describe("Acesso ao cadastro completo a partir da ficha do processo", () => {
  test("comparecimentos encerrados levam à rota própria de encerrados", () => {
    expect(rotaCadastroComparecimento("Encerrado")).toBe("/comparecimentos/encerrados");
  });

  test("comparecimentos ativos continuam usando a rota de ativos", () => {
    expect(rotaCadastroComparecimento("Ativo")).toBe("/comparecimentos");
  });

  test("deep link por ID resolve o registro encerrado exato e preserva histórico", () => {
    const registros = [
      { id: "ativo-1", situacao: "Ativo", pessoa: "Primeira pessoa", historico: [{ id: "h1" }] },
      { id: "encerrado-1", situacao: "Encerrado", pessoa: "Segunda pessoa", historico: [{ id: "h2" }, { id: "h3" }] },
      { id: "encerrado-2", situacao: "Encerrado", pessoa: "Terceira pessoa", historico: [{ id: "h4" }] },
    ];

    const selecionado = cadastroEncerradoPorId(registros, "encerrado-1");
    expect(selecionado?.pessoa).toBe("Segunda pessoa");
    expect(selecionado?.historico).toEqual([{ id: "h2" }, { id: "h3" }]);
    expect(cadastroEncerradoPorId(registros, "encerrado-2")?.pessoa).toBe("Terceira pessoa");
  });

  test("ID de ativo, desconhecido ou ausente não abre outro cadastro", () => {
    const registros = [
      { id: "ativo-1", situacao: "Ativo" },
      { id: "encerrado-1", situacao: "Encerrado" },
    ];
    expect(cadastroEncerradoPorId(registros, "ativo-1")).toBeNull();
    expect(cadastroEncerradoPorId(registros, "inexistente")).toBeNull();
    expect(cadastroEncerradoPorId(registros, "")).toBeNull();
  });

  test("deep link não depende de a lista de encerrados estar filtrada por busca", () => {
    const registros = [
      { id: "encerrado-1", situacao: "Encerrado", pessoa: "Maria" },
      { id: "encerrado-2", situacao: "Encerrado", pessoa: "José" },
    ];
    const resultadosBusca = registros.filter((r) => r.pessoa.includes("Maria"));
    expect(resultadosBusca).toHaveLength(1);
    expect(cadastroEncerradoPorId(registros, "encerrado-2")?.pessoa).toBe("José");
  });
});
