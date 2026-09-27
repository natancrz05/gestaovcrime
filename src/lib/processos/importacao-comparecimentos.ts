/**
 * Importador reutilizável de planilhas de comparecimentos (XLSX ou CSV).
 * Colunas reconhecidas pelo nome do cabeçalho, em qualquer ordem.
 * A gravação é feita no banco (importar_comparecimentos), tudo-ou-nada.
 */
import { supabase } from "@/integrations/supabase/client";
import { paraData } from "./importacao";

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[_\s.:/-]+/g, " ").trim();

type Campo = "pessoa" | "cpf" | "processo" | "sistema" | "ip" | "acao_penal" | "providencia" | "ultima" | "periodicidade" | "situacao" | "aplicacao" | "dias";

/** Ordem importa: regras mais específicas primeiro. */
const REGRAS: [Campo, (h: string) => boolean][] = [
  ["pessoa", (h) => h.includes("REQUERID") || h === "NOME" || h.startsWith("NOME ")],
  ["cpf", (h) => /\bCPF\b/.test(h)],
  ["acao_penal", (h) => h.includes("ACAO PENAL")],
  ["ip", (h) => /\bIP\b/.test(h) || h.includes("INQUERITO")],
  ["processo", (h) => h.includes("PROCESSO") || h.includes("CAUTELAR") || h.includes("EXECUCAO")],
  ["sistema", (h) => h.includes("SISTEMA")],
  ["providencia", (h) => h.includes("PROVIDENCIA")],
  ["ultima", (h) => h.includes("ASSINATURA")],
  ["periodicidade", (h) => h.includes("PERIODICIDADE")],
  ["aplicacao", (h) => h.includes("APLICACAO")],
  ["dias", (h) => h.includes("DIAS")],
  ["situacao", (h) => h.includes("SITUACAO")],
];

export const ROTULOS: Record<Campo, string> = {
  pessoa: "Nome do requerido", cpf: "CPF", processo: "Processo cautelar ou execução", sistema: "Sistema",
  ip: "Número do IP", acao_penal: "Número da ação penal", providencia: "Providência", ultima: "Data da última assinatura",
  periodicidade: "Periodicidade", situacao: "Situação", aplicacao: "Data da aplicação da medida", dias: "Dias de cumprimento",
};

const PADRAO: [RegExp, string, number][] = [
  [/QUADRIMESTRAL/, "Quadrimestral", 4], [/TRIMESTRAL/, "Trimestral", 3], [/BIMESTRAL/, "Bimestral", 2],
  [/SEMESTRAL/, "Semestral", 6], [/ANUAL/, "Anual", 12], [/MENSAL/, "Mensal", 1], [/QUINZENAL|SEMANAL/, "", 0],
];
const PADRAO_MESES: Record<number, string> = { 1: "Mensal", 2: "Bimestral", 3: "Trimestral", 4: "Quadrimestral", 6: "Semestral", 12: "Anual" };

/** Converte o texto da planilha na periodicidade do módulo (sem criar regras novas). */
export function lerPeriodicidade(txt: string): { periodicidade: string; intervalo: number } | null {
  const t = norm(txt);
  if (!t) return null;
  for (const [re, p, m] of PADRAO) if (re.test(t)) return m ? { periodicidade: p, intervalo: m } : null;
  const meses = t.match(/(\d+)\s*(MES|MESES)\b/);
  const dias = t.match(/(\d+)\s*DIAS?\b/);
  const n = meses ? +meses[1]! : dias && +dias[1]! % 30 === 0 ? +dias[1]! / 30 : /^\d+$/.test(t) ? +t : 0;
  if (n < 1 || n > 120) return null;
  return { periodicidade: PADRAO_MESES[n] ?? "Personalizado", intervalo: n };
}

export interface LinhaComp {
  linha: number; numeros: string[]; processos: string[]; outros: string[]; pessoa: string; cpf: string; periodicidade: string; intervalo: number;
  ultima: string | null; aplicacao: string | null; dados: Record<string, string>;
}
export interface Problema { linha: number; pessoa: string; motivo: string }
export interface AnaliseComp { total: number; reconhecidas: string[]; validas: LinhaComp[]; erros: Problema[]; duplicados: Problema[] }

