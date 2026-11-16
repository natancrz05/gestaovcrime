/** Controle de comparecimentos periódicos (mensais). Apenas acompanhamento administrativo. */
import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { diasEntre, hojeISO } from "./modelo";
import { cpfPessoa, podeVincularProcesso, SITUACAO_VINCULO_REMOVIDO } from "./comparecimentos-vinculos";

export const CONFIG_COMPARECIMENTOS = { diasVencendo: 7 };

export type SituacaoComparecimento = "vencido" | "vencendo" | "regular";

export const SITUACOES_COMP: { chave: SituacaoComparecimento; rotulo: string; classe: string; ponto: string }[] = [
  { chave: "vencido", rotulo: "Vencido", classe: "bg-urgente-suave text-urgente border-urgente/25", ponto: "bg-urgente" },
  { chave: "vencendo", rotulo: "Vencendo", classe: "bg-alerta-suave text-alerta border-alerta/30", ponto: "bg-alerta" },
  { chave: "regular", rotulo: "Regular", classe: "bg-concluido-suave text-concluido border-concluido/25", ponto: "bg-concluido" },
];

export interface RegistroComparecimento {
  id: string;
  data_prevista: string;
  data_realizada: string;
  situacao: string;
  observacao: string;
  criado_em: string;
}

export interface Comparecimento {
  id: string;
  processo_id: string | null;
  pessoa: string;
  cpf: string;
  dados_planilha: Record<string, string> | null;
  conferir: boolean;
  motivo_conferencia: string;
  numeros_informados: string[];
  data_inicio: string;
  periodicidade: string;
  intervalo_meses: number;
  proximo: string;
  observacao: string;
  situacao: string;
  criado_em: string;
  processos: { numero: string } | null;
  comparecimento_registros: RegistroComparecimento[];
}

export interface ComparecimentoListado extends Comparecimento {
  numero: string;
  status: SituacaoComparecimento;
  dias: number;
  ultimo: string | null;
  historico: RegistroComparecimento[];
}

export function situacaoPorData(proximo: string, hoje = hojeISO()): SituacaoComparecimento {
  const d = diasEntre(hoje, proximo);
  if (d < 0) return "vencido";
  if (d <= CONFIG_COMPARECIMENTOS.diasVencendo) return "vencendo";
  return "regular";
}

async function listar(apenasAtivos = false): Promise<Comparecimento[]> {
  const pagina = 1000;
  const todos: Comparecimento[] = [];

  for (let inicio = 0; ; inicio += pagina) {
    let consulta = supabase
      .from("comparecimentos")
      .select(
        "*, processos(numero), comparecimento_registros(id,data_prevista,data_realizada,situacao,observacao,criado_em)",
      )
      // Listas, Dashboard e alertas só precisam do registro mais recente.
      // O histórico completo é buscado sob demanda ao abrir a ficha.
      .order("data_realizada", { referencedTable: "comparecimento_registros", ascending: false })
      .order("criado_em", { referencedTable: "comparecimento_registros", ascending: false })
      .limit(1, { referencedTable: "comparecimento_registros" })
      .order("proximo")
      .range(inicio, inicio + pagina - 1);

    if (apenasAtivos) consulta = consulta.eq("situacao", "Ativo");
    const { data, error } = await consulta;
    if (error) throw new Error(error.message);

    const lote = (data ?? []) as unknown as Comparecimento[];
    todos.push(...lote);
    if (lote.length < pagina) break;
  }

  return todos;
}

export const comparecimentosQuery = () =>
  queryOptions({ queryKey: ["comparecimentos"], staleTime: 30_000, queryFn: () => listar(false) });

export const comparecimentosAtivosQuery = () =>
  queryOptions({
    queryKey: ["comparecimentos", "ativos"],
    staleTime: 30_000,
    queryFn: () => listar(true),
  });

export const comparecimentosDoProcessoQuery = (processoId: string) =>
  queryOptions({
    queryKey: ["comparecimentos", "processo", processoId, "historico-completo"],
    staleTime: 30_000,
    queryFn: async (): Promise<Comparecimento[]> => {
      const { data, error } = await supabase
        .from("comparecimentos")
        .select(
          "*, processos(numero), comparecimento_registros(id,data_prevista,data_realizada,situacao,observacao,criado_em)",
        )
        .eq("processo_id", processoId)
        .order("data_realizada", {
          referencedTable: "comparecimento_registros",
          ascending: false,
        })
        .order("criado_em", {
          referencedTable: "comparecimento_registros",
          ascending: false,
        })
        .order("proximo");
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as Comparecimento[];
    },
  });

