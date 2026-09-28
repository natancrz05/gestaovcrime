/**
 * Importação / atualização em lote de processos por planilha XLSX.
 * A leitura e a validação ocorrem no navegador; a comparação com o banco,
 * a gravação (transacional) e o desfazer ocorrem no banco de dados.
 */

export const CAMPOS_IMPORTACAO: Record<string, string> = {
  classe: "Classe",
  assunto: "Assunto",
  data_distribuicao: "Data de autuação",
  pje_classe_codigo: "Código da classe",
  pje_ultima_mov_data: "Última movimentação (PJe)",
  pje_ultima_mov_descricao: "Descrição da movimentação",
  pje_qtde_dias: "Qtde. dias (PJe)",
  pje_situacao: "Situação (PJe)",
  pje_tarefas: "Tarefas (PJe)",
  pje_autor: "Autor",
  pje_reu: "Réu (PJe)",
  pje_prioridade: "Prioridade do PJe",
  pje_descricao_prioridade: "Descrição da prioridade",
  pje_concluso: "Concluso",
  pje_segredo: "Segredo",
  pje_localizacao: "Localização",
  pje_sistema: "Sistema",
};
export const rotuloCampo = (c: string) => CAMPOS_IMPORTACAO[c] ?? c;

/** Cabeçalho normalizado da planilha → campo interno. */
const COLUNAS: Record<string, string> = {
  PROCESSO: "numero",
  CLASSE: "pje_classe_codigo",
  "DESCRICAO DA CLASSE": "classe",
  "DESCRICAO CLASSE CNJ": "classe",
  "DESCRICAO CLASSE": "classe",
  ASSUNTO: "assunto",
  "DATA AUTUACAO": "data_distribuicao",
  "DATA ULT MOV": "pje_ultima_mov_data",
  MOVIMENTACAO: "pje_ultima_mov_descricao",
  "QTDE DIAS": "pje_qtde_dias",
  SITUACAO: "pje_situacao",
  TAREFAS: "pje_tarefas",
  AUTOR: "pje_autor",
  REU: "pje_reu",
  PRIORIDADE: "pje_prioridade",
  "DESCRICAO PRIORIDADE": "pje_descricao_prioridade",
  CONCLUSO: "pje_concluso",
  SEGREDO: "pje_segredo",
  LOCALIZACAO: "pje_localizacao",
  SISTEMA: "pje_sistema",
};
const DATAS = new Set(["data_distribuicao", "pje_ultima_mov_data"]);

const normCab = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[_\s.]+/g, " ").trim();

export const soDigitos = (s: string) => s.replace(/\D/g, "");
/** Formato CNJ: NNNNNNN-DD.AAAA.J.TR.OOOO */
export function formatarNumeroCNJ(d: string) {
  return `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9, 13)}.${d.slice(13, 14)}.${d.slice(14, 16)}.${d.slice(16, 20)}`;
}

