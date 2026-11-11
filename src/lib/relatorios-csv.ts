/**
 * CSV de relatórios administrativos — compatível com Excel em pt-BR.
 * Não utiliza HTML nem formatação de planilhas e impede execução de fórmulas
 * provenientes de cadastros, importações ou descrições fornecidas por terceiros.
 */
export type ValorCSV = string | number | boolean | null | undefined;

function celulaSegura(valor: ValorCSV): string {
  if (valor === null || valor === undefined) return "";
  if (typeof valor === "number") return Number.isFinite(valor) ? String(valor) : "";
  if (typeof valor === "boolean") return valor ? "Sim" : "Não";
  let texto = String(valor);
  // Bloqueio de CSV/Excel formula injection, inclusive com espaço/tab antes do sinal.
  if (/^[\s\uFEFF\u200B-\u200D]*[=+\-@]/u.test(texto) || /^[\t\r\n]/.test(texto)) texto = "'" + texto;
  return texto;
}

function escapar(valor: ValorCSV): string {
  const texto = celulaSegura(valor);
  return /[;"\r\n]/.test(texto)
    ? '"' + texto.replace(/"/g, '""') + '"'
    : texto;
}

/** Valida cada linha antes de gerar CSV, em vez de perder campos silenciosamente. */
export function gerarConteudoCSV(
  colunas: readonly string[],
  linhas: readonly (readonly ValorCSV[])[],
): string {
  if (!colunas.length) throw new Error("O relatório não possui colunas.");
  for (const [i, linha] of linhas.entries()) {
    if (linha.length !== colunas.length) {
      throw new Error(
        "Inconsistência na exportação: linha " + (i + 1) +
        " contém " + linha.length + " campo(s); esperados " + colunas.length + ".",
      );
    }
  }
  return "\uFEFF" +
    [colunas.map(escapar).join(";"), ...linhas.map((linha) => linha.map(escapar).join(";"))]
      .join("\r\n") + "\r\n";
}

export function baixarRelatorioCSV(
  nome: string,
  colunas: readonly string[],
  linhas: readonly (readonly ValorCSV[])[],
) {
  const conteudo = gerarConteudoCSV(colunas, linhas);
  const nomeSeguro = nome.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 70);
  const data = new Date();
  const hoje = [data.getFullYear(), String(data.getMonth() + 1).padStart(2, "0"), String(data.getDate()).padStart(2, "0")].join("-");
  const blob = new Blob([conteudo], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeSeguro + "-" + hoje + ".csv";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  // A revogação imediata pode interromper downloads em alguns navegadores.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
