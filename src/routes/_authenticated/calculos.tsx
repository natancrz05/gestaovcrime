import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AlertTriangle, BrainCircuit, CalendarClock, CalendarDays, Check, CheckCircle2, ChevronsUpDown, ClipboardCopy, FileText, Gavel, Hourglass, Loader2, LockKeyhole, Scale, ShieldCheck, UploadCloud, X } from "lucide-react";
import { toast } from "sonner";
import { calcularPrazoProcessual, type DadosPrazo, type MateriaPrazo } from "@/lib/prazos/calculo";
import { ESTADOS_BRASIL, municipiosDaUf } from "@/lib/prazos/localidades-brasil";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Command, CommandGroup, CommandInput, CommandItem, CommandList, CommandEmpty } from "@/components/ui/command";
import { Calendar } from "@/components/ui/calendar";
import { extrairArquivoTexto, type ArquivoExtraido } from "@/lib/assistente-arquivos";
import { perguntarAoAssistente } from "@/lib/assistente";
import { criarConversaAssistente, salvarMensagemUsuario } from "@/lib/assistente-historico";
import { usePode, useSessao } from "@/lib/sessao";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/calculos")({
  head: () => ({
    meta: [
      { title: "Cálculos Processuais — Gestão da Vara Criminal" },
      { name: "description", content: "Cálculo de prazos e análises jurídicas assistidas por IA para a serventia." },
    ],
  }),
  component: PaginaCalculos,
});

type Aba = "manual" | "ia";
const CAMPO = "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10";
const TITULO = "mb-1.5 block text-xs font-medium text-foreground";

function formatarData(iso: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  return iso.slice(8, 10) + "/" + iso.slice(5, 7) + "/" + iso.slice(0, 4);
}
function normalizarPesquisa(texto: string) {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}
function deIsoParaDataLocal(iso: string): Date {
  const [ano, mes, dia] = iso.split("-").map(Number);
  return new Date(ano, mes - 1, dia, 12);
}
function deDataLocalParaIso(data: Date): string {
  return [String(data.getFullYear()), String(data.getMonth() + 1).padStart(2, "0"), String(data.getDate()).padStart(2, "0")].join("-");
}
function CampoFixo({ valor }: { valor: string }) {
  return <div className={cn(CAMPO, "flex items-center bg-muted/35 font-medium text-foreground")} aria-readonly="true">{valor}</div>;
}

