import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { PrioridadeManualEntrada } from "../src/lib/processos/repositorio";

let erroAtual: { code: string; message: string } | null = null;
const inserir = mock(async (_entrada: PrioridadeManualEntrada) => ({ error: erroAtual }));
const atualizarPorId = mock(async (_campo: string, _id: string) => ({ error: erroAtual }));
const atualizar = mock((_entrada: PrioridadeManualEntrada) => ({ eq: atualizarPorId }));
const tabela = mock((_nome: string) => ({ insert: inserir, update: atualizar }));

mock.module("../src/integrations/supabase/client", () => ({ supabase: { from: tabela } }));
const { salvarPrioridadeManual } = await import("../src/lib/processos/repositorio");

const niveis: PrioridadeManualEntrada["nivel"][] = [
  "critico",
  "alta",
  "media",
  "conferir",
  "baixa",
];
const entrada = (nivel: PrioridadeManualEntrada["nivel"]): PrioridadeManualEntrada => ({
  processo_id: "processo-teste",
  titulo: "Conferir manifestação",
  nivel,
  observacao: "Observação de teste",
});

beforeEach(() => {
  erroAtual = null;
  inserir.mockClear();
  atualizar.mockClear();
  atualizarPorId.mockClear();
  tabela.mockClear();
});

describe("Cadastro e edição de prioridades manuais", () => {
  test.each(niveis)("envia o nível %s sem converter ou perder dados", async (nivel) => {
    const dados = entrada(nivel);
    await salvarPrioridadeManual(dados);
    expect(tabela).toHaveBeenCalledWith("prioridades");
    expect(inserir).toHaveBeenCalledTimes(1);
    expect(inserir).toHaveBeenCalledWith(dados);
    expect(atualizar).not.toHaveBeenCalled();
  });

  test.each(["critico", "conferir"] as const)(
    "edita para %s usando somente o ID selecionado",
    async (nivel) => {
      const dados = entrada(nivel);
      await salvarPrioridadeManual(dados, "prioridade-teste");
      expect(atualizar).toHaveBeenCalledWith(dados);
      expect(atualizarPorId).toHaveBeenCalledWith("id", "prioridade-teste");
      expect(inserir).not.toHaveBeenCalled();
    },
  );

  test("explica a validação antiga em português em vez de esconder o erro", async () => {
    erroAtual = {
      code: "23514",
      message:
        'new row for relation "prioridades" violates check constraint "prioridades_nivel_check"',
    };
    await expect(salvarPrioridadeManual(entrada("critico"))).rejects.toThrow(
      "O nível escolhido ainda não está habilitado para prioridades manuais.",
    );
    await expect(salvarPrioridadeManual(entrada("conferir"), "prioridade-teste")).rejects.toThrow(
      "A atualização do sistema precisa ser concluída.",
    );
  });

  test("preserva erros de permissão como Error, sem ocultar nem ignorar a falha", async () => {
    erroAtual = { code: "42501", message: "Sem permissão para cadastrar prioridade." };
    try {
      await salvarPrioridadeManual(entrada("critico"));
      throw new Error("A gravação deveria falhar.");
    } catch (erro) {
      expect(erro).toBeInstanceOf(Error);
      expect((erro as Error).message).toBe(erroAtual.message);
    }
  });
});
