import { describe, expect, test } from "bun:test";
import { estaPendente } from "../src/lib/processos/audiencias";
import { inadimplenciaCriticaComparecimento, type Comparecimento } from "../src/lib/processos/comparecimentos";
import {
  estadoAlertaSemMovimentacao,
  proximaAudiencia,
  type ProcessoCompleto,
} from "../src/lib/processos/modelo";
import {
  estadoPrazoPreventiva,
  tipoPrisaoOperacional,
} from "../src/lib/processos/reus-presos";
import {
  DADOS_VAZIOS_ALERTAS_BETA,
  montarItensAtencaoBeta,
  type ReuPresoBeta,
} from "../src/lib/processos/alertas-beta";
import { alertasDoProcesso, CONFIG_PRIORIDADES } from "../src/lib/processos/prioridades";

function processoBase(): ProcessoCompleto {
  return {
    id: "proc-1",
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
    pje_tarefas: "",
    partes: [],
    reus: [],
    movimentacoes: [],
    observacoes_internas: [],
    audiencias: [],
    pendencias: [],
    prioridades: [],
  };
}

function presoBase(): ReuPresoBeta {
  return {
    id: "reu-1",
    processo_id: "proc-1",
    nome: "RÉU TESTE",
    preso: true,
    tipo_prisao: "Prisão preventiva",
    especie_cautelar: "Prisão preventiva",
    data_prisao: "2026-08-01",
    situacao: "",
    observacoes: "",
    dados_planilha: {},
    processos: { numero: "0000001-01.2026.8.05.0067" },
  };
}

function comparecimentoBase(): Comparecimento {
  return {
    id: "comp-1",
    processo_id: "proc-1",
    pessoa: "RÉU TESTE",
    cpf: "",
    dados_planilha: null,
    conferir: false,
    motivo_conferencia: "",
    numeros_informados: [],
    data_inicio: "2026-08-01",
    periodicidade: "Mensal",
    intervalo_meses: 1,
    proximo: "2026-09-01",
    observacao: "",
    situacao: "Ativo",
    criado_em: "2026-08-01",
    processos: { numero: "0000001-01.2026.8.05.0067" },
    comparecimento_registros: [],
  };
}

