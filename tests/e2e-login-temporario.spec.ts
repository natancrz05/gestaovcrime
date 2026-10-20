import { test, expect } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL!;
const EMAIL = "e2e.login.servidor@varacrime.test";
const SENHA = ["Teste", "Login", "2026"].join("-");

async function abrir(page: any) {
  await page.goto(BASE + "/auth", { waitUntil: "networkidle" });
  await expect(page.getByText("Vara Criminal")).toBeVisible();
}

test("login inexistente e ajuda de senha", async ({ page }) => {
  await abrir(page);
  await page.getByLabel("E-mail").fill("nao.existe.e2e@varacrime.test");
  await page.getByLabel("Senha").fill("credencial-incorreta");
  await page.getByRole("button", { name: "Entrar", exact: true }).last().click();
  await expect(page.getByText("E-mail ou senha incorretos.")).toBeVisible();

  await page.getByRole("button", { name: "Esqueci minha senha" }).click();
  await expect(page.getByText("Procure um administrador da unidade.", { exact: false })).toBeVisible();
});

test("autocadastro pendente permanece sem acesso", async ({ page }) => {
  await abrir(page);
  await page.getByRole("button", { name: "Solicitar acesso" }).click();
  await page.getByLabel("Nome completo").fill("E2E Servidor Login");
  await page.getByLabel("E-mail").fill(EMAIL);
  const senhas = page.locator('input[autocomplete="new-password"]');
  await senhas.nth(0).fill(SENHA);
  await senhas.nth(1).fill(SENHA);
  await page.getByRole("button", { name: "Enviar solicitação" }).click();
  await expect(page.getByText("Solicitação enviada.", { exact: false })).toBeVisible();

  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.getByLabel("E-mail").fill(EMAIL);
  await page.getByLabel("Senha").fill(SENHA);
  await page.getByRole("button", { name: "Entrar", exact: true }).last().click();
  await expect(page.getByText("Aguardando aprovação")).toBeVisible();
});

test("controles de UX do login existem", async ({ page }) => {
  await abrir(page);
  await expect(page.getByText("Lembrar meu e-mail neste dispositivo")).toBeVisible();
  await expect(page.locator('input[type="checkbox"]')).not.toBeChecked();

  const senha = page.getByLabel("Senha");
  await senha.click();
  await page.evaluate(() => {
    const input = document.querySelector('input[autocomplete="current-password"]');
    if (!input) return;
    const evento = new KeyboardEvent("keydown", { bubbles: true });
    Object.defineProperty(evento, "getModifierState", { value: (key: string) => key === "CapsLock" });
    input.dispatchEvent(evento);
  });
  await expect(page.getByText("Caps Lock ativado")).toBeVisible();
});
