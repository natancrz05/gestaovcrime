/**
 * Núcleo puro da BETA de sincronização de pautas.
 * Não acessa banco, não grava dados e não depende do leitor de PDF.
 */
import { tipoAudienciaCanonico } from "./audiencias";

export type SituacaoPautaBeta =
  | "Designada"
  | "Realizada"
  | "Redesignada"
  | "Cancelada"
  | "NaoRealizada"
  | "ConvertidaDiligencia"
  | "Desconhecida";

export interface LinhaPautaBeta {
  pagina: number;
  data: string;
  horario: string;
  numero: string;
  orgao: string;
  classe: string;
  tipo: string;
  tipoOriginal: string;
  salaOriginal: string;
  situacao: SituacaoPautaBeta;
  situacaoOriginal: string;
}

export interface ProblemaLeituraBeta {
  pagina: number;
  numero?: string | undefined;
  motivo: string;
}

export type AcaoSincronizacaoBeta =
  | "atualizacao-segura"
  | "nova-candidata"
  | "sem-alteracao"
  | "conferir"
  | "processo-ausente"
  | "resultado-complementar";

export interface AudienciaSistemaBeta {
  id: string;
  data: string;
  horario: string | null;
  tipo: string;
  situacao: string;
}

export interface ProcessoSistemaBeta {
  id: string;
  numero: string;
  audiencias: AudienciaSistemaBeta[];
}

export interface ItemSincronizacaoBeta extends LinhaPautaBeta {
  processoId?: string | undefined;
  audienciaId?: string | undefined;
  situacaoSistema?: string | undefined;
  acao: AcaoSincronizacaoBeta;
  sugestao: string;
  motivo: string;
}

export interface AnaliseSincronizacaoBeta {
  itens: ItemSincronizacaoBeta[];
  errosLeitura: ProblemaLeituraBeta[];
  duplicadasExatasIgnoradas: number;
  totalLido: number;
  totalAnalisado: number;
  contagens: Record<AcaoSincronizacaoBeta, number>;
}

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();

export const normalizarNumeroProcessoBeta = (s: string) => s.replace(/\D/g, "");

/** NÃO-REALIZADA precisa ser testada antes de REALIZADA. */
export function situacaoPautaBeta(valor: string): SituacaoPautaBeta {
  const t = norm(valor);
  if (/NAO[ -]?REALIZAD/.test(t)) return "NaoRealizada";
  if (/CONVERTID.*DILIG/.test(t)) return "ConvertidaDiligencia";
  if (/CANCELAD/.test(t)) return "Cancelada";
  if (/REDESIGNAD/.test(t)) return "Redesignada";
  if (/REALIZAD/.test(t)) return "Realizada";
  if (/DESIGNAD|AGENDAD|MARCADA/.test(t)) return "Designada";
  return "Desconhecida";
}

function situacaoSistemaCanonica(valor: string) {
  const t = norm(valor);
  // Assim como no PJe, "não-realizada" precisa ser testada antes de
  // "realizada", pois contém o mesmo radical.
  if (/NAO[ -]?REALIZAD/.test(t)) return "NaoRealizada";
  if (/CONVERTID.*DILIG/.test(t)) return "ConvertidaDiligencia";
  if (/CANCELAD/.test(t)) return "Cancelada";
  if (/REDESIGNAD/.test(t)) return "Redesignada";
  if (/REALIZAD/.test(t)) return "Realizada";
  if (/DESIGNAD|AGENDAD|MARCADA/.test(t)) return "Designada";
  return valor;
}

function chaveExataLinha(l: LinhaPautaBeta) {
  return [
    normalizarNumeroProcessoBeta(l.numero),
    l.data,
    l.horario,
    norm(tipoAudienciaCanonico(l.tipo)),
    l.situacao,
  ].join("|");
}

function chaveMomento(l: LinhaPautaBeta) {
  return [normalizarNumeroProcessoBeta(l.numero), l.data, l.horario].join("|");
}

function mesmaAudiencia(a: AudienciaSistemaBeta, l: LinhaPautaBeta) {
  return (
    a.data === l.data &&
    (a.horario ?? "").slice(0, 5) === l.horario &&
    norm(tipoAudienciaCanonico(a.tipo)) === norm(tipoAudienciaCanonico(l.tipo))
  );
}

function mesmoMomento(a: AudienciaSistemaBeta, l: LinhaPautaBeta) {
  return a.data === l.data && (a.horario ?? "").slice(0, 5) === l.horario;
}

function itemBase(
  l: LinhaPautaBeta,
  acao: AcaoSincronizacaoBeta,
  sugestao: string,
  motivo: string,
  extras: Partial<ItemSincronizacaoBeta> = {},
): ItemSincronizacaoBeta {
  return { ...l, acao, sugestao, motivo, ...extras };
}

