import { describe, expect, test } from "bun:test";
import { decidirAcessoAposLogin } from "../src/lib/login-acesso";

describe("decisão de acesso após autenticação", () => {
  test("sem cadastro interno é bloqueado", () => {
    expect(decidirAcessoAposLogin(null)).toBe("inativo");
  });

  test("cadastro pendente aguarda aprovação", () => {
    expect(decidirAcessoAposLogin({
      status_cadastro: "pendente",
      ativo: false,
      troca_senha_obrigatoria: false,
    })).toBe("pendente");
  });

  test("cadastro recusado recebe bloqueio específico", () => {
    expect(decidirAcessoAposLogin({
      status_cadastro: "recusado",
      ativo: false,
      troca_senha_obrigatoria: false,
    })).toBe("recusado");
  });

  test("usuário aprovado porém inativo continua bloqueado", () => {
    expect(decidirAcessoAposLogin({
      status_cadastro: "aprovado",
      ativo: false,
      troca_senha_obrigatoria: false,
    })).toBe("inativo");
  });

  test("senha padrão exige troca antes de liberar", () => {
    expect(decidirAcessoAposLogin({
      status_cadastro: "aprovado",
      ativo: true,
      troca_senha_obrigatoria: true,
    })).toBe("trocar_senha");
  });

  test("usuário aprovado e ativo é liberado", () => {
    expect(decidirAcessoAposLogin({
      status_cadastro: "aprovado",
      ativo: true,
      troca_senha_obrigatoria: false,
    })).toBe("liberado");
  });
});
