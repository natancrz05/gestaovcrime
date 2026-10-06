import { describe, expect, test } from "bun:test";
import {
  agruparItensAtencaoBeta,
  contarGruposAtencaoBeta,
  filtrarGruposAtencaoBeta,
} from "../src/lib/processos/agrupamento-alertas";
import {
  chaveOcultacaoAlertaBeta,
  montarItensAtencaoBeta,
  type ItemAtencaoBeta,
} from "../src/lib/processos/alertas-beta";
import type { ProcessoCompleto } from "../src/lib/processos/modelo";
import type { Comparecimento } from "../src/lib/processos/comparecimentos";

const NUMERO = "0000001-01.2026.8.05.0067";

function alerta(id: string, campos: Partial<ItemAtencaoBeta> = {}): ItemAtencaoBeta {
  return {
    id,
    processoId: "processo-1",
    processoNumero: NUMERO,
    pessoa: "Ana",
    categoria: "+100 dias",
    titulo: "278 dias sem movimentação",
    descricao: "",
    nivel: "informativo",
    origem: "Automático",
    modulo: "Processos",
    dataLimite: null,
    diasRestantes: null,
    ...campos,
  };
}

function processo(campos: Partial<ProcessoCompleto> = {}): ProcessoCompleto {
  return {
    id: "processo-1",
    numero: NUMERO,
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
    pje_ultima_mov_data: "2026-01-01",
    pje_tarefas: "Aguardando audiência",
    partes: [],
    reus: [],
    movimentacoes: [
      {
        id: "movimentacao-1",
        processo_id: "processo-1",
        data: "2026-01-01",
        descricao: "Certidão juntada",
        tipo: "Certidão",
        observacao: "",
        criado_em: "2026-01-01",
      },
    ],
    observacoes_internas: [],
    audiencias: [],
    pendencias: [],
    prioridades: [],
    ...campos,
  };
}

const comparecimento: Comparecimento = {
  id: "comparecimento-1",
  processo_id: "processo-1",
  pessoa: "Ana",
  cpf: "",
  dados_planilha: null,
  conferir: false,
  motivo_conferencia: "",
  numeros_informados: [NUMERO],
  data_inicio: "2026-01-01",
  periodicidade: "Mensal",
  intervalo_meses: 1,
  proximo: "2026-03-01",
  observacao: "",
  situacao: "Ativo",
  criado_em: "2026-01-01",
  processos: { numero: NUMERO },
  comparecimento_registros: [],
};