function avaliarLinhaUnica(
  l: LinhaPautaBeta,
  processo: ProcessoSistemaBeta,
): ItemSincronizacaoBeta {
  const exatas = processo.audiencias.filter((a) => mesmaAudiencia(a, l));
  const momento = processo.audiencias.filter((a) => mesmoMomento(a, l));

  if (exatas.length > 1 || momento.length > 1) {
    return itemBase(
      l,
      "conferir",
      "Conferir cadastro do processo",
      "O sistema já possui mais de uma audiência neste mesmo momento; a beta não escolherá qual atualizar.",
      { processoId: processo.id },
    );
  }

  const existente = exatas[0];
  if (!existente && momento[0]) {
    return itemBase(
      l,
      "conferir",
      "Conferir finalidade da audiência",
      "Já existe audiência do mesmo processo, data e horário, mas com finalidade diferente.",
      {
        processoId: processo.id,
        audienciaId: momento[0].id,
        situacaoSistema: momento[0].situacao,
      },
    );
  }

  if (!existente) {
    if (l.situacao === "Designada") {
      return itemBase(
        l,
        "nova-candidata",
        "Cadastrar audiência agendada",
        "O processo existe, mas esta audiência não foi localizada no sistema.",
        { processoId: processo.id },
      );
    }
    if (l.situacao === "Realizada") {
      return itemBase(
        l,
        "nova-candidata",
        "Cadastrar audiência histórica e confirmar realização",
        "A pauta informa audiência realizada, mas não existe ocorrência correspondente no sistema.",
        { processoId: processo.id },
      );
    }
    if (l.situacao === "Cancelada") {
      return itemBase(
        l,
        "nova-candidata",
        "Cadastrar ocorrência histórica cancelada",
        "A pauta informa audiência cancelada sem ocorrência correspondente no sistema.",
        { processoId: processo.id },
      );
    }
    if (l.situacao === "Redesignada") {
      return itemBase(
        l,
        "conferir",
        "Conferir redesignação",
        "Há uma redesignação na pauta, mas não existe audiência correspondente no sistema para preservar a origem com segurança.",
        { processoId: processo.id },
      );
    }
    if (l.situacao === "NaoRealizada") {
      return itemBase(
        l,
        "conferir",
        "Definir tratamento para audiência não realizada",
        "A situação 'não-realizada' é distinta e não será convertida automaticamente em Realizada ou Cancelada.",
        { processoId: processo.id },
      );
    }
    if (l.situacao === "ConvertidaDiligencia") {
      return itemBase(
        l,
        "resultado-complementar",
        "Registrar resultado complementar após validação",
        "Conversão em diligência não é tratada como situação final isolada na beta.",
        { processoId: processo.id },
      );
    }
    return itemBase(
      l,
      "conferir",
      "Conferir situação não reconhecida",
      "A situação da pauta ainda não possui regra de sincronização.",
      { processoId: processo.id },
    );
  }

  const sistema = situacaoSistemaCanonica(existente.situacao);
  const extras = {
    processoId: processo.id,
    audienciaId: existente.id,
    situacaoSistema: existente.situacao,
  };

  if (l.situacao === "NaoRealizada") {
    return itemBase(
      l,
      "conferir",
      "Definir resultado de não realização",
      "A beta preserva 'não-realizada' como informação própria e não altera a audiência automaticamente.",
      extras,
    );
  }
  if (l.situacao === "ConvertidaDiligencia") {
    return itemBase(
      l,
      "resultado-complementar",
      "Registrar conversão em diligência como resultado complementar",
      "A conversão em diligência não deve apagar eventual informação de que a audiência ocorreu.",
      extras,
    );
  }
  if (l.situacao === "Desconhecida") {
    return itemBase(
      l,
      "conferir",
      "Conferir situação do PJe",
      "A situação não é conhecida pela beta.",
      extras,
    );
  }
  if (sistema === l.situacao) {
    return itemBase(
      l,
      "sem-alteracao",
      "Nenhuma alteração",
      "A situação do sistema já coincide com a pauta.",
      extras,
    );
  }

  if (l.situacao === "Realizada") {
    if (sistema === "Designada" || sistema === "Redesignada") {
      return itemBase(
        l,
        "atualizacao-segura",
        "Confirmar audiência como realizada",
        "A ocorrência corresponde exatamente e a pauta informa realização.",
        extras,
      );
    }
    return itemBase(
      l,
      "conferir",
      "Conferir divergência de situação",
      'O sistema está "' + existente.situacao + '" e a pauta informa realização.',
      extras,
    );
  }

  if (l.situacao === "Cancelada") {
    if (sistema === "Designada" || sistema === "Redesignada") {
      return itemBase(
        l,
        "atualizacao-segura",
        "Marcar audiência como cancelada",
        "A ocorrência corresponde exatamente e a pauta informa cancelamento.",
        extras,
      );
    }
    return itemBase(
      l,
      "conferir",
      "Conferir divergência de situação",
      'O sistema está "' + existente.situacao + '" e a pauta informa cancelamento.',
      extras,
    );
  }

  if (l.situacao === "Redesignada") {
    if (sistema === "Designada") {
      return itemBase(
        l,
        "atualizacao-segura",
        "Marcar como redesignada, preservando a ocorrência anterior",
        "A ocorrência corresponde exatamente; a beta não tenta adivinhar a nova data.",
        extras,
      );
    }
    return itemBase(
      l,
      "conferir",
      "Conferir redesignação",
      'O sistema está "' + existente.situacao + '" e a pauta informa redesignação.',
      extras,
    );
  }

  if (l.situacao === "Designada") {
    return itemBase(
      l,
      "conferir",
      "Não retroceder situação automaticamente",
      'A pauta informa designada, mas o sistema já está "' + existente.situacao + '".',
      extras,
    );
  }

  return itemBase(
    l,
    "conferir",
    "Conferir manualmente",
    "A combinação de situações não possui regra segura.",
    extras,
  );
}

