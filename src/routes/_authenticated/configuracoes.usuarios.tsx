import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowLeft, Plus } from "lucide-react";
import { Cabecalho } from "@/components/ui-serventia/Cabecalho";
import { CLASSE_CAMPO, Campo } from "@/components/processos/campos";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PERFIS, pode, rotuloPerfil, type Perfil } from "@/lib/permissoes";
import { atualizarUsuario, criarUsuario, excluirUsuario, listarUsuarios } from "@/lib/usuarios.functions";
import { useSessao } from "@/lib/sessao";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/configuracoes/usuarios")({
  beforeLoad: ({ context }) => {
    if (!pode(context.sessao.perfil, "gerenciar-usuarios")) throw redirect({ to: "/" });
  },
  head: () => ({
    meta: [
      { title: "Usuários — Gestão da Vara Criminal" },
      { name: "description", content: "Cadastro de usuários e perfis de acesso da serventia." },
      { property: "og:title", content: "Usuários — Gestão da Vara Criminal" },
      { property: "og:description", content: "Cadastro de usuários e perfis de acesso da serventia." },
    ],
  }),
  component: Pagina,
});

const BOTAO = "inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60";
const BOTAO_SEC = "inline-flex h-8 items-center rounded-md border border-border bg-background px-3 text-xs font-medium hover:bg-muted disabled:opacity-50";

interface Edicao { id?: string; nome: string; email: string; senha: string; perfil: Perfil; ativo: boolean }

