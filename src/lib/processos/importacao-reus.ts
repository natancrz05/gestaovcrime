/**
 * Importador reutilizável de planilhas de réus presos (XLSX ou CSV).
 * Colunas reconhecidas pelo nome do cabeçalho, em qualquer ordem.
 * A gravação é feita no banco (importar_reus_presos), tudo-ou-nada.
 */
import { supabase } from "@/integrations/supabase/client";
import { paraData } from "./importacao";
import { separarNumeros } from "./importacao-comparecimentos";


/**
 * Lê CSV sem depender da codificação padrão do navegador.
 * UTF-8 válido é preservado; CSVs Windows-1252 são decodificados explicitamente.
 * UTF-8 com BOM tem o BOM removido pelo TextDecoder.
 */
async function lerCsv(arquivo: File): Promise<string> {
  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  const temBomUtf8 = bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  const utf8 = new TextDecoder("utf-8", { fatal: true });
  if (temBomUtf8) return utf8.decode(bytes);
  try { return utf8.decode(bytes); }
  catch { return new TextDecoder("windows-1252").decode(bytes); }
}

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[_\s.:/-]+/g, " ").trim();

type Campo = "nome" | "rji" | "especie" | "cautelar" | "ip" | "acao_penal" | "andamento" | "termino" | "ultima_reav" | "prazo_reav" | "data_reav" | "situacao" | "data_prisao" | "dias" | "sistema";

/** Ordem importa: regras mais específicas primeiro. */
const REGRAS: [Campo, (h: string) => boolean][] = [
  ["especie", (h) => h.includes("ESPECIE")],
  ["nome", (h) => h.includes("NOME")],
  ["rji", (h) => /\bRJI\b/.test(h)],
  ["acao_penal", (h) => h.includes("ACAO PENAL")],
  ["ip", (h) => /\bIP\b/.test(h) || h.includes("INQUERITO")],
  ["cautelar", (h) => h.includes("CAUTELAR")],
  ["andamento", (h) => h.includes("ANDAMENTO")],
  ["termino", (h) => h.includes("TERMINO")],
  ["ultima_reav", (h) => h.includes("ULTIMA") && h.includes("REAVALIACAO")],
  ["prazo_reav", (h) => h.includes("PRAZO") && h.includes("REAVALIACAO")],
  ["data_reav", (h) => h.includes("REAVALIACAO")],
  ["data_prisao", (h) => h.includes("PRISAO")],
  ["dias", (h) => h.includes("DIAS")],
  ["situacao", (h) => h.includes("SITUACAO")],
  ["sistema", (h) => h.includes("SISTEMA")],
];

export const ROTULOS_REU: Record<Campo, string> = {
  nome: "Nome do preso", rji: "RJI", especie: "Espécie de cautelar", cautelar: "Processo cautelar", ip: "Número do IP",
  acao_penal: "Número da ação penal", andamento: "Andamento do último procedimento", termino: "Término de eventual prazo",
  ultima_reav: "Última reavaliação", prazo_reav: "Prazo de reavaliação", data_reav: "Data de reavaliação", situacao: "Situação",
  data_prisao: "Data da prisão", dias: "Dias preso (planilha)", sistema: "Sistema",
};

/** Apenas traduz o texto da espécie para os tipos já existentes no cadastro de réus. */
export function tipoPrisaoDe(especie: string): string {
  const t = norm(especie);
  if (t.includes("PREVENT")) return "Prisão preventiva";
  if (t.includes("TEMPOR")) return "Prisão temporária";
  if (t.includes("FLAGRAN")) return "Prisão em flagrante";
  return "Outra";
}

function dataPlanilhaValida(valor: unknown): string | null {
  const d = paraData(valor);
  if (!d) return null;
  const ano = Number(d.slice(0, 4));
  return Number.isFinite(ano) && ano >= 2000 ? d : null;
}

export interface LinhaReu {
  linha: number; nome: string; rji: string; especie: string; tipo_prisao: string; preso: boolean; situacao: string;
  data_prisao: string | null; cautelar: string[]; ip: string[]; acao_penal: string[]; dados: Record<string, string>;
}
export interface ProblemaReu { linha: number; nome: string; motivo: string }
export interface AnaliseReu { total: number; validas: LinhaReu[]; erros: ProblemaReu[]; duplicados: ProblemaReu[]; avisos: ProblemaReu[] }

