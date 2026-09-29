/** Campo único e reutilizável para pesquisar e selecionar um processo. */
import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { CLASSE_CAMPO } from "./campos";
import { processosSeletorQuery, type ProcessoParaSelecao } from "@/lib/processos/repositorio";
import { cn } from "@/lib/utils";

const LIMITE = 15;
const sem = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

interface Opcao { id: string; numero: string; digitos: string; nome: string; classe: string; texto: string }

function paraOpcao(p: ProcessoParaSelecao): Opcao {
  const nome = [...p.reus].sort((a, b) => a.ordem - b.ordem)[0]?.nome ?? p.pje_reu ?? p.partes[0]?.nome ?? "";
  const nomes = [nome, p.pje_reu ?? "", ...p.reus.map((r) => r.nome), ...p.partes.map((x) => x.nome)].join(" ");
  return { id: p.id, numero: p.numero, digitos: p.numero.replace(/\D/g, ""), nome, classe: p.classe, texto: sem(`${p.numero} ${nomes}`) };
}

export function SeletorProcesso({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const { data: processos = [] } = useQuery(processosSeletorQuery());
  const opcoes = useMemo(() => processos.map(paraOpcao), [processos]);
  const [termo, setTermo] = useState("");
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(0);
  const ref = useRef<HTMLInputElement>(null);
  const selecionado = opcoes.find((o) => o.id === value);

  const resultados = useMemo(() => {
    const t = sem(termo.trim());
    if (!t) return [];
    const dig = t.replace(/\D/g, "");
    const soNumero = /^[\d.\-\s]+$/.test(t);
    return opcoes.filter((o) => o.texto.includes(t) || (soNumero && dig.length > 0 && o.digitos.includes(dig))).slice(0, LIMITE);
  }, [termo, opcoes]);

  const escolher = (o: Opcao) => { onChange(o.id); setTermo(""); setAberto(false); };

  if (selecionado && !aberto) {
    return (
      <div className={cn(CLASSE_CAMPO, "flex items-center justify-between gap-2")}>
        <span className="min-w-0 truncate"><span className="numero-processo font-medium">{selecionado.numero}</span>{selecionado.nome ? ` · ${selecionado.nome}` : ""}</span>
        <button type="button" aria-label="Trocar processo" className="shrink-0 text-muted-foreground hover:text-foreground" onClick={() => { onChange(""); setAberto(true); setTimeout(() => ref.current?.focus(), 0); }}><X className="size-4" /></button>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        ref={ref}
        role="combobox"
        aria-expanded={aberto}
        className={CLASSE_CAMPO}
        placeholder="Pesquisar processo por número ou nome..."
        value={termo}
        onFocus={() => setAberto(true)}
        onBlur={() => setTimeout(() => setAberto(false), 150)}
        onChange={(e) => { setTermo(e.target.value); setAtivo(0); setAberto(true); }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setAtivo((a) => Math.min(a + 1, resultados.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setAtivo((a) => Math.max(a - 1, 0)); }
          else if (e.key === "Enter" && resultados[ativo]) { e.preventDefault(); escolher(resultados[ativo]); }
          else if (e.key === "Escape") setAberto(false);
        }}
      />
      {aberto ? (
        <ul role="listbox" className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-md border border-border bg-popover text-sm shadow-md">
          {!termo.trim() ? <li className="px-3 py-2 text-muted-foreground">Digite o número ou nome para pesquisar.</li>
            : resultados.length === 0 ? <li className="px-3 py-2 text-muted-foreground">Nenhum processo encontrado.</li>
            : resultados.map((o, i) => (
              <li key={o.id} role="option" aria-selected={i === ativo}>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); escolher(o); }} onMouseEnter={() => setAtivo(i)}
                  className={cn("block w-full px-3 py-1.5 text-left", i === ativo && "bg-muted")}>
                  <span className="numero-processo font-medium">{o.numero}</span>
                  <span className="block truncate text-xs text-muted-foreground">{[o.nome, o.classe].filter(Boolean).join(" · ") || "—"}</span>
                </button>
              </li>
            ))}
          {resultados.length === LIMITE ? <li className="px-3 py-1.5 text-xs text-muted-foreground">Mostrando os primeiros {LIMITE}. Refine a pesquisa.</li> : null}
        </ul>
      ) : null}
    </div>
  );
}