export const comparecimentoHistoricoQuery = (comparecimentoId: string | null) =>
  queryOptions({
    queryKey: ["comparecimentos", comparecimentoId, "historico"],
    enabled: Boolean(comparecimentoId),
    staleTime: 30_000,
    queryFn: async (): Promise<RegistroComparecimento[]> => {
      if (!comparecimentoId) return [];
      const { data, error } = await supabase
        .from("comparecimento_registros")
        .select("id, data_prevista, data_realizada, situacao, observacao, criado_em")
        .eq("comparecimento_id", comparecimentoId)
        .order("data_realizada", { ascending: false })
        .order("criado_em", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as RegistroComparecimento[];
    },
  });

/** Último comparecimento: o mais recente entre o histórico e a "Data da última assinatura" importada. */
function ultimoDe(registro: string | undefined, dados: unknown): string | null {
  const v = (dados as Record<string, unknown> | null)?.["Data da última assinatura"];
  const planilha = typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined;
  if (registro && planilha) return registro > planilha ? registro : planilha;
  return registro ?? planilha ?? null;
}

const ORDEM = { vencido: 0, vencendo: 1, regular: 2 };

export function preparar(lista: Comparecimento[], hoje = hojeISO()): ComparecimentoListado[] {
  return lista
    .map((c) => {
      const historico = [...c.comparecimento_registros].sort(
        (a, b) => b.data_realizada.localeCompare(a.data_realizada) || b.criado_em.localeCompare(a.criado_em),
      );
      return {
        ...c,
        numero: c.processos?.numero ?? "Não vinculado",
        status: situacaoPorData(c.proximo, hoje),
        dias: diasEntre(hoje, c.proximo),
        ultimo: ultimoDe(historico[0]?.data_realizada, c.dados_planilha),
        historico,
      };
    })
    .sort((a, b) => {
      // Obrigações ativas primeiro; desvinculados pendentes e encerrados no fim.
      const ordem = (s: string) => s === "Ativo" ? 0 : s === "Desvinculado" ? 1 : 2;
      const e = ordem(a.situacao) - ordem(b.situacao);
      return e || ORDEM[a.status] - ORDEM[b.status] || a.proximo.localeCompare(b.proximo);
    });
}

/**
 * Periodicidade = intervalo definido para aquele processo (decisão, acordo ou
 * medida aplicável). Não presume previsão legal específica.
 */
export const PERIODICIDADES = [
  { v: "Mensal", meses: 1 },
  { v: "Bimestral", meses: 2 },
  { v: "Trimestral", meses: 3 },
  { v: "Quadrimestral", meses: 4 },
  { v: "Semestral", meses: 6 },
  { v: "Anual", meses: 12 },
  { v: "Personalizado", meses: 0 },
] as const;

export function mesesDe(periodicidade: string, personalizado: number): number {
  const p = PERIODICIDADES.find((x) => x.v === periodicidade);
  return p && p.meses > 0 ? p.meses : Math.max(1, Math.min(120, Math.floor(personalizado) || 1));
}

/** Soma N meses mantendo o dia; se o dia não existir, usa o último dia do mês (ex.: 31/01 + 1 → 28/02). */
export function somarMeses(iso: string, n = 1): string {
  const [a, m, d] = iso.split("-").map(Number) as [number, number, number];
  const total = a * 12 + (m - 1) + n;
  const na = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const ultimoDia = new Date(na, nm, 0).getDate();
  return `${na}-${String(nm).padStart(2, "0")}-${String(Math.min(d, ultimoDia)).padStart(2, "0")}`;
}
export const somarMes = (iso: string) => somarMeses(iso, 1);

export function inadimplenciaCriticaComparecimento(
  comparecimento: Pick<Comparecimento, "situacao" | "proximo" | "comparecimento_registros">,
  hoje = hojeISO(),
): { proximo: string; disparo: string; atraso: number } | null {
  if (comparecimento.situacao !== "Ativo") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(comparecimento.proximo)) return null;
  if (situacaoPorData(comparecimento.proximo, hoje) !== "vencido") return null;

  const houveRegistroPosterior = comparecimento.comparecimento_registros.some(
    (registro) =>
      /^\d{4}-\d{2}-\d{2}$/.test(registro.data_realizada) &&
      registro.data_realizada >= comparecimento.proximo,
  );
  if (houveRegistroPosterior) return null;

  const disparo = somarMeses(comparecimento.proximo, 1);
  if (hoje < disparo) return null;

  return {
    proximo: comparecimento.proximo,
    disparo,
    atraso: diasEntre(comparecimento.proximo, hoje),
  };
}

