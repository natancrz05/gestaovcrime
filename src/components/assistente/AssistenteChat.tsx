import { useEffect, useRef, useState } from "react";
import { Bot, CheckCircle2, Copy, FileText, Gavel, Loader2, Search, Send, ShieldCheck, Sparkles, User } from "lucide-react";
import { toast } from "sonner";
import { perguntarAoAssistente, type MensagemAssistente } from "@/lib/assistente";
import { cn } from "@/lib/utils";

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

export function AssistenteChat() {
  const [mensagens, setMensagens] = useState<MensagemAssistente[]>([]);
  const [texto, setTexto] = useState("");
  const [carregando, setCarregando] = useState(false);
  const fimRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens, carregando]);

  const enviar = async (conteudo = texto) => {
    const pergunta = conteudo.trim();
    if (!pergunta || carregando) return;

    const proxima = [...mensagens, { role: "user" as const, content: pergunta }];
    setMensagens(proxima);
    setTexto("");
    setCarregando(true);

    try {
      const resposta = await perguntarAoAssistente(proxima);
      setMensagens((atual) => [...atual, { role: "assistant", content: resposta.resposta }]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao consultar o assistente.");
    } finally {
      setCarregando(false);
    }
  };

  const copiar = async (texto: string) => {
    await navigator.clipboard.writeText(texto);
    toast.success("Texto copiado.");
  };

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
      <div className="border-b border-border/80 bg-gradient-to-r from-card via-card to-muted/20 px-5 py-4 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3.5">
            <span className="relative flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/20">
              <Sparkles className="size-5" strokeWidth={1.8} />
              <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-card bg-emerald-500" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-semibold tracking-tight">Assistente da Vara</h2>
                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background/80 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  <ShieldCheck className="size-3" /> Uso interno
                </span>
              </div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                Apoio à redação, consulta e organização das atividades da serventia.
              </p>
            </div>
          </div>
          <div className="hidden items-center gap-1.5 text-[11px] text-muted-foreground sm:flex">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            Disponível
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-muted/[0.14] p-4 sm:p-6">
        {mensagens.length === 0 ? (
          <div className="mx-auto max-w-4xl py-4 sm:py-8">
            <div className="rounded-2xl border border-border/80 bg-background/90 p-6 shadow-sm sm:p-8">
              <div className="mx-auto max-w-2xl text-center">
                <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/10">
                  <Bot className="size-7" strokeWidth={1.5} />
                </div>
                <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
                  Apoio inteligente à serventia
                </p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                  Como posso ajudar hoje?
                </h3>
                <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                  Escreva uma pergunta, cole uma minuta ou peça uma consulta. O assistente pode
                  ajudar com redação, explicações e buscas controladas no acervo.
                </p>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {SUGESTOES.map(({ icon: Icone, titulo, texto: sugestao }) => (
                  <button
                    key={sugestao}
                    type="button"
                    onClick={() => void enviar(sugestao)}
                    className="group rounded-xl border border-border/80 bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:bg-primary/[0.025] hover:shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                        <Icone className="size-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{titulo}</span>
                        <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                          {sugestao}
                        </span>
                      </span>
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-6 flex flex-col gap-3 rounded-xl border border-border/70 bg-muted/30 px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-2">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span>Use o assistente como apoio. Revise o conteúdo antes de utilizá-lo em atividade oficial.</span>
                </div>
                <span className="shrink-0 font-medium text-foreground/70">Revisão humana necessária</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-4xl space-y-6">
            {mensagens.map((m, i) => (
              <div key={i} className={cn("flex gap-3", m.role === "user" ? "justify-end" : "justify-start")}>
                {m.role === "assistant" && (
                  <span className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                    <Bot className="size-4" />
                  </span>
                )}
                <div className={cn(
                  "max-w-[88%] rounded-2xl px-4 py-3.5 text-sm leading-6 shadow-sm",
                  m.role === "user"
                    ? "rounded-br-md bg-primary text-primary-foreground"
                    : "rounded-bl-md border border-border/80 bg-background",
                )}>
                  <div className="whitespace-pre-wrap">{m.content}</div>
                  {m.role === "assistant" && (
                    <button
                      type="button"
                      className="mt-3 inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      onClick={() => void copiar(m.content)}
                    >
                      <Copy className="size-3" /> Copiar resposta
                    </button>
                  )}
                </div>
                {m.role === "user" && (
                  <span className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                    <User className="size-4" />
                  </span>
                )}
              </div>
            ))}
            {carregando && (
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                  <Bot className="size-4" />
                </span>
                <span className="flex items-center gap-2 rounded-xl border border-border/70 bg-background px-3 py-2.5 shadow-sm">
                  <Loader2 className="size-4 animate-spin text-primary" /> Consultando o assistente…
                </span>
              </div>
            )}
            <div ref={fimRef} />
          </div>
        )}
      </div>

      <div className="border-t border-border/80 bg-card p-4 sm:p-5">
        <form
          className="mx-auto flex max-w-4xl items-end gap-2 rounded-2xl border border-input bg-background p-1.5 shadow-sm transition-shadow focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10"
          onSubmit={(e) => { e.preventDefault(); void enviar(); }}
        >
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void enviar();
              }
            }}
            placeholder="Digite sua pergunta ou cole a minuta que deseja melhorar…"
            rows={2}
            className="min-h-12 flex-1 resize-none bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground"
            disabled={carregando}
          />
          <button
            type="submit"
            disabled={!texto.trim() || carregando}
            aria-label="Enviar mensagem"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm transition-all hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send className="size-4" />
          </button>
        </form>
        <div className="mx-auto mt-2 flex max-w-4xl items-center justify-between gap-3 px-1 text-[11px] text-muted-foreground">
          <span>Enter envia · Shift + Enter cria nova linha</span>
          <span className="hidden sm:inline">Ferramenta de apoio interno</span>
        </div>
      </div>
    </div>
  );
}