const OPCOES_IA = [
  {
    id: "prescricao",
    numero: "01",
    titulo: "Prescrição penal",
    descricao: "Análise de marcos, períodos suspensos e datas de possível prescrição",
    icone: CalendarClock,
    orientacao: "Reconstrua a linha do tempo dos marcos interruptivos e suspensivos com indicação precisa de datas, IDs documentais e páginas. Distinga prescrição da pretensão punitiva, retroativa, intercorrente e executória conforme o caso. Não trate inclusão em pauta, mera movimentação administrativa ou agendamento como interrupção legal sem fundamento. Confira pena cominada/aplicada, majorantes e causas legais, bem como data de recebimento da denúncia e trânsito em julgado. Sem documentos suficientes, não declare prescrição consumada.",
  },
  {
    id: "preventiva",
    numero: "02",
    titulo: "Revisão da prisão preventiva",
    descricao: "Alertas de 90 dias e identificação da última decisão de revisão",
    icone: ShieldCheck,
    orientacao: "Identifique a data da prisão, decisão de decretação e última decisão fundamentada de revisão. Diferencie a prisão de última reavaliação. Calcule o período até a data de referência com indicação de fatos verificáveis, explique art. 316, parágrafo único, do CPP e não afirme soltura automática.",
  },
  {
    id: "manifestacoes",
    numero: "03",
    titulo: "Prazos de manifestações",
    descricao: "Controle de intimações, defesas, vistas e recursos",
    icone: FileText,
    orientacao: "Identifique modalidade e data de intimação/publicação efetiva, ato processual, base legal do prazo, contagem conforme CPP, CPC ou Juizados, feriados e suspensões. Não presuma início pela disponibilização no DJE e não invente feriados locais. Se faltar dado sobre ciência, conclua como prazo ainda não confirmável.",
  },
  {
    id: "excesso",
    numero: "04",
    titulo: "Excesso de prazo",
    descricao: "Tempo de prisão e de tramitação, com sinalização para análise individualizada",
    icone: Hourglass,
    orientacao: "Construa cronologia de prisão e tramitação, identifique incidentes, diligências, atos atribuíveis às partes, complexidade, pluralidade de réus e fase processual. Calcule lapsos de forma transparente e evite afirmar excesso de prazo apenas com base em número fixo de dias.",
  },
  {
    id: "execucao",
    numero: "05",
    titulo: "Execução penal",
    descricao: "Pena cumprida, progressão, remição e previsão de término",
    icone: Scale,
    orientacao: "Identifique guia de recolhimento, penas e regimes, data-base, detração, faltas graves, remição e benefícios. Diferencie cumprimento de pena e estimativas; calcule somente quando houver dados e legislação aplicável aos fatos. Alerta: dados do SEEU podem não constar no PDF ou no acervo do Vara Crime.",
  },
  {
    id: "suspensao",
    numero: "06",
    titulo: "Suspensão processual",
    descricao: "Períodos de suspensão, fundamento, retomada e efeitos nos prazos",
    icone: Gavel,
    orientacao: "Identifique todas as determinações judiciais de suspensão, fundamento legal, termo inicial, termo final e eventual decisão de retomada. Diferencie suspensão do processo, suspensão de prazo processual e suspensão da prescrição; não presuma duração ou retomada quando os autos forem insuficientes.",
  },
] as const;