describe("Fonte única das regras críticas", () => {
  test("audiência pendente tem a mesma definição no módulo e no modelo", () => {
    for (const situacao of ["Agendada", "Designada", "Redesignada"]) {
      const p = processoBase();
      p.audiencias = [{
        id: `aud-${situacao}`,
        processo_id: p.id,
        data: "2026-11-20",
        tipo: "Audiência de instrução e julgamento",
        local: "",
        situacao,
        horario: "09:00",
        modalidade: "Presencial",
        observacao: "",
        criado_em: "2026-11-01",
      }];
      expect(estaPendente(p.audiencias[0]!)).toBe(true);
      expect(proximaAudiencia(p, "2026-11-10")?.id).toBe(`aud-${situacao}`);
    }

    for (const situacao of ["Realizada", "Cancelada", "Não realizada", "Convertida em diligência"]) {
      const p = processoBase();
      p.audiencias = [{
        id: `aud-${situacao}`,
        processo_id: p.id,
        data: "2026-11-20",
        tipo: "Audiência de instrução e julgamento",
        local: "",
        situacao,
        horario: "09:00",
        modalidade: "Presencial",
        observacao: "",
        criado_em: "2026-11-01",
      }];
      expect(estaPendente(p.audiencias[0]!)).toBe(false);
      expect(proximaAudiencia(p, "2026-11-10")).toBeNull();
    }
  });

  test("preventiva usa a data da prisão como primeiro marco também na Central de Alertas", () => {
    const preso = presoBase();
    const hoje = "2026-10-25";
    const estado = estadoPrazoPreventiva({
      dataPrisao: preso.data_prisao,
      ultimaReavaliacaoHistorico: null,
      dadosPlanilha: {},
      hoje,
    });

    expect(estado.dataPrisao).toBe("2026-08-01");
    expect(estado.referenciaPrazo).toBe("2026-08-01");
    expect(estado.limite).toBe("2026-10-30");

    const itens = montarItensAtencaoBeta({
      processos: [processoBase()],
      presos: [preso],
      comparecimentos: [],
      auxiliares: DADOS_VAZIOS_ALERTAS_BETA,
      hoje,
    });
    const alerta = itens.find((item) => item.id === "revisao-preventiva:reu-1");
    expect(alerta?.dataLimite).toBe(estado.limite);
    expect(alerta?.diasRestantes).toBe(estado.diasRestantes);
    expect(itens.some((item) => item.id === "preventiva-sem-base:reu-1")).toBe(false);
  });

  test("reavaliação muda apenas a referência do próximo ciclo e preserva a data da prisão", () => {
    const preso = presoBase();
    const hoje = "2026-11-10";
    const estado = estadoPrazoPreventiva({
      dataPrisao: preso.data_prisao,
      ultimaReavaliacaoHistorico: "2026-10-20",
      dadosPlanilha: {},
      hoje,
    });

    expect(estado.dataPrisao).toBe("2026-08-01");
    expect(estado.ultimaReavaliacao).toBe("2026-10-20");
    expect(estado.referenciaPrazo).toBe("2026-10-20");
    expect(estado.limite).toBe("2027-01-18");
  });

  test("tipo de prisão salvo manualmente prevalece sobre espécie antiga importada", () => {
    expect(
      tipoPrisaoOperacional({
        tipoPrisao: "Outra",
        especieCautelar: "Prisão preventiva",
      }),
    ).toBe("Outra");

    const preso = presoBase();
    preso.tipo_prisao = "Outra";
    preso.especie_cautelar = "Prisão preventiva";

    const itens = montarItensAtencaoBeta({
      processos: [processoBase()],
      presos: [preso],
      comparecimentos: [],
      auxiliares: DADOS_VAZIOS_ALERTAS_BETA,
      hoje: "2026-10-25",
    });
    expect(itens.some((item) => item.id.startsWith("revisao-preventiva:"))).toBe(false);
  });

  test("comparecimento crítico é decidido pela mesma regra usada nos alertas", () => {
    const comparecimento = comparecimentoBase();
    const hoje = "2026-10-02";
    const inadimplencia = inadimplenciaCriticaComparecimento(comparecimento, hoje);
    expect(inadimplencia?.proximo).toBe("2026-09-01");

    const itens = montarItensAtencaoBeta({
      processos: [processoBase()],
      presos: [],
      comparecimentos: [comparecimento],
      auxiliares: DADOS_VAZIOS_ALERTAS_BETA,
      hoje,
    });
    const alerta = itens.find((item) => item.id === "comparecimento-inadimplente:comp-1");
    expect(alerta?.dataLimite).toBe(inadimplencia?.proximo);
    expect(alerta?.diasRestantes).toBe(-(inadimplencia?.atraso ?? 0));
  });

  test("+100 dias usa o mesmo estado no módulo de prioridades e nos relatórios", () => {
    const p = processoBase();
    p.movimentacoes = [{
      id: "mov-1",
      processo_id: p.id,
      data: "2026-07-01",
      descricao: "Última movimentação",
      tipo: "Outro",
      observacao: "",
      criado_em: "2026-07-01",
    }];
    const hoje = "2026-11-10";
    const estado = estadoAlertaSemMovimentacao(
      p,
      hoje,
      CONFIG_PRIORIDADES.limiteDiasSemMovimentacao,
    );

    expect(estado.emAlerta).toBe(true);
    expect(
      alertasDoProcesso(p, hoje).some((alerta) => alerta.categoria === "sem-movimentacao"),
    ).toBe(estado.emAlerta);
  });
});
