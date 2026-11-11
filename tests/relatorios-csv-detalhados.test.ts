import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { gerarConteudoCSV } from "../src/lib/relatorios-csv";
import {
  COLUNAS_CSV_EXTRAS, enriquecerRelatorioCSV, type TipoRelatorioCSV,
} from "../src/lib/relatorios-detalhados";
import type { FontesDetalhesCSV } from "../src/lib/relatorios-detalhados";

const numero = "8000373-72.2020.8.05.0067";
const processo = {
  id: "p1", numero, classe: "Ação Penal", assunto: "Contravenção penal",
  status: "Ativo", fase: "Instrução", comarca: "Coração de Maria",
  unidade: "Vara Plena", responsavel: "Secretaria", criado_em: "2020-01-15",
  data_distribuicao: "2020-01-10",
  pje_situacao: "Concluso", pje_tarefas: "Analisar certidão",
  pje_localizacao: "Secretaria", pje_concluso: "Concluso ao juízo",
  pje_ultima_mov_data: "2026-11-01",
  pje_ultima_mov_descricao: "Conclusão",
  reus: [
    { id: "r1", nome: "JAILTON SANTOS DAMASCENO", preso: true },
    { id: "r2", nome: "JOÃO DA SILVA", preso: false },
  ],
  movimentacoes: [{ data: "2026-11-01", tipo: "Decisão", descricao: "Determinou providência" }],
  audiencias: [
    {
      id: "a1", data: "2026-11-25", horario: "10:00", local: "Sala do Júri",
      observacao: "Apresentação", situacao: "Agendada",
      aguardando_nova_data: false, data_realizacao: null,
      datas_anteriores: [{ data: "2026-11-10", horario: "09:00", situacao: "Redesignada" }],
    },
  ],
  pendencias: [{
    id: "pend1", titulo: "Intimar réu", tipo: "Expedir/intimar",
    descricao: "Providenciar intimação", prazo: "2026-11-18",
    prioridade: "alta", status: "A fazer", observacoes: "Oficial de justiça",
    criado_em: "2026-11-04", data_conclusao: null, concluida: false,
  }],
  prioridades: [], partes: [], observacoes_internas: [],
};
const fontes = {
  processos: [processo],
  presos: [{
    id: "r1", processo_id: "p1", nome: "JAILTON SANTOS DAMASCENO",
    situacao: "Custodiado", tipo_prisao: "Prisão preventiva",
    especie_cautelar: "Prisão preventiva", data_prisao: "2026-10-01",
    observacoes: "Reavaliação necessária", dados_planilha: {},
  }],
  comparecimentos: [{
    id: "c1", processo_id: "p1", pessoa: "JAILTON SANTOS DAMASCENO",
    numero, data_inicio: "2026-01-01", intervalo_meses: 1,
    dias: -2, conferir: true, motivo_conferencia: "Conferir assinatura",
    numeros_informados: [numero], observacao: "Cadastro ativo",
    criado_em: "2026-01-01", historico: [{ situacao: "Realizado", observacao: "Assinatura registrada" }],
  }],
  oficios: [{
    id: "o1", ano: 2026, sequencial: 33, processo_id: "p1",
    numero_original: "33/2026", processo_original: numero,
    data_expedicao: "2026-11-01", data_original: "01/11/2026",
    historico_importado: true, fonte_importacao: "Planilha anterior",
    criado_em: "2026-11-01", atualizado_em: "2026-11-02",
  }],
  prioridades: [{
    id: "g1", categoria: "Custódia", descricao: "Verificar revisão",
    dataLimite: "2026-11-20", diasRestantes: 9,
    motivos: [
      { nivel: "urgente", titulo: "Preventiva 90 dias", descricao: "Conferir marco", dataLimite: "2026-11-20", categoria: "Prisões" },
      { nivel: "atencao", titulo: "Sem movimentação", descricao: "Verificar", dataLimite: null, categoria: "Processos" },
    ],
  }],
  reavaliacoes: [{
    reu_id: "r1", data_reavaliacao: "2026-11-01", proxima_data: "2027-01-30",
  }],
} as unknown as FontesDetalhesCSV;

const chaves: Record<TipoRelatorioCSV, { chave: string; processoId: string | null }> = {
  processos: { chave: "p1", processoId: "p1" },
  "presos-provisorios": { chave: "r1", processoId: "p1" },
  "sem-movimentacao": { chave: "p1", processoId: "p1" },
  audiencias: { chave: "a1", processoId: "p1" },
  comparecimentos: { chave: "c1", processoId: "p1" },
  pendencias: { chave: "pend1", processoId: "p1" },
  oficios: { chave: "o1", processoId: "p1" },
  prioridades: { chave: "g1", processoId: "p1" },
};