function CalculadoraManual() {
  const [materia, setMateria] = useState<MateriaPrazo>("penal");
  const [estado, setEstado] = useState("BA");
  const [municipio, setMunicipio] = useState("Coração de Maria");
  const [estadoAberto, setEstadoAberto] = useState(false);
  const [municipioAberto, setMunicipioAberto] = useState(false);
  const [buscaEstado, setBuscaEstado] = useState("");
  const [buscaMunicipio, setBuscaMunicipio] = useState("");
  const [calendarioAberto, setCalendarioAberto] = useState(false);
  const municipiosDisponiveis = useMemo(() => municipiosDaUf(estado), [estado]);
  const estadosFiltrados = useMemo(() => ESTADOS_BRASIL.filter((uf) =>
    normalizarPesquisa(uf.nome + " " + uf.sigla).includes(normalizarPesquisa(buscaEstado))
  ), [buscaEstado]);
  const municipiosFiltrados = useMemo(() => municipiosDisponiveis.filter((nome) =>
    normalizarPesquisa(nome).includes(normalizarPesquisa(buscaMunicipio))
  ), [municipiosDisponiveis, buscaMunicipio]);
  const [publicacao, setPublicacao] = useState("");
  const [dias, setDias] = useState("");
  const [extras, setExtras] = useState<string[]>([]);
  const [suspensaoInicio, setSuspensaoInicio] = useState("");
  const [suspensaoFim, setSuspensaoFim] = useState("");
  const [resultado, setResultado] = useState<ReturnType<typeof calcularPrazoProcessual> | null>(null);
  const [erro, setErro] = useState("");
  const contagem = materia === "penal" || materia === "jec_criminal" ? "Dias corridos" : "Dias úteis";

  const gerar = () => {
    setErro("");
    setResultado(null);
    try {
      if (!publicacao) throw new Error("Informe a data efetiva da publicação.");
      if (!dias.trim()) throw new Error("Informe o prazo em dias.");
      if (!municipio) throw new Error("Selecione o município para calcular.");
      if (Boolean(suspensaoInicio) !== Boolean(suspensaoFim)) throw new Error("Informe as duas datas da suspensão específica.");
      const dados: DadosPrazo = {
        publicacao,
        prazoDias: Number(dias),
        materia,
        uf: estado,
        municipio,
        diasSemExpediente: extras,
        suspensoesEspecificas: suspensaoInicio && suspensaoFim ? [{ inicio: suspensaoInicio, fim: suspensaoFim }] : [],
      };
      setResultado(calcularPrazoProcessual(dados));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível calcular o prazo.");
    }
  };

  const copiar = () => {
    if (!resultado) return;
    const texto = [
      "CÁLCULO DE PRAZO — VARA CRIME",
      "Local: " + municipio + "/" + estado + " — TJBA (1º grau)",
      "Publicação efetiva: " + formatarData(resultado.publicacao),
      "Início da contagem: " + formatarData(resultado.primeiroDia),
      "Prazo: " + resultado.prazoDias + " dias (" + resultado.contagem + ")",
      "Vencimento bruto: " + formatarData(resultado.vencimentoCalculado),
      "Vencimento ajustado: " + formatarData(resultado.vencimento),
      "Calendário: " + (resultado.calendarioCompleto ? "TJBA 2026 parametrizado para Coração de Maria (sujeito a alterações)" : "incompleto — conferir"),
      "Memória de cálculo: ",
      ...resultado.memoriaCalculo.map((dia) =>
        formatarData(dia.data) + " — " + dia.situacao +
        (dia.numeroDia ? " (" + dia.numeroDia + "º dia)" : "") + " — " + dia.motivo
      ),
      "Fundamento: " + resultado.fundamento,
      "Observações: " + [...resultado.avisoCalendario, ...resultado.observacoes].join(" "),
    ].join("\n");
    void navigator.clipboard.writeText(texto).then(() => toast.success("Cálculo copiado."), () => toast.error("Não foi possível copiar."));
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="mb-5 border-b border-border pb-4">
          <h2 className="text-lg font-semibold">Novo cálculo de prazo</h2>
          <p className="mt-1 text-sm text-muted-foreground">Parâmetros adaptados à Vara Plena de Coração de Maria, conforme a legislação processual.</p>
        </div>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); gerar(); }}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <span className={TITULO}>Estado</span>
              <Popover open={estadoAberto} onOpenChange={(open) => { setEstadoAberto(open); if (!open) setBuscaEstado(""); }}>
                <PopoverTrigger asChild>
                  <button type="button" aria-label="Selecionar estado" aria-expanded={estadoAberto} className={cn(CAMPO, "flex items-center justify-between gap-2 text-left")}>
                    <span className="truncate">{ESTADOS_BRASIL.find((uf) => uf.sigla === estado)?.nome ?? estado} ({estado})</span>
                    <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-[min(90vw,370px)] p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput placeholder="Digite o nome ou sigla do estado…" value={buscaEstado} onValueChange={setBuscaEstado} />
                    <CommandList>
                      {estadosFiltrados.length === 0 ? <CommandEmpty>Nenhum estado encontrado.</CommandEmpty> : null}
                      <CommandGroup>
                        {estadosFiltrados.map((uf) => (
                          <CommandItem key={uf.sigla} value={uf.sigla} onSelect={() => {
                            setEstado(uf.sigla);
                            setMunicipio(uf.sigla === "BA" ? "Coração de Maria" : "");
                            setExtras([]);
                            setBuscaMunicipio("");
                            setResultado(null);
                            setEstadoAberto(false);
                          }}>
                            <Check className={cn("size-4", estado === uf.sigla ? "opacity-100" : "opacity-0")} />
                            {uf.nome} ({uf.sigla})
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <span className={TITULO}>Município</span>
              <Popover open={municipioAberto} onOpenChange={(open) => { setMunicipioAberto(open); if (!open) setBuscaMunicipio(""); }}>
                <PopoverTrigger asChild>
                  <button type="button" aria-label="Selecionar município" aria-expanded={municipioAberto} className={cn(CAMPO, "flex items-center justify-between gap-2 text-left")}>
                    <span className={cn("truncate", !municipio && "text-muted-foreground")}>{municipio || "Selecione o município…"}</span>
                    <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-[min(90vw,400px)] p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput placeholder="Pesquise digitando o nome da cidade…" value={buscaMunicipio} onValueChange={setBuscaMunicipio} />
                    <CommandList>
                      {municipiosFiltrados.length === 0 ? <CommandEmpty>Nenhum município encontrado nesta UF.</CommandEmpty> : null}
                      <CommandGroup>
                        {municipiosFiltrados.map((nome) => (
                          <CommandItem key={nome} value={nome} onSelect={() => {
                            setMunicipio(nome);
                            setExtras([]);
                            setResultado(null);
                            setMunicipioAberto(false);
                          }}>
                            <Check className={cn("size-4", municipio === nome ? "opacity-100" : "opacity-0")} />
                            {nome}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className={TITULO}>Matéria</span>
              <select className={CAMPO} value={materia} onChange={(e) => { setMateria(e.target.value as MateriaPrazo); setResultado(null); }}>
                <option value="penal">Processual penal (CPP)</option>
                <option value="civil">Processual civil (CPC)</option>
                <option value="jec_criminal">Juizado Especial Criminal</option>
                <option value="jec_civil">Juizado Especial Cível</option>
              </select>
            </label>
            <div><span className={TITULO}>Tribunal</span><CampoFixo valor="TJBA — 1º grau" /></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label><span className={TITULO}>Data da publicação efetiva</span><input required type="date" className={CAMPO} value={publicacao} onChange={(e) => { setPublicacao(e.target.value); setResultado(null); }} /></label>
            <label><span className={TITULO}>Prazo (dias)</span><input required type="number" min={1} max={3650} step={1} placeholder="Ex.: 15" className={CAMPO} value={dias} onChange={(e) => { setDias(e.target.value); setResultado(null); }} /></label>
          </div>
          <div><span className={TITULO}>Tipo de contagem (automático)</span><CampoFixo valor={contagem} /></div>
          <details className="rounded-lg border border-border bg-muted/15 px-4 py-3">
            <summary className="cursor-pointer text-sm font-medium">Feriados adicionais e suspensão específica</summary>
            <div className="mt-3 space-y-3">
              <div className="space-y-2">
                <span className={TITULO}>Datas sem expediente não contempladas</span>
                <div className="flex flex-wrap items-center gap-2">
                  <Popover open={calendarioAberto} onOpenChange={setCalendarioAberto}>
                    <PopoverTrigger asChild>
                      <button type="button" className={cn(CAMPO, "flex min-w-[190px] flex-1 items-center justify-between gap-2 text-left")}>
                        <span>{extras.length === 0 ? "Nenhuma data selecionada" : extras.length + (extras.length === 1 ? " data selecionada" : " datas selecionadas")}</span>
                        <CalendarDays className="size-4 text-muted-foreground" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-auto max-w-[95vw] p-3">
                      <p className="mb-2 text-xs text-muted-foreground">Clique nos dias sem expediente para selecionar ou retirar.</p>
                      <Calendar mode="multiple" captionLayout="dropdown" startMonth={new Date(2000, 0)} endMonth={new Date(2050, 11)} selected={extras.map(deIsoParaDataLocal)} onSelect={(datas) => {
                        setExtras((datas ?? []).map(deDataLocalParaIso).sort());
                        setResultado(null);
                      }} />
                      <button type="button" onClick={() => setCalendarioAberto(false)} className="mt-2 w-full rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground">Concluir seleção</button>
                    </PopoverContent>
                  </Popover>
                  <button type="button" disabled={extras.length === 0} onClick={() => { setExtras([]); setResultado(null); }} className="h-10 rounded-lg border border-border px-3 text-xs font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40">
                    Limpar
                  </button>
                </div>
                {extras.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {extras.map((data) => (
                      <button key={data} type="button" title="Remover esta data" onClick={() => { setExtras((atuais) => atuais.filter((item) => item !== data)); setResultado(null); }} className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] hover:bg-muted">
                        {formatarData(data)} <X className="size-3" />
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label><span className={TITULO}>Suspensão específica — início</span><input type="date" className={CAMPO} value={suspensaoInicio} onChange={(e) => { setSuspensaoInicio(e.target.value); setResultado(null); }} /></label>
                <label><span className={TITULO}>Suspensão específica — fim</span><input type="date" className={CAMPO} value={suspensaoFim} onChange={(e) => { setSuspensaoFim(e.target.value); setResultado(null); }} /></label>
              </div>
              <p className="text-xs leading-5 text-muted-foreground">Use somente suspensões formalmente aplicáveis ao caso, com fundamento nos autos.</p>
            </div>
          </details>
          {erro ? <p role="alert" className="rounded-lg border border-destructive/20 p-3 text-sm text-destructive">{erro}</p> : null}
          <button type="submit" className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:brightness-95">
            <CalendarDays className="size-4" /> Calcular prazo
          </button>
        </form>
      </section>
      <aside className="space-y-4">
        {resultado ? (
          <section className="rounded-xl border border-primary/20 bg-card p-5 shadow-sm" aria-live="polite">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary"><CheckCircle2 className="size-4" /> Resultado estimado</span>
            {!resultado.calendarioCompleto ? (
              <p className="mt-3 rounded-lg border border-amber-300/40 p-2 text-xs font-medium text-amber-700 dark:text-amber-400">
                Calendário não integralmente parametrizado para a UF, município ou ano selecionado. O vencimento exige conferência dos atos oficiais.
              </p>
            ) : null}
            <p className="mt-4 text-xs text-muted-foreground">Vencimento previsto</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">{formatarData(resultado.vencimento)}</p>
            <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-4 text-sm">
              <div><dt className="text-xs text-muted-foreground">Primeiro dia</dt><dd className="mt-1 font-medium">{formatarData(resultado.primeiroDia)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Prazo</dt><dd className="mt-1 font-medium">{resultado.prazoDias} dias {resultado.contagem}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Dias suspensos</dt><dd className="mt-1 font-medium">{resultado.diasSuspensos}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Vencimento ajustado</dt><dd className="mt-1 font-medium">{resultado.prorrogado ? "Sim" : "Não"}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Vencimento bruto</dt><dd className="mt-1 font-medium">{formatarData(resultado.vencimentoCalculado)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Dias não computados</dt><dd className="mt-1 font-medium">{resultado.diasNaoContados}</dd></div>
            </dl>
            <p className="mt-4 text-xs font-medium">{resultado.fundamento}</p>
            <details className="mt-4 rounded-lg border border-border bg-muted/10 p-3">
              <summary className="cursor-pointer text-xs font-semibold">Memória de cálculo — {resultado.memoriaCalculo.length} registros</summary>
              <p className="mt-2 text-[11px] text-muted-foreground">Contado, suspenso, não computado e prorrogação do vencimento. Para séries extensas, veja os primeiros e últimos registros ou copie a memória integral.</p>
              <ol className="mt-2 max-h-[260px] space-y-1 overflow-y-auto text-[11px] leading-5">
                {(resultado.memoriaCalculo.length > 65
                  ? [...resultado.memoriaCalculo.slice(0, 35), ...resultado.memoriaCalculo.slice(-30)]
                  : resultado.memoriaCalculo
                ).map((dia, i) => (
                  <li key={dia.data + "-" + i} className="flex gap-2 border-b border-border/40 py-1">
                    <span className="w-[72px] shrink-0 tabular-nums font-medium">{formatarData(dia.data)}</span>
                    <span>
                      <strong>{dia.numeroDia ? dia.numeroDia + "º dia · " : ""}{dia.situacao === "contado" ? "Contado" : dia.situacao === "suspenso" ? "Suspenso" : dia.situacao === "prorrogado" ? "Prorrogação" : "Não computado"}</strong>
                      {" — " + dia.motivo}
                    </span>
                  </li>
                ))}
              </ol>
              {resultado.memoriaCalculo.length > 65 ? <p className="mt-2 text-[11px] text-muted-foreground">Exibição resumida (35 primeiros e 30 últimos dias). O botão Copiar resultado inclui todas as datas.</p> : null}
            </details>
            {resultado.avisoCalendario.map((aviso, i) => <p key={i} className="mt-3 text-xs leading-5 text-amber-700 dark:text-amber-400"><AlertTriangle className="mr-1 inline size-3.5" /> {aviso}</p>)}
            <button type="button" onClick={copiar} className="mt-4 inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-muted">
              <ClipboardCopy className="size-4" /> Copiar resultado
            </button>
          </section>
        ) : (
          <section className="rounded-xl border border-dashed border-border bg-card p-5 text-sm text-muted-foreground">
            <CalendarDays className="mb-3 size-6 text-primary" />
            <p className="font-medium text-foreground">Resultado do cálculo</p>
            <p className="mt-2 text-xs leading-5">Preencha os campos e clique em Calcular. O cálculo é feito localmente, sem consumir créditos de IA.</p>
          </section>
        )}
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <div>
              <p className="text-sm font-semibold">Verificação obrigatória</p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Informe a data efetiva de publicação no DJE, não a disponibilização. Ciência no portal, intimação pessoal, vista e regras especiais podem alterar o termo inicial.
              </p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                O calendário automatizado do TJBA está parametrizado para 2026; os feriados municipais automáticos referem-se a Coração de Maria. Ao selecionar outra cidade ou UF, confira e inclua os feriados próprios do local. O tribunal permanece TJBA — 1º grau.
              </p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">Prescrição, execução penal e outros prazos materiais exigem análise própria na calculadora por IA. O art. 798-A do CPP prevê exceções legais à suspensão para processos de réu preso, procedimentos da Lei Maria da Penha e medidas urgentes fundamentadas; confira o caso concreto.</p>
            </div>
          </div>
        </section>
      </aside>
    </div>
  );
}

function CalculadoraIA() {
  const sessao = useSessao();
  const [tipo, setTipo] = useState<(typeof OPCOES_IA)[number]["id"]>("prescricao");
  const [processo, setProcesso] = useState("");
  const [arquivo, setArquivo] = useState<ArquivoExtraido | null>(null);
  const [lendo, setLendo] = useState(false);
  const [analisando, setAnalisando] = useState(false);
  const [resposta, setResposta] = useState("");
  const [conversaCriada, setConversaCriada] = useState("");
  const [erro, setErro] = useState("");
  const opcao = useMemo(() => OPCOES_IA.find((o) => o.id === tipo) ?? OPCOES_IA[0], [tipo]);

  const carregar = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setLendo(true);
    setErro("");
    setArquivo(null);
    setResposta("");
    try {
      if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") throw new Error("Envie os autos no formato PDF.");
      const extraido = await extrairArquivoTexto(file);
      setArquivo(extraido);
      if (extraido.truncado) toast.warning("O PDF excedeu o limite de extração. A análise será parcial.");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível ler o PDF.");
    } finally {
      setLendo(false);
    }
  };

  const analisar = async () => {
    if (!arquivo || analisando) return;
    setErro("");
    setResposta("");
    setConversaCriada("");
    setAnalisando(true);
    try {
      const prompt = [
        "ANÁLISE JURÍDICA — " + opcao.titulo.toUpperCase(),
        processo.trim() ? "PROCESSO: " + processo.trim() : "PROCESSO: identificar exclusivamente se constar nos autos.",
        "Unidade: Vara Plena da Comarca de Coração de Maria/BA — TJBA.",
        "Examine o PDF anexado como fonte primária. Consulte o acervo interno através das ferramentas do Assistente caso o número do processo esteja informado e exista cadastro correspondente.",
        "OBJETIVO: " + opcao.descricao + ".",
        "CRITÉRIOS ESPECÍFICOS: " + opcao.orientacao,
        "Indique cada marco com data, página do PDF, ID do documento quando efetivamente encontrado e fundamento legal. Separe fatos localizados, dados administrativos e inferências.",
        "Use cronologia e cálculos auditáveis. Nunca invente documentos ou datas. Não trate ausência de informação como prova de inexistência.",
        arquivo.truncado ? "ATENÇÃO: O PDF foi TRUNCADO NA EXTRAÇÃO. É PROIBIDO CONCLUIR DE MODO DEFINITIVO; informe o que falta e recomende nova análise integral." : "Verifique lacunas dos autos antes de qualquer conclusão.",
        "O resultado é subsídio para avaliação técnica humana, não decisão judicial.",
      ].join("\n");
      const chat = await criarConversaAssistente(sessao.id, opcao.titulo + (processo.trim() ? " — " + processo.trim() : ""));
      setConversaCriada(chat.id);
      const msgId = crypto.randomUUID();
      await salvarMensagemUsuario({
        id: msgId, conversaId: chat.id, usuarioId: sessao.id,
        conteudo: prompt, anexos: [arquivo.nome],
      });
      const gerada = await perguntarAoAssistente(
        [{ role: "user", content: prompt }],
        [{ nome: arquivo.nome, tipo: arquivo.tipo, texto: arquivo.texto, ...(arquivo.paginas !== undefined ? { paginas: arquivo.paginas } : {}), ...(arquivo.truncado !== undefined ? { truncado: arquivo.truncado } : {}) }],
        { conversaId: chat.id, respostaId: crypto.randomUUID() },
      );
      setResposta(gerada.resposta);
      if (!gerada.persistida) toast.warning("A resposta foi gerada, mas o registro do histórico não foi confirmado.");
      else toast.success("Análise concluída e salva em Suas conversas.");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível realizar a análise.");
    } finally {
      setAnalisando(false);
    }
  };

  return (
    <div className="space-y-5">
      <section>
        <h2 className="text-lg font-semibold">Selecione o tipo de análise</h2>
        <p className="mt-1 text-sm text-muted-foreground">A IA usará o Assistente da Vara e, quando pertinente, as consultas somente leitura ao acervo.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {OPCOES_IA.map((item) => {
            const Icone = item.icone;
            return (
              <button key={item.id} type="button" onClick={() => { setTipo(item.id); setResposta(""); }} disabled={analisando}
                className={cn("min-h-[145px] rounded-xl border bg-card p-4 text-left shadow-sm transition-colors hover:border-primary/50 disabled:opacity-50", tipo === item.id ? "border-primary ring-1 ring-primary/25" : "border-border")}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold tracking-wider text-muted-foreground">{item.numero}</span>
                  <Icone className={cn("size-5", tipo === item.id ? "text-primary" : "text-muted-foreground")} />
                </div>
                <p className="mt-3 text-sm font-semibold">{item.titulo}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.descricao}</p>
              </button>
            );
          })}
        </div>
      </section>
      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <h3 className="text-base font-semibold">Autos para análise</h3>
          <label><span className={TITULO}>Número do processo (opcional, para buscar no acervo)</span>
            <input className={CAMPO} value={processo} onChange={(e) => setProcesso(e.target.value)} placeholder="Ex.: 8000000-00.2026.8.05.0067" maxLength={40} disabled={analisando} />
          </label>
          <label className="block cursor-pointer rounded-xl border border-dashed border-border bg-muted/15 px-5 py-6 text-center hover:border-primary/40">
            {lendo ? <Loader2 className="mx-auto size-6 animate-spin text-primary" /> : <UploadCloud className="mx-auto size-6 text-primary" />}
            <span className="mt-2 block text-sm font-medium">{lendo ? "Lendo o documento…" : arquivo ? arquivo.nome : "Selecione o PDF dos autos"}</span>
            <span className="mt-1 block text-xs text-muted-foreground">{arquivo ? String(arquivo.paginas ?? "?") + " páginas" + (arquivo.truncado ? " · Extração parcial" : " · Texto extraído") : "PDF com texto selecionável, até 60 MB"}</span>
            <input type="file" className="sr-only" accept=".pdf,application/pdf" disabled={lendo || analisando} onChange={(e) => void carregar(e.target.files)} />
          </label>
          {arquivo?.truncado ? <p className="rounded-lg border border-amber-300/40 p-3 text-xs leading-5 text-amber-700 dark:text-amber-400">O arquivo ultrapassa o limite de texto analisável por requisição. O resultado será parcial e não deve fundamentar uma conclusão definitiva.</p> : null}
          {erro ? <p role="alert" className="rounded-lg border border-destructive/20 px-3 py-2 text-sm text-destructive">{erro}</p> : null}
          <button type="button" onClick={() => void analisar()} disabled={!arquivo || lendo || analisando}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-40">
            {analisando ? <Loader2 className="size-4 animate-spin" /> : <BrainCircuit className="size-4" />}
            {analisando ? "Analisando autos e consultando o acervo…" : "Analisar com IA"}
          </button>
        </div>
        <aside className="rounded-xl border border-border bg-card p-5 text-xs leading-5 text-muted-foreground">
          <ShieldCheck className="mb-3 size-6 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Como funciona</h3>
          <p className="mt-2">O PDF é extraído no navegador; apenas o texto analisável é enviado ao GPT através do gateway Lovable AI.</p>
          <p className="mt-2">A IA pode consultar processos e réus cadastrados, sem alterar registros.</p>
          <p className="mt-2">A análise é registrada no histórico privado do usuário. O PDF original não é guardado.</p>
          <p className="mt-2 font-medium text-foreground">Atenção: executar uma análise com IA consome créditos de uso do Lovable AI. A calculadora manual não consome.</p>
        </aside>
      </section>
      {resposta ? (
        <section className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6" aria-live="polite">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
            <h3 className="font-semibold">Resultado da análise — {opcao.titulo}</h3>
            {conversaCriada ? <Link to="/assistente" className="text-xs font-medium text-primary underline underline-offset-2">Abrir histórico no Assistente</Link> : null}
          </div>
          <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-7">{resposta}</pre>
        </section>
      ) : null}
    </div>
  );
}

function PaginaCalculos() {
  const [aba, setAba] = useState<Aba>("manual");
  const podeUsarAssistente = usePode("usar-assistente");
  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">Gestão de prazos</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Cálculos Processuais</h1>
        <p className="mt-1 text-sm text-muted-foreground">Cálculo administrativo de prazos e análises documentais com o Assistente da Vara.</p>
      </div>
      <div className="inline-flex max-w-full flex-wrap gap-1 rounded-xl border border-border bg-card p-1">
        <button type="button" onClick={() => setAba("manual")} className={cn("inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium", aba === "manual" ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
          <CalendarDays className="size-4" /> Calculadora manual
        </button>
        <button type="button" onClick={() => setAba("ia")} disabled={!podeUsarAssistente} title={!podeUsarAssistente ? "Disponível somente para perfis autorizados ao Assistente." : undefined} className={cn("inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40", aba === "ia" ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
          <BrainCircuit className="size-4" /> Calculadora por IA
        </button>
      </div>
      {aba === "manual" ? <CalculadoraManual /> : podeUsarAssistente ? <CalculadoraIA /> : null}
      <p className="flex items-center gap-2 text-xs text-muted-foreground"><LockKeyhole className="size-3.5" /> Acesso reservado aos usuários autenticados. Resultados sujeitos à conferência técnica.</p>
    </div>
  );
}
