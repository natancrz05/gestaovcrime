import { describe, expect, test } from "bun:test";
import {
  analisarSincronizacaoPautaBeta,
  situacaoPautaBeta,
  type LinhaPautaBeta,
  type ProcessoSistemaBeta,
} from "../src/lib/processos/sincronizacao-pauta-beta-core";

function linha(parcial: Partial<LinhaPautaBeta> = {}): LinhaPautaBeta {
  return {
    pagina: 1,
    data: "2026-06-03",
    horario: "10:20",
    numero: "8001543-06.2025.8.05.0067",
    orgao: "VARA CRIMINAL DE CORAÇÃO DE MARIA",
    classe: "AÇÃO PENAL",
    tipo: "Audiência de instrução e julgamento",
    tipoOriginal: "Instrução e Julgamento",
    salaOriginal: "Sala de audiência principal",
    situacao: "Realizada",
    situacaoOriginal: "realizada",
    ...parcial,
  };
}

function processo(
  audiencias: ProcessoSistemaBeta["audiencias"] = [],
): ProcessoSistemaBeta {
  return {
    id: "processo-1",
    numero: "8001543-06.2025.8.05.0067",
    audiencias,
  };
}

describe("Sincronização de pautas BETA", () => {
  test("não-realizada nunca é interpretada como Realizada", () => {
    expect(situacaoPautaBeta("não-realizada")).toBe("NaoRealizada");
    expect(situacaoPautaBeta("realizada")).toBe("Realizada");
  });

  test("duas linhas diferentes do mesmo processo/data/horário vão para conferência", () => {
    const analise = analisarSincronizacaoPautaBeta(
      [
        linha({
          tipo: "Audiência de depoimento especial",
          tipoOriginal: "Audiência de Depoimento Especial",
          situacao: "Redesignada",
          situacaoOriginal: "redesignada",
        }),
        linha(),
      ],
      [processo()],
    );

    expect(analise.contagens.conferir).toBe(2);
    expect(analise.contagens["atualizacao-segura"]).toBe(0);
  });

  test("realizada correspondente a audiência agendada é atualização segura", () => {
    const analise = analisarSincronizacaoPautaBeta(
      [linha()],
      [
        processo([
          {
            id: "aud-1",
            data: "2026-06-03",
            horario: "10:20",
            tipo: "Audiência de instrução e julgamento",
            situacao: "Agendada",
          },
        ]),
      ],
    );

    expect(analise.contagens["atualizacao-segura"]).toBe(1);
    expect(analise.itens[0]?.sugestao).toContain("realizada");
  });

  test("processo ausente não é criado pela beta", () => {
    const analise = analisarSincronizacaoPautaBeta([linha()], []);
    expect(analise.contagens["processo-ausente"]).toBe(1);
  });

  test("realizada + convertida em diligência não cria duas audiências", () => {
    const analise = analisarSincronizacaoPautaBeta(
      [
        linha(),
        linha({
          situacao: "ConvertidaDiligencia",
          situacaoOriginal: "convertida em diligência",
        }),
      ],
      [
        processo([
          {
            id: "aud-1",
            data: "2026-06-03",
            horario: "10:20",
            tipo: "Audiência de instrução e julgamento",
            situacao: "Agendada",
          },
        ]),
      ],
    );

    expect(analise.contagens["atualizacao-segura"]).toBe(1);
    expect(analise.contagens["resultado-complementar"]).toBe(1);
    expect(analise.contagens.conferir).toBe(0);
  });
});
