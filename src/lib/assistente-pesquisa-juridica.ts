/**
 * Pesquisa de referências jurídicas públicas no serviço SRU do LexML Brasil.
 *
 * SEGURANÇA:
 * - acesso somente ao endpoint HTTPS fixo, nunca a URL sugerida pela IA;
 * - termos temáticos curtos, sem identificação de processos ou pessoas;
 * - sem enviar PDFs, mensagens, histórico ou dados de usuários;
 * - somente leitura, sem credenciais;
 * - resultado externo é DADO, jamais instrução a ser executada.
 */
import { z } from "zod";

const ENDPOINT = "https://www.lexml.gov.br/busca/SRU";
const DOMINIO_FONTE = "https://www.lexml.gov.br";
const MAX_REGISTROS = 6;
const LIMITE_CONSULTA = 130;
const MAX_XML_BYTES = 500_000;

const CNJ = /\b\d{7}-?\d{2}\.?\d{4}\.?\d\.?\d{2}\.?\d{4}\b/;
const CPF = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/;
const DADOS_SENSIVEIS = /\b(?:cpf|cnpj|rg|senha|token|api[_ -]?key|processo\s+n[ºo°.]?|segredo\s+de\s+justi[cç]a|sigiloso|nome\s+do\s+r[eé]u|acusad[oa]\s*:|v[ií]tima\s*:)\b/i;
const INSTRUCOES_EM_TEMA = /(?:ignore\s+(?:as|todas)|system\s+prompt|developer\s+message|instru[cç][õo]es\s+(?:anteriores|do\s+sistema))/i;

export const CONSULTA_JURIDICA_EXTERNA = {
  type: "function",
  name: "pesquisar_fontes_juridicas",
  description: "Pesquisa externa SOMENTE LEITURA de normas e referências de jurisprudência pública no LexML Brasil. Use apenas temas jurídicos genéricos, como 'prescrição penal recebimento denúncia' ou 'prisão preventiva revisão 90 dias'. Não inclua número do processo, nomes, CPF, trechos dos autos, informações pessoais ou dados sigilosos. Devolva URLs/fontes para conferência nos portais oficiais; NÃO afirme que uma ementa foi confirmada sem texto disponível.",
  parameters: {
    type: "object",
    properties: {
      tema: { type: "string", description: "Termos jurídicos públicos, sem identificação de caso concreto." },
      quantidade: { type: "integer", description: "Máximo de referências (1 a 6)." },
    },
    required: ["tema"],
    additionalProperties: false,
  },
} as const;

const Entrada = z.object({
  tema: z.string().min(4).max(LIMITE_CONSULTA),
  quantidade: z.number().int().min(1).max(MAX_REGISTROS).optional(),
}).strict();

export function validarTemaExterno(dado: unknown) {
  const entrada = Entrada.parse(dado);
  const tema = entrada.tema.replace(/\s+/g, " ").trim();
  if (CNJ.test(tema) || CPF.test(tema) || DADOS_SENSIVEIS.test(tema) ||
      INSTRUCOES_EM_TEMA.test(tema) || /(?:https?:\/\/|@|[{}<>])/.test(tema) || tema.includes("[") || tema.includes("]") ||
      /\b\d{11,20}\b/.test(tema)) {
    throw new Error("A pesquisa externa aceita somente temas jurídicos gerais, sem identificação de processos, partes ou dados sensíveis.");
  }
  // Pesquisa só com caracteres úteis, sem operadores CQL escolhidos pelo modelo.
  if (!/^[\p{L}\p{N}\s.,;()º°§/-]+$/u.test(tema)) {
    throw new Error("Use somente palavras-chave jurídicas e referências normativas na consulta externa.");
  }
  return { tema, quantidade: entrada.quantidade ?? 5 };
}

function textoLimpo(texto: string, limite = 500) {
  return texto.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, limite);
}

function xmlDesescapar(texto: string) {
  return texto
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => {
      const code = parseInt(n, 16);
      return code >= 32 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
    })
    .replace(/&#(\d+);/g, (_, n: string) => {
      const code = parseInt(n, 10);
      return code >= 32 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
    })
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

function extrairCampo(xml: string, nome: string): string[] {
  const padrao = new RegExp("<(?:[\\w-]+:)?" + nome + "(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[\\w-]+:)?" + nome + "\\s*>", "gi");
  return [...xml.matchAll(padrao)].map((m) => textoLimpo(xmlDesescapar(m[1] ?? ""))).filter(Boolean);
}

