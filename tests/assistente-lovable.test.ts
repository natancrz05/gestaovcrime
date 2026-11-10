import { describe, expect, test } from "bun:test";
import { __teste } from "../src/lib/assistente-lovable";

describe("Assistente via Lovable", () => {
  test("extrai texto de uma resposta normal", () => {
    const texto = __teste.textoDaResposta({
      output: [
        {
          type: "message",
          content: [{ type: "output_text", text: "Resposta da IA" }],
        },
      ],
    });
    expect(texto).toBe("Resposta da IA");
  });

  test("identifica chamadas de ferramentas do acervo", () => {
    const chamadas = __teste.chamadasDaResposta({
      output: [
        {
          type: "function_call",
          call_id: "call_1",
          name: "detalhar_processo",
          arguments: JSON.stringify({ numero: "8000000-00.2026.8.05.0067" }),
        },
      ],
    });
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0]?.name).toBe("detalhar_processo");
    expect(chamadas[0]?.argumentos).toEqual({ numero: "8000000-00.2026.8.05.0067" });
  });

  test("anexa o texto do arquivo apenas à última mensagem do usuário", () => {
    const input = __teste.inputComArquivos(
      [
        { role: "user", content: "Analise o processo." },
        { role: "assistant", content: "Envie os autos." },
        { role: "user", content: "Segue o PDF." },
      ],
      [
        {
          nome: "autos.pdf",
          tipo: "application/pdf",
          texto: "[Página 1]\nConteúdo dos autos",
          paginas: 1,
        },
      ],
    );

    expect(input[0]?.content).toBe("Analise o processo.");
    expect(input[2]?.content).toContain("autos.pdf");
    expect(input[2]?.content).toContain("[Página 1]");
  });

  test("informa ao modelo quando o arquivo foi truncado", () => {
    const input = __teste.inputComArquivos(
      [{ role: "user", content: "Analise." }],
      [
        {
          nome: "autos.pdf",
          tipo: "application/pdf",
          texto: "trecho",
          paginas: 900,
          truncado: true,
        },
      ],
    );
    expect(input[0]?.content).toContain("AVISO: a extração foi truncada");
  });
});