export async function lerPlanilhaComparecimentos(arquivo: File): Promise<AnaliseComp> {
  if (!/\.(xlsx|csv)$/i.test(arquivo.name)) throw new Error("Envie um arquivo .xlsx ou .csv.");
  const XLSX = await import("xlsx");
  let wb;
  try {
    wb = /\.csv$/i.test(arquivo.name)
      ? XLSX.read(await arquivo.text(), { type: "string", raw: true })
      : XLSX.read(await arquivo.arrayBuffer(), { type: "array", cellDates: true });
  } catch { throw new Error("Não foi possível ler o arquivo. Ele pode estar corrompido."); }
  const aba = wb.SheetNames[0] ? wb.Sheets[wb.SheetNames[0]] : undefined;
  if (!aba) throw new Error("A planilha está vazia.");
  const matriz = XLSX.utils.sheet_to_json<unknown[]>(aba, { header: 1, raw: true, defval: "" });
  const mapear = (r: unknown[]) => r.map((c) => { const h = norm(String(c)); return h ? REGRAS.find(([, f]) => f(h))?.[0] ?? null : null; });
  const iCab = matriz.findIndex((r) => { const m = mapear(r); return m.includes("pessoa") && (m.includes("processo") || m.includes("acao_penal")); });
  if (iCab < 0) throw new Error('Não encontrei as colunas "Nome do requerido" e "Processo". Nenhuma alteração foi feita.');
  const cab = (matriz[iCab] ?? []).map(String);
  const mapa = mapear(matriz[iCab] ?? []);
  // Se o mesmo campo aparecer em duas colunas, vale a primeira.
  mapa.forEach((c, i) => { if (c && mapa.indexOf(c) !== i) mapa[i] = null; });

  const validas: LinhaComp[] = []; const erros: Problema[] = [];
  let total = 0;
  matriz.slice(iCab + 1).forEach((r, k) => {
    if (!r.some((c) => String(c ?? "").trim())) return;
    total++;
    const nLinha = iCab + k + 2;
    const v: Partial<Record<Campo, unknown>> = {};
    mapa.forEach((c, i) => { if (c) v[c] = r[i]; });
    const txt = (c: Campo) => { const x = v[c]; return (x instanceof Date ? paraData(x) ?? "" : String(x ?? "")).trim(); };
    const pessoa = txt("pessoa");
    const probs: string[] = [];
    if (!pessoa) probs.push("nome do requerido vazio");
    const ultima = paraData(v.ultima); const aplicacao = paraData(v.aplicacao);
    if (ultima === null) probs.push(`data da última assinatura inválida ("${txt("ultima")}")`);
    if (aplicacao === null) probs.push(`data da aplicação inválida ("${txt("aplicacao")}")`);
    if (!ultima && !aplicacao) probs.push("sem data da última assinatura nem da aplicação da medida");
    const per = lerPeriodicidade(txt("periodicidade"));
    if (!per) probs.push(`periodicidade não reconhecida ("${txt("periodicidade")}")`);
    // A falta de número de processo NÃO descarta a pessoa: ela entra como "não vinculada".
    const processos = separarNumeros(txt("processo"));
    const outros = [...separarNumeros(txt("acao_penal")), ...separarNumeros(txt("ip"))];
    const numeros = [txt("processo"), txt("acao_penal"), txt("ip")].filter(Boolean);
    if (probs.length || !per) { erros.push({ linha: nLinha, pessoa: pessoa || "—", motivo: probs.join("; ") }); return; }
    const dados: Record<string, string> = {};
    (["sistema", "ip", "acao_penal", "providencia", "ultima", "aplicacao", "dias", "situacao"] as Campo[]).forEach((c) => {
      const s = c === "aplicacao" ? aplicacao ?? "" : c === "ultima" ? ultima ?? "" : txt(c);
      if (s) dados[ROTULOS[c]] = s;
    });
    validas.push({ linha: nLinha, numeros, processos, outros, pessoa, cpf: txt("cpf"), periodicidade: per.periodicidade, intervalo: per.intervalo, ultima: ultima ?? null, aplicacao: aplicacao ?? null, dados });
  });

  // Duplicidade = mesma pessoa (CPF ou nome) no mesmo processo, dentro da planilha.
  const chave = (l: LinhaComp) => `${[...l.processos].sort().join(",")}|${l.cpf.replace(/\D/g, "") || norm(l.pessoa)}`;
  const cont = new Map<string, number>();
  validas.forEach((l) => cont.set(chave(l), (cont.get(chave(l)) ?? 0) + 1));
  const duplicados = validas.filter((l) => (cont.get(chave(l)) ?? 0) > 1).map((l) => ({ linha: l.linha, pessoa: l.pessoa, motivo: "possível duplicidade: mesma pessoa e processo repetidos na planilha" }));
  return { total, reconhecidas: cab.filter((_, i) => mapa[i]), validas: validas.filter((l) => (cont.get(chave(l)) ?? 0) === 1), erros, duplicados };
}

/** Separa uma célula em números individuais (ignora espaços/pontuação dentro do número). */
export function separarNumeros(celula: string): string[] {
  const out: string[] = [];
  for (const parte of celula.split(/[;,/|\n]+|\s+e\s+/i)) {
    const d = parte.replace(/\D/g, "");
    if (d.length < 10) continue;
    if (d.length > 20 && d.length % 20 === 0) for (let i = 0; i < d.length; i += 20) out.push(d.slice(i, i + 20));
    else out.push(d);
  }
  return [...new Set(out)];
}

export interface ItemResultado extends LinhaComp { numero?: string; proximo?: string; proximo_antes?: string; vinculo?: string; motivo?: string; sugestoes?: string[] }
export interface ResultadoComp {
  total: number; novos: ItemResultado[]; atualizados: ItemResultado[]; sem_alteracao: number; nao_vinculados: ItemResultado[];
  processos_encontrados: number; processos_criados: { numero: string; pessoa: string; linha: number }[];
  correspondencias: { linha: number; pessoa: string; sugestoes: string[] }[];
}

export async function executarImportacaoComparecimentos(arquivo: string, linhas: LinhaComp[], simular: boolean): Promise<ResultadoComp> {
  const { data, error } = await supabase.rpc("importar_comparecimentos" as never, { p_arquivo: arquivo, p_linhas: linhas, p_simular: simular } as never);
  if (error) throw new Error(error.message);
  return data as unknown as ResultadoComp;
}
