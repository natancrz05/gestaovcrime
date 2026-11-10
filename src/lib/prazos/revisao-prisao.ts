/** Orientações por modalidade: a classificação depende dos autos, nunca do rótulo do cadastro. */
export const MODALIDADES_PRISAO = [
  { valor: "identificar", rotulo: "Identificar automaticamente pelos autos" },
  { valor: "preventiva", rotulo: "Prisão preventiva" },
  { valor: "temporaria", rotulo: "Prisão temporária" },
  { valor: "flagrante", rotulo: "Prisão em flagrante" },
  { valor: "outra", rotulo: "Outra hipótese legal de custódia" },
] as const;

export type ModalidadePrisao = (typeof MODALIDADES_PRISAO)[number]["valor"];

export const ORIENTACAO_REVISAO_PRISAO = [
  "ANÁLISE DE PRISÃO PROVISÓRIA: abranja preventiva, temporária, flagrante ou outra espécie de custódia legalmente prevista, sem presumir que são equivalentes.",
  "Primeiro identifique a situação jurídica ATUAL na data de referência. Reconstrua as mudanças de fundamento da custódia (flagrante, conversão em preventiva, mandado de temporária, revogação, soltura, condenação e outras decisões) com datas, IDs do PJe e páginas comprovados.",
  "Diferencie a data do recolhimento, o cumprimento de mandado, a decisão que fundamenta a custódia, a última revisão judicial comprovada e o eventual término da medida. Cumprimento de mandado é forma de efetivação, não modalidade autônoma de prisão.",
  "Para PREVENTIVA: verifique fundamentos e contemporaneidade (CPP arts. 312, 313, 315 e 316), a decisão do órgão emissor e a revisão fundamentada a cada 90 dias (art. 316, parágrafo único). Utilize a ferramenta de marco de 90 dias SOMENTE se os autos comprovarem a natureza preventiva e houver data válida da decretação ou última decisão revisional. Identifique o órgão responsável e não afirme soltura automática pelo mero decurso.",
  "Para TEMPORÁRIA: examine Lei 7.960/1989 (arts. 1º e 2º), decisão escrita, finalidade investigativa, data de cumprimento, prazo e DATA DE LIBERTAÇÃO FIXADOS NO MANDADO (§ 4º-A), prorrogação expressa e eventual revogação ou conversão. Regra comum de 5 dias prorrogáveis por igual período e hipótese especial de 30 dias prorrogáveis por igual período nos crimes abrangidos pelo art. 2º, § 4º, da Lei 8.072/1990, observadas a legislação aplicável e a decisão judicial. Inclui-se o dia do CUMPRIMENTO no prazo da temporária (Lei 7.960/1989, art. 2º, § 8º), diferentemente da medição genérica (início, fim]; para essa data use conferir_prazo_temporaria e confronte o mandado. Decorrido o período, observe o § 7º quanto à soltura independente de nova ordem, ressalvada prorrogação comunicada ou decretação de preventiva. Não presuma prorrogação, não use os 90 dias do art. 316 e não trate ultrapassagem de prazo como conversão automática.",
  "Para FLAGRANTE: verifique auto de prisão, data e hora efetivas, comunicação ao juízo, audiência de custódia e decisão fundamentada do CPP art. 310 (relaxamento, conversão em preventiva ou liberdade provisória). Se houver conversão, analise o período subsequente como preventiva. Avalie separadamente eventual descumprimento dos prazos de apresentação, sem converter o flagrante em custódia autônoma de duração indefinida ou aplicar 90 dias antes de conversão comprovada.",
  "Para OUTRA HIPÓTESE: identifique o título judicial ou legal específico, autoridade competente, fundamento, data, condições, limitações e prazo eventualmente previsto. Diferencie custódia cautelar de prisão definitiva, prisão civil e internação provisória; se não forem prisão provisória criminal, sinalize a diferença e aplique o regime jurídico adequado, sem transpor automaticamente CPP art. 316.",
  "Registros administrativos da plataforma sobre prisão e reavaliação são pistas, não prova de decisão fundamentada. O PDF e decisões judiciais prevalecem. Quando a espécie, o termo inicial ou a decisão faltarem, indique INCONCLUSIVO e quais peças devem ser conferidas.",
  "Entregue quadro de situação atual, cronologia documentada, identificação das decisões, memória aritmética, base legal por modalidade, alertas operacionais e pontos para conferência do servidor. Nenhuma conclusão pode substituir a decisão judicial.",
].join("\n");

export function orientacaoPorModalidade(modalidade: ModalidadePrisao): string {
  switch (modalidade) {
    case "identificar":
      return "Modalidade não informada pelo servidor: classifique somente pelos documentos e dados confiáveis. Se não for possível estabelecer o tipo atual da custódia, informe que a análise não é conclusiva. Não calcule automaticamente a revisão de 90 dias.";
    case "preventiva":
      return "Modalidade declarada pelo servidor: PRISÃO PREVENTIVA, sujeita a confirmação nos autos. Investigue a decretação, eventual conversão, decisões fundamentadas e revisão de 90 dias se comprovado o enquadramento legal.";
    case "temporaria":
      return "Modalidade declarada pelo servidor: PRISÃO TEMPORÁRIA, sujeita a confirmação nos autos. Priorize o mandado, sua efetivação, duração e prorrogação judicial. Não aplique a revisão de 90 dias própria da preventiva.";
    case "flagrante":
      return "Modalidade declarada pelo servidor: PRISÃO EM FLAGRANTE, sujeita a confirmação nos autos. Priorize as providências de audiência de custódia e decisão do art. 310 do CPP; investigue posterior conversão ou soltura. Não aplique 90 dias sem decisão de preventiva comprovada.";
    case "outra":
      return "Modalidade declarada pelo servidor: OUTRA HIPÓTESE DE CUSTÓDIA. Localize seu fundamento legal e a decisão que a autorizou; não atribua de modo automático regime de preventiva, temporária ou flagrante. Caso exista prisão definitiva, indique que não se trata de prisão provisória.";
  }
}