function Pagina() {
  const eu = useSessao();
  const listar = useServerFn(listarUsuarios);
  const criar = useServerFn(criarUsuario);
  const atualizar = useServerFn(atualizarUsuario);
  const excluir = useServerFn(excluirUsuario);
  const [excluindo, setExcluindo] = useState<{ id: string; nome: string } | null>(null);
  const qc = useQueryClient();
  const { data: usuarios = [], isLoading, error } = useQuery({ queryKey: ["usuarios"], queryFn: () => listar() });
  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const recarregar = () => qc.invalidateQueries({ queryKey: ["usuarios"] });

  async function alternar(u: (typeof usuarios)[number]) {
    setErro("");
    try {
      await atualizar({ data: { id: u.id, nome: u.nome, perfil: u.perfil ?? "consulta", ativo: !u.ativo } });
      await recarregar();
    } catch (e) { setErro((e as Error).message); }
  }

  async function salvar(ev: React.FormEvent) {
    ev.preventDefault();
    if (!edicao) return;
    setSalvando(true);
    setErro("");
    try {
      if (edicao.id) await atualizar({ data: { id: edicao.id, nome: edicao.nome, perfil: edicao.perfil, ativo: edicao.ativo } });
      else await criar({ data: { nome: edicao.nome, email: edicao.email, senha: edicao.senha, perfil: edicao.perfil } });
      await recarregar();
      setEdicao(null);
    } catch (e) { setErro((e as Error).message); } finally { setSalvando(false); }
  }

  return (
    <div className="space-y-6">
      <Link to="/configuracoes" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Configurações</Link>
      <Cabecalho
        titulo="Usuários"
        subtitulo="Cadastro de acessos e perfis. Somente o Administrador gerencia usuários."
        acao={<button className={BOTAO} onClick={() => { setErro(""); setEdicao({ nome: "", email: "", senha: "", perfil: "servidor", ativo: true }); }}><Plus className="size-4" /> Novo usuário</button>}
      />
      {erro && !edicao ? <p className="text-sm text-urgente">{erro}</p> : null}
      {error ? <p className="text-sm text-urgente">{(error as Error).message}</p> : null}
      <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
            <tr><th className="px-4 py-2.5 font-medium">Nome</th><th className="px-4 py-2.5 font-medium">E-mail</th><th className="px-4 py-2.5 font-medium">Perfil</th><th className="px-4 py-2.5 font-medium">Status</th><th className="px-4 py-2.5 font-medium">Criado em</th><th /></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">Carregando…</td></tr> : null}
            {usuarios.map((u) => (
              <tr key={u.id} className={cn(!u.ativo && "text-muted-foreground")}>
                <td className="px-4 py-2.5 font-medium">{u.nome}{u.id === eu.id ? <span className="ml-1 text-xs text-muted-foreground">(você)</span> : null}</td>
                <td className="px-4 py-2.5">{u.email}</td>
                <td className="px-4 py-2.5">{rotuloPerfil(u.perfil)}</td>
                <td className="px-4 py-2.5">
                  <span className={cn("inline-flex rounded border px-1.5 py-0.5 text-[11px] font-medium", u.ativo ? "border-concluido/30 bg-concluido-suave text-concluido" : "border-border bg-muted text-muted-foreground")}>{u.ativo ? "Ativo" : "Inativo"}</span>
                </td>
                <td className="px-4 py-2.5 tabular-nums">{new Date(u.criado_em).toLocaleDateString("pt-BR")}</td>
                <td className="px-4 py-2.5 text-right">
                  <div className="flex justify-end gap-1.5">
                    <button className={BOTAO_SEC} onClick={() => { setErro(""); setEdicao({ id: u.id, nome: u.nome, email: u.email, senha: "", perfil: u.perfil ?? "consulta", ativo: u.ativo }); }}>Editar</button>
                    <button className={BOTAO_SEC} disabled={u.id === eu.id} onClick={() => alternar(u)}>{u.ativo ? "Inativar" : "Ativar"}</button>
                    <button className={cn(BOTAO_SEC, "text-urgente")} disabled={u.id === eu.id} onClick={() => { setErro(""); setExcluindo({ id: u.id, nome: u.nome }); }}>Excluir</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!edicao} onOpenChange={(o) => !o && setEdicao(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edicao?.id ? "Editar usuário" : "Novo usuário"}</DialogTitle></DialogHeader>
          {edicao ? (
            <form className="space-y-3" onSubmit={salvar}>
              <Campo rotulo="Nome"><input required className={CLASSE_CAMPO} value={edicao.nome} onChange={(e) => setEdicao({ ...edicao, nome: e.target.value })} /></Campo>
              <Campo rotulo="E-mail"><input required type="email" disabled={!!edicao.id} className={CLASSE_CAMPO} value={edicao.email} onChange={(e) => setEdicao({ ...edicao, email: e.target.value })} /></Campo>
              {!edicao.id ? (
                <Campo rotulo="Senha inicial (mínimo 6 caracteres)"><input required minLength={6} maxLength={72} type="password" autoComplete="new-password" className={CLASSE_CAMPO} value={edicao.senha} onChange={(e) => setEdicao({ ...edicao, senha: e.target.value })} /></Campo>
              ) : null}
              <Campo rotulo="Perfil">
                <select className={CLASSE_CAMPO} value={edicao.perfil} onChange={(e) => setEdicao({ ...edicao, perfil: e.target.value as Perfil })}>
                  {PERFIS.map((p) => <option key={p.valor} value={p.valor}>{p.rotulo} — {p.descricao}</option>)}
                </select>
              </Campo>
              {edicao.id ? (
                <Campo rotulo="Status">
                  <select className={CLASSE_CAMPO} value={edicao.ativo ? "1" : "0"} onChange={(e) => setEdicao({ ...edicao, ativo: e.target.value === "1" })}>
                    <option value="1">Ativo</option><option value="0">Inativo</option>
                  </select>
                </Campo>
              ) : null}
              {erro ? <p className="text-sm text-urgente">{erro}</p> : null}
              <div className="flex justify-end gap-2">
                <button type="button" className={BOTAO_SEC} onClick={() => setEdicao(null)}>Cancelar</button>
                <button className={BOTAO} disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</button>
              </div>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!excluindo} onOpenChange={(o) => !o && setExcluindo(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Excluir o usuário {excluindo?.nome}?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">O acesso será removido definitivamente e o usuário deixará de aparecer na lista. Esta ação não pode ser desfeita. Se quiser apenas bloquear o acesso, use "Inativar".</p>
          {erro ? <p className="text-sm text-urgente">{erro}</p> : null}
          <div className="flex justify-end gap-2">
            <button type="button" className={BOTAO_SEC} onClick={() => setExcluindo(null)}>Cancelar</button>
            <button className={cn(BOTAO, "bg-urgente hover:bg-urgente/90")} disabled={salvando} onClick={async () => {
              if (!excluindo) return;
              setSalvando(true); setErro("");
              try { await excluir({ data: { id: excluindo.id } }); await recarregar(); setExcluindo(null); }
              catch (e) { setErro((e as Error).message); } finally { setSalvando(false); }
            }}>{salvando ? "Excluindo…" : "Excluir usuário"}</button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
