import { describe, expect, test } from "bun:test";
import {
  criarExecutorEconomico, erroControladoFerramenta, INSTRUCOES_MINUTAS,
  MAX_CARACTERES_RETORNO_FERRAMENTA, MAX_CHAMADAS_FERRAMENTAS,
  MAX_RODADAS_IA, resultadoConcisoFerramenta,
} from "../src/lib/assistente-execucao";

describe("ConclusosIA — freios de créditos por solicitação", () => {
  test("limita rodadas, chamadas e tamanho de cada retorno", () => {
    expect(MAX_RODADAS_IA).toBeLessThanOrEqual(4);
    expect(MAX_CHAMADAS_FERRAMENTAS).toBeLessThanOrEqual(8);
    expect(MAX_CARACTERES_RETORNO_FERRAMENTA).toBeLessThanOrEqual(14000);
  });

  test("reaproveita chamadas iguais somente na solicitação atual", async () => {
    let chamadas = 0;
    const executor = criarExecutorEconomico(async (_nome, dados) => {
      chamadas++;
      return { achado: dados["termo"] };
    });
    expect(await executor("buscar_processo", { termo: "800001" })).toEqual({ achado: "800001" });
    expect(await executor("buscar_processo", { termo: "800001" })).toEqual({ achado: "800001" });
    expect(chamadas).toBe(1);

    const outraSolicitacao = criarExecutorEconomico(async () => {
      chamadas++;
      return { achado: "outra resposta" };
    });
    expect(await outraSolicitacao("buscar_processo", { termo: "800001" }))
      .toEqual({ achado: "outra resposta" });
    expect(chamadas).toBe(2);
  });

  test("cap global impede consultas de ferramentas em excesso", async () => {
    let chamadas = 0;
    const executor = criarExecutorEconomico(async () => {
      chamadas++;
      return { ok: true };
    }, 2);
    await executor("a", {});
    await executor("b", {});
    const bloqueada = await executor("c", {});
    expect(chamadas).toBe(2);
    expect(bloqueada).toMatchObject({ limiteDeConsultas: true });
  });

  test("retornos grandes mantêm JSON válido e informam lacuna sem omissão silenciosa", () => {
    const original = { registros: Array.from({ length: 200 }, (_, i) => ({ id: i, descricao: "A".repeat(160) })) };
    const resumo = JSON.parse(resultadoConcisoFerramenta(original));
    expect(resumo.truncado).toBe(true);
    expect(resumo.tamanhoOriginal).toBeGreaterThan(14000);
    expect(resumo.observacao).toContain("parciais");
    expect(resumo.dadosParciais.length).toBeLessThan(14000);
    expect(JSON.parse(resultadoConcisoFerramenta({ ok: true }))).toEqual({ ok: true });
  });

  test("erro de consulta não replica informações sensíveis do banco", () => {
    const texto = JSON.stringify(erroControladoFerramenta("buscar_processo"));
    expect(texto).toContain("consultaRealizada");
    expect(texto).not.toContain("CPF");
    expect(texto).not.toContain("password");
  });

  test("minutas usam instruções objetivas sem proibir revisão jurídica", () => {
    expect(INSTRUCOES_MINUTAS).toContain("ConclusosIA");
    expect(INSTRUCOES_MINUTAS).toContain("preservando fatos");
    expect(INSTRUCOES_MINUTAS).toContain("Não invente dados");
  });
});