export function analisarSincronizacaoPautaBeta(
  linhas: LinhaPautaBeta[],
  processos: ProcessoSistemaBeta[],
  errosLeitura: ProblemaLeituraBeta[] = [],
): AnaliseSincronizacaoBeta {
  const processosPorNumero = new Map<string, ProcessoSistemaBeta[]>();
  for (const processo of processos) {
    const numero = normalizarNumeroProcessoBeta(processo.numero);
    processosPorNumero.set(numero, [
      ...(processosPorNumero.get(numero) ?? []),
      processo,
    ]);
  }

  const chavesExatas = new Set<string>();
  const unicas: LinhaPautaBeta[] = [];
  let duplicadasExatasIgnoradas = 0;
  for (const linha of linhas) {
    const chave = chaveExataLinha(linha);
    if (chavesExatas.has(chave)) {
      duplicadasExatasIgnoradas++;
      continue;
    }
    chavesExatas.add(chave);
    unicas.push(linha);
  }

  const porMomento = new Map<string, LinhaPautaBeta[]>();
  for (const linha of unicas) {
    const chave = chaveMomento(linha);
    porMomento.set(chave, [...(porMomento.get(chave) ?? []), linha]);
  }

  const especiais = new Map<LinhaPautaBeta, ItemSincronizacaoBeta>();
  for (const grupo of porMomento.values()) {
    if (grupo.length <= 1) continue;

    const tipos = new Set(grupo.map((l) => norm(tipoAudienciaCanonico(l.tipo))));
    const situacoes = new Set(grupo.map((l) => l.situacao));
    const compatibilidadeDiligencia =
      tipos.size === 1 &&
      situacoes.size === 2 &&
      situacoes.has("Realizada") &&
      situacoes.has("ConvertidaDiligencia");

    if (compatibilidadeDiligencia) {
      const diligencia = grupo.find((l) => l.situacao === "ConvertidaDiligencia");
      if (diligencia) {
        especiais.set(
          diligencia,
          itemBase(
            diligencia,
            "resultado-complementar",
            "Preservar como resultado complementar",
            "A mesma ocorrência também aparece como realizada; a beta não cria uma segunda audiência.",
          ),
        );
      }
      continue;
    }

    const resumo = grupo
      .map((l) => l.tipoOriginal + " — " + l.situacaoOriginal)
      .join(" | ");
    for (const linha of grupo) {
      especiais.set(
        linha,
        itemBase(
          linha,
          "conferir",
          "Conferir conflito da própria pauta",
          "O PJe contém mais de um registro para o mesmo processo, data e horário: " +
            resumo +
            ". Nenhuma conclusão automática será tomada.",
        ),
      );
    }
  }

  const itens: ItemSincronizacaoBeta[] = [];
  for (const linha of unicas) {
    const especial = especiais.get(linha);
    if (especial) {
      itens.push(especial);
      continue;
    }

    const candidatos =
      processosPorNumero.get(normalizarNumeroProcessoBeta(linha.numero)) ?? [];
    if (!candidatos.length) {
      itens.push(
        itemBase(
          linha,
          "processo-ausente",
          "Aguardar vínculo com o acervo",
          "O número CNJ da pauta não foi localizado no sistema. A beta não cria processo automaticamente.",
        ),
      );
      continue;
    }
    if (candidatos.length > 1) {
      itens.push(
        itemBase(
          linha,
          "conferir",
          "Conferir duplicidade de processo",
          "Há mais de um processo no sistema com o mesmo número CNJ.",
        ),
      );
      continue;
    }

    itens.push(avaliarLinhaUnica(linha, candidatos[0]!));
  }

  const contagens: Record<AcaoSincronizacaoBeta, number> = {
    "atualizacao-segura": 0,
    "nova-candidata": 0,
    "sem-alteracao": 0,
    conferir: 0,
    "processo-ausente": 0,
    "resultado-complementar": 0,
  };
  for (const item of itens) contagens[item.acao]++;

  return {
    itens,
    errosLeitura,
    duplicadasExatasIgnoradas,
    totalLido: linhas.length,
    totalAnalisado: itens.length,
    contagens,
  };
}
