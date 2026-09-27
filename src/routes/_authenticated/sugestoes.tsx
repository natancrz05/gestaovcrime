import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSessao } from "@/lib/sessao";
import { Cabecalho } from "@/components/ui-serventia/Cabecalho";
import { CLASSE_CAMPO } from "@/components/processos/campos";
import { BOTAO, BOTAO_SEC } from "@/components/processos/Pendencias";

export const Route = createFileRoute("/_authenticated/sugestoes")({
  head: () => ({
    meta: [
      { title: "Problemas e Sugestões — Gestão da Vara Criminal" },
      { name: "description", content: "Registro interno de problemas encontrados e sugestões de melhoria do sistema." },
      { property: "og:title", content: "Problemas e Sugestões — Gestão da Vara Criminal" },
      { property: "og:description", content: "Registro interno de problemas encontrados e sugestões de melhoria do sistema." },
    ],
  }),
  component: Pagina,
});

const STATUS = ["Não analisado", "Em análise", "Resolvido"] as const;
interface Nota { id: string; tipo: string; descricao: string; status: string; usuario_nome: string; criado_em: string }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tabela = () => (supabase as any).from("sugestoes");

function Pagina() {
  const sessao = useSessao();
  const admin = sessao.perfil === "administrador";
  const [tipo, setTipo] = useState("Problema");
  const [descricao, setDescricao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [notas, setNotas] = useState<Nota[]>([]);

  const carregar = async () => {
    if (!admin) return;
    const { data, error } = await tabela().select("*").order("criado_em", { ascending: false });
    if (error) toast.error("Erro ao carregar as notas.");
    else setNotas(data ?? []);
  };
  useEffect(() => { void carregar(); }, [admin]);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!descricao.trim()) return toast.error("Descreva o problema ou a sugestão.");
    setSalvando(true);
    const { error } = await tabela().insert({ tipo, descricao: descricao.trim().slice(0, 5000) });
    setSalvando(false);
    if (error) return toast.error("Não foi possível registrar a nota.");
    toast.success("Nota registrada. Obrigado!");
    setDescricao("");
    void carregar();
  };

  const mudarStatus = async (id: string, status: string) => {
    const { error } = await tabela().update({ status }).eq("id", id);
    if (error) return toast.error("Não foi possível alterar o status.");
    setNotas((n) => n.map((x) => (x.id === id ? { ...x, status } : x)));
  };
  const excluir = async (id: string) => {
    if (!confirm("Excluir esta nota? Esta ação não pode ser desfeita.")) return;
    const { error } = await tabela().delete().eq("id", id);
    if (error) return toast.error("Não foi possível excluir a nota.");
    setNotas((n) => n.filter((x) => x.id !== id));
  };

  return (
    <div className="space-y-6">
      <Cabecalho titulo="Problemas e Sugestões" descricao="Registre problemas encontrados no sistema ou sugira melhorias." />
      <form onSubmit={enviar} className="space-y-3 rounded-lg border bg-card p-5">
        <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
          <label className="text-sm font-medium">Tipo
            <select className={CLASSE_CAMPO} value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option>Problema</option><option>Sugestão</option>
            </select>
          </label>
          <label className="text-sm font-medium">Descrição
            <textarea className={CLASSE_CAMPO} rows={4} maxLength={5000} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </label>
        </div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">Registrado como {sessao.nome || sessao.email}; data e hora automáticas.</p>
          <button type="submit" className={BOTAO} disabled={salvando}>{salvando ? "Enviando…" : "Registrar nota"}</button>
        </div>
      </form>

      {admin && (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr><th className="p-3">Data/hora</th><th className="p-3">Tipo</th><th className="p-3">Descrição</th><th className="p-3">Usuário</th><th className="p-3">Status</th><th className="p-3" /></tr>
            </thead>
            <tbody>
              {notas.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Nenhuma nota registrada.</td></tr>}
              {notas.map((n) => (
                <tr key={n.id} className="border-t align-top">
                  <td className="whitespace-nowrap p-3">{new Date(n.criado_em).toLocaleString("pt-BR")}</td>
                  <td className="p-3">{n.tipo}</td>
                  <td className="whitespace-pre-wrap p-3">{n.descricao}</td>
                  <td className="p-3">{n.usuario_nome}</td>
                  <td className="p-3">
                    <select className={CLASSE_CAMPO} value={n.status} onChange={(e) => mudarStatus(n.id, e.target.value)}>
                      {STATUS.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="p-3"><button type="button" className={BOTAO_SEC} onClick={() => excluir(n.id)}>Excluir</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