export async function lerPlanilhaReus(arquivo: File): Promise<AnaliseReu> {
  if (!/\.(xlsx|csv)$/i.test(arquivo.name)) throw new Error("Envie um arquivo .xlsx ou .csv.");
  const XLSX = await import("xlsx");
  let wb;
  try {
    wb = /\.csv$/i.test(arquivo.name)
      ? XLSX.read(await lerCsv(arquivo), { type: "string", raw: true })
      : XLSX.read(await arquivo.arrayBuffer(), { type: "array", cellDates: true });
  } catch { throw new Error("Não foi possível ler o arquivo. Ele pode estar corrompido."); }
  const aba = wb.SheetNames[0] ? wb.Sheets[wb.SheetNames[0]] : undefined;
  if (!aba) throw new Error("A planilha está vazia.");
  const matriz = XLSX.utils.sheet_to_json<unknown[]>(aba, { header: 1, raw: true, defval: "" });
  const mapear = (r: unknown[]) => r.map((c) => { const h = norm(String(c)); return h ? REGRAS.find(([, f]) => f(h))?.[0] ?? null : null; });
  const iCab = matriz.findIndex((r) => mapear(r).includes("nome"));
  if (iCab < 0) throw new Error('Não encontrei a coluna "Nome do preso". Nenhuma alteração foi feita.');
  const mapa = mapear(matriz[iCab] ?? []);
  mapa.forEach((c, i) => { if (c && mapa.indexOf(c) !== i) mapa[i] = null; });

  const validas: LinhaReu[] = []; const erros: ProblemaReu[] = []; const avisos: ProblemaReu[] = [];
  let total = 0;
  matriz.slice(iCab + 1).forEach((r, k) => {
    if (!r.some((c) => String(c ?? "").trim())) return;
    total++;
    const nLinha = iCab + k + 2;
    const v: Partial<Record<Campo, unknown>> = {};
    mapa.forEach((c, i) => { if (c) v[c] = r[i]; });
    const txt = (c: Campo) => { const x = v[c]; return (x instanceof Date ? paraData(x) ?? "" : String(x ?? "")).trim(); };
    const nome = txt("nome");
    if (!nome) { erros.push({ linha: nLinha, nome: "—", motivo: "nome do preso vazio" }); return; }
    const dados: Record<string, string> = {};
    const probs: string[] = [];
    (["andamento", "termino", "ultima_reav", "prazo_reav", "data_reav", "dias", "sistema"] as Campo[]).forEach((c) => {
      if (["termino", "ultima_reav", "data_reav"].includes(c)) {
        const d = dataPlanilhaValida(v[c]);
        const bruto = txt(c);
        if (bruto && d === null) probs.push(ROTULOS_REU[c] + " não reconhecida (\"" + bruto + "\") — ignorada");
        if (d) dados[ROTULOS_REU[c]] = d;
      } else if (c === "dias") {
        const bruto = txt(c);
        const n = Number(bruto.replace(",", "."));
        if (bruto && Number.isFinite(n) && n >= 0 && n <= 5000) dados[ROTULOS_REU[c]] = String(Math.trunc(n));
        else if (bruto) probs.push("Dias preso não reconhecido (\"" + bruto + "\") — ignorado");
      } else {
        const s = txt(c);
        if (s) dados[ROTULOS_REU[c]] = s;
      }
    });
    const dp = dataPlanilhaValida(v.data_prisao);
    if (txt("data_prisao") && dp === null) probs.push("data da prisão não reconhecida (\"" + txt("data_prisao") + "\") — ignorada");
    if (probs.length) avisos.push({ linha: nLinha, nome, motivo: probs.join("; ") });
    const especie = txt("especie");
    const situacao = txt("situacao");
    const solto = /\bSOLTO\b/.test(norm(situacao));
    validas.push({
      linha: nLinha, nome, rji: txt("rji"), especie, situacao, data_prisao: dp ?? null,
      tipo_prisao: solto ? "Não preso" : tipoPrisaoDe(especie), preso: !solto,
      cautelar: separarNumerosOuTexto(txt("cautelar")), ip: separarNumerosOuTexto(txt("ip")), acao_penal: separarNumerosOuTexto(txt("acao_penal")), dados,
    });
  });

  // Duplicidade = mesmo preso E mesmos processos. Mesmo preso em processo diferente é outro vínculo.
  const chave = (l: LinhaReu) => `${l.rji.replace(/\s/g, "") || norm(l.nome)}|${[...l.cautelar, ...l.ip, ...l.acao_penal].map((n) => n.replace(/\D/g, "") || norm(n)).sort().join(",")}`;
  const cont = new Map<string, number>();
  validas.forEach((l) => cont.set(chave(l), (cont.get(chave(l)) ?? 0) + 1));
  const duplicados = validas.filter((l) => (cont.get(chave(l)) ?? 0) > 1).map((l) => ({ linha: l.linha, nome: l.nome, motivo: "possível duplicidade: mesmo preso e mesmo processo repetidos na planilha" }));
  return { total, validas: validas.filter((l) => (cont.get(chave(l)) ?? 0) === 1), erros, duplicados, avisos };
}

/** Números CNJ separados; números curtos (ex.: IP "123/2024") são mantidos como texto. */
function separarNumerosOuTexto(celula: string): string[] {
  if (!celula) return [];
  const nums = separarNumeros(celula);
  return nums.length ? nums : [celula];
}

export interface ProcRel { tipo: string; numero: string; processo_id: string | null; situacao: string }
export interface ItemReu { linha: number; nome: string; rji: string; especie: string; processos: ProcRel[]; motivo: string }
export interface ResultadoReu {
  total: number; novos: ItemReu[]; atualizados: ItemReu[]; sem_alteracao: number; processos_encontrados: number;
  processos_criados: { numero: string; tipo: string; preso: string; linha: number }[];
  nao_vinculados: { linha: number; preso: string; tipo: string; numero: string }[];
}

export async function executarImportacaoReus(arquivo: string, linhas: LinhaReu[], erros: number, simular: boolean): Promise<ResultadoReu> {
  const { data, error } = await supabase.rpc("importar_reus_presos" as never, { p_arquivo: arquivo, p_linhas: linhas, p_erros: erros, p_simular: simular } as never);
  if (error) throw new Error(error.message);
  return data as unknown as ResultadoReu;
}

export const ROTULO_TIPO_PROC: Record<string, string> = { cautelar: "Cautelar", ip: "IP", acao_penal: "Ação penal", outro: "Outro relacionado" };
