import { describe, expect, test } from "bun:test";
import {
  contextoConciso, limitarPesquisasExternas, modeloParaSolicitacao,
  solicitacaoSimples, solicitouPesquisaExterna,
} from "../src/lib/assistente-otimizacao";

describe("ConclusosIA — controle econômico de contexto", () => {
  test("mantém a última pergunta completa e limita o histórico anterior", () => {
    const historico = Array.from({ length: 20 }, (_, i) => ({
      role: (i % 2 ? "assistant" : "user") as "assistant" | "user",
      content: "Texto histórico " + i + " ".repeat(4000),
    }));
    historico.push({ role: "user", content: "Confira especificamente o fundamento do último ato." });
    const compactado = contextoConciso(historico);
    expect(compactado.length).toBeLessThanOrEqual(8);
    expect(compactado.length).toBeGreaterThan(1);
    expect(compactado.at(-1)?.content).toBe(historico.at(-1)?.content);
    expect(compactado.slice(0, -1).reduce((n, item) => n + item.content.length, 0)).toBeLessThanOrEqual(12000);
    expect(compactado[0]?.content).not.toContain("Texto histórico 0");
  });
  test("não modifica mensagens originais nem armazena conteúdo em estado global", () => {
    const mensagens = [{ role: "user" as const, content: "Pergunta" }];
    const primeira = contextoConciso(mensagens);
    primeira[0]!.content = "Alterada";
    expect(mensagens[0]?.content).toBe("Pergunta");
    expect(contextoConciso(mensagens)[0]?.content).toBe("Pergunta");
  });
});

describe("ConclusosIA — roteamento por custo e risco jurídico", () => {
  test("minutas simples sem anexos usam Luna", () => {
    expect(modeloParaSolicitacao("Melhore esta minuta de certidão: Certifico o comparecimento.", false, false))
      .toBe("openai/gpt-6-luna");
    expect(solicitacaoSimples("Corrija a gramática deste texto.", false, false)).toBe(true);
  });
  test("casos jurídicos críticos, anexos e cálculos permanecem no Astra", () => {
    for (const prompt of [
      "Calcule a prescrição penal neste processo",
      "Pesquise jurisprudência STJ sobre revisão preventiva",
      "Faça análise processual dos autos anexados",
    ]) {
      expect(modeloParaSolicitacao(prompt, false, false)).toBe("openai/gpt-6-astra");
    }
    expect(modeloParaSolicitacao("Melhore minha minuta", true, false)).toBe("openai/gpt-6-astra");
    expect(modeloParaSolicitacao("Melhore minha minuta", false, true)).toBe("openai/gpt-6-astra");
  });
  test("consulta externa somente sob pedido expresso", () => {
    expect(solicitouPesquisaExterna("Pesquise jurisprudência no STJ sobre prisão preventiva")).toBe(true);
    expect(solicitouPesquisaExterna("Confira decisões do STF sobre mandado de segurança")).toBe(true);
    expect(solicitouPesquisaExterna("Explique o conceito de prescrição penal")).toBe(false);
    expect(solicitouPesquisaExterna("Melhore esta certidão")).toBe(false);
    expect(solicitouPesquisaExterna("Calcule prescrição penal")).toBe(false);
  });
});

describe("ConclusosIA — freio da pesquisa externa", () => {
  test("executa apenas uma busca, mesmo que a IA a solicite repetidamente", async () => {
    let chamadas = 0;
    const pesquisar = limitarPesquisasExternas(async (_args) => {
      chamadas++;
      return { consultaRealizada: true, referencias: [{ url: "https://www.lexml.gov.br" }] };
    });
    const primeiro = await pesquisar({ tema: "prescrição penal" });
    const repetido = await pesquisar({ tema: "prescrição penal" });
    const segundo = await pesquisar({ tema: "prisão preventiva" });
    expect(chamadas).toBe(1);
    expect(primeiro).toMatchObject({ consultaRealizada: true });
    expect(repetido).toEqual(primeiro);
    expect(segundo).toMatchObject({ consultaRealizada: false, limiteDaResposta: true });
  });
  test("limite é isolado por solicitação, sem misturar dados entre usuários", async () => {
    const primeiro = limitarPesquisasExternas(async () => ({ resultado: "A" }));
    const segundo = limitarPesquisasExternas(async () => ({ resultado: "B" }));
    expect(await primeiro({ tema: "tema" })).toEqual({ resultado: "A" });
    expect(await segundo({ tema: "tema" })).toEqual({ resultado: "B" });
  });
});
