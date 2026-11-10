import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { AlertCircle, ArrowDown, Bot, CheckCircle2, Copy, FileText, Gavel, Loader2, MessageSquare, MessageSquarePlus, Paperclip, Pencil, RotateCcw, Search, Send, ShieldCheck, Sparkles, Trash2, User, X } from "lucide-react";
import { toast } from "sonner";
import { perguntarAoAssistente, type ArquivoAssistente, type MensagemAssistente } from "@/lib/assistente";
import { extrairArquivoTexto, type ArquivoExtraido } from "@/lib/assistente-arquivos";
import { cn } from "@/lib/utils";
import { useSessao } from "@/lib/sessao";
import {
  criarConversaAssistente, excluirConversaAssistente,
  listarConversasAssistente, listarMensagensAssistente,
  renomearConversaAssistente, salvarMensagemUsuario,
  salvarRespostaAssistenteLocal, tituloInicialDaConversa,
  visualizarMensagemSalva, type ConversaAssistente,
} from "@/lib/assistente-historico";

function renderInlineMarkdown(texto: string): ReactNode[] {
  const partes = texto.split(/(\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|`[^`]+`|\[[^\]]+\]\([^)]+\))/g).filter(Boolean);

  return partes.map((parte, index) => {
    if ((parte.startsWith("**") && parte.endsWith("**")) || (parte.startsWith("__") && parte.endsWith("__"))) {
      return <strong key={index} className="font-semibold">{parte.slice(2, -2)}</strong>;
    }
    if ((parte.startsWith("*") && parte.endsWith("*")) || (parte.startsWith("_") && parte.endsWith("_"))) {
      return <em key={index}>{parte.slice(1, -1)}</em>;
    }
    if (parte.startsWith("`") && parte.endsWith("`")) {
      return <code key={index} className="rounded border border-current/20 px-1.5 py-0.5 font-mono text-[0.9em]">{parte.slice(1, -1)}</code>;
    }
    const link = parte.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link && /^https?:\/\//i.test(link[2] ?? "")) {
      return <a key={index} href={link[2]} target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-2 hover:opacity-80">{link[1]}</a>;
    }
    return <Fragment key={index}>{parte}</Fragment>;
  });
}

function MarkdownResposta({ texto }: { texto: string }) {
  const linhas = texto.replace(/\r\n/g, "\n").split("\n");
  const blocos: ReactNode[] = [];
  let listaAtual: { texto: string; numerada: boolean }[] = [];
  let codigo: string[] | null = null;
  let linguagem = "";

  const descarregarLista = () => {
    const primeiro = listaAtual[0];
    if (!primeiro) return;
    const Tag = primeiro.numerada ? "ol" : "ul";
    blocos.push(
      <Tag key={"lista-" + blocos.length} className={cn("my-2 space-y-1 pl-5", primeiro.numerada ? "list-decimal" : "list-disc")}>
        {listaAtual.map((item, index) => <li key={index} className="pl-0.5">{renderInlineMarkdown(item.texto)}</li>)}
      </Tag>,
    );
    listaAtual = [];
  };

  const descarregarCodigo = () => {
    if (codigo === null) return;
    blocos.push(
      <div key={"codigo-" + blocos.length} className="my-3 min-w-0 overflow-hidden rounded-lg border border-border bg-muted/40">
        {linguagem ? <div className="border-b border-border px-3 py-1 text-[11px] opacity-70">{linguagem}</div> : null}
        <pre className="overflow-x-auto p-3 text-xs leading-5"><code>{codigo.join("\n")}</code></pre>
      </div>,
    );
    codigo = null;
    linguagem = "";
  };

  for (const [index, linha] of linhas.entries()) {
    const cerca = linha.match(/^\s*\x60{3}(.*)$/);
    if (cerca) {
      if (codigo !== null) descarregarCodigo();
      else {
        descarregarLista();
        codigo = [];
        linguagem = (cerca[1] ?? "").trim().slice(0, 30);
      }
      continue;
    }
    if (codigo !== null) {
      codigo.push(linha);
      continue;
    }

    const lista = linha.match(/^\s*(?:[-*•])\s+(.+)$/);
    const numerada = linha.match(/^\s*\d+[.)]\s+(.+)$/);
    if (lista || numerada) {
      const atual = lista ?? numerada;
      const numero = Boolean(numerada);
      if (listaAtual[0] && listaAtual[0].numerada !== numero) descarregarLista();
      if (atual?.[1]) listaAtual.push({ texto: atual[1], numerada: numero });
      continue;
    }
    descarregarLista();

    if (!linha.trim()) {
      blocos.push(<div key={"espaco-" + index} className="h-2" />);
      continue;
    }

    const titulo = linha.match(/^\s*(#{1,3})\s+(.+)$/);
    if (titulo?.[1] && titulo[2]) {
      const nivel = titulo[1].length;
      const classe = nivel === 1 ? "mt-3 text-base font-semibold" : nivel === 2 ? "mt-2.5 text-sm font-semibold" : "mt-2 text-sm font-medium";
      blocos.push(<div key={"titulo-" + index} className={classe}>{renderInlineMarkdown(titulo[2])}</div>);
      continue;
    }

    const citado = linha.match(/^\s*>\s?(.+)$/);
    if (citado?.[1]) {
      blocos.push(
        <blockquote key={"citacao-" + index} className="my-2 border-l-2 border-current/30 pl-3 opacity-80">
          {renderInlineMarkdown(citado[1])}
        </blockquote>,
      );
      continue;
    }

    blocos.push(
      <p key={"paragrafo-" + index} className="whitespace-pre-wrap break-words leading-6">
        {renderInlineMarkdown(linha)}
      </p>,
    );
  }

  descarregarLista();
  descarregarCodigo();
  return <div className="min-w-0 space-y-1">{blocos}</div>;
}

const SUGESTOES = [
  {
    icon: FileText,
    titulo: "Redação cartorária",
    texto: "Melhore esta minuta de certidão: Certifico que, decorrido o prazo, não houve manifestação.",
  },
  {
    icon: Gavel,
    titulo: "Explicação jurídica",
    texto: "Explique de forma prática o que significa matéria preliminar na resposta à acusação.",
  },
  {
    icon: CheckCircle2,
    titulo: "Conferência processual",
    texto: "Quais informações devo conferir antes de certificar o trânsito em julgado?",
  },
  {
    icon: Search,
    titulo: "Consulta ao acervo",
    texto: "Procure no acervo o processo 8000000-00.2026.8.05.0067.",
  },
];


type MensagemVisual = MensagemAssistente & {
  id: string;
  hora: number;
  anexos?: string[];
};

type EnvioPendente = {
  mensagens: MensagemAssistente[];
  arquivos: ArquivoAssistente[];
  conversaId: string;
  respostaId: string;
};

type RespostaNaoSalva = {
  id: string;
  conversaId: string;
  conteudo: string;
};

function arquivosParaEnvio(arquivos: ArquivoExtraido[]): ArquivoAssistente[] {
  return arquivos.map((arquivo) => ({
    nome: arquivo.nome,
    tipo: arquivo.tipo,
    texto: arquivo.texto,
    ...(arquivo.paginas !== undefined ? { paginas: arquivo.paginas } : {}),
    ...(arquivo.truncado !== undefined ? { truncado: arquivo.truncado } : {}),
  }));
}

function horaDaMensagem(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function AssistenteChat() {
  const sessao = useSessao();
  const [mensagens, setMensagens] = useState<MensagemVisual[]>([]);
  const [conversas, setConversas] = useState<ConversaAssistente[]>([]);
  const [conversaAtual, setConversaAtual] = useState<string | null>(null);
  const [carregandoHistorico, setCarregandoHistorico] = useState(true);
  const [erroHistorico, setErroHistorico] = useState("");
  const [alterandoHistorico, setAlterandoHistorico] = useState(false);
  const [buscaChats, setBuscaChats] = useState("");
  const [texto, setTexto] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [arquivos, setArquivos] = useState<ArquivoExtraido[]>([]);
  const [lendoArquivo, setLendoArquivo] = useState(false);
  const [erro, setErro] = useState("");
  const [arrastando, setArrastando] = useState(false);
  const [mostrarFim, setMostrarFim] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const arquivoRef = useRef<HTMLInputElement>(null);
  const autoScrollRef = useRef(true);
  const ocupadoRef = useRef(false);
  const conversaAtualRef = useRef<string | null>(null);
  const cargaRef = useRef(0);
  const ultimoEnvioRef = useRef<EnvioPendente | null>(null);
  const respostaNaoSalvaRef = useRef<RespostaNaoSalva | null>(null);

  const chaveSessao = "vara-crime-assistente:chat:" + sessao.id;

  useEffect(() => {
    let ativo = true;
    const numeroCarga = ++cargaRef.current;
    async function iniciar() {
      setCarregandoHistorico(true);
      setErroHistorico("");
      try {
        const lista = await listarConversasAssistente(sessao.id);
        const lembrado = window.sessionStorage.getItem(chaveSessao);
        const escolhido = lista.find((item) => item.id === lembrado) ?? lista[0];
        const historico = escolhido
          ? await listarMensagensAssistente(escolhido.id, sessao.id)
          : [];
        if (!ativo || numeroCarga !== cargaRef.current) return;
        setConversas(lista);
        setConversaAtual(escolhido?.id ?? null);
        conversaAtualRef.current = escolhido?.id ?? null;
        setMensagens(historico.map(visualizarMensagemSalva));
        setArquivos([]);
        setErro("");
        ultimoEnvioRef.current = null;
        respostaNaoSalvaRef.current = null;
        if (escolhido) window.sessionStorage.setItem(chaveSessao, escolhido.id);
        else window.sessionStorage.removeItem(chaveSessao);
      } catch (e) {
        if (ativo && numeroCarga === cargaRef.current) {
          setErroHistorico(e instanceof Error ? e.message : "Falha ao carregar o histórico.");
        }
      } finally {
        if (ativo && numeroCarga === cargaRef.current) setCarregandoHistorico(false);
      }
    }
    void iniciar();
    return () => { ativo = false; ++cargaRef.current; };
  }, [sessao.id, chaveSessao]);

  const atualizarLista = async () => {
    const lista = await listarConversasAssistente(sessao.id);
    setConversas(lista);
  };

  const selecionarConversa = async (id: string) => {
    if (ocupadoRef.current || lendoArquivo || carregandoHistorico || alterandoHistorico || id === conversaAtualRef.current) return;
    const numeroCarga = ++cargaRef.current;
    setCarregandoHistorico(true);
    setErroHistorico("");
    try {
      const historico = await listarMensagensAssistente(id, sessao.id);
      if (numeroCarga !== cargaRef.current) return;
      setConversaAtual(id);
      conversaAtualRef.current = id;
      window.sessionStorage.setItem(chaveSessao, id);
      setMensagens(historico.map(visualizarMensagemSalva));
      setTexto("");
      setArquivos([]);
      setErro("");
      respostaNaoSalvaRef.current = null;
      ultimoEnvioRef.current = null;
      autoScrollRef.current = true;
    } catch (e) {
      if (numeroCarga === cargaRef.current) {
        setErroHistorico(e instanceof Error ? e.message : "Não foi possível abrir a conversa.");
      }
    } finally {
      if (numeroCarga === cargaRef.current) setCarregandoHistorico(false);
    }
  };

  const novaConversa = () => {
    if (ocupadoRef.current || lendoArquivo || carregandoHistorico || alterandoHistorico) return;
    ++cargaRef.current;
    setConversaAtual(null);
    conversaAtualRef.current = null;
    window.sessionStorage.removeItem(chaveSessao);
    setMensagens([]);
    setTexto("");
    setArquivos([]);
    setErro("");
    setErroHistorico("");
    setMostrarFim(false);
    ultimoEnvioRef.current = null;
    respostaNaoSalvaRef.current = null;
    autoScrollRef.current = true;
    editorRef.current?.focus();
  };

  const renomear = async (conversa: ConversaAssistente) => {
    if (ocupadoRef.current || carregandoHistorico || alterandoHistorico) return;
    const titulo = window.prompt("Novo título desta conversa:", conversa.titulo);
    if (titulo === null || !titulo.trim() || titulo.trim() === conversa.titulo) return;
    setAlterandoHistorico(true);
    try {
      await renomearConversaAssistente(conversa.id, sessao.id, titulo);
      await atualizarLista();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível renomear.");
    } finally {
      setAlterandoHistorico(false);
    }
  };

  const excluir = async (conversa: ConversaAssistente) => {
    if (ocupadoRef.current || carregandoHistorico || alterandoHistorico) return;
    if (!window.confirm('Excluir definitivamente a conversa "' + conversa.titulo + '" e todas as mensagens?')) return;
    setAlterandoHistorico(true);
    try {
      await excluirConversaAssistente(conversa.id, sessao.id);
      const lista = await listarConversasAssistente(sessao.id);
      setConversas(lista);
      if (conversaAtualRef.current === conversa.id) {
        const proxima = lista[0];
        if (proxima) {
          const historico = await listarMensagensAssistente(proxima.id, sessao.id);
          setConversaAtual(proxima.id);
          conversaAtualRef.current = proxima.id;
          window.sessionStorage.setItem(chaveSessao, proxima.id);
          setMensagens(historico.map(visualizarMensagemSalva));
        } else {
          setConversaAtual(null);
          conversaAtualRef.current = null;
          window.sessionStorage.removeItem(chaveSessao);
          setMensagens([]);
        }
        setTexto("");
        setArquivos([]);
        setErro("");
        ultimoEnvioRef.current = null;
        respostaNaoSalvaRef.current = null;
      }
      toast.success("Conversa excluída.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível excluir a conversa.");
    } finally {
      setAlterandoHistorico(false);
    }
  };

  const responder = async (pedido: EnvioPendente) => {
    const resposta = await perguntarAoAssistente(pedido.mensagens, pedido.arquivos, {
      conversaId: pedido.conversaId,
      respostaId: pedido.respostaId,
    });
    setMensagens((atual) => [
      ...atual,
      { id: pedido.respostaId, role: "assistant", content: resposta.resposta, hora: Date.now() },
    ]);
    ultimoEnvioRef.current = null;
    if (resposta.persistida) {
      void atualizarLista().catch(() => {});
    } else {
      respostaNaoSalvaRef.current = {
        id: pedido.respostaId,
        conversaId: pedido.conversaId,
        conteudo: resposta.resposta,
      };
      setErro("A resposta foi exibida, mas não foi salva no histórico. Use «Tentar salvar» antes de sair.");
    }
  };

  const enviar = (conteudo = texto) => {
    if (ocupadoRef.current || lendoArquivo || carregandoHistorico || erroHistorico || alterandoHistorico) return;
    const pergunta = conteudo.trim();
    if (!pergunta && !arquivos.length) return;
    ocupadoRef.current = true;
    setCarregando(true);
    setErro("");
    const anexos = arquivos.slice();
    const conteudoFinal = pergunta || "Analise os arquivos anexados, destacando os pontos relevantes e as páginas de origem.";

    void (async () => {
      try {
        let id = conversaAtualRef.current;
        if (!id) {
          const titulo = pergunta || ("Análise de " + (anexos[0]?.nome ?? "documento"));
          const criada = await criarConversaAssistente(sessao.id, titulo);
          id = criada.id;
          conversaAtualRef.current = id;
          setConversaAtual(id);
          setConversas((atual) => [criada, ...atual]);
          window.sessionStorage.setItem(chaveSessao, id);
        }
        const nova: MensagemVisual = {
          id: crypto.randomUUID(),
          role: "user",
          content: conteudoFinal,
          hora: Date.now(),
          ...(anexos.length ? { anexos: anexos.map((a) => a.nome) } : {}),
        };
        await salvarMensagemUsuario({
          id: nova.id, conversaId: id, usuarioId: sessao.id,
          conteudo: nova.content, anexos: nova.anexos ?? [],
        });
        const proxima = [...mensagens, nova];
        setMensagens(proxima);
        setTexto("");
        autoScrollRef.current = true;
        const pedido: EnvioPendente = {
          conversaId: id,
          respostaId: crypto.randomUUID(),
          mensagens: proxima.map(({ role, content }) => ({ role, content })).slice(-20),
          arquivos: arquivosParaEnvio(anexos),
        };
        ultimoEnvioRef.current = pedido;
        void atualizarLista().catch(() => {});
        await responder(pedido);
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Não foi possível receber a resposta.");
      } finally {
        ocupadoRef.current = false;
        setCarregando(false);
      }
    })();
  };

  const tentarNovamente = () => {
    if (ocupadoRef.current || carregandoHistorico) return;
    const respostaPendente = respostaNaoSalvaRef.current;
    const pedido = ultimoEnvioRef.current;
    if (!respostaPendente && !pedido) return;

    ocupadoRef.current = true;
    setCarregando(true);
    setErro("");
    void (async () => {
      try {
        if (respostaPendente) {
          await salvarRespostaAssistenteLocal({
            id: respostaPendente.id,
            conversaId: respostaPendente.conversaId,
            usuarioId: sessao.id,
            conteudo: respostaPendente.conteudo,
          });
          respostaNaoSalvaRef.current = null;
          toast.success("Resposta salva no histórico.");
          void atualizarLista().catch(() => {});
        } else if (pedido) {
          await responder(pedido);
        }
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Não foi possível concluir a tentativa.");
      } finally {
        ocupadoRef.current = false;
        setCarregando(false);
      }
    })();
  };

  const anexar = async (lista: FileList | null) => {
    if (!lista?.length || ocupadoRef.current || lendoArquivo || carregandoHistorico) return;
    const disponiveis = 2 - arquivos.length;
    if (disponiveis <= 0) {
      toast.error("É possível manter até 2 arquivos anexados.");
      return;
    }

    setLendoArquivo(true);
    try {
      const novos: ArquivoExtraido[] = [];
      for (const file of Array.from(lista).slice(0, disponiveis)) {
        try {
          const extraido = await extrairArquivoTexto(file);
          novos.push(extraido);
          if (extraido.truncado) toast.warning(file.name + ": leitura parcial. Confira o limite antes de uma análise conclusiva.");
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Não foi possível ler " + file.name);
        }
      }
      if (novos.length) {
        setArquivos((atual) => [...atual, ...novos].slice(0, 2));
        toast.success(novos.length === 1 ? "Arquivo pronto para análise." : "Arquivos prontos para análise.");
      }
    } finally {
      setLendoArquivo(false);
      setArrastando(false);
      if (arquivoRef.current) arquivoRef.current.value = "";
    }
  };

  const copiar = async (conteudo: string) => {
    try {
      await navigator.clipboard.writeText(conteudo);
      toast.success("Mensagem copiada.");
    } catch {
      toast.error("Não foi possível copiar a mensagem.");
    }
  };

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.style.height = "auto";
    editor.style.height = Math.min(editor.scrollHeight, 180) + "px";
  }, [texto]);

  useEffect(() => {
    const scroll = scrollRef.current;
    if (scroll && autoScrollRef.current) scroll.scrollTop = scroll.scrollHeight;
  }, [mensagens, carregando, erro]);

  const atualizarPosicao = () => {
    const scroll = scrollRef.current;
    if (!scroll) return;
    const pertoDoFim = scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 120;
    autoScrollRef.current = pertoDoFim;
    setMostrarFim(!pertoDoFim);
  };

  const irParaFim = () => {
    const scroll = scrollRef.current;
    if (scroll) scroll.scrollTo({ top: scroll.scrollHeight, behavior: "smooth" });
    autoScrollRef.current = true;
    setMostrarFim(false);
  };

  const podeEnviar =
    (texto.trim().length > 0 || arquivos.length > 0) &&
    !carregando && !lendoArquivo && !carregandoHistorico &&
    !erroHistorico && !alterandoHistorico;
  const podeNovaConversa = !carregando && !lendoArquivo && !carregandoHistorico && !alterandoHistorico;
  const filtradas = conversas.filter((conversa) =>
    conversa.titulo.toLocaleLowerCase("pt-BR").includes(buscaChats.trim().toLocaleLowerCase("pt-BR")),
  );

  return (
    <section className="flex h-[calc(100dvh-13rem)] min-h-[540px] max-h-[960px] flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm" aria-label="Conversa com o Assistente da Vara">
      <header className="flex items-center justify-between gap-3 border-b border-border/70 bg-card px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Sparkles className="size-5" strokeWidth={1.8} />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">Assistente da Vara</h2>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              GPT via Lovable AI · consultas e leitura de documentos
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={novaConversa}
          disabled={!podeNovaConversa}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
          title="Iniciar uma nova conversa"
        >
          <MessageSquarePlus className="size-4" />
          <span className="hidden sm:inline">Nova conversa</span>
        </button>
      </header>

      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          onScroll={atualizarPosicao}
          className="h-full overflow-y-auto overscroll-contain bg-muted/[0.10] px-4 py-5 sm:px-6 sm:py-6"
          role="log"
          aria-label="Histórico da conversa"
          aria-live="polite"
          aria-relevant="additions"
        >
          {mensagens.length === 0 ? (
            <div className="mx-auto flex min-h-full max-w-3xl flex-col justify-center py-6">
              <div className="mx-auto max-w-xl text-center">
                <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Bot className="size-6" />
                </span>
                <h3 className="mt-4 text-xl font-semibold tracking-tight">Como posso ajudar?</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Consulte o acervo, peça uma minuta ou anexe um documento para análise. As respostas exigem revisão antes do uso oficial.
                </p>
              </div>
              <div className="mt-7 grid gap-2.5 sm:grid-cols-2">
                {SUGESTOES.map(({ icon: Icone, titulo, texto: sugestao }) => (
                  <button
                    key={titulo}
                    type="button"
                    onClick={() => enviar(sugestao)}
                    disabled={carregando || lendoArquivo}
                    className="group flex items-start gap-3 rounded-xl border border-border/70 bg-background p-3.5 text-left transition-colors hover:border-primary/30 hover:bg-primary/[0.025] disabled:opacity-50"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground group-hover:text-primary">
                      <Icone className="size-4" />
                    </span>
                    <span>
                      <span className="block text-sm font-medium">{titulo}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">{sugestao}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-4xl space-y-6">
              {mensagens.map((mensagem) => (
                <article key={mensagem.id} className={cn("flex gap-3", mensagem.role === "user" ? "justify-end" : "justify-start")}>
                  {mensagem.role === "assistant" && (
                    <span className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Bot className="size-4" />
                    </span>
                  )}
                  <div className={cn("min-w-0", mensagem.role === "user" ? "max-w-[88%] sm:max-w-[78%]" : "max-w-[calc(100%-2.75rem)] flex-1")}>
                    <div className={cn("mb-1.5 flex items-center gap-2 text-[11px] text-muted-foreground", mensagem.role === "user" && "justify-end")}>
                      <span className="font-medium text-foreground/80">{mensagem.role === "user" ? "Você" : "Assistente"}</span>
                      <time dateTime={new Date(mensagem.hora).toISOString()}>{horaDaMensagem(mensagem.hora)}</time>
                    </div>
                    <div className={cn(
                      "min-w-0 break-words text-sm leading-6",
                      mensagem.role === "user"
                        ? "rounded-2xl rounded-tr-md bg-primary px-4 py-3 text-primary-foreground"
                        : "rounded-2xl rounded-tl-md border border-border/70 bg-background px-4 py-3.5 shadow-sm",
                    )}>
                      <MarkdownResposta texto={mensagem.content} />
                      {mensagem.anexos?.length ? (
                        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-current/15 pt-2.5">
                          {mensagem.anexos.map((nome) => (
                            <span key={nome} className="inline-flex max-w-full items-center gap-1 rounded-md border border-current/20 px-2 py-1 text-xs">
                              <FileText className="size-3 shrink-0" />
                              <span className="truncate">{nome}</span>
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div className={cn("mt-1 flex items-center gap-2", mensagem.role === "user" && "justify-end")}>
                      <button
                        type="button"
                        onClick={() => void copiar(mensagem.content)}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label={mensagem.role === "user" ? "Copiar sua mensagem" : "Copiar resposta"}
                      >
                        <Copy className="size-3" /> Copiar
                      </button>
                    </div>
                  </div>
                  {mensagem.role === "user" && (
                    <span className="mt-1 hidden size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground sm:flex">
                      <User className="size-4" />
                    </span>
                  )}
                </article>
              ))}
              {carregando ? (
                <div className="flex items-start gap-3" role="status">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Bot className="size-4" />
                  </span>
                  <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-background px-3.5 py-3 text-xs text-muted-foreground">
                    <Loader2 className="size-4 animate-spin text-primary" />
                    Consultando o assistente…
                  </div>
                </div>
              ) : null}
              {erro ? (
                <div className="ml-11 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/20 bg-background px-3.5 py-3 text-xs" role="alert">
                  <span className="flex items-start gap-2 text-destructive">
                    <AlertCircle className="size-4 shrink-0" />
                    <span>{erro}</span>
                  </span>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 font-medium hover:bg-muted"
                    onClick={tentarNovamente}
                    disabled={carregando || !ultimoEnvioRef.current}
                  >
                    <RotateCcw className="size-3.5" /> Tentar novamente
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </div>
        {mostrarFim && mensagens.length > 0 ? (
          <button
            type="button"
            onClick={irParaFim}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium shadow-md hover:bg-muted"
          >
            <ArrowDown className="size-3.5" /> Últimas mensagens
          </button>
        ) : null}
      </div>

      <div
        className={cn("relative shrink-0 border-t border-border/70 bg-card px-3 pb-3 pt-3 sm:px-5", arrastando && "bg-primary/[0.05]")}
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes("Files")) {
            event.preventDefault();
            setArrastando(true);
          }
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node)) setArrastando(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setArrastando(false);
          void anexar(event.dataTransfer.files);
        }}
      >
        {arrastando ? (
          <div className="pointer-events-none absolute inset-1 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-primary bg-background/95 text-sm font-medium text-primary">
            Solte aqui para anexar o arquivo
          </div>
        ) : null}

        <div className="mx-auto max-w-4xl">
          {arquivos.length > 0 ? (
            <div className="mb-2.5 space-y-1.5">
              <div className="flex flex-wrap gap-2">
                {arquivos.map((arquivo) => (
                  <span key={arquivo.id} className="inline-flex max-w-full items-center gap-2 rounded-lg border border-border bg-muted/40 px-2.5 py-1.5 text-xs">
                    <FileText className="size-3.5 shrink-0 text-primary" />
                    <span className="max-w-48 truncate" title={arquivo.nome}>{arquivo.nome}</span>
                    {arquivo.paginas ? <span className="whitespace-nowrap text-muted-foreground">{arquivo.paginas} pág.</span> : null}
                    {arquivo.truncado ? <span className="font-medium text-amber-600">Parcial</span> : null}
                    <button
                      type="button"
                      aria-label={"Remover " + arquivo.nome}
                      className="rounded p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
                      disabled={carregando || lendoArquivo}
                      onClick={() => setArquivos((atual) => atual.filter((a) => a.id !== arquivo.id))}
                    >
                      <X className="size-3.5" />
                    </button>
                  </span>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Anexos ativos nesta conversa: o texto será reenviado ao modelo em cada nova pergunta enquanto permanecerem aqui.
              </p>
            </div>
          ) : null}

          <form
            onSubmit={(event) => { event.preventDefault(); enviar(); }}
            className="flex items-end gap-2 rounded-2xl border border-input bg-background p-1.5 shadow-sm transition-colors focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10"
          >
            <input
              ref={arquivoRef}
              type="file"
              accept=".pdf,.txt,.md,.csv,application/pdf,text/plain,text/markdown,text/csv"
              multiple
              className="sr-only"
              tabIndex={-1}
              onChange={(event) => void anexar(event.target.files)}
              aria-label="Selecionar arquivos"
            />
            <button
              type="button"
              onClick={() => arquivoRef.current?.click()}
              disabled={carregando || lendoArquivo || arquivos.length >= 2}
              aria-label="Anexar PDF ou arquivo de texto"
              title="Anexar PDF, TXT, MD ou CSV"
              className="mb-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
              {lendoArquivo ? <Loader2 className="size-4 animate-spin" /> : <Paperclip className="size-4" />}
            </button>
            <textarea
              ref={editorRef}
              value={texto}
              onChange={(event) => setTexto(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  enviar();
                }
              }}
              maxLength={20_000}
              rows={1}
              placeholder="Digite sua mensagem ou anexe os autos para análise…"
              aria-label="Mensagem para o Assistente"
              disabled={carregando || lendoArquivo}
              className="max-h-[180px] min-h-10 flex-1 resize-none overflow-y-auto bg-transparent px-1 py-2.5 text-sm leading-5 outline-none placeholder:text-muted-foreground"
            />
            <button
              type="submit"
              disabled={!podeEnviar}
              aria-label="Enviar mensagem"
              title="Enviar"
              className="mb-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-colors hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send className="size-4" />
            </button>
          </form>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] text-muted-foreground">
            <span>Enter envia · Shift + Enter quebra linha · arraste PDFs para anexar</span>
            <span>{texto.length > 18_000 ? texto.length.toLocaleString("pt-BR") + "/20.000" : "Revisão humana necessária"}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