export interface ComparecimentoEntrada {
  processo_id: string;
  pessoa: string;
  data_inicio: string;
  periodicidade: string;
  intervalo_meses: number;
  proximo: string;
  observacao: string;
  situacao: string;
  cpf?: string;
}

export async function salvarComparecimento(v: ComparecimentoEntrada, id?: string) {
  const cpf = cpfPessoa(v.cpf) ?? null;
  if (v.cpf?.trim() && !cpf) throw new Error("Confira os 11 dígitos do CPF antes de salvar.");
  const processoId = v.processo_id || null;
  if (!processoId) throw new Error("Selecione um processo para o vínculo. Use Desvincular para preservar o cadastro sem obrigação ativa.");

  // Protege a identidade: CPF une visualmente a pessoa, não duplica vínculo
  // ativo com o mesmo processo.
  if (cpf) {
    const { data: semelhantes, error: erroPessoas } = await supabase
      .from("comparecimentos")
      .select("id,cpf,processo_id,situacao")
      .eq("processo_id", processoId)
      .eq("situacao", "Ativo");
    if (erroPessoas) throw new Error(erroPessoas.message);
    if (!podeVincularProcesso(semelhantes ?? [], cpf, processoId, id)) {
      throw new Error("Já existe vínculo ativo desta pessoa com este processo. Abra o cadastro existente.");
    }
  }

  if (id) {
    const { data: anterior, error: erroCadastro } = await supabase
      .from("comparecimentos").select("processo_id,situacao").eq("id", id).single();
    if (erroCadastro || !anterior) throw new Error("Cadastro não encontrado ou sem permissão.");
    if (anterior.situacao === SITUACAO_VINCULO_REMOVIDO) {
      throw new Error("Este vínculo está desvinculado. Restaure-o explicitamente ou adicione outro processo.");
    }
    if (anterior.processo_id !== processoId) {
      const { data: registros, error: erroRegistros } = await supabase
        .from("comparecimento_registros").select("id").eq("comparecimento_id", id).limit(1);
      if (erroRegistros) throw new Error(erroRegistros.message);
      if (registros?.length) {
        throw new Error("Este vínculo possui assinaturas. Para manter o histórico correto, adicione o novo processo e desvincule o anterior separadamente.");
      }
    }
  }
  const dados = {
    processo_id: processoId,
    pessoa: v.pessoa.trim().slice(0, 200),
    data_inicio: v.data_inicio,
    periodicidade: v.periodicidade,
    intervalo_meses: mesesDe(v.periodicidade, v.intervalo_meses),
    proximo: v.proximo,
    observacao: v.observacao.slice(0, 1000),
    situacao: v.situacao,
    ...(cpf ? { cpf } : {}),
    ...(processoId ? { conferir: false, motivo_conferencia: "" } : {}),
  };
  const { error } = id
    ? await supabase.from("comparecimentos").update(dados).eq("id", id)
    : await supabase.from("comparecimentos").insert(dados);
  if (error) throw new Error(error.message);
}

/** Remove somente a vigência do vínculo, preservando o processo original e TODAS as assinaturas. */
export async function desvincularProcessoComparecimento(id: string, motivo: string) {
  const justificativa = motivo.trim();
  if (justificativa.length < 8) throw new Error("Informe o motivo da desvinculação ou a pendência a conferir (mínimo de 8 caracteres).");
  const { data: atual, error: erroLeitura } = await supabase
    .from("comparecimentos").select("situacao,processo_id").eq("id", id).single();
  if (erroLeitura || !atual) throw new Error("Vínculo não encontrado ou sem permissão.");
  if (atual.situacao !== "Ativo" || !atual.processo_id) {
    throw new Error("Somente vínculos ativos podem ser desvinculados. O cadastro e o histórico permanecem preservados.");
  }
  const { data, error } = await supabase.from("comparecimentos").update({
    situacao: SITUACAO_VINCULO_REMOVIDO,
    conferir: true,
    motivo_conferencia: "Vínculo desvinculado; pendência de conferência: " + justificativa.slice(0, 350),
  }).eq("id", id).eq("situacao", "Ativo").select("id");
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("O vínculo foi alterado por outro servidor. Atualize a página antes de tentar novamente.");
}

