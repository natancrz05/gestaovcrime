/**
 * Perfis e permissões. A interface usa estas regras para mostrar/ocultar ações;
 * o banco de dados aplica as mesmas regras (políticas de acesso), então uma ação
 * sem permissão é recusada mesmo que alguém tente executá-la diretamente.
 */
export type Perfil = "administrador" | "servidor" | "consulta";

export const PERFIS: { valor: Perfil; rotulo: string; descricao: string }[] = [
  { valor: "administrador", rotulo: "Administrador", descricao: "Acesso total, inclusive gestão de usuários" },
  { valor: "servidor", rotulo: "Servidor", descricao: "Cadastra e edita informações administrativas" },
  { valor: "consulta", rotulo: "Consulta", descricao: "Somente visualização" },
];

export const rotuloPerfil = (p: Perfil | null | undefined) => PERFIS.find((x) => x.valor === p)?.rotulo ?? "—";

export type Acao =
  | "editar" // cadastrar/editar processos, movimentações, audiências, pendências, prioridades
  | "excluir-processo"
  | "gerenciar-usuarios"
  | "relatorios"\n  | "usar-assistente";

const MATRIZ: Record<Perfil, Acao[]> = {
  administrador: ["editar", "excluir-processo", "gerenciar-usuarios", "relatorios", "usar-assistente"],
  servidor: ["editar", "relatorios", "usar-assistente"],
  consulta: [],
};

export function pode(perfil: Perfil | null | undefined, acao: Acao) {
  return !!perfil && MATRIZ[perfil].includes(acao);
}
