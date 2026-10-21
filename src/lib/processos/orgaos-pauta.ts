const normalizar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Chave usada somente para conferir se uma pauta mistura unidades judiciais.
 * Pequenas variações de texto/diagramação do PJe não devem transformar
 * a mesma unidade em dois órgãos diferentes.
 */
export function chaveOrgaoPauta(orgao: string) {
  const t = normalizar(orgao);

  // O PJe pode repetir palavras, acrescentar sufixos ou quebrar o nome da unidade
  // de forma diferente entre linhas/páginas.
  if (/VARA\s+CRIMINAL/.test(t) && /CORACAO\s+DE\s+MARIA/.test(t)) {
    return "VARA CRIMINAL DE CORACAO DE MARIA";
  }

  return t;
}

export function orgaosDistintosDaPauta(orgaos: string[]) {
  const porChave = new Map<string, string>();

  for (const orgao of orgaos) {
    const chave = chaveOrgaoPauta(orgao);
    if (!chave) continue;
    if (!porChave.has(chave)) porChave.set(chave, orgao.trim());
  }

  return [...porChave.entries()].map(([chave, rotulo]) => ({ chave, rotulo }));
}


export const ORGAO_LOCAL_PAUTA = "VARA CRIMINAL DE CORACAO DE MARIA";

export function orgaoPertenceUnidade(orgao: string) {
  return chaveOrgaoPauta(orgao) === ORGAO_LOCAL_PAUTA;
}
