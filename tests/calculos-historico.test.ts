import { describe, expect, test } from "bun:test";
import {
  ehHistoricoCalculo,
  historicosDoMesmoProcesso,
  numeroCandidatoPdf,
  PREFIXO_HISTORICO_CALCULO,
  tituloHistoricoCalculo,
} from "../src/lib/prazos/historico-calculos";

describe("Histórico individual de relatórios processuais", () => {
  test("identifica registros novos e antigos sem capturar conversas comuns", () => {
    expect(ehHistoricoCalculo(PREFIXO_HISTORICO_CALCULO + "Prescrição penal · 8000373-72.2020.8.05.0067")).toBe(true);
    expect(ehHistoricoCalculo("Prescrição penal — 8000373-72.2020.8.05.0067")).toBe(true);
    expect(ehHistoricoCalculo("Revisão da prisão preventiva")).toBe(true);
    expect(ehHistoricoCalculo("Revisão de prisão provisória")).toBe(true);
    expect(ehHistoricoCalculo("Certidão de comparecimento")).toBe(false);
  });

  test("a identificação por número é indicativa e extraída do PDF, não consultada no acervo", () => {
    const numero = "8000373-72.2020.8.05.0067";
    expect(numeroCandidatoPdf(numero + "-autos.pdf", "Texto qualquer")).toBe(numero);
    expect(numeroCandidatoPdf("processo.pdf", "[Página 1] Processo " + numero)).toBe(numero);
    expect(numeroCandidatoPdf("processo.pdf", "Nenhum número CNJ informado.")).toBeNull();
  });

  test("título armazena a modalidade e identificação sugerida sem expor PDF original", () => {
    const titulo = tituloHistoricoCalculo(
      "Prescrição penal", "autos.pdf", "8000373-72.2020.8.05.0067",
    );
    expect(titulo).toBe(PREFIXO_HISTORICO_CALCULO + "Prescrição penal · 8000373-72.2020.8.05.0067");
    expect(titulo).not.toContain("[Página");
    expect(tituloHistoricoCalculo("Excesso de prazo", "autos.pdf", null)).toContain("autos");
  });

  test("alerta de possível duplicidade só cruza relatórios reconhecidos", () => {
    const numero = "8000373-72.2020.8.05.0067";
    const conversas = [
      { titulo: PREFIXO_HISTORICO_CALCULO + "Prescrição penal · " + numero },
      { titulo: "Revisão de prisão provisória — " + numero },
      { titulo: "Pesquisa cadastral de " + numero },
      { titulo: PREFIXO_HISTORICO_CALCULO + "Prescrição penal · 8001226-71.2026.8.05.0067" },
    ];
    expect(historicosDoMesmoProcesso(conversas, numero)).toBe(2);
    expect(historicosDoMesmoProcesso(conversas, null)).toBe(0);
  });
});
