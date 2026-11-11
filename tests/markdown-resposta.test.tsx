import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MarkdownResposta } from "../src/components/assistente/MarkdownResposta";

function html(texto: string) {
  return renderToStaticMarkup(createElement(MarkdownResposta, { texto }));
}

describe("Markdown dos relatórios jurídicos gerados por IA", () => {
  test("exibe o relatório da prescrição com título, campos em negrito e subtítulos", () => {
    const resultado = html([
      "# Relatório técnico — prescrição penal",
      "",
      "**Processo:** 8000373-72.2020.8.05.0067",
      "**Acusado:** Jailton Santos Damasceno",
      "**Data de referência exclusiva:** **10/11/2026**",
      "",
      "## 1. Objeto e síntese",
      "",
      "**Conclusão central:** possível prescrição a conferir.",
    ].join("\n"));
    expect(resultado).toContain("<h2");
    expect(resultado).toContain("Relatório técnico — prescrição penal");
    expect(resultado).toContain("<strong");
    expect(resultado).toContain("Processo:");
    expect(resultado).toContain("10/11/2026</strong>");
    expect(resultado).toContain("<h3");
    expect(resultado).not.toContain("**Processo:**");
    expect(resultado).not.toContain("## 1. Objeto e síntese");
  });

  test("mantém emojis e suporta itálico, tachado, listas e linha horizontal", () => {
    const resultado = html([
      "✅ **Prazo conferido** :warning:",
      "- *Marco interruptivo*",
      "- ~~Data descartada~~",
      "1. **Primeira decisão**",
      "2. **Segunda decisão**",
      "---",
    ].join("\n"));
    expect(resultado).toContain("✅");
    expect(resultado).toContain("⚠️");
    expect(resultado).toContain("<em");
    expect(resultado).toContain("<del");
    expect(resultado).toContain("<ul");
    expect(resultado).toContain("<ol");
    expect(resultado).toContain("<hr");
  });

  test("formata tabelas, código e links HTTP(S)", () => {
    const resultado = html([
      "| Marco | Data |",
      "| --- | --- |",
      "| Denúncia | **04/08/2021** |",
      "",
      "Confira [documento](https://www.tjba.jus.br).",
      "",
      "```txt",
      "ID: 123456789",
      "```",
    ].join("\n"));
    expect(resultado).toContain("<table");
    expect(resultado).toContain("<thead");
    expect(resultado).toContain("<tbody");
    expect(resultado).toContain("<strong");
    expect(resultado).toContain('href="https://www.tjba.jus.br"');
    expect(resultado).toContain("ID: 123456789");
  });

  test("não injeta HTML fornecido pelo modelo e não cria link javascript", () => {
    const resultado = html([
      "<script>alert('x')</script>",
      "[Acessar](javascript:alert(1))",
      "**Texto jurídico seguro**",
    ].join("\n"));
    expect(resultado).not.toContain("<script>");
    expect(resultado).toContain("&lt;script&gt;");
    expect(resultado).not.toContain('href="javascript:');
    expect(resultado).toContain("<strong");
  });
});

describe("Compatibilidade com respostas do Assistente", () => {
  test("quebras de linha e marcadores de revisão permanecem legíveis", () => {
    const resultado = html([
      "Data do ato: **04/08/2021**",
      "Retomada: *11/12/2023*",
      "",
      "> ⚖️ Conferência judicial necessária",
      "",
      "### Pendências",
      "- Conferir mídia",
    ].join("\n"));
    expect(resultado).toContain("04/08/2021</strong>");
    expect(resultado).toContain("11/12/2023</em>");
    expect(resultado).toContain("<blockquote");
    expect(resultado).toContain("⚖️");
    expect(resultado).toContain("<h4");
    expect(resultado).toContain("Conferir mídia");
  });
});
