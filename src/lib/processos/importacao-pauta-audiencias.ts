/**
 * Leitor da pauta de audiências exportada pelo PJe em PDF.
 *
 * Princípios:
 * - leitura estrutural pelas colunas do próprio PDF (não por OCR);
 * - nenhuma gravação durante a leitura/prévia;
 * - processo é identificado pelo número CNJ normalizado;
 * - audiência já existente, inclusive manual, nunca é recriada;
 * - colisões de horário/finalidade são bloqueadas antes da importação;
 * - réus são extraídos das Partes apenas quando o papel é inequivocamente passivo.
 * - a importação é idempotente: se for interrompida, o mesmo arquivo pode ser
 *   processado novamente sem recriar o que já tiver sido salvo.
 */
import pdfWorker from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import { supabase } from "@/integrations/supabase/client";
import type { ProcessoCompleto, Reu } from "./modelo";
import { listarProcessosCompletos, criarProcesso, salvarAudiencia, type NovoProcessoEntrada } from "./repositorio";
import { TIPOS_AUDIENCIA, tipoAudienciaCanonico } from "./audiencias";

type Coluna = "data" | "processo" | "orgao" | "partes" | "classe" | "tipo" | "sala" | "situacao";

export interface PessoaPauta {
  nome: string;
  cpf: string;
  papel: string;
  reu: boolean;
}

export interface LinhaPautaAudiencia {
  pagina: number;
  data: string;
  horario: string;
  numero: string;
  orgao: string;
  classe: string;
  tipo: string;
  tipoOriginal: string;
  salaOriginal: string;
  local: "Sala de Audiências" | "Sala do Júri" | "Videoconferência" | "Outro";
  modalidade: "Presencial" | "Virtual" | "Híbrida";
  situacao: "Agendada" | "Redesignada" | "Realizada" | "Cancelada";
  situacaoOriginal: string;
  pessoas: PessoaPauta[];
  reus: PessoaPauta[];
}

export interface ProblemaPauta {
  pagina: number;
  numero?: string | undefined;
  motivo: string;
}

export type EstadoImportacaoPauta = "nova" | "ja-cadastrada" | "conflito";

export interface ItemAnalisePauta extends LinhaPautaAudiencia {
  processoId?: string | undefined;
  processoNovo: boolean;
  reusNovos: PessoaPauta[];
  estado: EstadoImportacaoPauta;
  motivo?: string | undefined;
}

export interface AnalisePautaAudiencias {
  total: number;
  itens: ItemAnalisePauta[];
  erros: ProblemaPauta[];
  duplicadasArquivo: ProblemaPauta[];
  processosNovos: number;
  processosExistentes: number;
  audienciasNovas: number;
  audienciasExistentes: number;
  reusNovos: number;
  conflitos: number;
}

export interface ResultadoImportacaoPauta {
  processosCriados: number;
  processosReutilizados: number;
  reusCriados: number;
  reusAtualizados: number;
  audienciasCriadas: number;
  audienciasJaExistentes: number;
}

const norm = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/\s+/g, " ").trim();

const normNome = (s: string) =>
  norm(s).replace(/[^A-Z0-9 ]/g, "").replace(/\s+/g, " ").trim();

const normClasse = (s: string) =>
  norm(s).replace(/\(\d+\)/g, "").replace(/[^A-Z0-9]/g, "");

export const normalizarNumeroProcesso = (s: string) => s.replace(/\D/g, "");

function formatarNumeroCnj(digitos: string): string {
  if (digitos.length !== 20) return digitos;
  return `${digitos.slice(0, 7)}-${digitos.slice(7, 9)}.${digitos.slice(9, 13)}.${digitos.slice(13, 14)}.${digitos.slice(14, 16)}.${digitos.slice(16)}`;
}

