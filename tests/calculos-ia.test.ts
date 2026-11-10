import { describe, expect, test } from "bun:test";
import { medirIntervalo } from "../src/lib/prazos/intervalos";
import { executarMedicaoIntervalo } from "../src/lib/assistente-intervalos";
import { indexarReferenciasPdf } from "../src/lib/prazos/triagem-documental";
import { conferirPrazoTemporaria } from "../src/lib/prazos/temporaria";
import { executarPrazoTemporaria } from "../src/lib/assistente-temporaria";
import { ORIENTACAO_REVISAO_PRISAO, MODALIDADES_PRISAO, orientacaoPorModalidade } from "../src/lib/prazos/revisao-prisao";

describe("Medição determinística de intervalos", () => {
  test("mede período de dias sem converter em prescrição", () => {
    const result = medirIntervalo("2026-11-10", "2026-11-15");
    expect(result.diasCorridos).toBe(5);
    expect(result.diasSuspensosInformados).toBe(0);
    expect(result.diasDescontadasSuspensoes).toBe(5);
    expect(result.observacoes.join(" ")).toContain("prescrição penal");
  });

  test("desconta suspensão comprovada no intervalo (início, fim]", () => {
    const result = medirIntervalo("2026-11-10", "2026-11-15", [
      { inicio: "2026-11-12", fim: "2026-11-13" },
    ]);
    expect(result.diasSuspensosInformados).toBe(2);
    expect(result.diasDescontadasSuspensoes).toBe(3);
  });

  test("união de suspensões sobrepostas impede desconto em duplicidade", () => {
    const result = medirIntervalo("2026-11-10", "2026-11-15", [
      { inicio: "2026-11-11", fim: "2026-11-13" },
      { inicio: "2026-11-13", fim: "2026-11-15" },
    ]);
    expect(result.diasSuspensosInformados).toBe(5);
    expect(result.diasDescontadasSuspensoes).toBe(0);
    expect(result.periodosConsiderados).toHaveLength(1);
  });

  test("ignora o dia inicial e recorta suspensões fora do período", () => {
    const result = medirIntervalo("2026-11-10", "2026-11-13", [
      { inicio: "2026-11-01", fim: "2026-11-11" },
      { inicio: "2026-11-20", fim: "2026-11-30" },
    ]);
    expect(result.diasCorridos).toBe(3);
    expect(result.diasSuspensosInformados).toBe(1);
    expect(result.periodosConsiderados).toEqual([{ inicio: "2026-11-11", fim: "2026-11-11" }]);
  });

  test("marco de 90 dias é referência, não soltura automática", () => {
    const result = executarMedicaoIntervalo({
      inicio: "2026-08-12", fim: "2026-11-10", calcularMarco90: true, modalidadePrisao: "preventiva",
    });
    expect(result.marco90Dias).toBe("2026-11-10");
    expect(result.diasAteMarco90).toBe(0);
    expect(result.observacoes.join(" ")).toContain("soltura automática");
  });

  test("bloqueia intervalos e suspensões inválidos", () => {
    expect(() => medirIntervalo("2026-11-15", "2026-11-10")).toThrow();
    expect(() => medirIntervalo("2026-11-10", "2026-11-15", [
      { inicio: "2026-11-14", fim: "2026-11-11" },
    ])).toThrow();
    expect(() => executarMedicaoIntervalo({
      inicio: "2026-02-30", fim: "2026-11-15",
    })).toThrow();
  });
});

describe("Triagem de PDF e IDs", () => {
  test("vincula datas e IDs candidatos às páginas sem classificar os atos", () => {
    const pdf = [
      "[Página 1]",
      "Denúncia ID. 123456789 em 10/11/2026. ID. 123456789 repetido.",
      "[Página 2]",
      "Documento id 987654321 em 2026-11-15.",
      "[Página 3]",
      "[Sem texto extraível nesta página]",
    ].join("\n");
    const indice = indexarReferenciasPdf(pdf);
    expect(indice.datas).toEqual([
      { valor: "10/11/2026", pagina: 1 },
      { valor: "2026-11-15", pagina: 2 },
    ]);
    expect(indice.ids).toEqual([
      { valor: "123456789", pagina: 1 },
      { valor: "987654321", pagina: 2 },
    ]);
    expect(indice.paginasComTexto).toBe(2);
  });

  test("não gera marcos quando IDs e datas estão ausentes", () => {
    const indice = indexarReferenciasPdf("[Página 1]\nTexto jurídico sem data e sem identificadores.");
    expect(indice.ids).toHaveLength(0);
    expect(indice.datas).toHaveLength(0);
  });
});

