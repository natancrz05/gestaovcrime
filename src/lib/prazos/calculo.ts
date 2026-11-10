/**
 * Calculadora de PRAZOS PROCESSUAIS em dias — não calcula prescrição penal,
 * prazo de direito material ou data de intimação eletrônica presumida.
 * Fontes: CPC arts. 219, 220 e 224; CPP arts. 798 e 798-A;
 * Lei 9.099/95 art. 12-A; Lei 11.419/2006 art. 4º, §§ 3º e 4º.
 * Calendário TJBA 2026: Decreto Judiciário 1.050/2025;
 * feriados locais: Decreto Judiciário 09/2026 (Coração de Maria).
 */
import { ESTADOS_BRASIL, municipiosDaUf } from "./localidades-brasil";

export type MateriaPrazo = "civil" | "penal" | "jec_civil" | "jec_criminal";
export type ExcecaoRecesso = "nenhuma" | "reu_preso" | "maria_penha" | "urgente";
export type TipoContagem = "uteis" | "corridos";

export interface DadosPrazo {
  publicacao: string; // Data efetiva de publicação (YYYY-MM-DD), não disponibilização.
  prazoDias: number;
  materia: MateriaPrazo;
  uf?: string;
  municipio?: string;
  excecaoRecesso?: ExcecaoRecesso;
  diasSemExpediente?: string[];
  suspensoesEspecificas?: { inicio: string; fim: string }[];
}

export interface ResultadoPrazo {
  uf: string;
  municipio: string;
  publicacao: string;
  primeiroDia: string;
  vencimentoCalculado: string;
  vencimento: string;
  prorrogado: boolean;
  prazoDias: number;
  contagem: TipoContagem;
  fundamento: string;
  diasSuspensos: number;
  diasNaoContados: number;
  diasAteVencimento: number;
  avisoCalendario: string[];
  observacoes: string[];
}

const FERIADOS_TJBA_2026 = new Set([
  "2026-01-01", "2026-01-02",
  "2026-02-12", "2026-02-13", "2026-02-16", "2026-02-17", "2026-02-18",
  "2026-04-02", "2026-04-03", "2026-04-20", "2026-04-21",
  "2026-05-01", "2026-06-04", "2026-06-05",
  "2026-06-22", "2026-06-23", "2026-06-24",
  "2026-07-02", "2026-07-03",
  "2026-08-10", "2026-08-11", "2026-09-07",
  "2026-10-12", "2026-10-30",
  "2026-11-02", "2026-11-20",
  "2026-12-07", "2026-12-08", "2026-12-23", "2026-12-24", "2026-12-25",
  "2026-12-30", "2026-12-31",
]);

// Datas nacionais fixas; feriados móveis e atos locais precisam do calendário do tribunal.
const FERIADOS_NACIONAIS_FIXOS = new Set([
  "01-01", "04-21", "05-01", "09-07", "10-12", "11-02",
  "11-15", "11-20", "12-25",
]);

const FERIADOS_CORACAO_DE_MARIA_2026 = new Set([
  "2026-06-01", "2026-06-29", "2026-08-22",
]);

export function dataUTC(iso: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) throw new Error("Informe a data no formato AAAA-MM-DD.");
  const d = new Date(iso + "T12:00:00.000Z");
  if (Number.isNaN(d.valueOf()) || d.toISOString().slice(0, 10) !== iso) {
    throw new Error("Data inválida.");
  }
  return d;
}
export function isoUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function proximoDia(iso: string) {
  const d = dataUTC(iso);
  d.setUTCDate(d.getUTCDate() + 1);
  return isoUTC(d);
}
function eFimDeSemana(iso: string) {
  const dia = dataUTC(iso).getUTCDay();
  return dia === 0 || dia === 6;
}
function dentro(iso: string, inicio: string, fim: string) {
  return iso >= inicio && iso <= fim;
}
function feriadoOuRecesso(iso: string, adicionais: Set<string>, uf: string, municipio: string) {
  const mesDia = iso.slice(5);
  // Período tradicional de recesso judiciário (20/12 a 06/01).
  // O calendário anual deve ser conferido com os decretos do exercício.
  return (
    eFimDeSemana(iso) ||
    FERIADOS_NACIONAIS_FIXOS.has(mesDia) ||
    (uf === "BA" && FERIADOS_TJBA_2026.has(iso)) ||
    (uf === "BA" && municipio === "Coração de Maria" && FERIADOS_CORACAO_DE_MARIA_2026.has(iso)) ||
    adicionais.has(iso) ||
    mesDia >= "12-20" ||
    mesDia <= "01-06"
  );
}
function emSuspensaoGeral(iso: string) {
  const mesDia = iso.slice(5);
  return mesDia >= "12-20" || mesDia <= "01-20";
}
function emSuspensaoEspecifica(iso: string, periodos: { inicio: string; fim: string }[]) {
  return periodos.some(({ inicio, fim }) => dentro(iso, inicio, fim));
}
function primeiroUtilApos(iso: string, feriados: Set<string>, aplicaSuspensao: boolean, suspensoes: {inicio:string;fim:string}[], uf: string, municipio: string) {
  let dia = proximoDia(iso);
  for (let i = 0; i < 2000; i++) {
    if (!feriadoOuRecesso(dia, feriados, uf, municipio) &&
        !(aplicaSuspensao && emSuspensaoGeral(dia)) &&
        !emSuspensaoEspecifica(dia, suspensoes)) return dia;
    dia = proximoDia(dia);
  }
  throw new Error("Não foi encontrado dia útil para o início do prazo.");
}

