/**
 * Política de uso econômico do ConclusosIA.
 * Não armazenar prompts, PDFs ou resultados jurídicos em cache global.
 */
export type MensagemChat = { role: "user" | "assistant"; content: string };

const LIMITE_MENSAGENS = 8;
const ORCAMENTO_HISTORICO = 12_000;
const MAX_MENSAGEM_ANTIGA = 3_000;

export function contextoConciso(mensagens: MensagemChat[]): MensagemChat[] {
  if (!mensagens.length) return [];
  const recentes = mensagens.slice(-LIMITE_MENSAGENS);
  const atual = recentes[recentes.length - 1];
  if (!atual) return [];
  let restante = ORCAMENTO_HISTORICO;
  const selecionadas: MensagemChat[] = [{ role: atual.role, content: atual.content }];
  for (let i = recentes.length - 2; i >= 0; i--) {
    const mensagem = recentes[i];
    if (!mensagem || restante <= 0) break;
    const texto = mensagem.content.slice(0, Math.min(MAX_MENSAGEM_ANTIGA, restante));
    if (texto) selecionadas.unshift({ role: mensagem.role, content: texto });
    restante -= texto.length;
  }
  return selecionadas;
}

/** Não confundir simples revisão de texto com pareceres, prescrição ou cálculo processual. */
export function solicitacaoSimples(pergunta: string, possuiAnexo: boolean, analiseProcessual: boolean) {
  if (possuiAnexo || analiseProcessual || pergunta.length > 1500) return false;
  const t = pergunta.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  if (!/^(?:por favor[,:]?\s*)?(?:melhore|reescreva|revise\s+a\s+redacao|corrija\s+a\s+gramatica|corrija\s+o\s+texto|formate|resuma\s+o\s+texto|simplifique\s+a\s+redacao)\b/.test(t)) return false;
  if (/\b(?:jurisprudencia|stj|stf|pesquise|busque|pesquisa externa|consulta externa|legislacao atual|atualiz\w*|prescric\w*|prisao|fundamentacao juridica|analise processual|calcule|prazo|inquerito|processo|autos|sentenca|decisao|denuncia|reu|habeas corpus|precedentes|acordaos)\b/.test(t)) return false;
  return true;
}

export function modeloParaSolicitacao(pergunta: string, possuiAnexo: boolean, analiseProcessual: boolean) {
  return solicitacaoSimples(pergunta, possuiAnexo, analiseProcessual)
    ? "openai/gpt-6-luna"
    : "openai/gpt-6-astra";
}

/** Consultas externas só quando o usuário solicitar expressamente pesquisa/atualização. */
export function solicitouPesquisaExterna(pergunta: string): boolean {
  const t = pergunta.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const acao = /\b(?:pesquis|busqu|consult|verifiqu|confir|localiz|procur|atualiz|encontr|traga|mostre|indiqu|apresent|cit|quero|preciso|existe|existem)\w*/.test(t);
  const objeto = /\b(?:jurisprudenc|precedent|acorda|stj|stf|lexml|fonte[s]? extern|legislac|sumula[s]?|decisoes? de tribunais|pesquisa externa|consulta externa|internet|web|online|portais? oficiais?)\w*/.test(t);
  return acao && objeto;
}

/** Uma pesquisa LexML por solicitação; nenhuma resposta é armazenada entre usuários. */
export function limitarPesquisasExternas(
  executar: (dados: Record<string, unknown>) => Promise<unknown>,
) {
  let primeira: Promise<unknown> | undefined;
  let temaOriginal = "";
  return (dados: Record<string, unknown>) => {
    const tema = String(dados["tema"] ?? "").trim().toLowerCase();
    if (primeira) {
      if (tema && tema === temaOriginal) return primeira;
      return Promise.resolve({
        consultaRealizada: false,
        limiteDaResposta: true,
        observacao: "Uma consulta ao LexML já foi realizada para esta resposta. Utilize as referências anteriores; não inicie outra pesquisa.",
      });
    }
    temaOriginal = tema;
    primeira = executar(dados);
    return primeira;
  };
}
