import { Fragment, type ReactNode } from "react";

/**
 * Exibe Markdown produzido pela IA sem inserir HTML arbitrário no DOM.
 * Emojis Unicode são preservados como texto; links externos aceitam só HTTP(S).
 * Componente compartilhado pelo Assistente e pela calculadora processual.
 */
const EMOJI_ATALHOS: Record<string, string> = {
  ":warning:": "⚠️",
  ":check:": "✅",
  ":white_check_mark:": "✅",
  ":x:": "❌",
  ":calendar:": "📅",
  ":hourglass:": "⌛",
  ":information_source:": "ℹ️",
};

function textoComEmojis(texto: string): string {
  return texto.replace(/:(?:warning|check|white_check_mark|x|calendar|hourglass|information_source):/g, (item) => EMOJI_ATALHOS[item] ?? item);
}

function renderInlineMarkdown(texto: string, prefixo = "inline"): ReactNode[] {
  const tokens: ReactNode[] = [];
  const padrao = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*\n]+)\*\*|__([^_\n]+)__|~~([^~\n]+)~~|`([^`\n]+)`|\*([^*\n]+)\*|_([^_\n]+)_/g;
  let fimAnterior = 0;
  let indice = 0;

  for (const token of texto.matchAll(padrao)) {
    const inicio = token.index;
    if (inicio > fimAnterior) {
      tokens.push(<Fragment key={prefixo + "-t" + indice}>{textoComEmojis(texto.slice(fimAnterior, inicio))}</Fragment>);
    }
    const chave = prefixo + "-f" + indice;
    if (token[1] !== undefined && token[2] !== undefined) {
      tokens.push(<a key={chave} href={token[2]} target="_blank" rel="noopener noreferrer" className="break-all font-medium text-primary underline underline-offset-2 hover:opacity-80">{textoComEmojis(token[1])}</a>);
    } else if (token[3] !== undefined || token[4] !== undefined) {
      tokens.push(<strong key={chave} className="font-semibold">{renderInlineMarkdown(token[3] ?? token[4] ?? "", chave)}</strong>);
    } else if (token[5] !== undefined) {
      tokens.push(<del key={chave} className="opacity-70">{textoComEmojis(token[5])}</del>);
    } else if (token[6] !== undefined) {
      tokens.push(<code key={chave} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.9em]">{token[6]}</code>);
    } else {
      tokens.push(<em key={chave} className="italic">{renderInlineMarkdown(token[7] ?? token[8] ?? "", chave)}</em>);
    }
    fimAnterior = inicio + token[0].length;
    indice++;
  }
  if (fimAnterior < texto.length) {
    tokens.push(<Fragment key={prefixo + "-fim"}>{textoComEmojis(texto.slice(fimAnterior))}</Fragment>);
  }
  return tokens;
}

function partesTabela(linha: string): string[] {
  return linha.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((x) => x.trim());
}

function separadorTabela(linha: string): boolean {
  const partes = partesTabela(linha);
  return partes.length > 1 && partes.every((coluna) => /^:?-{3,}:?$/.test(coluna));
}

function ehLista(linha: string): boolean {
  return /^\s*(?:[-*•]\s+|\d+[.)]\s+)/.test(linha);
}
function ehBlocoEspecial(linhas: string[], i: number): boolean {
  const linha = linhas[i] ?? "";
  return /^\s*`{3}/.test(linha) ||
    /^\s*#{1,6}\s+/.test(linha) ||
    /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(linha) ||
    /^\s*>/.test(linha) ||
    ehLista(linha) ||
    (linha.includes("|") && separadorTabela(linhas[i + 1] ?? ""));
}

