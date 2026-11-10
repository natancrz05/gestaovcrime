import { dataUTC, isoUTC } from "./calculo";

const DIA_MS = 86_400_000;

export interface EntradaTemporaria {
  dataCumprimento: string;
  prazoDiasMandado: number;
  dataReferencia: string;
  dataLibertacaoMandado?: string;
}

/**
 * Apenas conferência aritmética de prazo documental de prisão temporária.
 * Lei 7.960/1989, art. 2º, § 8º: inclui o dia do cumprimento no prazo.
 * Não presume validade do mandado, prorrogação, revogação ou conversão.
 */
export function conferirPrazoTemporaria(dados: EntradaTemporaria) {
  const inicio = dataUTC(dados.dataCumprimento).getTime();
  const referencia = dataUTC(dados.dataReferencia).getTime();
  if (referencia < inicio) throw new Error("A data de referência é anterior ao cumprimento do mandado; confira o período selecionado.");
  if (!Number.isInteger(dados.prazoDiasMandado) || dados.prazoDiasMandado < 1 || dados.prazoDiasMandado > 120) {
    throw new Error("Informe prazo do mandado entre 1 e 120 dias, confirmado nos autos.");
  }
  const fim = inicio + (dados.prazoDiasMandado - 1) * DIA_MS;
  const dataFim = isoUTC(new Date(fim));
  const diaSeguinteAoFim = isoUTC(new Date(fim + DIA_MS));
  const dataMandado = dados.dataLibertacaoMandado
    ? isoUTC(dataUTC(dados.dataLibertacaoMandado))
    : null;
  const diasDesdeCumprimento = Math.round((referencia - inicio) / DIA_MS);
  return {
    modalidade: "Prisão temporária (conferência aritmética)",
    referenciaLegal: "Lei 7.960/1989, art. 2º, §§ 4º-A, 7º e 8º; Lei 8.072/1990, art. 2º, § 4º, se aplicável.",
    dataCumprimento: dados.dataCumprimento,
    prazoDiasMandado: dados.prazoDiasMandado,
    dataReferencia: dados.dataReferencia,
    dataLimitePorContagemInclusiva: dataFim,
    primeiroDiaAposPrazo: diaSeguinteAoFim,
    dataLibertacaoMandado: dataMandado,
    diasDeCumprimentoAteReferencia: diasDesdeCumprimento < 0 ? 0 : diasDesdeCumprimento + 1,
    diasAteDataLimiteCalculada: Math.round((fim - referencia) / DIA_MS),
    divergenciaComDataDoMandado: dataMandado === null ? null : dataMandado !== diaSeguinteAoFim,
    observacoes: [
      "O dia do cumprimento do mandado está incluído: primeiro dia = data do cumprimento.",
      "O último dia computado é a dataLimitePorContagemInclusiva. A expiração regular do prazo ocorre no primeiro minuto do dia seguinte, indicada em primeiroDiaAposPrazo, conforme regras operacionais do BNMP 3.0.",
      "A data indicada no mandado judicial deve ser conferida e prevalece como documento da ordem; a divergência com a referência aritmética não demonstra, isoladamente, erro do mandado ou irregularidade de prisão.",
      "Prazo informado não significa prorrogação válida: eventual extensão depende de decisão e comunicação judicial.",
      "Lei 7.960/1989, art. 2º, § 7º: decorrido o prazo do mandado, soltura independente de nova ordem, salvo prorrogação comunicada ou decretação de preventiva.",
      "Não aplicar revisão de 90 dias do CPP art. 316 a prisão exclusivamente temporária.",
      "Não concluir situação atual da custódia com base apenas no prazo; confirme decisões posteriores, soltura ou conversão nos autos.",
    ],
  };
}
