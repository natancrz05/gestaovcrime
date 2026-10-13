/**
 * Leitor de PDF exclusivo da BETA de sincronização.
 * Não altera o importador oficial de pautas e não realiza gravações.
 */
import pdfWorker from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import { tipoAudienciaCanonico } from "./audiencias";
import {
  normalizarNumeroProcessoBeta,
  situacaoPautaBeta,
  type LinhaPautaBeta,
  type ProblemaLeituraBeta,
} from "./sincronizacao-pauta-beta-core";

type Coluna =
  | "data"
  | "processo"
  | "orgao"
  | "partes"
  | "classe"
  | "tipo"
  | "sala"
  | "situacao";

interface ItemPdf {
  str: string;
  x: number;
  y: number;
}

export interface LeituraPautaBeta {
  linhas: LinhaPautaBeta[];
  erros: ProblemaLeituraBeta[];
}

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();

const limparTexto = (s: string) => s.replace(/\s+/g, " ").trim();

function formatarNumeroCnj(digitos: string): string {
  if (digitos.length !== 20) return digitos;
  return (
    digitos.slice(0, 7) +
    "-" +
    digitos.slice(7, 9) +
    "." +
    digitos.slice(9, 13) +
    "." +
    digitos.slice(13, 14) +
    "." +
    digitos.slice(14, 16) +
    "." +
    digitos.slice(16)
  );
}

function paraIso(data: string): string | null {
  const m = data.trim().match(/^(\d{2})\/(\d{2})\/(\d{2}|\d{4})$/);
  if (!m) return null;
  const dia = Number(m[1]);
  const mes = Number(m[2]);
  const anoCurto = Number(m[3]);
  const ano = m[3]!.length === 2 ? 2000 + anoCurto : anoCurto;
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  if (
    d.getUTCFullYear() !== ano ||
    d.getUTCMonth() !== mes - 1 ||
    d.getUTCDate() !== dia
  ) {
    return null;
  }
  return (
    String(ano).padStart(4, "0") +
    "-" +
    String(mes).padStart(2, "0") +
    "-" +
    String(dia).padStart(2, "0")
  );
}

function colunaDe(x: number, limites: number[]): Coluna {
  if (x < limites[0]!) return "data";
  if (x < limites[1]!) return "processo";
  if (x < limites[2]!) return "orgao";
  if (x < limites[3]!) return "partes";
  if (x < limites[4]!) return "classe";
  if (x < limites[5]!) return "tipo";
  if (x < limites[6]!) return "sala";
  return "situacao";
}

function limitesCabecalho(itens: ItemPdf[]): number[] | null {
  const achar = (re: RegExp) => itens.find((i) => re.test(norm(i.str)))?.x;
  const xs = [
    achar(/^DATA$/),
    achar(/^PROCESSO$/),
    achar(/^ORGAO/),
    achar(/^PARTES$/),
    achar(/^CLASSE$/),
    achar(/^TIPO\b/),
    achar(/^SALA$/),
    achar(/^SITUACAO$/),
  ];
  if (xs.some((x) => x === undefined)) return null;
  const n = xs as number[];
  for (let i = 1; i < n.length; i++) {
    if (n[i]! <= n[i - 1]!) return null;
  }
  const limites = n.slice(0, -1).map((x, i) => (x + n[i + 1]!) / 2);
  limites[3] = n[4]! - 20;
  return limites;
}

