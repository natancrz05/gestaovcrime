import { describe, expect, test } from "bun:test";
import {
  ehHistoricoCalculo,
  historicosDoMesmoProcesso,
  numeroCandidatoPdf,
  nomeReuCandidatoPdf,
  paginarHistorico,
  PREFIXO_HISTORICO_CALCULO,
  TAMANHO_PAGINA_HISTORICO,
  tituloHistoricoCalculo,
  tituloVisivelHistorico,
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
    expect(titulo).toBe(PREFIXO_HISTORICO_CALCULO + "8000373-72.2020.8.05.0067");
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

describe("Uso responsável e identificação conservadora", () => {
  test("não identifica automaticamente número ausente no cabeçalho do PDF", () => {
    const numero = "8000373-72.2020.8.05.0067";
    const texto = "Capa digitalizada sem número legível. ".repeat(150) + numero;
    expect(numeroCandidatoPdf("autos.pdf", texto)).toBeNull();
    // O arquivo continua apto à análise: a identificação é opcional.
    expect(tituloHistoricoCalculo("Prescrição penal", "autos.pdf", null)).toContain("autos");
  });
});

describe("Paginação do histórico: cinco análises por vez", () => {
  const registros = Array.from({ length: 13 }, (_, i) => ({ id: i + 1, titulo: "Análise " + (i + 1) }));

  test("a primeira página mostra os cinco primeiros registros", () => {
    const pagina = paginarHistorico(registros, 1);
    expect(TAMANHO_PAGINA_HISTORICO).toBe(5);
    expect(pagina.registros.map((x) => x.id)).toEqual([1, 2, 3, 4, 5]);
    expect(pagina.totalPaginas).toBe(3);
    expect(pagina.inicio).toBe(1);
    expect(pagina.fim).toBe(5);
    expect(pagina.total).toBe(13);
  });

  test("a última página mostra apenas registros restantes", () => {
    const pagina = paginarHistorico(registros, 3);
    expect(pagina.registros.map((x) => x.id)).toEqual([11, 12, 13]);
    expect(pagina.inicio).toBe(11);
    expect(pagina.fim).toBe(13);
  });

  test("página além do limite e lista vazia permanecem válidas", () => {
    expect(paginarHistorico(registros, 20).paginaAtual).toBe(3);
    expect(paginarHistorico(registros, -3).paginaAtual).toBe(1);
    const vazia = paginarHistorico([], 1);
    expect(vazia.registros).toEqual([]);
    expect(vazia.inicio).toBe(0);
    expect(vazia.totalPaginas).toBe(1);
  });

  test("a paginação recebe o histórico filtrado, preservando a pesquisa", () => {
    const filtrados = registros.filter((r) => r.titulo.includes("1"));
    expect(paginarHistorico(filtrados, 1).registros).toHaveLength(5);
    expect(paginarHistorico(filtrados, 2).paginaAtual).toBe(1);
  });
});

describe("Identificação do réu e títulos por processo", () => {
  const numero = "8000373-72.2020.8.05.0067";

  test("extrai nome do campo réu expresso no cabeçalho do PJe", () => {
    const texto = "[Página 1] Processo " + numero + " RÉU: JAILTON SANTOS DAMASCENO CPF: 000.000.000-00";
    expect(nomeReuCandidatoPdf(texto)).toBe("JAILTON SANTOS DAMASCENO");
    expect(tituloHistoricoCalculo("Prescrição penal", "autos.pdf", numero, nomeReuCandidatoPdf(texto)))
      .toBe(PREFIXO_HISTORICO_CALCULO + numero + " — JAILTON SANTOS DAMASCENO");
  });

  test("também reconhece campos acusado e polo passivo com nomes próprios", () => {
    expect(nomeReuCandidatoPdf("[Página 1] Acusado: Jailton Santos Damasceno; Documento: 123"))
      .toBe("Jailton Santos Damasceno");
    expect(nomeReuCandidatoPdf("[Página 1] POLO PASSIVO: JOÃO DA SILVA CPF: 123"))
      .toBe("JOÃO DA SILVA");
  });

  test("não inventa o réu sem campo claro no PDF", () => {
    expect(nomeReuCandidatoPdf("A testemunha Jailton Santos Damasceno declarou os fatos.")).toBeNull();
    expect(nomeReuCandidatoPdf("RÉU: não identificado.")).toBeNull();
    expect(tituloHistoricoCalculo("Prescrição penal", "autos.pdf", numero))
      .toBe(PREFIXO_HISTORICO_CALCULO + numero);
  });

  test("títulos legados passam a exibir a numeração em primeiro lugar", () => {
    expect(tituloVisivelHistorico("Prescrição penal — " + numero))
      .toBe(numero + " · Prescrição penal");
    expect(tituloVisivelHistorico(PREFIXO_HISTORICO_CALCULO + "Prescrição penal · " + numero))
      .toBe(numero + " · Prescrição penal");
    expect(tituloVisivelHistorico(PREFIXO_HISTORICO_CALCULO + numero + " — Jailton Santos Damasceno"))
      .toBe(numero + " — Jailton Santos Damasceno");
  });
});

describe("Paginação após alteração dos filtros", () => {
  test("uma nova pesquisa com poucos registros mantém uma página válida", () => {
    const todos = Array.from({ length: 23 }, (_, i) => ({ titulo: "Processo " + (i + 1), indice: i + 1 }));
    const paginaAntiga = paginarHistorico(todos, 5);
    expect(paginaAntiga.registros).toHaveLength(3);
    const filtrados = todos.filter((item) => item.indice === 2);
    expect(paginarHistorico(filtrados, 5).paginaAtual).toBe(1);
    expect(paginarHistorico(filtrados, 5).registros).toEqual([{ titulo: "Processo 2", indice: 2 }]);
  });
});
