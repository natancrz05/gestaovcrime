import type { ItemAtencaoBeta, NivelAtencaoBeta } from "./alertas-beta";

export interface GrupoAtencaoBeta extends ItemAtencaoBeta {
  motivos: ItemAtencaoBeta[];
}

const ORDEM_NIVEL: Record<NivelAtencaoBeta, number> = {
  critico: 0,
  urgente: 1,
  atencao: 2,
  conferir: 3,
  informativo: 4,
  administrativo: 5,
};

function comparar(a: ItemAtencaoBeta, b: ItemAtencaoBeta) {
  return (
    ORDEM_NIVEL[a.nivel] - ORDEM_NIVEL[b.nivel] ||
    (a.dataLimite ?? "9999-12-31").localeCompare(b.dataLimite ?? "9999-12-31") ||
    (a.processoNumero ?? a.pessoa ?? a.titulo).localeCompare(
      b.processoNumero ?? b.pessoa ?? b.titulo,
      "pt-BR",
    )
  );
}

const numeroNormalizado = (numero: string | null) => numero?.replace(/\D/g, "") || null;

/** Uma linha por processo, com todos os motivos e o nível mais alto ainda ativo.
 * Aplicar permissões e ocultações aos itens antes de chamar esta função.
 */
export function agruparItensAtencaoBeta(itens: ItemAtencaoBeta[]): GrupoAtencaoBeta[] {
  const processoPorNumero = new Map<string, string>();
  for (const item of itens) {
    const numero = numeroNormalizado(item.processoNumero);
    if (numero && item.processoId && !processoPorNumero.has(numero)) {
      processoPorNumero.set(numero, item.processoId);
    }
  }

  const grupos = new Map<string, GrupoAtencaoBeta>();
  for (const item of [...itens].sort(comparar)) {
    const numero = numeroNormalizado(item.processoNumero);
    const processoId = (numero && processoPorNumero.get(numero)) || item.processoId;
    // Registros sem processo identificável continuam independentes.
    const chave = processoId
      ? `processo:${processoId}`
      : numero
        ? `numero:${numero}`
        : `alerta:${item.id}`;
    const grupo = grupos.get(chave);
    if (grupo) {
      if (!grupo.motivos.some((motivo) => motivo.id === item.id)) grupo.motivos.push(item);
      grupo.processoNumero ??= item.processoNumero;
    } else {
      grupos.set(chave, { ...item, id: chave, processoId, motivos: [item] });
    }
  }

  return [...grupos.values()].map((grupo) => ({
    ...grupo,
    pessoa: [...new Set(grupo.motivos.map((m) => m.pessoa).filter(Boolean))].join(" · ") || null,
  }));
}

export function contarGruposAtencaoBeta(grupos: GrupoAtencaoBeta[]) {
  const contagens: Record<NivelAtencaoBeta, number> = {
    critico: 0,
    urgente: 0,
    atencao: 0,
    conferir: 0,
    informativo: 0,
    administrativo: 0,
  };
  for (const grupo of grupos) contagens[grupo.nivel]++;
  return contagens;
}

interface FiltrosAtencaoBeta {
  busca?: string;
  nivel?: string;
  origem?: string;
  categoria?: string;
  modulo?: string;
  prazo?: string;
}

function correspondePrazo(item: ItemAtencaoBeta, prazo: string) {
  const dias = item.diasRestantes;
  if (prazo === "vencidos") return dias !== null && dias < 0;
  if (prazo === "hoje") return dias === 0;
  if (prazo === "1-3") return dias !== null && dias >= 1 && dias <= 3;
  if (prazo === "4-7") return dias !== null && dias >= 4 && dias <= 7;
  if (prazo === "8-15") return dias !== null && dias >= 8 && dias <= 15;
  if (prazo === "sem") return item.dataLimite === null;
  return true;
}

const normalizarBusca = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export function filtrarGruposAtencaoBeta(
  grupos: GrupoAtencaoBeta[],
  filtros: FiltrosAtencaoBeta,
): GrupoAtencaoBeta[] {
  const termo = normalizarBusca((filtros.busca ?? "").trim());
  const digitos = /^[\d\s./-]+$/.test(termo) ? termo.replace(/\D/g, "") : "";
  return grupos.filter((grupo) => {
    if (filtros.nivel && grupo.nivel !== filtros.nivel) return false;
    // As combinações devem corresponder ao mesmo motivo, sem cruzar módulos
    // de um alerta com a categoria/prazo de outro alerta do processo.
    if (
      !grupo.motivos.some(
        (item) =>
          (!filtros.origem || item.origem === filtros.origem) &&
          (!filtros.categoria || item.categoria === filtros.categoria) &&
          (!filtros.modulo || item.modulo === filtros.modulo) &&
          correspondePrazo(item, filtros.prazo ?? ""),
      )
    )
      return false;
    if (!termo) return true;
    const alvo = normalizarBusca(
      [
        grupo.processoNumero,
        numeroNormalizado(grupo.processoNumero),
        ...grupo.motivos.flatMap((m) => [
          m.pessoa,
          m.titulo,
          m.descricao,
          m.categoria,
          m.modulo,
          m.origem,
        ]),
      ]
        .filter(Boolean)
        .join(" "),
    );
    return alvo.includes(termo) || Boolean(digitos && alvo.includes(digitos));
  });
}
