import { describe, expect, test } from "bun:test";
import { credencialOpenAI } from "../src/lib/assistente-openai";

describe("Provedor principal do Assistente", () => {
  test("prioriza o token do plano ChatGPT", () => {
    const c = credencialOpenAI({
      OPENAI_CHATGPT_ACCESS_TOKEN: "oauth-token",
      OPENAI_API_KEY: "api-key",
      OPENAI_ALLOW_PAID_API: "true",
    } as NodeJS.ProcessEnv);
    expect(c).toEqual({ token: "oauth-token", origem: "chatgpt_plan" });
  });

  test("não usa API paga sem autorização explícita", () => {
    expect(() =>
      credencialOpenAI({
        OPENAI_API_KEY: "api-key",
      } as NodeJS.ProcessEnv),
    ).toThrow(/ChatGPT ainda não está conectado/);
  });

  test("permite API paga somente como fallback explicitamente habilitado", () => {
    const c = credencialOpenAI({
      OPENAI_API_KEY: "api-key",
      OPENAI_ALLOW_PAID_API: "true",
    } as NodeJS.ProcessEnv);
    expect(c).toEqual({ token: "api-key", origem: "api_key" });
  });

  test("não possui fallback para créditos Lovable", () => {
    expect(() =>
      credencialOpenAI({
        LOVABLE_API_KEY: "lovable-key",
      } as NodeJS.ProcessEnv),
    ).toThrow(/Lovable foi desativado/);
  });
});
