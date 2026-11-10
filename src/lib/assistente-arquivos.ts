import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

export interface ArquivoExtraido {
  id: string;
  nome: string;
  tipo: string;
  texto: string;
  paginas?: number;
  paginasLidas?: number;
  paginasSemTexto?: number[];
  truncado?: boolean;
}

const LIMITE_ARQUIVO_BYTES = 60 * 1024 * 1024;
const LIMITE_TEXTO = 440_000;

function limitarTexto(texto: string) {
  if (texto.length <= LIMITE_TEXTO) return { texto, truncado: false };
  return {
    texto: texto.slice(0, LIMITE_TEXTO) + "\n\n[CONTEÚDO TRUNCADO PELO LIMITE DO ASSISTENTE]",
    truncado: true,
  };
}

async function extrairPdf(file: File): Promise<Omit<ArquivoExtraido, "id">> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data: bytes }).promise;
  const partes: string[] = [];
  let caracteres = 0;
  let truncado = false;
  let paginasLidas = 0;
  const paginasSemTexto: number[] = [];

  for (let pagina = 1; pagina <= pdf.numPages; pagina += 1) {
    const p = await pdf.getPage(pagina);
    const conteudo = await p.getTextContent();
    const linhas = conteudo.items
      .map((item) => ("str" in item ? item.str : ""))
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    const bloco = `[Página ${pagina}]\n${linhas || "[Sem texto extraível nesta página]"}\n`;
    if (caracteres + bloco.length > LIMITE_TEXTO) {
      const restante = LIMITE_TEXTO - caracteres;
      if (restante > 0) partes.push(bloco.slice(0, restante));
      truncado = true;
      break;
    }

    partes.push(bloco);
    caracteres += bloco.length;
    paginasLidas = pagina;
    if (!linhas) paginasSemTexto.push(pagina);
  }

  const texto = partes.join("\n").trim();
  if (!texto || texto.replace(/\[Página \d+\]|\[Sem texto extraível nesta página\]/g, "").trim().length < 40) {
    throw new Error(
      "Não foi possível extrair texto suficiente deste PDF. Ele pode ser composto principalmente por imagens digitalizadas.",
    );
  }

  return {
    nome: file.name,
    tipo: file.type || "application/pdf",
    texto: truncado ? texto + "\n\n[CONTEÚDO TRUNCADO PELO LIMITE DO ASSISTENTE]" : texto,
    paginas: pdf.numPages,
    paginasLidas,
    paginasSemTexto,
    truncado,
  };
}

export async function extrairArquivoTexto(file: File): Promise<ArquivoExtraido> {
  if (file.size > LIMITE_ARQUIVO_BYTES) {
    throw new Error("O arquivo excede 60 MB. Divida-o em partes menores antes de anexar.");
  }

  const nome = file.name.toLowerCase();
  if (file.type === "application/pdf" || nome.endsWith(".pdf")) {
    const extraido = await extrairPdf(file);
    return { id: crypto.randomUUID(), ...extraido };
  }

  if (
    file.type.startsWith("text/") ||
    nome.endsWith(".txt") ||
    nome.endsWith(".md") ||
    nome.endsWith(".csv")
  ) {
    const limitado = limitarTexto(await file.text());
    return {
      id: crypto.randomUUID(),
      nome: file.name,
      tipo: file.type || "text/plain",
      texto: limitado.texto,
      truncado: limitado.truncado,
    };
  }

  throw new Error("Formato não suportado. Envie PDF, TXT, MD ou CSV.");
}