function paraIso(data: string): string | null {
  const m = data.trim().match(/^(\d{2})\/(\d{2})\/(\d{2}|\d{4})$/);
  if (!m) return null;
  const dia = Number(m[1]); const mes = Number(m[2]);
  const anoCurto = Number(m[3]); const ano = m[3]!.length === 2 ? 2000 + anoCurto : anoCurto;
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  if (d.getUTCFullYear() !== ano || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return null;
  return `${ano.toString().padStart(4, "0")}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

function limparTexto(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

function limparClasse(s: string): string {
  const t = limparTexto(s).replace(/^(?:(?:[-–—]\s*)|(?:CPF\s*:?\s*))+/i, "").trim();
  const compacto = norm(t).replace(/[^A-Z0-9]/g, "");
  const codigo = t.match(/\((\d+)\)/)?.[1];
  if (compacto.includes("TERMOCIRCUNSTANCIADO")) return `TERMO CIRCUNSTANCIADO${codigo ? ` (${codigo})` : ""}`;
  if (compacto.includes("AUTODEPRISAOEMFLAGRANTE")) return `AUTO DE PRISÃO EM FLAGRANTE${codigo ? ` (${codigo})` : ""}`;
  if (compacto.includes("INQUERITOPOLICIAL")) return `INQUÉRITO POLICIAL${codigo ? ` (${codigo})` : ""}`;
  return t;
}

function situacaoCanonica(s: string): LinhaPautaAudiencia["situacao"] | null {
  const t = norm(s);
  if (/CANCELAD/.test(t)) return "Cancelada";
  if (/REALIZAD/.test(t)) return "Realizada";
  if (/REDESIGNAD/.test(t)) return "Redesignada";
  if (/DESIGNAD|AGENDAD|MARCADA/.test(t)) return "Agendada";
  return null;
}

function salaCanonica(s: string): Pick<LinhaPautaAudiencia, "local" | "modalidade"> | null {
  const t = norm(s);
  if (!t || t === "." || t === "-") return null;
  if (/HIBRID/.test(t)) return { local: "Sala de Audiências", modalidade: "Híbrida" };
  if (/VIDEOCONFER|VIRTUAL|TEAMS|ZOOM/.test(t)) return { local: "Videoconferência", modalidade: "Virtual" };
  if (/JURI/.test(t)) return { local: "Sala do Júri", modalidade: "Presencial" };
  // O PJe pode usar o nome da sala/pauta (ex.: "Audiência Conciliação e Preliminar")
  // em vez do nome físico. Nomes inequivocamente ligados à pauta de audiência
  // são convertidos para a opção rígida "Sala de Audiências"; outros ficam como "Outro".
  if (/AUDIENCIA|CONCILIACAO|PRELIMINAR|INSTRUCAO|CUSTODIA/.test(t)) {
    return { local: "Sala de Audiências", modalidade: "Presencial" };
  }
  return { local: "Outro", modalidade: "Presencial" };
}

function papelEhReu(papel: string) {
  const t = norm(papel).replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  return /(AUTOR\s+DO\s+FATO|\bREU\b|ACUSAD|DENUNCIAD|INDICIAD|QUERELAD|EXECUTAD|INVESTIGAD|REQUERID)/.test(t);
}

function extrairPessoas(texto: string): PessoaPauta[] {
  const pessoas: PessoaPauta[] = [];
  const re = /([^()]+?)\(([^)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(texto))) {
    let trecho = limparTexto(m[1] ?? "");
    const papel = limparTexto(m[2] ?? "");
    trecho = trecho.replace(/^(?:(?:X|E)\s+|[,;]\s*)+/i, "").trim();
    // Alguns PDFs quebram "CPF:" ou os dois últimos dígitos entre linhas.
    // A leitura aceita pontuação/espaços intermediários e normaliza para 000.000.000-00.
    const cpfMatch = trecho.match(/(?:\bCPF\s*:?\s*)?(\d{3}\s*\.?\s*\d{3}\s*\.?\s*\d{3}\s*-?\s*\d{2})/i);
    const cpfDigitos = cpfMatch?.[1]?.replace(/\D/g, "") ?? "";
    const cpf = cpfDigitos.length === 11
      ? `${cpfDigitos.slice(0, 3)}.${cpfDigitos.slice(3, 6)}.${cpfDigitos.slice(6, 9)}-${cpfDigitos.slice(9)}`
      : "";
    const nome = trecho
      .replace(cpfMatch?.[0] ?? "", "")
      .replace(/^[-–—,;\s]+|[-–—,;\s]+$/g, "")
      .trim();
    if (!nome || nome === "X") continue;
    pessoas.push({ nome, cpf, papel, reu: papelEhReu(papel) });
  }
  return pessoas;
}

function chaveAudiencia(numero: string, data: string, horario: string, tipo: string) {
  return `${normalizarNumeroProcesso(numero)}|${data}|${horario.slice(0, 5)}|${norm(tipoAudienciaCanonico(tipo))}`;
}

function chaveHorario(data: string, horario: string, tipo: string) {
  return `${data}|${horario.slice(0, 5)}|${norm(tipoAudienciaCanonico(tipo))}`;
}

function cpfDeReu(r: Reu): string {
  const obs = r.observacoes?.match(/\bCPF\s*:\s*([0-9.\-]+)/i)?.[1];
  if (obs) return obs.replace(/\D/g, "");
  const dados = (r as Reu & { dados_planilha?: Record<string, unknown> }).dados_planilha;
  const cpf = dados && typeof dados["cpf"] === "string" ? dados["cpf"] : "";
  return cpf.replace(/\D/g, "");
}

function reuJaExiste(reus: Reu[], pessoa: PessoaPauta) {
  const cpf = pessoa.cpf.replace(/\D/g, "");
  return reus.some((r) =>
    normNome(r.nome) === normNome(pessoa.nome) ||
    (!!cpf && cpf.length >= 11 && cpfDeReu(r) === cpf),
  );
}

function conflitoIdentidadeReu(reus: Reu[], pessoa: PessoaPauta): string | null {
  const cpfPauta = pessoa.cpf.replace(/\D/g, "");
  if (!cpfPauta) return null;
  const mesmoNome = reus.find((r) => normNome(r.nome) === normNome(pessoa.nome));
  if (!mesmoNome) return null;
  const cpfExistente = cpfDeReu(mesmoNome);
  if (cpfExistente && cpfExistente !== cpfPauta) {
    return `O réu/autor do fato ${pessoa.nome} já existe no processo com CPF diferente do informado na pauta.`;
  }
  return null;
}

function observacaoImportacao(l: LinhaPautaAudiencia) {
  const detalhes = ["Importada da pauta de audiências do PJe."];
  if (l.salaOriginal) detalhes.push(`Sala no PJe: ${l.salaOriginal}.`);
  if (l.situacaoOriginal) detalhes.push(`Situação no PJe: ${l.situacaoOriginal}.`);
  return detalhes.join(" ");
}

interface ItemPdf {
  str: string;
  x: number;
  y: number;
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
  for (let i = 1; i < n.length; i++) if (n[i]! <= n[i - 1]!) return null;
  const limites = n.slice(0, -1).map((x, i) => (x + n[i + 1]!) / 2);
  // "Partes" é uma coluna larga e o texto pode chegar muito perto da borda direita.
  // O meio entre os títulos Partes/Classe corta sobrenomes, CPF e o papel da parte.
  // Usa a borda real aproximada da coluna, imediatamente antes do início de Classe.
  limites[3] = n[4]! - 20;
  return limites;
}

function montarLinha(pagina: number, colunas: Record<Coluna, string[]>): { linha?: LinhaPautaAudiencia; erro?: ProblemaPauta } {
  const dataHora = limparTexto(colunas.data.join(" "));
  const dm = dataHora.match(/(\d{2}\/\d{2}\/(?:\d{2}|\d{4}))\s+(\d{2}:\d{2})/);
  const data = dm ? paraIso(dm[1]!) : null;
  const horario = dm?.[2] ?? "";
  const digitos = normalizarNumeroProcesso(colunas.processo.join(""));
  const numero = formatarNumeroCnj(digitos);
  const orgao = limparTexto(colunas.orgao.join(" "));
  const tipoOriginal = limparTexto(colunas.tipo.join(" ")).replace(/[.\s]+$/g, "").trim();
  const tipo = tipoAudienciaCanonico(tipoOriginal);
  const tipoReconhecido = (TIPOS_AUDIENCIA as readonly string[]).includes(tipo);
  const salaOriginal = limparTexto(colunas.sala.join(" "));
  const situacaoOriginal = limparTexto(colunas.situacao.join(" "));
  const situacao = situacaoCanonica(situacaoOriginal);
  // Em células muito longas, o PDF pode posicionar o fechamento do papel da parte
  // poucos pixels dentro da coluna Classe. Recupera apenas o necessário para
  // fechar os parênteses, sem misturar a classe ao nome da parte.
  const partesTokens = [...colunas.partes];
  const classeTokens = [...colunas.classe];
  const saldoParenteses = () => {
    const t = partesTokens.join(" ");
    return (t.match(/\(/g)?.length ?? 0) - (t.match(/\)/g)?.length ?? 0);
  };
  while (saldoParenteses() > 0 && classeTokens.length) partesTokens.push(classeTokens.shift()!);
  const classe = limparClasse(classeTokens.join(" "));
  const pessoas = extrairPessoas(limparTexto(partesTokens.join(" ")));
  const reus = pessoas.filter((p) => p.reu);
  const sala = salaCanonica(salaOriginal);

  const faltas: string[] = [];
  if (!data) faltas.push("data inválida");
  if (!/^\d{2}:\d{2}$/.test(horario)) faltas.push("horário inválido");
  if (digitos.length !== 20) faltas.push("número CNJ inválido");
  if (!classe) faltas.push("classe não identificada");
  if (!tipoOriginal || !tipoReconhecido) faltas.push(`tipo de audiência não reconhecido ("${tipoOriginal || "vazio"}")`);
  if (!situacao) faltas.push(`situação não reconhecida ("${situacaoOriginal || "vazia"}")`);
  if (!orgao) faltas.push("órgão julgador não identificado");
  if (!sala) faltas.push("sala/local não identificado");
  if (!reus.length) faltas.push("nenhum réu/autor do fato identificado nas Partes");
  if (reus.some((r) => !r.cpf)) faltas.push("CPF de réu/autor do fato não identificado");
  if (faltas.length) return { erro: { pagina, numero: numero || undefined, motivo: faltas.join("; ") } };

  return {
    linha: {
      pagina, data: data!, horario, numero, orgao, classe,
      tipo, tipoOriginal, salaOriginal, local: sala!.local, modalidade: sala!.modalidade,
      situacao: situacao!, situacaoOriginal, pessoas, reus,
    },
  };
}

export async function lerPautaAudiencias(arquivo: File): Promise<{ linhas: LinhaPautaAudiencia[]; erros: ProblemaPauta[] }> {
  if (!/\.pdf$/i.test(arquivo.name) && arquivo.type !== "application/pdf") {
    throw new Error("Envie a pauta de audiências em PDF exportada pelo PJe.");
  }

  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;
  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  const pdf = await (async () => {
    try {
      return await pdfjs.getDocument({ data: bytes }).promise;
    } catch {
      throw new Error("Não foi possível abrir o PDF. O arquivo pode estar corrompido ou protegido.");
    }
  })();

  const linhas: LinhaPautaAudiencia[] = [];
  const erros: ProblemaPauta[] = [];

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
      erros.push({ pagina, motivo: "Cabeçalho da pauta PJe não reconhecido nesta página." });
      continue;
    }

    const inicios = itens
      .filter((i) => colunaDe(i.x, limites) === "data" && /^\d{2}\/\d{2}\/(?:\d{2}|\d{4})(?:\s+\d{2}:\d{2})?$/.test(i.str))
      .sort((a, b) => b.y - a.y);

    if (!inicios.length) {
      erros.push({ pagina, motivo: "Nenhuma linha de audiência foi encontrada nesta página." });
      continue;
    }

    // Conferência estrutural independente: cada linha da pauta também começa por
    // um bloco CNJ (0000000-). Se as contagens divergirem, o leitor não arrisca
    // importar uma pauta parcialmente reconhecida.
    const iniciosProcesso = itens.filter(
      (i) => colunaDe(i.x, limites) === "processo" && /^\d{7}-?$/.test(i.str.replace(/\s/g, "")),
    );
    if (iniciosProcesso.length !== inicios.length) {
      erros.push({
        pagina,
        motivo: `A estrutura da página não foi reconhecida por completo: ${inicios.length} horário(s) e ${iniciosProcesso.length} início(s) de processo. A importação foi bloqueada.`,
      });
    }

    for (let n = 0; n < inicios.length; n++) {
      const inicio = inicios[n]!;
      const proximo = inicios[n + 1];
      // Para a última linha da página, limita a altura para não absorver rodapé
      // ou numeração de página como se fossem dados da audiência.
      const limiteInferior = proximo ? proximo.y + 0.5 : inicio.y - 120;
      const itensLinha = itens
        .filter((item) => item.y <= inicio.y + 2 && item.y > limiteInferior)
        .sort((a, b) => b.y - a.y || a.x - b.x);
      const colunas: Record<Coluna, string[]> = {
        data: [], processo: [], orgao: [], partes: [], classe: [], tipo: [], sala: [], situacao: [],
      };
      for (const item of itensLinha) {
        const coluna = colunaDe(item.x, limites);
        colunas[coluna].push(item.str);
      }
      const r = montarLinha(pagina, colunas);
      if (r.linha) linhas.push(r.linha);
      if (r.erro) erros.push(r.erro);
    }
  }

  if (!linhas.length && !erros.length) throw new Error("Nenhuma audiência foi identificada no PDF.");
  return { linhas, erros };
}

export function analisarPautaAudiencias(
  linhas: LinhaPautaAudiencia[],
  processos: ProcessoCompleto[],
  errosLeitura: ProblemaPauta[] = [],
): AnalisePautaAudiencias {
  const erros = [...errosLeitura];
  const duplicadasArquivo: ProblemaPauta[] = [];

  const processosPorNumero = new Map<string, ProcessoCompleto[]>();
  for (const p of processos) {
    const k = normalizarNumeroProcesso(p.numero);
    processosPorNumero.set(k, [...(processosPorNumero.get(k) ?? []), p]);
  }

  const primeiraPorChave = new Set<string>();
  const linhasUnicas: LinhaPautaAudiencia[] = [];
  for (const l of linhas) {
    const k = chaveAudiencia(l.numero, l.data, l.horario, l.tipo);
    if (primeiraPorChave.has(k)) {
      duplicadasArquivo.push({ pagina: l.pagina, numero: l.numero, motivo: "Linha repetida na própria pauta; será ignorada." });
      continue;
    }
    primeiraPorChave.add(k);
    linhasUnicas.push(l);
  }

  const orgaos = new Set(linhasUnicas.map((l) => norm(l.orgao)).filter(Boolean));
  if (orgaos.size > 1) {
    erros.push({ pagina: 0, motivo: "A pauta contém mais de um órgão julgador. Importe apenas a pauta da mesma unidade por vez." });
  }

  // O mesmo processo deve ter uma única classe na pauta.
  const classes = new Map<string, Set<string>>();
  for (const l of linhasUnicas) {
    const k = normalizarNumeroProcesso(l.numero);
    const set = classes.get(k) ?? new Set<string>();
    set.add(norm(l.classe));
    classes.set(k, set);
  }
  for (const [numero, set] of classes) {
    if (set.size > 1) erros.push({ numero: formatarNumeroCnj(numero), pagina: 0, motivo: "O mesmo processo aparece com classes diferentes na pauta." });
  }

  const slotsArquivo = new Map<string, Set<string>>();
  const horariosPorProcesso = new Map<string, number>();
  for (const l of linhasUnicas) {
    const k = chaveHorario(l.data, l.horario, l.tipo);
    const numeros = slotsArquivo.get(k) ?? new Set<string>();
    numeros.add(normalizarNumeroProcesso(l.numero));
    slotsArquivo.set(k, numeros);

    const processoHorario = `${normalizarNumeroProcesso(l.numero)}|${l.data}|${l.horario}`;
    horariosPorProcesso.set(processoHorario, (horariosPorProcesso.get(processoHorario) ?? 0) + 1);
  }

  const reusNovosVistos = new Set<string>();
  const itens: ItemAnalisePauta[] = linhasUnicas.map((l) => {
    const numeroNormalizado = normalizarNumeroProcesso(l.numero);
    const candidatos = processosPorNumero.get(numeroNormalizado) ?? [];
    if (candidatos.length > 1) {
      return {
        ...l, processoNovo: false, reusNovos: [], estado: "conflito",
        motivo: "Há mais de um processo no acervo com este mesmo número CNJ.",
      };
    }
    const processo = candidatos[0];
    if (processo) {
      // O código CNJ da classe entre parênteses pode existir na pauta e estar
      // ausente em cadastros antigos. Compara a classe sem esse código para não
      // gerar falso conflito (ex.: "TERMO CIRCUNSTANCIADO" x "... (278)").
      const classeSistema = normClasse(processo.classe ?? "");
      const classePauta = normClasse(l.classe);
      if (classeSistema && classePauta && classeSistema !== classePauta) {
        return {
          ...l, processoId: processo.id, processoNovo: false, reusNovos: [], estado: "conflito",
          motivo: `O processo já existe, mas a classe diverge: sistema "${processo.classe}" e pauta "${l.classe}".`,
        };
      }

      const conflitoReu = l.reus.map((p) => conflitoIdentidadeReu(processo.reus, p)).find(Boolean);
      if (conflitoReu) {
        return {
          ...l, processoId: processo.id, processoNovo: false, reusNovos: [], estado: "conflito",
          motivo: conflitoReu,
        };
      }
    }

    const candidatosReusNovos = processo ? l.reus.filter((r) => !reuJaExiste(processo.reus, r)) : l.reus;
    const reusNovos = candidatosReusNovos.filter((r) => {
      const identidade = r.cpf.replace(/\D/g, "") || normNome(r.nome);
      const chave = `${numeroNormalizado}|${identidade}`;
      if (reusNovosVistos.has(chave)) return false;
      reusNovosVistos.add(chave);
      return true;
    });

    const processoHorario = `${numeroNormalizado}|${l.data}|${l.horario}`;
    if ((horariosPorProcesso.get(processoHorario) ?? 0) > 1) {
      return {
        ...l, processoId: processo?.id, processoNovo: !processo, reusNovos, estado: "conflito",
        motivo: "A própria pauta contém mais de uma audiência deste processo na mesma data e horário.",
      };
    }

    const slot = chaveHorario(l.data, l.horario, l.tipo);
    if ((slotsArquivo.get(slot)?.size ?? 0) > 1) {
      return {
        ...l, processoId: processo?.id, processoNovo: !processo, reusNovos, estado: "conflito",
        motivo: "A própria pauta contém mais de um processo no mesmo horário com a mesma finalidade.",
      };
    }

    if (processo) {
      const exata = processo.audiencias.find((a) =>
        chaveAudiencia(processo.numero, a.data, a.horario ?? "", a.tipo) === chaveAudiencia(l.numero, l.data, l.horario, l.tipo),
      );
      if (exata) {
        const situacaoExistente = situacaoCanonica(exata.situacao) ?? exata.situacao;
        if (situacaoExistente !== l.situacao) {
          return {
            ...l, processoId: processo.id, processoNovo: false, reusNovos, estado: "conflito",
            motivo: `A audiência já existe, mas a situação diverge: sistema "${exata.situacao}" e pauta "${l.situacaoOriginal}".`,
          };
        }
        return { ...l, processoId: processo.id, processoNovo: false, reusNovos, estado: "ja-cadastrada" };
      }

      const mesmoMomento = processo.audiencias.find((a) => a.data === l.data && (a.horario ?? "").slice(0, 5) === l.horario);
      if (mesmoMomento) {
        return {
          ...l, processoId: processo.id, processoNovo: false, reusNovos, estado: "conflito",
          motivo: `O processo já possui outra audiência neste horário (${mesmoMomento.tipo}).`,
        };
      }
    }

    const choqueOutroProcesso = processos.find((p) =>
      normalizarNumeroProcesso(p.numero) !== numeroNormalizado &&
      p.audiencias.some((a) =>
        a.data === l.data &&
        (a.horario ?? "").slice(0, 5) === l.horario &&
        norm(tipoAudienciaCanonico(a.tipo)) === norm(tipoAudienciaCanonico(l.tipo)),
      ),
    );
    if (choqueOutroProcesso) {
      return {
        ...l, processoId: processo?.id, processoNovo: !processo, reusNovos, estado: "conflito",
        motivo: `Já existe audiência com a mesma finalidade neste horário no processo ${choqueOutroProcesso.numero}.`,
      };
    }

    return { ...l, processoId: processo?.id, processoNovo: !processo, reusNovos, estado: "nova" };
  });

  const numsNovos = new Set(itens.filter((i) => i.processoNovo).map((i) => normalizarNumeroProcesso(i.numero)));
  const numsExistentes = new Set(itens.filter((i) => !i.processoNovo).map((i) => normalizarNumeroProcesso(i.numero)));

  return {
    total: linhas.length,
    itens,
    erros,
    duplicadasArquivo,
    processosNovos: numsNovos.size,
    processosExistentes: numsExistentes.size,
    audienciasNovas: itens.filter((i) => i.estado === "nova").length,
    audienciasExistentes: itens.filter((i) => i.estado === "ja-cadastrada").length,
    reusNovos: itens.reduce((n, i) => n + i.reusNovos.length, 0),
    conflitos: itens.filter((i) => i.estado === "conflito").length,
  };
}

async function enriquecerReusExistentes(processo: ProcessoCompleto, pessoas: PessoaPauta[]) {
  let atualizados = 0;
  for (const pessoa of pessoas) {
    const cpfPauta = pessoa.cpf.replace(/\D/g, "");
    if (!cpfPauta) continue;
    const existente = processo.reus.find((r) =>
      normNome(r.nome) === normNome(pessoa.nome) || cpfDeReu(r) === cpfPauta,
    );
    if (!existente || cpfDeReu(existente)) continue;

    const observacaoCpf = `CPF: ${pessoa.cpf} — identificado na pauta de audiências do PJe.`;
    const observacoes = existente.observacoes.trim()
      ? `${existente.observacoes.trim()}\n${observacaoCpf}`
      : observacaoCpf;
    const bruto = (existente as Reu & { dados_planilha?: unknown }).dados_planilha;
    const dadosExistentes =
      bruto && typeof bruto === "object" && !Array.isArray(bruto)
        ? bruto as Record<string, unknown>
        : {};

    const { error } = await supabase
      .from("reus")
      .update({
        observacoes,
        dados_planilha: {
          ...dadosExistentes,
          pauta_audiencia: { cpf: pessoa.cpf, papel: pessoa.papel },
        },
      } as never)
      .eq("id", existente.id);
    if (error) throw error;
    existente.observacoes = observacoes;
    atualizados++;
  }
  return atualizados;
}

async function inserirReusAusentes(processo: ProcessoCompleto, pessoas: PessoaPauta[]) {
  const unicas = pessoas.filter((p, i, arr) =>
    arr.findIndex((x) => normNome(x.nome) === normNome(p.nome) || (!!x.cpf && !!p.cpf && x.cpf.replace(/\D/g, "") === p.cpf.replace(/\D/g, ""))) === i,
  );
  const novos = unicas.filter((p) => !reuJaExiste(processo.reus, p));
  if (!novos.length) return 0;
  const ordemInicial = processo.reus.reduce((m, r) => Math.max(m, r.ordem), -1) + 1;
  const { error } = await supabase.from("reus").insert(novos.map((r, i) => ({
    processo_id: processo.id,
    nome: r.nome,
    situacao: "",
    preso: false,
    tipo_prisao: "Não preso",
    data_prisao: null,
    observacoes: r.cpf ? `CPF: ${r.cpf} — identificado na pauta de audiências do PJe.` : "Identificado na pauta de audiências do PJe.",
    ordem: ordemInicial + i,
    dados_planilha: { origem: "Pauta de Audiência PJe", cpf: r.cpf, papel: r.papel },
  })));
  if (error) throw error;
  return novos.length;
}

export async function executarImportacaoPauta(
  linhas: LinhaPautaAudiencia[],
  errosLeitura: ProblemaPauta[] = [],
): Promise<ResultadoImportacaoPauta> {
  let processos = await listarProcessosCompletos();
  let analise = analisarPautaAudiencias(linhas, processos, errosLeitura);
  if (analise.erros.length || analise.conflitos) {
    throw new Error("A pauta possui erros ou conflitos. Nenhuma nova audiência foi importada.");
  }

  let processosCriados = 0;
  let reusCriados = 0;
  let reusAtualizados = 0;
  const porNumero = new Map<string, LinhaPautaAudiencia[]>();
  for (const l of linhas) {
    const k = normalizarNumeroProcesso(l.numero);
    porNumero.set(k, [...(porNumero.get(k) ?? []), l]);
  }

  // Cria somente processos inexistentes, uma vez por número CNJ.
  for (const [numeroNormalizado, grupo] of porNumero) {
    let existentes = processos.filter((p) => normalizarNumeroProcesso(p.numero) === numeroNormalizado);
    if (existentes.length > 1) throw new Error(`O processo ${grupo[0]!.numero} já está duplicado no acervo.`);
    if (!existentes.length) {
      const reus = grupo.flatMap((l) => l.reus).filter((r, i, arr) =>
        arr.findIndex((x) => normNome(x.nome) === normNome(r.nome) || (!!x.cpf && !!r.cpf && x.cpf.replace(/\D/g, "") === r.cpf.replace(/\D/g, ""))) === i,
      );
      const entrada: NovoProcessoEntrada = {
        numero: grupo[0]!.numero,
        classe: grupo[0]!.classe,
        assunto: "",
        data_distribuicao: null,
        status: "Ativo",
        fase: "",
        responsavel: "",
        observacao_geral: "Processo incluído automaticamente a partir da pauta de audiências do PJe.",
        partes: [],
        reus: reus.map((r) => ({
          nome: r.nome,
          situacao: "",
          preso: false,
          tipo_prisao: "Não preso",
          data_prisao: null,
          observacoes: r.cpf ? `CPF: ${r.cpf} — identificado na pauta de audiências do PJe.` : "Identificado na pauta de audiências do PJe.",
        })),
        movimentacao: null,
        observacao_interna: "",
      };
      try {
        await criarProcesso(entrada);
        processosCriados++;
        reusCriados += reus.length;
      } catch (e) {
        // Em concorrência, outro usuário pode ter criado o processo após a prévia.
        // Recarrega e só prossegue se agora houver exatamente um registro correspondente.
        if (!(e instanceof Error) || !/já existe um processo/i.test(e.message)) throw e;
      }
      processos = await listarProcessosCompletos();
      existentes = processos.filter((p) => normalizarNumeroProcesso(p.numero) === numeroNormalizado);
      if (existentes.length !== 1) throw new Error(`Não foi possível vincular com segurança o processo ${grupo[0]!.numero}.`);
    }
  }

  // Completa réus em processos que já existiam (ou foram criados por concorrência).
  processos = await listarProcessosCompletos();
  for (const [numeroNormalizado, grupo] of porNumero) {
    const processo = processos.find((p) => normalizarNumeroProcesso(p.numero) === numeroNormalizado);
    if (!processo) throw new Error(`Processo ${grupo[0]!.numero} não encontrado após o cadastro.`);
    const pessoas = grupo.flatMap((l) => l.reus);
    reusAtualizados += await enriquecerReusExistentes(processo, pessoas);
    const criados = await inserirReusAusentes(processo, pessoas);
    reusCriados += criados;
  }

  // Reanalisa imediatamente antes das audiências para capturar qualquer alteração concorrente.
  processos = await listarProcessosCompletos();
  analise = analisarPautaAudiencias(linhas, processos);
  if (analise.erros.length || analise.conflitos) {
    throw new Error("O acervo mudou durante a importação e surgiu um conflito. As audiências não foram duplicadas; revise a prévia e tente novamente.");
  }

  let audienciasCriadas = 0;
  let audienciasJaExistentes = analise.audienciasExistentes;
  for (const item of analise.itens) {
    if (item.estado !== "nova") continue;
    const processo = processos.find((p) => normalizarNumeroProcesso(p.numero) === normalizarNumeroProcesso(item.numero));
    if (!processo) throw new Error(`Processo ${item.numero} não encontrado.`);

    // Última trava imediatamente antes da gravação. Evita que uma audiência criada
    // por outro usuário entre a prévia e o clique de importar gere duplicidade/choque.
    const { data: ocupadas, error: ocupadasError } = await supabase
      .from("audiencias")
      .select("processo_id, tipo")
      .eq("data", item.data)
      .eq("horario", item.horario);
    if (ocupadasError) throw ocupadasError;

    const mesmaFinalidade = (ocupadas ?? []).filter((a) =>
      norm(tipoAudienciaCanonico(a.tipo)) === norm(tipoAudienciaCanonico(item.tipo)),
    );
    if (mesmaFinalidade.some((a) => a.processo_id === processo.id)) {
      audienciasJaExistentes++;
      continue;
    }
    if (mesmaFinalidade.length) {
      throw new Error(`Surgiu outra audiência com a mesma finalidade em ${item.data} às ${item.horario}. A linha ${item.numero} não foi duplicada.`);
    }
    if ((ocupadas ?? []).some((a) => a.processo_id === processo.id)) {
      throw new Error(`O processo ${item.numero} passou a possuir outra audiência em ${item.data} às ${item.horario}. Revise a pauta.`);
    }

    await salvarAudiencia({
      processo_id: processo.id,
      tipo: item.tipo,
      data: item.data,
      horario: item.horario,
      modalidade: item.modalidade,
      local: item.local,
      situacao: item.situacao,
      observacao: observacaoImportacao(item),
      aguardando_nova_data: false,
    });
    audienciasCriadas++;
    // Mantém o estado local atualizado para que duas linhas subsequentes nunca escapem da verificação.
    processo.audiencias.push({
      id: `importando-${audienciasCriadas}`,
      processo_id: processo.id,
      tipo: item.tipo,
      data: item.data,
      horario: item.horario,
      modalidade: item.modalidade,
      local: item.local,
      situacao: item.situacao,
      observacao: observacaoImportacao(item),
      criado_em: new Date().toISOString(),
    });
  }

  return {
    processosCriados,
    processosReutilizados: new Set(linhas.map((l) => normalizarNumeroProcesso(l.numero))).size - processosCriados,
    reusCriados,
    reusAtualizados,
    audienciasCriadas,
    audienciasJaExistentes,
  };
}