describe("Consolidação da Central de Prioridades e Alertas", () => {
  test("reúne +100 dias, audiência e comparecimento gerados pelo motor atual", () => {
    const itens = montarItensAtencaoBeta({
      processos: [processo()],
      presos: [],
      comparecimentos: [comparecimento],
      hoje: "2026-10-06",
    }).filter((i) => i.processoId !== null);
    expect(itens.map((i) => i.modulo).sort()).toEqual([
      "Audiências",
      "Comparecimentos",
      "Processos",
    ]);
    const grupos = agruparItensAtencaoBeta(itens);
    expect(grupos).toHaveLength(1);
    expect(grupos[0]?.motivos).toHaveLength(3);
    expect(grupos[0]?.nivel).toBe("critico");
    expect(contarGruposAtencaoBeta(grupos)).toEqual({
      critico: 1,
      urgente: 0,
      atencao: 0,
      conferir: 0,
      informativo: 0,
      administrativo: 0,
    });
  });

  test("mantém motivos manuais, etiquetas e réus diferentes dentro do mesmo processo", () => {
    const manual = alerta("existente:processo-1:manual:prioridade-1", {
      origem: "Manual",
      nivel: "urgente",
      titulo: "Conferir manifestação (urgente)",
    });
    const etiqueta = alerta("etiqueta:processo-1:etiqueta-1", {
      origem: "Etiqueta",
      nivel: "atencao",
      titulo: "Conferir resposta",
      pessoa: "Bruno",
    });
    const grupos = agruparItensAtencaoBeta([alerta("sem-mov"), etiqueta, manual]);
    expect(grupos[0]?.nivel).toBe("urgente");
    expect(grupos[0]?.motivos[0]).toBe(manual);
    expect(grupos[0]?.motivos[0]?.id.split(":").pop()).toBe("prioridade-1");
    expect(grupos[0]?.pessoa).toBe("Ana · Bruno");
    expect(contarGruposAtencaoBeta(grupos).urgente).toBe(1);
    expect(contarGruposAtencaoBeta(grupos).atencao).toBe(0);
  });

  test("considera ocultações individuais antes de escolher o nível do processo", () => {
    const vencido = alerta("comparecimento-1", {
      nivel: "critico",
      dataLimite: "2026-03-01",
      diasRestantes: -219,
    });
    const semMov = alerta("sem-mov");
    const audiencia = alerta("audiencia", { modulo: "Audiências", categoria: "Audiência" });
    const ocultos = new Set([chaveOcultacaoAlertaBeta(vencido)]);
    const visiveis = [vencido, semMov, audiencia].filter(
      (i) => !ocultos.has(chaveOcultacaoAlertaBeta(i)),
    );
    const grupos = agruparItensAtencaoBeta(visiveis);
    expect(grupos).toHaveLength(1);
    expect(grupos[0]?.nivel).toBe("informativo");
    expect(grupos[0]?.motivos).toEqual([semMov, audiencia]);
    expect(chaveOcultacaoAlertaBeta(vencido)).toBe("comparecimento-1|2026-03-01");
    const novaOcorrencia = { ...vencido, dataLimite: "2026-04-01" };
    expect(ocultos.has(chaveOcultacaoAlertaBeta(novaOcorrencia))).toBe(false);
    expect(contarGruposAtencaoBeta(grupos).informativo).toBe(1);
  });

  test("usa o número normalizado para integrar alertas sem ID ao processo conhecido", () => {
    const semId = alerta("comparecimento", {
      processoId: null,
      processoNumero: NUMERO.replace(/\D/g, ""),
      nivel: "critico",
    });
    const grupos = agruparItensAtencaoBeta([semId, alerta("sem-mov")]);
    expect(grupos).toHaveLength(1);
    expect(grupos[0]?.processoId).toBe("processo-1");
    expect(grupos[0]?.motivos).toHaveLength(2);
  });

  test("não repete motivos idênticos nem altera os itens de origem", () => {
    const original = alerta("sem-mov");
    const itens = [original, { ...original }];
    const copia = JSON.stringify(itens);
    expect(agruparItensAtencaoBeta(itens)[0]?.motivos).toHaveLength(1);
    expect(JSON.stringify(itens)).toBe(copia);
    expect(original.id).toBe("sem-mov");
  });

  test("não junta processos distintos nem registros sem identificação", () => {
    const grupos = agruparItensAtencaoBeta([
      alerta("processo-1"),
      alerta("processo-2", {
        processoId: "processo-2",
        processoNumero: "0000002-02.2026.8.05.0067",
      }),
      alerta("preso-1", { processoId: null, processoNumero: null }),
      alerta("preso-2", { processoId: null, processoNumero: null }),
      alerta("base-pje", { processoId: null, processoNumero: null, nivel: "administrativo" }),
    ]);
    expect(grupos).toHaveLength(5);
    expect(contarGruposAtencaoBeta(grupos).informativo).toBe(4);
    expect(contarGruposAtencaoBeta(grupos).administrativo).toBe(1);
  });

  test("os filtros encontram módulos e categorias secundários sem duplicar a linha", () => {
    const grupos = agruparItensAtencaoBeta([
      alerta("sem-mov"),
      alerta("audiencia", { modulo: "Audiências", categoria: "Audiência" }),
      alerta("comparecimento", {
        modulo: "Comparecimentos",
        categoria: "Comparecimento não registrado",
        nivel: "critico",
        dataLimite: "2026-03-01",
        diasRestantes: -219,
      }),
    ]);
    expect(filtrarGruposAtencaoBeta(grupos, { modulo: "Audiências" })).toHaveLength(1);
    expect(filtrarGruposAtencaoBeta(grupos, { categoria: "+100 dias" })).toHaveLength(1);
    expect(filtrarGruposAtencaoBeta(grupos, { nivel: "critico" })).toHaveLength(1);
    expect(filtrarGruposAtencaoBeta(grupos, { nivel: "informativo" })).toHaveLength(0);
    expect(
      filtrarGruposAtencaoBeta(grupos, { modulo: "Comparecimentos", prazo: "vencidos" }),
    ).toHaveLength(1);
    expect(
      filtrarGruposAtencaoBeta(grupos, { modulo: "Audiências", prazo: "vencidos" }),
    ).toHaveLength(0);
    expect(
      filtrarGruposAtencaoBeta(grupos, { modulo: "Audiências", categoria: "+100 dias" }),
    ).toHaveLength(0);
  });

  test("busca por nome, número e motivos secundários sem aceitar todo texto", () => {
    const grupos = agruparItensAtencaoBeta([
      alerta("sem-mov"),
      alerta("audiencia", { titulo: "Urgência de audiência", pessoa: "João" }),
    ]);
    for (const busca of [NUMERO, NUMERO.replace(/\D/g, ""), "Joao", "audiencia"]) {
      expect(filtrarGruposAtencaoBeta(grupos, { busca })).toHaveLength(1);
    }
    expect(filtrarGruposAtencaoBeta(grupos, { busca: "Inexistente" })).toHaveLength(0);
  });

  test("filtra cada faixa de prazo e mantém a ordem de nível e vencimento", () => {
    const grupos = agruparItensAtencaoBeta([
      alerta("sem-data", { processoId: null, processoNumero: null }),
      ...[-1, 0, 2, 5, 10].map((dias) =>
        alerta(`prazo-${dias}`, {
          processoId: null,
          processoNumero: null,
          nivel: "urgente",
          dataLimite: `2026-10-${String(dias + 6).padStart(2, "0")}`,
          diasRestantes: dias,
        }),
      ),
    ]);
    for (const prazo of ["vencidos", "hoje", "1-3", "4-7", "8-15", "sem"]) {
      expect(filtrarGruposAtencaoBeta(grupos, { prazo })).toHaveLength(1);
    }
    expect(grupos.map((g) => g.motivos[0]?.id)).toEqual([
      "prazo--1",
      "prazo-0",
      "prazo-2",
      "prazo-5",
      "prazo-10",
      "sem-data",
    ]);
  });

  test("preserva a exclusão de +100 dias para fluxos suspensos e em segundo grau", () => {
    for (const p of [
      processo({ pje_tarefas: "Processo suspenso - aguardar" }),
      processo({ pje_tarefas: "Aguardando apreciação pela instância superior - Recursais" }),
    ]) {
      const itens = montarItensAtencaoBeta({
        processos: [p],
        presos: [],
        comparecimentos: [],
        hoje: "2026-10-06",
      }).filter((i) => i.processoId !== null);
      expect(agruparItensAtencaoBeta(itens)).toHaveLength(0);
    }
  });
});
