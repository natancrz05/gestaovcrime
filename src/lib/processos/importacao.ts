/**
 * Importação / atualização em lote de processos por planilha do PJe.
 *
 * O leitor é deliberadamente tolerante com XLSX/XLS/ODS, variações de cabeçalho,
 * datas e formatação do número CNJ. A gravação continua sendo feita apenas após
 * prévia e confirmação do usuário.
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

const COLUNAS: Record<string, string> = {
  PROCESSO: "numero",
  "NUMERO DO PROCESSO": "numero",
  "NUMERO PROCESSO": "numero",
  "N PROCESSO": "numero",
  "N DO PROCESSO": "numero",
  "Nº PROCESSO": "numero",
  CLASSE: "pje_classe_codigo",
  "CODIGO DA CLASSE": "pje_classe_codigo",
  "CODIGO CLASSE": "pje_classe_codigo",
  "DESCRICAO DA CLASSE": "classe",
  "DESCRICAO CLASSE CNJ": "classe",
  "DESCRICAO CLASSE": "classe",
  "CLASSE CNJ": "classe",
  ASSUNTO: "assunto",
  "DESCRICAO ASSUNTO": "assunto",
  "DATA AUTUACAO": "data_distribuicao",
  "DATA DE AUTUACAO": "data_distribuicao",
  "DATA DISTRIBUICAO": "data_distribuicao",
  "DATA DE DISTRIBUICAO": "data_distribuicao",
  "DATA ULT MOV": "pje_ultima_mov_data",
  "DATA ULTIMA MOV": "pje_ultima_mov_data",
  "DATA ULTIMA MOVIMENTACAO": "pje_ultima_mov_data",
  MOVIMENTACAO: "pje_ultima_mov_descricao",
  "ULTIMA MOVIMENTACAO": "pje_ultima_mov_descricao",
  "DESCRICAO DA MOVIMENTACAO": "pje_ultima_mov_descricao",
  "QTDE DIAS": "pje_qtde_dias",
  "QTD DIAS": "pje_qtde_dias",
  "QUANTIDADE DIAS": "pje_qtde_dias",
  SITUACAO: "pje_situacao",
  TAREFAS: "pje_tarefas",
  TAREFA: "pje_tarefas",
  AUTOR: "pje_autor",
  REU: "pje_reu",
  "REU REQUERIDO": "pje_reu",
  PRIORIDADE: "pje_prioridade",
  "DESCRICAO PRIORIDADE": "pje_descricao_prioridade",
  "DESCRICAO DA PRIORIDADE": "pje_descricao_prioridade",
  CONCLUSO: "pje_concluso",
  SEGREDO: "pje_segredo",
  LOCALIZACAO: "pje_localizacao",
  SISTEMA: "pje_sistema",
};

const DATAS = new Set(["data_distribuicao", "pje_ultima_mov_data"]);
const COLUNAS_CONTEXTO = new Set(["COMARCA", "UNIDADE", "COMPETENCIA", "TIPO", "GRATUITA", "VALOR DA CAUSA"]);

const normCab = (s: string) =>
  s.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[_.:;()\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const limparTexto = (v: unknown) =>
  String(v ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const normPessoa = (s: string) =>
  limparTexto(s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const resolverColuna = (cabecalho: string) => COLUNAS[normCab(cabecalho)] ?? null;

export const soDigitos = (s: string) => String(s ?? "").replace(/\D/g, "");

/** Formato CNJ: NNNNNNN-DD.AAAA.J.TR.OOOO */
export function formatarNumeroCNJ(d: string) {
  return `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9, 13)}.${d.slice(13, 14)}.${d.slice(14, 16)}.${d.slice(16, 20)}`;
}