describe("CSV detalhado dos oito relatórios da Vara", () => {
  for (const tipo of Object.keys(chaves) as TipoRelatorioCSV[]) {
    test("preserva dados e alinhamento em: " + tipo, () => {
      const chave = chaves[tipo];
      const { colunas, linhas } = enriquecerRelatorioCSV(
        tipo, ["Processo", "Campo existente"],
        [{ ...chave, celulas: [numero, "Informação original"] }], fontes,
      );
      expect(colunas.length).toBe(2 + COLUNAS_CSV_EXTRAS[tipo].length);
      expect(linhas).toHaveLength(1);
      expect(linhas[0]?.length).toBe(colunas.length);
      expect(linhas[0]?.slice(0, 2)).toEqual([numero, "Informação original"]);
      expect(linhas[0]?.slice(2).some((v) => v !== "")).toBe(true);
      expect(gerarConteudoCSV(colunas, linhas)).toContain(numero);
    });
  }

  test("preserva nomes de todos os réus e campos PJe, não somente o réu principal", () => {
    const r = enriquecerRelatorioCSV("processos", ["Processo"], [{ chave: "p1", celulas: [numero] }], fontes);
    expect(r.linhas[0]?.[r.colunas.indexOf("Réus cadastrados")]).toContain("JOÃO DA SILVA");
    expect(r.linhas[0]?.[r.colunas.indexOf("Tarefas PJe")]).toBe("Analisar certidão");
    expect(r.linhas[0]?.[r.colunas.indexOf("Qtd. presos")]).toBe(1);
  });

  test("exporta reavaliação efetivamente registrada, sem inventar nova data", () => {
    const r = enriquecerRelatorioCSV("presos-provisorios", ["Processo"], [{ chave: "r1", processoId: "p1", celulas: [numero] }], fontes);
    expect(r.linhas[0]?.[r.colunas.indexOf("Data da última reavaliação registrada")]).toBe("01/11/2026");
    expect(r.linhas[0]?.[r.colunas.indexOf("Data de próxima revisão registrada")]).toBe("30/01/2027");
  });

  test("aceita datas brasileiras da planilha e identifica dias de custódia sem estimativa", () => {
    const fontesBR = {
      ...fontes,
      presos: [{ ...fontes.presos[0], dados_planilha: { "Término do prazo": "21/11/2026" } }],
      reavaliacoes: [],
    } as unknown as FontesDetalhesCSV;
    const r = enriquecerRelatorioCSV("presos-provisorios", ["Processo"], [{ chave: "r1", processoId: "p1", celulas: [numero] }], fontesBR);
    expect(r.linhas[0]?.[r.colunas.indexOf("Término da temporária informado")]).toBe("21/11/2026");
    expect(typeof r.linhas[0]?.[r.colunas.indexOf("Dias em custódia (contagem administrativa)")]).toBe("number");
  });

  test("exporta histórico de redesignações e local da audiência", () => {
    const r = enriquecerRelatorioCSV("audiencias", ["Processo"], [{ chave: "a1", celulas: [numero] }], fontes);
    expect(r.linhas[0]?.[r.colunas.indexOf("Local / sala")]).toBe("Sala do Júri");
    expect(r.linhas[0]?.[r.colunas.indexOf("Histórico de redesignações")]).toContain("10/11/2026");
  });

  test("exporta todos os motivos da prioridade, sem ocultar o segundo motivo", () => {
    const r = enriquecerRelatorioCSV("prioridades", ["Processo"], [{ chave: "g1", celulas: [numero] }], fontes);
    expect(r.linhas[0]?.[r.colunas.indexOf("Quantidade de motivos")]).toBe(2);
    expect(r.linhas[0]?.[r.colunas.indexOf("Detalhamento de todos os motivos")]).toContain("Sem movimentação");
  });

  test("nenhum processo de fora do filtro é incluído", () => {
    const r = enriquecerRelatorioCSV("processos", ["Processo"], [], fontes);
    expect(r.linhas).toEqual([]);
  });
});

describe("CSV compatível e seguro", () => {
  test("abre com BOM UTF-8, separador ponto e vírgula, CRLF e acentos preservados", () => {
    const csv = gerarConteudoCSV(["Descrição", "Processo"], [["Intimação; com observação\ncomplementar", numero]]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"Intimação; com observação\ncomplementar"');
    expect(csv).toContain("\r\n");
    expect(csv).toContain(numero);
  });
  test("neutraliza fórmulas CSV fornecidas por usuário ou documento importado", () => {
    const csv = gerarConteudoCSV(["Descrição"], [
      ["=HYPERLINK(\"https://atacante.exemplo\")"],
      ["  +cmd"],
      ["-12"],
      ["@SUM(A1:A2)"],
    ]);
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain("'  +cmd");
    expect(csv).toContain("'-12");
    expect(csv).toContain("'@SUM");
  });
  test("recusa linha com número incorreto de colunas", () => {
    expect(() => gerarConteudoCSV(["A", "B"], [["apenas um campo"]])).toThrow("Inconsistência");
  });
});

describe("Produtividade: não gerar CSV parcial sem aviso", () => {
  test("exportação busca páginas até o fim e confere o total", () => {
    const componente = readFileSync(new URL("../src/components/relatorios/RelatorioProdutividade.tsx", import.meta.url), "utf8");
    expect(componente).toContain(".range(inicio, inicio + tamanhoLote - 1)");
    expect(componente).toContain("todos.length !== totalEsperado");
    expect(componente).toContain("baixarRelatorioCSV(");
    expect(componente).toContain("A prévia e os agrupamentos");
  });
});