function montarLinha(
  pagina: number,
  colunas: Record<Coluna, string[]>,
): { linha?: LinhaPautaBeta; erro?: ProblemaLeituraBeta } {
  const dataHora = limparTexto(colunas.data.join(" "));
  const dm = dataHora.match(/(\d{2}\/\d{2}\/(?:\d{2}|\d{4}))\s+(\d{2}:\d{2})/);
  const data = dm ? paraIso(dm[1]!) : null;
  const horario = dm?.[2] ?? "";
  const digitos = normalizarNumeroProcessoBeta(colunas.processo.join(""));
  const numero = formatarNumeroCnj(digitos);
  const orgao = limparTexto(colunas.orgao.join(" "));
  const classe = limparTexto(colunas.classe.join(" "));
  const tipoOriginal = limparTexto(colunas.tipo.join(" "))
    .replace(/[.\s]+$/g, "")
    .trim();
  const tipo = tipoAudienciaCanonico(tipoOriginal) || tipoOriginal;
  const salaOriginal = limparTexto(colunas.sala.join(" "));
  const situacaoOriginal = limparTexto(colunas.situacao.join(" "));
  const situacao = situacaoPautaBeta(situacaoOriginal);

  const faltas: string[] = [];
  if (!data) faltas.push("data inválida");
  if (!/^\d{2}:\d{2}$/.test(horario)) faltas.push("horário inválido");
  if (digitos.length !== 20) faltas.push("número CNJ inválido");
  if (!tipoOriginal) faltas.push("tipo de audiência vazio");
  if (!situacaoOriginal) faltas.push("situação vazia");

  if (faltas.length) {
    return {
      erro: { pagina, numero: numero || undefined, motivo: faltas.join("; ") },
    };
  }

  return {
    linha: {
      pagina,
      data: data!,
      horario,
      numero,
      orgao,
      classe,
      tipo,
      tipoOriginal,
      salaOriginal,
      situacao,
      situacaoOriginal,
    },
  };
}

export async function lerPautaSincronizacaoBeta(
  arquivo: File,
): Promise<LeituraPautaBeta> {
  if (!/\.pdf$/i.test(arquivo.name) && arquivo.type !== "application/pdf") {
    throw new Error("Envie uma pauta de audiências em PDF exportada pelo PJe.");
  }

  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;
  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  const pdf = await (async () => {
    try {
      return await pdfjs.getDocument({ data: bytes }).promise;
    } catch {
      throw new Error("Não foi possível abrir o PDF.");
    }
  })();

  const linhas: LinhaPautaBeta[] = [];
  const erros: ProblemaLeituraBeta[] = [];

  for (let pagina = 1; pagina <= pdf.numPages; pagina++) {
    const p = await pdf.getPage(pagina);
    const conteudo = await p.getTextContent();
    const itens: ItemPdf[] = conteudo.items.flatMap((item) => {
      if (!("str" in item) || !("transform" in item)) return [];
      const str = String(item.str ?? "").trim();
      const transform = item.transform as number[];
      if (!str || !Array.isArray(transform)) return [];
      return [{ str, x: Number(transform[4]), y: Number(transform[5]) }];
    });

    const limites = limitesCabecalho(itens);
    if (!limites) {
      erros.push({
        pagina,
        motivo: "Cabeçalho da pauta PJe não reconhecido nesta página.",
      });
      continue;
    }

    const inicios = itens
      .filter(
        (i) =>
          colunaDe(i.x, limites) === "data" &&
          /^\d{2}\/\d{2}\/(?:\d{2}|\d{4})(?:\s+\d{2}:\d{2})?$/.test(i.str),
      )
      .sort((a, b) => b.y - a.y);

    if (!inicios.length) {
      erros.push({
        pagina,
        motivo: "Nenhuma linha de audiência foi localizada nesta página.",
      });
      continue;
    }

    for (let n = 0; n < inicios.length; n++) {
      const inicio = inicios[n]!;
      const proximo = inicios[n + 1];
      const limiteInferior = proximo ? proximo.y + 0.5 : inicio.y - 120;
      const itensLinha = itens
        .filter((item) => item.y <= inicio.y + 2 && item.y > limiteInferior)
        .sort((a, b) => b.y - a.y || a.x - b.x);

      const colunas: Record<Coluna, string[]> = {
        data: [],
        processo: [],
        orgao: [],
        partes: [],
        classe: [],
        tipo: [],
        sala: [],
        situacao: [],
      };
      for (const item of itensLinha) {
        colunas[colunaDe(item.x, limites)].push(item.str);
      }

      const resultado = montarLinha(pagina, colunas);
      if (resultado.linha) linhas.push(resultado.linha);
      if (resultado.erro) erros.push(resultado.erro);
    }
  }

  if (!linhas.length && !erros.length) {
    throw new Error("Nenhuma audiência foi identificada no PDF.");
  }
  return { linhas, erros };
}
