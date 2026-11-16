import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  agruparPessoas, cpfPessoa, mesmoTitular, podeRegistrarVinculo,
  podeVincularProcesso, SITUACAO_VINCULO_REMOVIDO, vinculosDaPessoa,
} from "../src/lib/processos/comparecimentos-vinculos";
import { montarHtmlCertidaoComparecimento } from "../src/lib/processos/certidao-comparecimento";
import { inadimplenciaCriticaComparecimento } from "../src/lib/processos/comparecimentos";

const pessoas = [
  { id:"v1", cpf:"013.541.375-31", pessoa:"MARIA", processo_id:"p1", situacao:"Ativo" },
  { id:"v2", cpf:"01354137531", pessoa:"MARIA", processo_id:"p2", situacao:"Ativo" },
  { id:"v3", cpf:"013.541.375-31", pessoa:"MARIA", processo_id:"p3", situacao:SITUACAO_VINCULO_REMOVIDO },
  { id:"v4", cpf:"", pessoa:"MARIA", processo_id:"p4", situacao:"Ativo" },
  { id:"v5", cpf:"", pessoa:"MARIA", processo_id:"p5", situacao:"Ativo" },
  { id:"v6", cpf:"098.692.525-08", pessoa:"MARIA", processo_id:"p6", situacao:"Ativo" },
];

describe("Uma pessoa, vários vínculos processuais independentes", () => {
  test("agrupa somente pelo CPF completo; nomes iguais e sem CPF não são fundidos", () => {
    expect(cpfPessoa("013.541.375-31")).toBe("01354137531");
    expect(cpfPessoa("123")).toBeNull();
    expect(cpfPessoa("00000000000")).toBeNull();
    expect(cpfPessoa("01354137530")).toBeNull();
    expect(mesmoTitular(pessoas[0]!, pessoas[1]!)).toBe(true);
    expect(mesmoTitular(pessoas[0]!, pessoas[5]!)).toBe(false);
    expect(agruparPessoas(pessoas)).toHaveLength(4);
    expect(vinculosDaPessoa(pessoas, pessoas[0]!).map((x) => x.id)).toEqual(["v1","v2","v3"]);
    expect(vinculosDaPessoa(pessoas, pessoas[3]!)).toEqual([pessoas[3]]);
  });
  test("um único titular pode ter dois processos ativos e um desvinculado pendente", () => {
    const vinculos = vinculosDaPessoa(pessoas, pessoas[0]!);
    expect(vinculos.filter(podeRegistrarVinculo).map((x) => x.processo_id)).toEqual(["p1","p2"]);
    expect(vinculos.find((x) => x.id === "v3")?.situacao).toBe("Desvinculado");
  });
  test("não duplica o mesmo processo ativo para o mesmo CPF", () => {
    expect(podeVincularProcesso(pessoas, "01354137531", "p1")).toBe(false);
    expect(podeVincularProcesso(pessoas, "01354137531", "p2")).toBe(false);
    expect(podeVincularProcesso(pessoas, "01354137531", "p3")).toBe(true);
    expect(podeVincularProcesso(pessoas, "01354137531", "p7")).toBe(true);
    expect(podeVincularProcesso(pessoas, "", "p7")).toBe(false);
  });
  test("vínculo removido ou encerrado jamais recebe assinatura", () => {
    expect(podeRegistrarVinculo({ situacao:"Desvinculado", processo_id:"p3" })).toBe(false);
    expect(podeRegistrarVinculo({ situacao:"Encerrado", processo_id:"p1" })).toBe(false);
    expect(podeRegistrarVinculo({ situacao:"Ativo", processo_id:null })).toBe(false);
    expect(podeRegistrarVinculo({ situacao:"Ativo", processo_id:"p1" })).toBe(true);
  });
  test("vínculo pendente não gera alerta de atraso, mesmo com data vencida", () => {
    expect(inadimplenciaCriticaComparecimento({
      situacao: "Desvinculado", proximo: "2026-07-01", comparecimento_registros: [],
    }, "2026-11-16")).toBeNull();
    expect(inadimplenciaCriticaComparecimento({
      situacao: "Ativo", proximo: "2026-07-01", comparecimento_registros: [],
    }, "2026-11-16")).not.toBeNull();
  });
});

describe("Assinatura física única com efeitos nos processos selecionados", () => {
  test("certidão relaciona dois processos, sem confundir pessoas", () => {
    const html = montarHtmlCertidaoComparecimento({
      numero:"8000001-11.2026.8.05.0067",
      numeros:["8000001-11.2026.8.05.0067","8000002-22.2026.8.05.0067"],
      pessoa:"JOÃO TESTE", cpf:"01354137531", data:"2026-11-16",
      analista:"Servidor Teste",
    });
    expect(html).toContain("Processos nº:");
    expect(html).toContain("8000001-11.2026.8.05.0067");
    expect(html).toContain("8000002-22.2026.8.05.0067");
    expect(html).toContain("às determinações de comparecimento dos processos relacionados");
  });
  test("migração preserva históricos existentes e tem transação única", () => {
    const sql=readFileSync(new URL("../supabase/migrations/20261116110000_comparecimentos_vinculo_desvinculado.sql",import.meta.url),"utf8");
    expect(sql).toContain("Desvinculado");
    expect(sql).toContain("assinatura_grupo_id uuid");
    expect(sql).toContain("registrar_comparecimentos_multiplos");
    expect(sql).toContain("for update of c");
    expect(sql).toContain("v_contagem <> cardinality(p_ids)");
    expect(sql).toContain("public.pode_editar(auth.uid())");
    expect(sql).toContain("c.situacao = 'Ativo'");
    expect(sql).not.toMatch(/delete\s+from\s+public\.comparecimento_registros/i);
  });
  test("o cadastro anterior conserva o processo original durante a desvinculação", () => {
    const file=readFileSync(new URL("../src/lib/processos/comparecimentos.ts",import.meta.url),"utf8");
    const trecho=file.slice(file.indexOf("export async function desvincularProcessoComparecimento"),
      file.indexOf("export async function restaurarVinculoComparecimento"));
    expect(trecho).toContain("SITUACAO_VINCULO_REMOVIDO");
    expect(trecho).not.toContain("processo_id: null");
    expect(trecho).not.toContain(".delete()");
    expect(trecho).toContain("motivo_conferencia");
    expect(file).toContain("Este vínculo possui assinaturas");
  });
});