export function calcularPrazoProcessual(dados: DadosPrazo): ResultadoPrazo {
  dataUTC(dados.publicacao);
  const uf = dados.uf ?? "BA";
  const municipio = dados.municipio ?? "Coração de Maria";
  if (!ESTADOS_BRASIL.some((estado) => estado.sigla === uf)) throw new Error("Estado inválido.");
  if (!municipiosDaUf(uf).includes(municipio)) throw new Error("Selecione um município válido para o estado.");
  const prazo = dados.prazoDias;
  if (!Number.isInteger(prazo) || prazo < 1 || prazo > 3650)
    throw new Error("O prazo deve ter entre 1 e 3.650 dias.");
  const feriados = new Set(dados.diasSemExpediente ?? []);
  for (const f of feriados) dataUTC(f);
  const suspensoes = dados.suspensoesEspecificas ?? [];
  for (const p of suspensoes) {
    dataUTC(p.inicio); dataUTC(p.fim);
    if (p.fim < p.inicio) throw new Error("O fim da suspensão não pode preceder seu início.");
  }
  const materias: MateriaPrazo[] = ["civil", "penal", "jec_civil", "jec_criminal"];
  if (!materias.includes(dados.materia)) throw new Error("Matéria processual inválida.");

  const penal = dados.materia === "penal" || dados.materia === "jec_criminal";
  const contagem: TipoContagem = dados.materia === "penal" ? "corridos" : "uteis";
  const excecao = penal && (dados.excecaoRecesso ?? "nenhuma") !== "nenhuma";
  const aplicaSuspensao = !excecao;
  const fundamento = dados.materia === "penal"
    ? "CPP, arts. 798 e 798-A"
    : dados.materia === "jec_criminal" || dados.materia === "jec_civil"
      ? "Lei 9.099/1995, art. 12-A" + (penal ? "; CPP, art. 798-A" : "; CPC, art. 220")
      : "CPC, arts. 219, 220 e 224";

  const primeiroDia = primeiroUtilApos(dados.publicacao, feriados, aplicaSuspensao, suspensoes, uf, municipio);
  let dia = primeiroDia;
  let contados = 0;
  let suspensos = 0;
  let ignorados = 0;
  let dataBruta = dia;
  for (let i = 0; i < 12000; i++) {
    const parado = (aplicaSuspensao && emSuspensaoGeral(dia)) || emSuspensaoEspecifica(dia, suspensoes);
    const ehUtil = !feriadoOuRecesso(dia, feriados, uf, municipio);
    const contabiliza = !parado && (contagem === "corridos" || ehUtil);
    if (contabiliza) {
      contados++;
      if (contados === prazo) { dataBruta = dia; break; }
    } else {
      ignorados++;
      if (parado) suspensos++;
    }
    if (i === 11999) throw new Error("O intervalo solicitado ultrapassou o limite de cálculo.");
    dia = proximoDia(dia);
  }
  let vencimento = dataBruta;
  for (let i = 0; i < 2000; i++) {
    if (!feriadoOuRecesso(vencimento, feriados, uf, municipio) &&
        !(aplicaSuspensao && emSuspensaoGeral(vencimento)) &&
        !emSuspensaoEspecifica(vencimento, suspensoes)) break;
    vencimento = proximoDia(vencimento);
  }

  const inicioAno = Number(dados.publicacao.slice(0, 4));
  const fimAno = Number(vencimento.slice(0, 4));
  const avisoCalendario: string[] = [];
  if (inicioAno !== 2026 || fimAno !== 2026) {
    avisoCalendario.push("O calendário oficial de feriados locais e do TJBA está parametrizado somente para 2026. Verifique outros anos e inclua datas de suspensão adicionais.");
  }
  if (uf !== "BA") {
    avisoCalendario.push("O tribunal configurado é o TJBA (1º grau), mas a localidade escolhida é de outra UF. O calendário próprio desse estado e seus feriados móveis ou municipais NÃO foram carregados; foram considerados somente os feriados nacionais fixos e os dias extras informados. Confira a jurisdição e as datas oficiais antes de utilizar o resultado.");
  } else if (municipio !== "Coração de Maria") {
    avisoCalendario.push("Os feriados específicos de " + municipio + " não estão cadastrados. O calendário base TJBA 2026 e feriados nacionais são considerados; inclua feriados municipais e suspensões locais em Datas sem expediente.");
  }
  if (penal) {
    avisoCalendario.push("O art. 798-A do CPP excepciona a suspensão do recesso para processos vinculados à prisão de réus presos, procedimentos da Lei Maria da Penha e medidas urgentes fundamentadas. Sem identificação do tipo concreto nos autos, a calculadora aplica a suspensão como padrão.");
  }
  if (penal && excecao) {
    avisoCalendario.push("Exceção legal do art. 798-A considerada mediante parâmetro técnico; confirme nos autos o enquadramento e o fundamento.");
  }
  const observacoes = [
    "A data indicada deve ser a PUBLICAÇÃO EFETIVA, não a disponibilização do DJE. Para consulta de intimação eletrônica, vista pessoal e outros atos, confirme a data legal de ciência.",
    "O vencimento calculado é uma previsão administrativa; confira movimentações, decisões de suspensão e eventuais alterações no calendário oficial da unidade.",
  ];
  return {
    uf,
    municipio,
    publicacao: dados.publicacao,
    primeiroDia,
    vencimentoCalculado: dataBruta,
    vencimento,
    prorrogado: dataBruta !== vencimento,
    prazoDias: prazo,
    contagem,
    fundamento,
    diasSuspensos: suspensos,
    diasNaoContados: ignorados,
    diasAteVencimento: Math.round((dataUTC(vencimento).getTime() - dataUTC(dados.publicacao).getTime()) / 86400000),
    avisoCalendario,
    observacoes,
  };
}