function numeroDaCelula(bruto: unknown, exibido: unknown): { numero: string; erro?: string } {
  const candidatos = [limparTexto(exibido), limparTexto(bruto)];
  for (const valor of candidatos) {
    const d = soDigitos(valor);
    if (d.length === 20) return { numero: formatarNumeroCNJ(d) };
  }

  // Números CNJ guardados como Number no Excel podem perder precisão acima de
  // 15 dígitos. Não inventamos os dígitos restantes: orientamos o usuário.
  if (typeof bruto === "number" && Number.isFinite(bruto)) {
    return {
      numero: limparTexto(exibido || bruto),
      erro: "número do processo foi armazenado como valor numérico e perdeu precisão; formate a coluna PROCESSO como Texto",
    };
  }

  const valor = candidatos.find(Boolean) ?? "";
  return { numero: valor, erro: valor ? "número do processo fora do padrão CNJ (20 dígitos)" : "número do processo vazio" };
}

export function paraData(v: unknown): string | null | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  if (v instanceof Date && !isNaN(v.getTime())) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`;
  }

  // Fallback para serial de data do Excel/Calc.
  if (typeof v === "number" && Number.isFinite(v) && v > 1 && v < 100000) {
    const ms = Math.round((v - 25569) * 86400 * 1000);
    const dt = new Date(ms);
    if (!isNaN(dt.getTime())) {
      return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
    }
  }

  const s = limparTexto(v);
  let m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2}|\d{4})(?:\s|$)/);
  let y: number, mo: number, d: number;
  if (m) {
    d = +m[1]!;
    mo = +m[2]!;
    y = +m[3]!;
    if (y < 100) y += y >= 70 ? 1900 : 2000;
  } else if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s]|$)/))) {
    y = +m[1]!;
    mo = +m[2]!;
    d = +m[3]!;
  } else {
    return null;
  }

  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d || y < 1900 || y > 2100) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

const PADROES_INSTITUCIONAIS = [
  /\bMINISTERIO PUBLICO\b/,
  /\bPOLICIA CIVIL\b/,
  /\bPOLICIA MILITAR\b/,
  /^DT\b/,
  /^DEPOL\b/,
  /^DELEGAD[OA]\b/,
  /^JUIZO\b/,
  /^JUIZ\b/,
  /\bVARA\b/,
  /\bTRIBUNAL\b/,
  /^COMARCA\b/,
  /^MUNICIPIO\b/,
  /^ESTADO DA BAHIA\b/,
  /^BAHIA SECRETARIA\b/,
  /^SECRETARIA\b/,
  /^DEFENSORIA\b/,
  /^PROCURADORIA\b/,
  /^PROMOTORIA\b/,
  /^PROMOTOR\b/,
  /^\d+\s*CIPM\b/,
  /^TJBA\b/,
];

function ehParteInstitucional(nome: string) {
  const n = normPessoa(nome);
  return PADROES_INSTITUCIONAIS.some((r) => r.test(n));
}

function separarPessoas(valor: string) {
  const nomes = limparTexto(valor)
    .split(/[;\n]+/)
    .map((x) => limparTexto(x))
    .filter(Boolean);
  const vistos = new Set<string>();
  return nomes.filter((nome) => {
    const k = normPessoa(nome);
    if (!k || vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
}

const CLASSE_ADMITE_INVERSAO_POLO = /^(ACAO PENAL|TERMO CIRCUNSTANCIADO|ACORDO DE NAO PERSECUCAO PENAL|AUTO DE PRISAO EM FLAGRANTE|PROCEDIMENTO ESPECIAL DA LEI ANTITOXICOS|CRIMES DE CALUNIA)/;

function inferirReus(classe: string, autorBruto: string, reuBruto: string) {
  const reusFonte = separarPessoas(reuBruto);
  const autoresFonte = separarPessoas(autorBruto);
  const reusPessoas = reusFonte.filter((n) => !ehParteInstitucional(n));
  const reusInstitucionais = reusFonte.filter(ehParteInstitucional);
  const autoresPessoas = autoresFonte.filter((n) => !ehParteInstitucional(n));
  const autoresInstitucionais = autoresFonte.filter(ehParteInstitucional);
  const avisos: string[] = [];

  let nomes = reusPessoas;
  if (reusInstitucionais.length && reusPessoas.length) {
    avisos.push("partes institucionais presentes na coluna REU foram desconsideradas no cadastro de réus");
  }

  const classeNorm = normCab(classe);
  if (
    nomes.length === 0 &&
    CLASSE_ADMITE_INVERSAO_POLO.test(classeNorm) &&
    autoresPessoas.length > 0 &&
    (reusInstitucionais.length > 0 || autoresInstitucionais.length > 0)
  ) {
    nomes = autoresPessoas;
    avisos.push("réu(s) inferido(s) pela coluna AUTOR porque o PJe exportou parte institucional no polo REU");
  }

  if (nomes.length === 0 && reusInstitucionais.length > 0) {
    avisos.push("a coluna REU contém apenas parte institucional; nenhum réu foi criado automaticamente");
  }

  const vistos = new Set<string>();
  nomes = nomes.filter((nome) => {
    const k = normPessoa(nome);
    if (!k || vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });

  return { nomes, avisos, institucionaisIgnorados: reusInstitucionais };
}

export interface LinhaValida {
  linha: number;
  numero: string;
  campos: Record<string, string>;
  reusInferidos: string[];
  partesInstitucionaisIgnoradas: string[];
  avisos: string[];
}
export interface LinhaProblema { linha: number; numero: string; motivo: string }
export interface Analise {
  aba: string;
  totalLinhas: number;
  reconhecidas: string[];
  contextuais: string[];
  naoReconhecidas: string[];
  validas: LinhaValida[];
  erros: LinhaProblema[];
  duplicados: LinhaProblema[];
  avisos: LinhaProblema[];
  duplicadosConsolidados: number;
  reusInferidosTotal: number;
}

function linhasDaAba(XLSX: typeof import("xlsx"), aba: import("xlsx").WorkSheet) {
  const brutas = XLSX.utils.sheet_to_json<unknown[]>(aba, { header: 1, raw: true, defval: "" });
  const exibidas = XLSX.utils.sheet_to_json<unknown[]>(aba, { header: 1, raw: false, defval: "", dateNF: "dd/mm/yyyy" });
  return { brutas, exibidas };
}

function escolherAba(XLSX: typeof import("xlsx"), wb: import("xlsx").WorkBook) {
  let melhor: { nome: string; aba: import("xlsx").WorkSheet; iCab: number; reconhecidas: number } | null = null;
  for (const nome of wb.SheetNames) {
    const aba = wb.Sheets[nome];
    if (!aba) continue;
    const { exibidas } = linhasDaAba(XLSX, aba);
    for (let i = 0; i < Math.min(exibidas.length, 100); i++) {
      const row = exibidas[i] ?? [];
      const campos = row.map((c) => resolverColuna(limparTexto(c)));
      if (!campos.includes("numero")) continue;
      const reconhecidas = campos.filter(Boolean).length;
      if (!melhor || reconhecidas > melhor.reconhecidas) melhor = { nome, aba, iCab: i, reconhecidas };
    }
  }
  return melhor;
}

function camposCompativeis(a: string, b: string) {
  if (a === b) return true;
  return normCab(a) === normCab(b);
}

function consolidarDuplicados(validas: LinhaValida[]) {
  const grupos = new Map<string, LinhaValida[]>();
  for (const l of validas) {
    const k = soDigitos(l.numero);
    grupos.set(k, [...(grupos.get(k) ?? []), l]);
  }

  const finais: LinhaValida[] = [];
  const conflitos: LinhaProblema[] = [];
  let consolidados = 0;

  for (const grupo of grupos.values()) {
    if (grupo.length === 1) {
      finais.push(grupo[0]!);
      continue;
    }

    const base = [...grupo].sort((a, b) => (b.campos.pje_ultima_mov_data ?? "").localeCompare(a.campos.pje_ultima_mov_data ?? ""))[0]!;
    const estaticos = ["classe", "assunto", "data_distribuicao", "pje_classe_codigo", "pje_sistema"];
    const conflitosEstaticos = estaticos.filter((campo) => {
      const valores = grupo.map((g) => g.campos[campo]).filter(Boolean);
      return valores.some((v) => !camposCompativeis(v!, valores[0]!));
    });

    if (conflitosEstaticos.length) {
      const linhas = grupo.map((g) => g.linha).join(", ");
      for (const g of grupo) {
        conflitos.push({
          linha: g.linha,
          numero: g.numero,
          motivo: `processo repetido com dados incompatíveis nas linhas ${linhas} (${conflitosEstaticos.map(rotuloCampo).join(", ")})`,
        });
      }
      continue;
    }

    const merged: LinhaValida = {
      ...base,
      campos: { ...base.campos },
      reusInferidos: [],
      partesInstitucionaisIgnoradas: [],
      avisos: [...base.avisos, `linhas duplicadas consolidadas automaticamente: ${grupo.map((g) => g.linha).join(", ")}`],
    };

    for (const campo of ["classe", "assunto", "data_distribuicao", "pje_classe_codigo", "pje_sistema"]) {
      const valor = grupo.map((g) => g.campos[campo]).find(Boolean);
      if (valor) merged.campos[campo] = valor;
    }

    for (const campo of ["pje_autor", "pje_reu"]) {
      const nomes = grupo.flatMap((g) => separarPessoas(g.campos[campo] ?? ""));
      const vistos = new Set<string>();
      const unicos = nomes.filter((n) => {
        const k = normPessoa(n);
        if (!k || vistos.has(k)) return false;
        vistos.add(k);
        return true;
      });
      if (unicos.length) merged.campos[campo] = unicos.join(";");
    }

    const vistosReus = new Set<string>();
    merged.reusInferidos = grupo.flatMap((g) => g.reusInferidos).filter((n) => {
      const k = normPessoa(n);
      if (!k || vistosReus.has(k)) return false;
      vistosReus.add(k);
      return true;
    });

    const vistosInstitucionais = new Set<string>();
    merged.partesInstitucionaisIgnoradas = grupo.flatMap((g) => g.partesInstitucionaisIgnoradas).filter((n) => {
      const k = normPessoa(n);
      if (!k || vistosInstitucionais.has(k)) return false;
      vistosInstitucionais.add(k);
      return true;
    });

    finais.push(merged);
    consolidados += grupo.length - 1;
  }

  return { validas: finais, duplicados: conflitos, consolidados };
}

export async function lerPlanilha(arquivo: File): Promise<Analise> {
  if (!/\.(xlsx|xls|ods)$/i.test(arquivo.name)) {
    throw new Error("Envie uma planilha .xlsx, .xls ou .ods.");
  }

  const XLSX = await import("xlsx");
  let wb: import("xlsx").WorkBook;
  try {
    wb = XLSX.read(await arquivo.arrayBuffer(), { type: "array", cellDates: true, cellText: true });
  } catch {
    throw new Error("Não foi possível ler o arquivo. Ele pode estar corrompido ou protegido.");
  }

  const escolhida = escolherAba(XLSX, wb);
  if (!escolhida) throw new Error('Nenhuma aba contém uma coluna reconhecível de "PROCESSO". Nenhuma alteração foi feita.');

  const { brutas: matriz, exibidas: matrizTexto } = linhasDaAba(XLSX, escolhida.aba);
  const iCab = escolhida.iCab;
  const cab = (matrizTexto[iCab] ?? []).map((c) => limparTexto(c));
  const mapa: (string | null)[] = cab.map(resolverColuna);
  const reconhecidas = cab.filter((_, i) => mapa[i]);
  const contextuais = cab.filter((c, i) => c && !mapa[i] && COLUNAS_CONTEXTO.has(normCab(c)));
  const naoReconhecidas = cab.filter((c, i) => c && !mapa[i] && !COLUNAS_CONTEXTO.has(normCab(c)));

  const validasBrutas: LinhaValida[] = [];
  const erros: LinhaProblema[] = [];
  const avisosGerais: LinhaProblema[] = [];
  const linhas = matriz.slice(iCab + 1);
  const linhasTexto = matrizTexto.slice(iCab + 1);
  let total = 0;

  linhas.forEach((r, k) => {
    const rt = linhasTexto[k] ?? [];
    const temConteudo = r.some((c) => limparTexto(c)) || rt.some((c) => limparTexto(c));
    if (!temConteudo) return;

    total++;
    const nLinha = iCab + k + 2;
    const campos: Record<string, string> = {};
    let numeroBruto: unknown = "";
    let numeroExibido: unknown = "";
    const problemas: string[] = [];

    mapa.forEach((campo, i) => {
      if (!campo) return;
      const v = r[i];
      const vt = rt[i];

      if (campo === "numero") {
        numeroBruto = v;
        numeroExibido = vt;
        return;
      }

      if (DATAS.has(campo)) {
        let d = paraData(v);
        if (d === null || d === undefined) d = paraData(vt);
        if (d === null) problemas.push(`data inválida em ${cab[i]} ("${limparTexto(vt || v)}")`);
        else if (d) campos[campo] = d;
        return;
      }

      const s = limparTexto(vt || v);
      if (!s) return;

      if (campo === "pje_qtde_dias") {
        const numeroDias = s.replace(",", ".");
        if (!/^-?\d+(?:\.0+)?$/.test(numeroDias)) problemas.push(`quantidade de dias inválida ("${s}")`);
        else campos[campo] = String(parseInt(numeroDias, 10));
        return;
      }

      campos[campo] = s;
    });

    const numeroLido = numeroDaCelula(numeroBruto, numeroExibido);
    if (numeroLido.erro) problemas.unshift(numeroLido.erro);
    const numero = numeroLido.numero;

    if (problemas.length) {
      erros.push({ linha: nLinha, numero, motivo: problemas.join("; ") });
      return;
    }

    const reuOriginal = campos.pje_reu ?? "";
    const inferencia = inferirReus(campos.classe ?? "", campos.pje_autor ?? "", reuOriginal);

    // O campo pje_reu passa a representar pessoas efetivamente identificadas como
    // réus/autores do fato, evitando criar Ministério Público, juízo ou polícia
    // como réu do processo por inversões do relatório do PJe.
    if (inferencia.nomes.length) campos.pje_reu = inferencia.nomes.join(";");
    else if (reuOriginal && separarPessoas(reuOriginal).every(ehParteInstitucional)) delete campos.pje_reu;

    const linhaAvisos = [...inferencia.avisos];
    for (const motivo of linhaAvisos) avisosGerais.push({ linha: nLinha, numero, motivo });

    validasBrutas.push({
      linha: nLinha,
      numero,
      campos,
      reusInferidos: inferencia.nomes,
      partesInstitucionaisIgnoradas: inferencia.institucionaisIgnorados,
      avisos: linhaAvisos,
    });
  });

  if (total === 0) throw new Error("A planilha não possui linhas de dados.");

  const consolidacao = consolidarDuplicados(validasBrutas);
  return {
    aba: escolhida.nome,
    totalLinhas: total,
    reconhecidas,
    contextuais,
    naoReconhecidas,
    validas: consolidacao.validas,
    erros,
    duplicados: consolidacao.duplicados,
    avisos: avisosGerais,
    duplicadosConsolidados: consolidacao.consolidados,
    reusInferidosTotal: consolidacao.validas.reduce((n, l) => n + l.reusInferidos.length, 0),
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
