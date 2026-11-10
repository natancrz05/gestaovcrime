import { dataUTC, isoUTC } from "./calculo";

const DIA_MS = 86_400_000;
type Periodo = { inicio: string; fim: string };

export interface MedicaoIntervalo {
  inicio: string;
  fim: string;
  convencao: string;
  diasCorridos: number;
  diasSuspensosInformados: number;
  diasDescontadasSuspensoes: number;
  periodosConsiderados: Periodo[];
  marco90Dias?: string;
  diasAteMarco90?: number;
  observacoes: string[];
}

/**
 * Aritmética cronológica, NÃO reconhecimento de causa suspensiva/interruptiva.
 * Convenção: (data inicial, data final], sem contar o dia inicial.
 * A contagem penal material, a prescrição e a definição de marcos legais
 * dependem de análise jurídica própria.
 */
export function medirIntervalo(
  inicio: string,
  fim: string,
  suspensoes: Periodo[] = [],
  incluirMarco90 = false,
): MedicaoIntervalo {
  const inicioMs = dataUTC(inicio).getTime();
  const fimMs = dataUTC(fim).getTime();
  if (fimMs < inicioMs) throw new Error("A data final deve ser igual ou posterior à inicial.");
  const totalDias = Math.round((fimMs - inicioMs) / DIA_MS);
  if (totalDias > 36525) throw new Error("Período superior a cem anos: confira os marcos.");

  const intervalos: { ini: number; fim: number }[] = [];
  for (const periodo of suspensoes) {
    const a = dataUTC(periodo.inicio).getTime();
    const b = dataUTC(periodo.fim).getTime();
    if (b < a) throw new Error("A suspensão termina antes de começar.");
    const recorteInicio = Math.max(a, inicioMs + DIA_MS);
    const recorteFim = Math.min(b, fimMs);
    if (recorteInicio <= recorteFim) intervalos.push({ ini: recorteInicio, fim: recorteFim });
  }
  intervalos.sort((a, b) => a.ini - b.ini || a.fim - b.fim);

  const consolidados: { ini: number; fim: number }[] = [];
  for (const periodo of intervalos) {
    const ultimo = consolidados[consolidados.length - 1];
    if (ultimo && periodo.ini <= ultimo.fim + DIA_MS) {
      ultimo.fim = Math.max(ultimo.fim, periodo.fim);
    } else {
      consolidados.push({ ...periodo });
    }
  }

  const diasSuspensos = consolidados.reduce(
    (soma, p) => soma + Math.round((p.fim - p.ini) / DIA_MS) + 1,
    0,
  );
  const marco90 = inicioMs + 90 * DIA_MS;
  return {
    inicio,
    fim,
    convencao: "Dia inicial excluído e dia final incluído: (início, fim].",
    diasCorridos: totalDias,
    diasSuspensosInformados: diasSuspensos,
    diasDescontadasSuspensoes: totalDias - diasSuspensos,
    periodosConsiderados: consolidados.map((p) => ({
      inicio: isoUTC(new Date(p.ini)),
      fim: isoUTC(new Date(p.fim)),
    })),
    ...(incluirMarco90
      ? {
          marco90Dias: isoUTC(new Date(marco90)),
          diasAteMarco90: Math.round((marco90 - fimMs) / DIA_MS),
        }
      : {}),
    observacoes: [
      "Somente as suspensões informadas foram descontadas; o sistema não verifica automaticamente sua validade jurídica.",
      "A duração cronológica não corresponde automaticamente a prazo processual ou prescrição penal.",
      ...(incluirMarco90
        ? ["A data de 90 dias é referência administrativa do art. 316, parágrafo único, do CPP; a situação da prisão e a obrigação de revisão exigem exame dos autos. Não há soltura automática."]
        : []),
    ],
  };
}
