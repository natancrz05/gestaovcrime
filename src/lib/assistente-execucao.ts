/**
 * Orçamento por solicitação do ConclusosIA.
 * Não persiste resultados, prompts ou dados entre usuários.
 */
export const MAX_RODADAS_IA = 4;
export const MAX_CHAMADAS_FERRAMENTAS = 8;
export const MAX_CARACTERES_RETORNO_FERRAMENTA = 14_000;

export function resultadoConcisoFerramenta(valor: unknown, limite = MAX_CARACTERES_RETORNO_FERRAMENTA) {
  const json = JSON.stringify(valor) ?? "null";
  if (json.length <= limite) return json;
  // Não recorta JSON no meio: mantém um envelope válido e avisa sobre a limitação.
  return JSON.stringify({
    dadosParciais: json.slice(0, Math.max(0, limite - 350)),
    truncado: true,
    tamanhoOriginal: json.length,
    observacao: "O retorno da ferramenta excede o limite desta resposta. Os dados exibidos são parciais; peça uma busca mais específica antes de concluir algo que dependa do trecho omitido.",
  });
}

export function erroControladoFerramenta(nome: string) {
  return {
    consultaRealizada: false,
    ferramenta: nome,
    observacao: "Esta verificação não pôde ser concluída. Não trate seus dados como confirmados; prossiga com o que estiver comprovado e indique apenas a lacuna relevante.",
  };
}

export function criarExecutorEconomico(
  executar: (nome: string, argumentos: Record<string, unknown>) => Promise<unknown>,
  maxChamadas = MAX_CHAMADAS_FERRAMENTAS,
) {
  // O estado pertence exclusivamente à execução atual (nunca cache global).
  const resultados = new Map<string, Promise<unknown>>();
  let chamadas = 0;
  return (nome: string, argumentos: Record<string, unknown>) => {
    const chave = nome + ":" + JSON.stringify(argumentos);
    const anterior = resultados.get(chave);
    if (anterior) return anterior;
    if (chamadas >= maxChamadas) {
      return Promise.resolve({
        limiteDeConsultas: true,
        observacao: "Limite de consultas desta resposta atingido. Utilize os resultados já obtidos e não inicie novas tentativas.",
      });
    }
    chamadas++;
    const chamada = executar(nome, argumentos);
    resultados.set(chave, chamada);
    return chamada;
  };
}

export const INSTRUCOES_MINUTAS = `Você é o ConclusosIA, assistente de redação da serventia criminal.
Revise ou reescreva diretamente o texto solicitado, preservando fatos, nomes, IDs, datas e conteúdo jurídico fornecidos.
Não invente dados nem acrescente fundamentos jurídicos, avisos de incapacidade, explicações longas ou parágrafos desnecessários.
Entregue só a versão solicitada, em português formal e claro. Minutas não equivalem a decisões judiciais.`;
