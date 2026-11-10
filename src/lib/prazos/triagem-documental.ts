export interface ReferenciaEncontrada {
  valor: string;
  pagina: number;
}

export interface IndiceDocumentoPdf {
  datas: ReferenciaEncontrada[];
  ids: ReferenciaEncontrada[];
  paginasComTexto: number;
}

/**
 * Índice literal de datas e IDs do texto extraído de um PDF.
 * NÃO classifica atos, NÃO identifica marcos interruptivos nem verifica
 * o significado jurídico das ocorrências. Isso depende da análise dos autos.
 */
export function indexarReferenciasPdf(texto: string, maximoPorTipo = 60): IndiceDocumentoPdf {
  const paginas = texto.split(/\[Página (\d+)\]\s*/g);
  const datas: ReferenciaEncontrada[] = [];
  const ids: ReferenciaEncontrada[] = [];
  const chavesData = new Set<string>();
  const chavesId = new Set<string>();
  let paginasComTexto = 0;

  for (let i = 1; i + 1 < paginas.length; i += 2) {
    const pagina = Number(paginas[i]);
    const conteudo = paginas[i + 1] ?? "";
    if (!Number.isInteger(pagina) || pagina < 1) continue;
    if (!conteudo.includes("[Sem texto extraível nesta página]") && conteudo.trim()) paginasComTexto++;

    for (const achado of conteudo.matchAll(/\b(?:0?[1-9]|[12]\d|3[01])\/(?:0?[1-9]|1[0-2])\/\d{4}\b|\b\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])\b/g)) {
      if (datas.length >= maximoPorTipo) break;
      const valor = achado[0];
      const chave = pagina + ":" + valor;
      if (!chavesData.has(chave)) {
        chavesData.add(chave);
        datas.push({ valor, pagina });
      }
    }

    for (const achado of conteudo.matchAll(/\bID\s*(?:n[º°o.]*)?\s*[:.-]?\s*(\d{6,15})\b/gi)) {
      if (ids.length >= maximoPorTipo) break;
      const valor = achado[1];
      if (!valor) continue;
      const chave = pagina + ":" + valor;
      if (!chavesId.has(chave)) {
        chavesId.add(chave);
        ids.push({ valor, pagina });
      }
    }
  }
  return { datas, ids, paginasComTexto };
}
