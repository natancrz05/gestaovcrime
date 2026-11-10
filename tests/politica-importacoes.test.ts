import { describe, expect, test } from "bun:test";
import {
  campoPjeLimpaQuandoVazio,
} from "../src/lib/processos/importacao";
import {
  tipoPrisaoAposReimportacao,
} from "../src/lib/processos/importacao-reus";
import {
  proximoComparecimentoAposImportacao,
} from "../src/lib/processos/importacao-comparecimentos";

describe("Política previsível das importações", () => {
  test("campos operacionais do PJe são limpos quando a coluna existe e vem vazia", () => {
    for (const campo of [
      "pje_qtde_dias",
      "pje_situacao",
      "pje_tarefas",
      "pje_prioridade",
      "pje_descricao_prioridade",
      "pje_concluso",
      "pje_segredo",
      "pje_localizacao",
      "pje_sistema",
    ]) {
      expect(campoPjeLimpaQuandoVazio(campo)).toBe(true);
    }
  });

  test("campos estáveis não são apagados apenas porque a célula veio vazia", () => {
    for (const campo of [
      "classe",
      "assunto",
      "data_distribuicao",
      "pje_classe_codigo",
      "pje_ultima_mov_data",
      "pje_ultima_mov_descricao",
      "pje_autor",
      "pje_reu",
    ]) {
      expect(campoPjeLimpaQuandoVazio(campo)).toBe(false);
    }
  });

  test("reimportação atualiza tipo prisional quando o cadastro ainda segue a classificação anterior da planilha", () => {
    expect(
      tipoPrisaoAposReimportacao({
        tipoAtual: "Prisão preventiva",
        especieAtual: "PREVENTIVA",
        tipoImportado: "Prisão temporária",
      }),
    ).toBe("Prisão temporária");
  });

  test("reimportação preserva tipo prisional alterado manualmente pelo servidor", () => {
    expect(
      tipoPrisaoAposReimportacao({
        tipoAtual: "Outra",
        especieAtual: "PREVENTIVA",
        tipoImportado: "Prisão preventiva",
      }),
    ).toBe("Outra");
  });

  test("comparecimento local mais recente prevalece sobre assinatura antiga importada", () => {
    expect(
      proximoComparecimentoAposImportacao({
        referenciaImportada: "2026-08-01",
        ultimaRealizadaLocal: "2026-10-15",
        proximoAtual: "2026-11-01",
        intervaloMeses: 1,
      }),
    ).toBe("2026-11-15");
  });

  test("reimportação de comparecimento nunca faz a próxima data retroceder", () => {
    expect(
      proximoComparecimentoAposImportacao({
        referenciaImportada: "2026-08-01",
        ultimaRealizadaLocal: null,
        proximoAtual: "2026-11-20",
        intervaloMeses: 1,
      }),
    ).toBe("2026-11-20");
  });

  test("referência importada mais recente pode avançar a próxima data", () => {
    expect(
      proximoComparecimentoAposImportacao({
        referenciaImportada: "2026-11-05",
        ultimaRealizadaLocal: "2026-10-01",
        proximoAtual: "2026-11-01",
        intervaloMeses: 1,
      }),
    ).toBe("2026-12-05");
  });
});
