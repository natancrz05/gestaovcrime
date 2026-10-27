import { describe, expect, test } from "bun:test";
import { itemCentral } from "../src/lib/processos/central";
import type { ProcessoCompleto } from "../src/lib/processos/modelo";

function processoComAudiencia(situacao: string, pje_tarefas = "Minutar despacho"): ProcessoCompleto {
  return {
    id: "processo-1",
    numero: "0000001-01.2026.8.05.0067",
    classe: "Ação Penal",
    assunto: "",
    comarca: "",
    unidade: "",
    data_distribuicao: null,
    status: "Ativo",
    fase: "",
    observacao_geral: "",
    responsavel: "",
    criado_em: "2026-01-01",
    pje_tarefas,
    pje_ultima_mov_data: "2026-10-01",
    partes: [],
    reus: [],
    movimentacoes: [],
    observacoes_internas: [],
    audiencias: [{
      id: "audiencia-1",
      processo_id: "processo-1",
      tipo: "Audiência de instrução e julgamento",
      data: "2026-11-10",
      horario: "09:00",
      modalidade: "Presencial",
      local: "Sala de Audiências",
      situacao,
      observacao: "",
      criado_em: "2026-10-01",
    }],
    pendencias: [],
    prioridades: [],
  };
}

describe("Central de Audiências", () => {
  test("mantém o processo quando há audiência agendada, mesmo que o fluxo do PJe seja outro", () => {
    expect(itemCentral(processoComAudiencia("Agendada"), "2026-10-27")).not.toBeNull();
  });

  test("mantém audiência redesignada pendente mesmo fora do fluxo de audiência do PJe", () => {
    expect(itemCentral(processoComAudiencia("Redesignada"), "2026-10-27")).not.toBeNull();
  });

  test("respeita o mesmo conjunto de pendências calculado pela lista de audiências", () => {
    const p = processoComAudiencia("Realizada", "Minutar despacho");
    expect(itemCentral(p, "2026-10-27", new Set([p.id]))).not.toBeNull();
  });

  test("não considera situações finalizadas como audiência pendente", () => {
    for (const situacao of ["Realizada", "Cancelada", "Não realizada", "Convertida em diligência"]) {
      expect(itemCentral(processoComAudiencia(situacao), "2026-10-27")).toBeNull();
    }
  });

  test("processo sem audiência cadastrada ainda entra quando a tarefa do PJe indica audiência", () => {
    const p = processoComAudiencia("Realizada", "Audiência - manipular");
    expect(itemCentral(p, "2026-10-27")).not.toBeNull();
  });
});