describe("Revisão de prisão provisória", () => {
  test("oferece identificação por documentos, preventiva, temporária, flagrante e outra modalidade", () => {
    expect(MODALIDADES_PRISAO.map((m) => m.valor))
      .toEqual(["identificar", "preventiva", "temporaria", "flagrante", "outra"]);
    expect(ORIENTACAO_REVISAO_PRISAO).toContain("FLAGRANTE");
    expect(ORIENTACAO_REVISAO_PRISAO).toContain("TEMPORÁRIA");
    expect(ORIENTACAO_REVISAO_PRISAO).toContain("PREVENTIVA");
    expect(orientacaoPorModalidade("identificar")).toContain("Não calcule automaticamente a revisão de 90 dias");
    expect(orientacaoPorModalidade("temporaria")).toContain("Não aplique a revisão de 90 dias");
    expect(orientacaoPorModalidade("flagrante")).toContain("Não aplique 90 dias");
  });

  test("marco de 90 dias não é calculado para temporária e flagrante", () => {
    for (const modalidadePrisao of ["temporaria", "flagrante", "outra", "indefinida"] as const) {
      expect(() => executarMedicaoIntervalo({
        inicio: "2026-08-12", fim: "2026-11-10", calcularMarco90: true, modalidadePrisao,
      })).toThrow(/exclusiva de prisão preventiva/);
    }
    expect(() => executarMedicaoIntervalo({
      inicio: "2026-08-12", fim: "2026-11-10", calcularMarco90: true,
    })).toThrow(/exclusiva de prisão preventiva/);
  });

  test("intervalos comuns podem ser medidos sem disparar alerta de 90 dias", () => {
    const r = executarMedicaoIntervalo({
      inicio: "2026-11-04", fim: "2026-11-10", modalidadePrisao: "flagrante",
    });
    expect(r.diasCorridos).toBe(6);
    expect(r.marco90Dias).toBeUndefined();
  });

  test("temporária conta o cumprimento como primeiro dia (art. 2º, § 8º)", () => {
    const r = conferirPrazoTemporaria({
      dataCumprimento: "2026-11-10", prazoDiasMandado: 5, dataReferencia: "2026-11-13",
      dataLibertacaoMandado: "2026-11-15",
    });
    expect(r.dataLimitePorContagemInclusiva).toBe("2026-11-14");
    expect(r.primeiroDiaAposPrazo).toBe("2026-11-15");
    expect(r.diasDeCumprimentoAteReferencia).toBe(4);
    expect(r.divergenciaComDataDoMandado).toBe(false);
    expect(r.diasAteDataLimiteCalculada).toBe(1);
  });

  test("compara data de libertação informada no mandado sem alterar a data legal", () => {
    const r = executarPrazoTemporaria({
      modalidadePrisao: "temporaria", dataCumprimento: "2026-11-10",
      prazoDiasMandado: 30, dataReferencia: "2026-11-15",
      dataLibertacaoMandado: "2026-12-11",
    });
    expect(r.dataLimitePorContagemInclusiva).toBe("2026-12-09");
    expect(r.primeiroDiaAposPrazo).toBe("2026-12-10");
    expect(r.divergenciaComDataDoMandado).toBe(true);
  });

  test("cálculo de temporária bloqueia tipo incorreto, prazo e datas inválidos", () => {
    expect(() => executarPrazoTemporaria({
      modalidadePrisao: "flagrante", dataCumprimento: "2026-11-10",
      prazoDiasMandado: 5, dataReferencia: "2026-11-11",
    })).toThrow();
    expect(() => conferirPrazoTemporaria({
      dataCumprimento: "2026-11-10", prazoDiasMandado: 0, dataReferencia: "2026-11-11",
    })).toThrow();
    expect(() => conferirPrazoTemporaria({
      dataCumprimento: "2026-11-31", prazoDiasMandado: 5, dataReferencia: "2026-12-03",
    })).toThrow();
    expect(() => conferirPrazoTemporaria({
      dataCumprimento: "2026-11-10", prazoDiasMandado: 5, dataReferencia: "2026-11-09",
    })).toThrow(/anterior ao cumprimento/);
  });
});

describe("Conferência do mandado e segurança da liberação", () => {
  test("data de soltura anterior informada no mandado não substitui a contagem inclusiva", () => {
    const calculo = conferirPrazoTemporaria({
      dataCumprimento: "2026-11-10",
      prazoDiasMandado: 5,
      dataReferencia: "2026-11-11",
      dataLibertacaoMandado: "2026-11-13",
    });
    expect(calculo.dataLimitePorContagemInclusiva).toBe("2026-11-14");
    expect(calculo.primeiroDiaAposPrazo).toBe("2026-11-15");
    expect(calculo.dataLibertacaoMandado).toBe("2026-11-13");
    expect(calculo.divergenciaComDataDoMandado).toBe(true);
    expect(calculo.observacoes.join(" ")).toContain("não demonstra, isoladamente, erro do mandado");
  });
});