export function MarkdownResposta({ texto }: { texto: string }) {
  const linhas = texto.replace(/\r\n?/g, "\n").split("\n");
  const blocos: ReactNode[] = [];
  let i = 0;

  while (i < linhas.length) {
    const linha = linhas[i] ?? "";
    if (!linha.trim()) { i++; continue; }
    const chave = "bloco-" + i;

    const codigo = linha.match(/^\s*`{3}([^\s`]*)/);
    if (codigo) {
      const linguagem = codigo[1] ?? "";
      const linhasCodigo: string[] = [];
      i++;
      while (i < linhas.length && !/^\s*`{3}\s*$/.test(linhas[i] ?? "")) {
        linhasCodigo.push(linhas[i] ?? "");
        i++;
      }
      if (i < linhas.length) i++;
      blocos.push(
        <div key={chave} className="my-3 min-w-0 overflow-hidden rounded-lg border border-border bg-muted/30">
          {linguagem ? <div className="border-b border-border px-3 py-1 text-xs text-muted-foreground">{linguagem}</div> : null}
          <pre className="overflow-x-auto whitespace-pre p-3 text-xs leading-5"><code>{linhasCodigo.join("\n")}</code></pre>
        </div>,
      );
      continue;
    }

    const titulo = linha.match(/^\s*(#{1,6})\s+(.+)$/);
    if (titulo?.[1] && titulo[2]) {
      const nivel = titulo[1].length;
      const classes = nivel === 1 ? "text-lg font-semibold" : nivel === 2 ? "text-base font-semibold" : "text-sm font-semibold";
      const Elemento = (nivel === 1 ? "h2" : nivel === 2 ? "h3" : "h4") as "h2" | "h3" | "h4";
      blocos.push(<Elemento key={chave} className={"mt-5 mb-2 leading-snug " + classes}>{renderInlineMarkdown(titulo[2], chave)}</Elemento>);
      i++;
      continue;
    }

    if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(linha)) {
      blocos.push(<hr key={chave} className="my-4 border-border" />);
      i++;
      continue;
    }

    if (linha.includes("|") && separadorTabela(linhas[i + 1] ?? "")) {
      const cabecalhos = partesTabela(linha);
      const dados: string[][] = [];
      i += 2;
      while (i < linhas.length && linhas[i]?.trim() && (linhas[i]?.includes("|") ?? false)) {
        dados.push(partesTabela(linhas[i] ?? ""));
        i++;
      }
      blocos.push(
        <div key={chave} className="my-3 max-w-full overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[420px] border-collapse text-left text-xs sm:text-sm">
            <thead className="bg-muted/50"><tr>{cabecalhos.map((coluna, j) =>
              <th key={j} scope="col" className="border-b border-border p-2.5 align-top font-semibold">{renderInlineMarkdown(coluna, chave + "-h" + j)}</th>)}</tr></thead>
            <tbody>{dados.map((row, j) =>
              <tr key={j} className="border-b border-border/60 last:border-0">{cabecalhos.map((_, k) =>
                <td key={k} className="p-2.5 align-top">{renderInlineMarkdown(row[k] ?? "", chave + "-d" + j + "-" + k)}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      );
      continue;
    }

    if (ehLista(linha)) {
      const itens: Array<{ texto: string; numerada: boolean }> = [];
      const numerada = /^\s*\d+[.)]\s+/.test(linha);
      while (i < linhas.length && ehLista(linhas[i] ?? "") && /^\s*\d+[.)]\s+/.test(linhas[i] ?? "") === numerada) {
        itens.push({ texto: (linhas[i] ?? "").replace(/^\s*(?:[-*•]|\d+[.)])\s+/, ""), numerada });
        i++;
      }
      const Elemento = numerada ? "ol" : "ul";
      blocos.push(
        <Elemento key={chave} className={"my-2 space-y-1 pl-6 " + (numerada ? "list-decimal" : "list-disc")}>
          {itens.map((item, j) =>
            <li key={j} className="pl-0.5 leading-relaxed">{renderInlineMarkdown(item.texto, chave + "-l" + j)}</li>)}
        </Elemento>,
      );
      continue;
    }

    if (/^\s*>\s?/.test(linha)) {
      const citacoes: string[] = [];
      while (i < linhas.length && /^\s*>\s?/.test(linhas[i] ?? "")) {
        citacoes.push((linhas[i] ?? "").replace(/^\s*>\s?/, ""));
        i++;
      }
      blocos.push(<blockquote key={chave} className="my-3 whitespace-pre-wrap border-l-2 border-primary/40 pl-3 text-muted-foreground">{renderInlineMarkdown(citacoes.join("\n"), chave)}</blockquote>);
      continue;
    }

    const paragrafo: string[] = [linha.trim()];
    i++;
    while (i < linhas.length && linhas[i]?.trim() && !ehBlocoEspecial(linhas, i)) {
      paragrafo.push((linhas[i] ?? "").trim());
      i++;
    }
    blocos.push(
      <p key={chave} className="my-2 whitespace-pre-wrap break-words leading-7">
        {renderInlineMarkdown(paragrafo.join("\n"), chave)}
      </p>,
    );
  }

  return <div className="min-w-0 text-sm text-foreground [font-variant-emoji:normal]">{blocos}</div>;
}