export function paraData(v: unknown): string | null | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  if (v instanceof Date && !isNaN(v.getTime())) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`;
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  let y: number, mo: number, d: number;
  if (m) { d = +m[1]!; mo = +m[2]!; y = +m[3]!; }
  else if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) { y = +m[1]!; mo = +m[2]!; d = +m[3]!; }
  else return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d || y < 1900 || y > 2100) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export interface LinhaValida { linha: number; numero: string; campos: Record<string, string> }
export interface LinhaProblema { linha: number; numero: string; motivo: string }
export interface Analise {
  totalLinhas: number;
  reconhecidas: string[];
  naoReconhecidas: string[];
  validas: LinhaValida[];
  erros: LinhaProblema[];
  duplicados: LinhaProblema[];
}

export async function lerPlanilha(arquivo: File): Promise<Analise> {
  if (!/\.xlsx$/i.test(arquivo.name)) throw new Error("Envie um arquivo no formato .xlsx.");
  const XLSX = await import("xlsx");
  let wb;
  try {
    wb = XLSX.read(await arquivo.arrayBuffer(), { type: "array", cellDates: true });
  } catch {
    throw new Error("Não foi possível ler o arquivo. Ele pode estar corrompido ou não ser uma planilha XLSX.");
  }
  const aba = wb.SheetNames[0] ? wb.Sheets[wb.SheetNames[0]] : undefined;
  if (!aba) throw new Error("A planilha está vazia.");
  const matriz = XLSX.utils.sheet_to_json<unknown[]>(aba, { header: 1, raw: true, defval: "" });
  const iCab = matriz.findIndex((r) => r.some((c) => normCab(String(c)) === "PROCESSO"));
  if (iCab < 0) throw new Error('A coluna obrigatória "PROCESSO" não foi encontrada. Nenhuma alteração foi feita.');
  const cab = (matriz[iCab] ?? []).map((c) => String(c));
  const mapa: (string | null)[] = cab.map((c) => COLUNAS[normCab(c)] ?? null);
  const reconhecidas = cab.filter((_, i) => mapa[i]);
  const naoReconhecidas = cab.filter((c, i) => c.trim() && !mapa[i]);

  const validas: LinhaValida[] = [];
  const erros: LinhaProblema[] = [];
  const porNumero = new Map<string, number[]>();
  const linhas = matriz.slice(iCab + 1);
  let total = 0;
  linhas.forEach((r, k) => {
    if (!r.some((c) => String(c ?? "").trim() !== "")) return;
    total++;
    const nLinha = iCab + k + 2;
    const campos: Record<string, string> = {};
    let numeroBruto = "";
    const problemas: string[] = [];
    mapa.forEach((campo, i) => {
      if (!campo) return;
      const v = r[i];
      if (campo === "numero") { numeroBruto = String(v ?? "").trim(); return; }
      if (DATAS.has(campo)) {
        const d = paraData(v);
        if (d === null) problemas.push(`data inválida em ${cab[i]} ("${String(v)}")`);
        else if (d) campos[campo] = d;
        return;
      }
      const s = (v instanceof Date ? paraData(v) ?? "" : String(v ?? "")).trim();
      if (!s) return;
      if (campo === "pje_qtde_dias") {
        if (!/^-?\d+(\.0+)?$/.test(s)) problemas.push(`quantidade de dias inválida ("${s}")`);
        else campos[campo] = String(parseInt(s, 10));
        return;
      }
      campos[campo] = s;
    });
    const dig = soDigitos(numeroBruto);
    if (!numeroBruto) problemas.unshift("número do processo vazio");
    else if (dig.length !== 20) problemas.unshift("número do processo fora do padrão (20 dígitos)");
    const numero = dig.length === 20 ? formatarNumeroCNJ(dig) : numeroBruto;
    if (problemas.length) { erros.push({ linha: nLinha, numero, motivo: problemas.join("; ") }); return; }
    validas.push({ linha: nLinha, numero, campos });
    porNumero.set(dig, [...(porNumero.get(dig) ?? []), validas.length - 1]);
  });
  if (total === 0) throw new Error("A planilha não possui linhas de dados.");

  // Duplicidades: nenhuma das ocorrências é importada (não há como saber qual está correta).
  const duplicados: LinhaProblema[] = [];
  const excluir = new Set<number>();
  for (const idx of porNumero.values()) {
    if (idx.length < 2) continue;
    const linhasDup = idx.map((i) => validas[i]!.linha).join(", ");
    for (const i of idx) {
      excluir.add(i);
      duplicados.push({ linha: validas[i]!.linha, numero: validas[i]!.numero, motivo: `processo repetido na planilha (linhas ${linhasDup})` });
    }
  }
  return {
    totalLinhas: total,
    reconhecidas,
    naoReconhecidas,
    validas: validas.filter((_, i) => !excluir.has(i)),
    erros,
    duplicados,
  };
}

export interface Mudanca { campo: string; antes: string | null; depois: string }
export interface Conflito { numero: string; campo: string; atual: string; novo: string; motivo: string }
export interface ResultadoSimulacao {
  analisados: number;
  novos: { numero: string; linha: number; classe?: string; reu?: string }[];
  atualizados: { numero: string; linha: number; mudancas: Mudanca[]; conflito: boolean }[];
  sem_alteracao: number;
  conflitos: Conflito[];
}

export function formatarValor(campo: string, v: string | null | undefined) {
  if (v === null || v === undefined || v === "") return "(vazio)";
  if (DATAS.has(campo) && /^\d{4}-\d{2}-\d{2}/.test(v)) return `${v.slice(8, 10)}/${v.slice(5, 7)}/${v.slice(0, 4)}`;
  return v;
}

export function baixarCSV(nome: string, cab: string[], linhas: (string | number)[][]) {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const txt = "\uFEFF" + [cab, ...linhas].map((l) => l.map(esc).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([txt], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = nome; a.click();
  URL.revokeObjectURL(url);
}