/** Reativa SOMENTE o mesmo processo original após conferência humana. */
export async function restaurarVinculoComparecimento(id: string) {
  const { data: atual, error } = await supabase.from("comparecimentos")
    .select("id,cpf,processo_id,situacao")
    .eq("id", id).single();
  if (error || !atual || atual.situacao !== SITUACAO_VINCULO_REMOVIDO || !atual.processo_id) {
    throw new Error("Vínculo desvinculado não encontrado ou sem permissão.");
  }
  const cpf = cpfPessoa(atual.cpf);
  if (cpf) {
    const { data: outros, error: erroOutros } = await supabase.from("comparecimentos")
      .select("id,cpf,processo_id,situacao")
      .eq("processo_id", atual.processo_id).eq("situacao", "Ativo");
    if (erroOutros) throw new Error(erroOutros.message);
    if (!podeVincularProcesso(outros ?? [], cpf, atual.processo_id, id)) {
      throw new Error("Já existe outro vínculo ativo desta pessoa com o processo. Confira antes de restaurar.");
    }
  }
  const { data: salvos, error: erroSalvar } = await supabase.from("comparecimentos")
    .update({ situacao: "Ativo", conferir: true,
      motivo_conferencia: "Vínculo restaurado administrativamente; conferir decisão e periodicidade aplicáveis." })
    .eq("id", id).eq("situacao", SITUACAO_VINCULO_REMOVIDO).select("id");
  if (erroSalvar) throw new Error(erroSalvar.message);
  if (!salvos?.length) throw new Error("O vínculo foi alterado por outro servidor. Atualize a página.");
}

export function mensagemProcessoAusenteComparecimento(pessoa?: string) {
  const nome = pessoa?.trim() ? ` de ${pessoa.trim()}` : "";
  return `Não é possível registrar o comparecimento${nome}: este cadastro não está vinculado a um processo no sistema. Antes de registrar, edite o cadastro e vincule ou cadastre o processo em que o réu está cumprindo a medida cautelar.`;
}

export async function registrarComparecimento(id: string, data: string, obs: string, cpf?: string) {
  const { data: cadastro, error: cadastroError } = await supabase
    .from("comparecimentos")
    .select("processo_id, pessoa, situacao")
    .eq("id", id)
    .single();

  if (cadastroError) throw new Error(cadastroError.message);
  if (cadastro?.situacao !== "Ativo") {
    throw new Error("O vínculo não está ativo. Confira a situação antes de registrar assinatura.");
  }
  if (!cadastro?.processo_id) {
    throw new Error(mensagemProcessoAusenteComparecimento(cadastro?.pessoa));
  }

  if (cpf) {
    const { error: cpfError } = await supabase
      .from("comparecimentos")
      .update({ cpf })
      .eq("id", id);
    if (cpfError) throw new Error(cpfError.message);
  }

  const { data: r, error } = await supabase.rpc("registrar_comparecimento", { p_id: id, p_data: data, p_obs: obs });
  if (error) throw new Error(error.message);
  return r as string;
}

/**
 * Um comparecimento físico atende 2+ vínculos SEM várias chamadas sucessivas.
 * A RPC de banco grava todos numa única transação e devolve o id do evento.
 */
export async function registrarAssinaturaConjunta(
  ids: string[], data: string, observacao: string, cpf: string,
) {
  const unicos = [...new Set(ids)];
  if (unicos.length !== ids.length || unicos.length < 2 || unicos.length > 20) {
    throw new Error("Selecione de 2 a 20 processos distintos para assinatura conjunta.");
  }
  const documento = cpfPessoa(cpf);
  if (!documento) throw new Error("Confirme o CPF de 11 dígitos antes da assinatura conjunta.");
  const { data: grupoId, error } = await supabase.rpc("registrar_comparecimentos_multiplos", {
    p_ids: unicos,
    p_data: data,
    p_obs: observacao.slice(0, 1000),
    p_cpf: documento,
  });
  if (error) throw new Error(
    error.message.includes("Could not find the function")
      ? "Assinatura conjunta ainda não habilitada neste banco. A migração precisa ser aplicada pela administração."
      : error.message,
  );
  return grupoId;
}

export async function encerrarComparecimento(id: string) {
  const { error } = await supabase.from("comparecimentos").update({ situacao: "Encerrado" }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function reativarComparecimento(id: string) {
  const { error } = await supabase
    .from("comparecimentos")
    .update({ situacao: "Ativo" })
    .eq("id", id);
  if (error) throw new Error(error.message);
}
