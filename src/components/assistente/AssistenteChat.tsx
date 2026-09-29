import { useEffect, useRef, useState } from "react";
import { Bot, Copy, Loader2, Send, Sparkles, User } from "lucide-react";
import { toast } from "sonner";
import { perguntarAoAssistente, type MensagemAssistente } from "@/lib/assistente";
import { cn } from "@/lib/utils";

const SUGESTOES = [
  "Melhore esta minuta de certidão: Certifico que, decorrido o prazo, não houve manifestação.",
  "Explique de forma prática o que significa matéria preliminar na resposta à acusação.",
  "Quais informações devo conferir antes de certificar o trânsito em julgado?",
  "Procure no acervo o processo 8000000-00.2026.8.05.0067.",
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
    <div className="flex min-h-[calc(100vh-9rem)] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-card">
      <div className="border-b border-border px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-lg bg-sidebar-accent ring-1 ring-sidebar-border">
            <Sparkles className="size-4 text-sidebar-accent-foreground" />
          </span>
          <div>
            <h2 className="font-semibold">Assistente da Vara</h2>
            <p className="text-xs text-muted-foreground">Redação, explicações e consulta controlada ao acervo.</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {mensagens.length === 0 ? (
          <div className="mx-auto max-w-3xl py-10">
            <div className="mb-8 text-center">
              <Bot className="mx-auto size-10 text-primary" strokeWidth={1.5} />
              <h3 className="mt-3 text-xl font-semibold">Como posso ajudar?</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Você pode pedir para melhorar uma minuta, explicar um tema, resumir um texto ou procurar informações no acervo.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {SUGESTOES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void enviar(s)}
                  className="rounded-lg border border-border p-3 text-left text-sm transition-colors hover:bg-muted/50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-4xl space-y-5">
            {mensagens.map((m, i) => (
              <div key={i} className={cn("flex gap-3", m.role === "user" ? "justify-end" : "justify-start")}>
                {m.role === "assistant" && (
                  <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Bot className="size-4" />
                  </span>
                )}
                <div className={cn(
                  "max-w-[85%] rounded-xl px-4 py-3 text-sm leading-6",
                  m.role === "user" ? "bg-primary text-primary-foreground" : "border border-border bg-background",
                )}>
                  <div className="whitespace-pre-wrap">{m.content}</div>
                  {m.role === "assistant" && (
                    <button
                      type="button"
                      className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => void copiar(m.content)}
                    >
                      <Copy className="size-3" /> Copiar
                    </button>
                  )}
                </div>
                {m.role === "user" && (
                  <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted">
                    <User className="size-4" />
                  </span>
                )}
              </div>
            ))}
            {carregando && (
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary"><Bot className="size-4" /></span>
                <span className="flex items-center gap-2"><Loader2 className="size-4 animate-spin" /> Consultando…</span>
              </div>
            )}
            <div ref={fimRef} />
          </div>
        )}
      </div>

      <div className="border-t border-border p-4">
        <form
          className="mx-auto flex max-w-4xl items-end gap-2"
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
            className="min-h-12 flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
            disabled={carregando}
          />
          <button
            type="submit"
            disabled={!texto.trim() || carregando}
            className="inline-flex h-12 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="size-4" /> Enviar
          </button>
        </form>
        <p className="mx-auto mt-2 max-w-4xl text-[11px] text-muted-foreground">
          O assistente é uma ferramenta de apoio. Revise o conteúdo antes de utilizar qualquer texto em atividade oficial.
        </p>
      </div>
    </div>
  );
}
