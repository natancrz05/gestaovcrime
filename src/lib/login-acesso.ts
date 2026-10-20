export type EstadoCadastroLogin = "pendente" | "aprovado" | "recusado";

export type UsuarioLogin = {
  status_cadastro: EstadoCadastroLogin | string;
  ativo: boolean;
  troca_senha_obrigatoria: boolean;
};

export type DecisaoLogin =
  | "pendente"
  | "recusado"
  | "inativo"
  | "trocar_senha"
  | "liberado";

export function decidirAcessoAposLogin(usuario: UsuarioLogin | null | undefined): DecisaoLogin {
  if (!usuario) return "inativo";
  if (usuario.status_cadastro === "pendente") return "pendente";
  if (usuario.status_cadastro === "recusado") return "recusado";
  if (!usuario.ativo) return "inativo";
  if (usuario.troca_senha_obrigatoria) return "trocar_senha";
  return "liberado";
}
