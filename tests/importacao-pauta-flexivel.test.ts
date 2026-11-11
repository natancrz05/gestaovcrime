import { describe, expect, test } from "bun:test";
import { tipoAudienciaCanonico, TIPOS_AUDIENCIA } from "../src/lib/processos/audiencias";
import { orgaoPertenceUnidade } from "../src/lib/processos/orgaos-pauta";
import { papelEhReu } from "../src/lib/processos/papeis-pauta";
import { analisarPautaAudiencias, montarLinhaPauta, type LinhaPautaAudiencia } from "../src/lib/processos/importacao-pauta-audiencias";
import type { ProcessoCompleto } from "../src/lib/processos/modelo";

const numero = "8001234-56.2026.8.05.0067";
const numero2 = "8001235-56.2026.8.05.0067";
const orgao = "Vara Plena da Comarca de Coração de Maria";
const base: LinhaPautaAudiencia = {
  pagina: 1,
  data: "2026-11-12",
  horario: "09:00",
  numero, orgao,
  classe: "AUTO DE PRISÃO EM FLAGRANTE",
  tipo: "Audiência de apresentação",
  tipoOriginal: "Audiência de apresentação",
  salaOriginal: "",
  local: "Outro",
  modalidade: "Presencial",
  situacao: "Agendada",
  situacaoOriginal: "Designada",
  pessoas: [],
  reus: [],
};

const processo = (classe = "AUTO DE PRISÃO EM FLAGRANTE") =>
  ({ id: "processo-id", numero, classe, reus: [], audiencias: [] }) as unknown as ProcessoCompleto;

describe("Leitor de pautas PJe: tipos e órgãos", () => {
  test("reconhece audiência de apresentação com ou sem prefixo", () => {
    expect(tipoAudienciaCanonico("Audiência de Apresentação")).toBe("Audiência de apresentação");
    expect(tipoAudienciaCanonico("APRESENTAÇÃO")).toBe("Audiência de apresentação");
    expect(TIPOS_AUDIENCIA).toContain("Audiência de apresentação");
  });
  test("preserva novas finalidades do PJe sem forçar categoria Outra", () => {
    expect(tipoAudienciaCanonico("Audiência de escuta inicial")).toBe("Audiência de escuta inicial");
  });
  test("identifica Vara Plena, Vara Única e Juízo de Direito de Coração de Maria", () => {
    expect(orgaoPertenceUnidade(orgao)).toBe(true);
    expect(orgaoPertenceUnidade("Vara Única de Coração de Maria")).toBe(true);
    expect(orgaoPertenceUnidade("Juízo de Direito da Comarca de Coração de Maria")).toBe(true);
    expect(orgaoPertenceUnidade("Vara Criminal de Feira de Santana")).toBe(false);
  });
  test("reconhece papéis de adolescentes em apresentação", () => {
    for (const papel of ["ADOLESCENTE", "ADOLESCENTE EM CONFLITO COM A LEI", "REPRESENTADO", "APREENDIDO"]) {
      expect(papelEhReu(papel)).toBe(true);
    }
    expect(papelEhReu("TESTEMUNHA")).toBe(false);
  });
});

describe("Leitor de pauta: registro parcial sem invenção", () => {
  const colunas = () => ({
    data: ["12/11/2026 09:00"],
    processo: [numero],
    orgao: [orgao],
    partes: [],
    classe: [],
    tipo: ["Audiência de apresentação"],
    sala: [],
    situacao: ["Designada"],
  });
  test("cria linha de apresentação mesmo sem réu, classe ou sala", () => {
    const r = montarLinhaPauta(1, colunas());
    expect(r.erro).toBeUndefined();
    expect(r.linha?.tipo).toBe("Audiência de apresentação");
    expect(r.linha?.reus).toHaveLength(0);
    expect(r.linha?.classe).toBe("Classe não informada na pauta");
    expect(r.linha?.local).toBe("Outro");
  });
  test("uma finalidade nova não bloqueia a linha", () => {
    const r = montarLinhaPauta(1, { ...colunas(), tipo: ["Audiência de escuta inicial"] });
    expect(r.erro).toBeUndefined();
    expect(r.linha?.tipo).toBe("Audiência de escuta inicial");
  });
  test("data, CNJ e horário ainda são essenciais", () => {
    expect(montarLinhaPauta(1, { ...colunas(), processo: ["123"] }).erro?.motivo).toContain("número CNJ inválido");
    expect(montarLinhaPauta(1, { ...colunas(), data: ["12/11/2026 29:10"] }).erro?.motivo).toContain("horário inválido");
    expect(montarLinhaPauta(1, { ...colunas(), data: ["32/11/2026 09:00"] }).erro?.motivo).toContain("data inválida");
  });
});

describe("Importação parcial: sem bloqueio global", () => {
  test("erros de outras linhas não bloqueiam audiência íntegra", () => {
    const analise = analisarPautaAudiencias([base], [], [
      { pagina: 2, numero: numero2, motivo: "Situação ilegível" },
    ]);
    expect(analise.itens).toHaveLength(1);
    expect(analise.itens[0]?.estado).toBe("nova");
    expect(analise.erros).toHaveLength(1);
  });
  test("classe divergente não impede inclusão de audiência no processo", () => {
    const analise = analisarPautaAudiencias([base], [processo("TERMO CIRCUNSTANCIADO")]);
    expect(analise.itens[0]?.estado).toBe("nova");
    expect(analise.avisos.some((i) => i.motivo.includes("Classe divergente"))).toBe(true);
  });
  test("conflito no mesmo horário é isolado e outra audiência continua válida", () => {
    const linhas = [
      base,
      { ...base, tipo: "Audiência de instrução e julgamento", tipoOriginal: "Audiência de instrução e julgamento" },
      { ...base, numero: numero2, horario: "10:00", tipo: "Audiência de apresentação" },
    ];
    const analise = analisarPautaAudiencias(linhas, []);
    expect(analise.conflitos).toBe(2);
    expect(analise.itens.filter((i) => i.estado === "nova")).toHaveLength(1);
  });
  test("pauta com outra jurisdição ignora somente aquele processo", () => {
    const analise = analisarPautaAudiencias([
      base,
      { ...base, numero: numero2, orgao: "Vara Criminal de Feira de Santana" },
    ], []);
    expect(analise.itens).toHaveLength(1);
    expect(analise.linhasOutraJurisdicao).toBe(1);
  });
  test("repetição idêntica é ignorada sem duplicar audiência", () => {
    const analise = analisarPautaAudiencias([base, { ...base }], []);
    expect(analise.itens).toHaveLength(1);
    expect(analise.duplicadasArquivo).toHaveLength(1);
  });
});