export function parsearLexml(xml: string) {
  const numero = Number(extrairCampo(xml, "numberOfRecords")[0] ?? 0);
  const registros = [...xml.matchAll(/<(?:[\w-]+:)?record(?:\s[^>]*)?>([\s\S]*?)<\/(?:[\w-]+:)?record\s*>/gi)].slice(0, MAX_REGISTROS);
  const referencias = registros.flatMap((item) => {
    const registro = item[1] ?? "";
    const titulo = extrairCampo(registro, "title")[0];
    if (!titulo) return [];
    const data = extrairCampo(registro, "date")[0] ?? null;
    const tipo = extrairCampo(registro, "type")[0] ?? null;
    const emissores = extrairCampo(registro, "creator");
    const identificadores = extrairCampo(registro, "identifier");
    const urn = identificadores.find((id) => /^urn:lex:br:/i.test(id));
    const urlPublica = identificadores.find((id) => /^https:\/\//i.test(id) && (() => {
      try {
        const host = new URL(id).hostname;
        return /(?:^|\.)gov\.br$/.test(host) || /(?:^|\.)jus\.br$/.test(host) || host === "www.lexml.gov.br";
      } catch { return false; }
    })());
    const url = urlPublica ?? (urn ? DOMINIO_FONTE + "/urn/" + encodeURIComponent(urn) : null);
    if (!url) return [];
    return [{ titulo, url, data, tipo, origem: emissores[0] ?? "LexML Brasil", urn: urn ?? null }];
  });
  return {
    totalEncontrado: Number.isFinite(numero) ? numero : 0,
    referencias,
  };
}

function linksConsultaManual() {
  return [
    { portal: "STJ — Jurisprudência", url: "https://scon.stj.jus.br/SCON/" },
    { portal: "STF — Jurisprudência", url: "https://jurisprudencia.stf.jus.br/pages/search" },
    { portal: "LexML Brasil", url: DOMINIO_FONTE + "/busca/" },
    { portal: "CNJ — Atos Normativos", url: "https://atos.cnj.jus.br/atos" },
  ];
}

export async function executarPesquisaJuridica(dados: unknown) {
  const { tema, quantidade } = validarTemaExterno(dados);
  const query = "dc.title any " + '"' + tema.replace(/["\\]/g, "") + '"';
  const params = new URLSearchParams({
    operation: "searchRetrieve",
    version: "1.1",
    query,
    maximumRecords: String(quantidade),
    recordSchema: "dc",
  });
  // URL fixa e controlada, sem redirects para outros domínios.
  const url = ENDPOINT + "?" + params.toString();
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "error",
      signal: AbortSignal.timeout(12_000),
      headers: { Accept: "application/xml, text/xml" },
    });
    if (!response.ok) throw new Error("HTTP " + response.status);
    const tipo = response.headers.get("content-type") ?? "";
    if (tipo && !/xml|text\/plain/i.test(tipo)) throw new Error("Resposta inesperada do serviço de pesquisa.");
    const comprimento = Number(response.headers.get("content-length") ?? 0);
    if (comprimento > MAX_XML_BYTES) throw new Error("Resposta muito extensa.");
    const raw = await response.text();
    if (raw.length > MAX_XML_BYTES) throw new Error("Resposta muito extensa.");
    const dadosLexml = parsearLexml(raw);
    return {
      servico: "LexML Brasil — SRU público",
      tema,
      consultaRealizada: true,
      ...dadosLexml,
      consultadoEm: new Date().toISOString(),
      observacao: "Metadados públicos: confira o inteiro teor e a atualidade no tribunal antes de citar.",
      portaisParaConferencia: linksConsultaManual(),
    };
  } catch {
    // Não declarar falsamente que pesquisa externa ocorreu. Nenhum dado do processo é retransmitido.
    return {
      servico: "LexML Brasil — SRU público",
      tema,
      consultaRealizada: false,
      totalEncontrado: 0,
      referencias: [],
      observacao: "A consulta externa NÃO foi concluída. Não cite precedentes não verificados; confira nos portais oficiais.",
      portaisParaConferencia: linksConsultaManual(),
    };
  }
}
