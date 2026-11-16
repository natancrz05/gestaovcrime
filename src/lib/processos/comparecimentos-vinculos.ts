/**
 * Uma pessoa pode cumprir comparecimento em diversos processos.
 * O identificador por CPF apenas agrega a VISUALIZAÇÃO; cada vínculo mantém
 * sua própria periodicidade, registros e histórico. Nunca unir por nome.
 */
export const SITUACAO_VINCULO_REMOVIDO = "Desvinculado";

export interface VinculoPessoa {
  id: string;
  cpf: string;
  processo_id: string | null;
  situacao: string;
}

export function cpfPessoa(cpf: string | null | undefined): string | null {
  const digitos = (cpf ?? "").replace(/\D/g, "");
  if (digitos.length !== 11 || /^(\d)\1{10}$/.test(digitos)) return null;
  // Evita unir pessoas por documento apenas aparentemente válido.
  const n = [...digitos].map(Number);
  for (let tamanho = 9; tamanho <= 10; tamanho++) {
    const valor = n.slice(0, tamanho).reduce((acc, digito, i) => acc + digito * (tamanho + 1 - i), 0);
    const verificador = (valor * 10) % 11;
    if (n[tamanho] !== (verificador === 10 ? 0 : verificador)) return null;
  }
  return digitos;
}

export function mesmoTitular(a: Pick<VinculoPessoa, "cpf">, b: Pick<VinculoPessoa, "cpf">): boolean {
  const cpfA = cpfPessoa(a.cpf);
  return cpfA !== null && cpfA === cpfPessoa(b.cpf);
}

export function vinculosDaPessoa<T extends VinculoPessoa>(cadastros: readonly T[], atual: T): T[] {
  if (!cpfPessoa(atual.cpf)) return [atual];
  return cadastros.filter((item) => mesmoTitular(atual, item));
}

export function agruparPessoas<T extends VinculoPessoa>(cadastros: readonly T[]): Array<{
  principal: T;
  vinculos: T[];
}> {
  const grupos = new Map<string, { principal: T; vinculos: T[] }>();
  for (const cadastro of cadastros) {
    const chave = cpfPessoa(cadastro.cpf) ? "cpf:" + cpfPessoa(cadastro.cpf) : "cadastro:" + cadastro.id;
    const grupo = grupos.get(chave);
    if (grupo) grupo.vinculos.push(cadastro);
    else grupos.set(chave, { principal: cadastro, vinculos: [cadastro] });
  }
  return [...grupos.values()];
}

export function podeVincularProcesso<T extends VinculoPessoa>(
  cadastros: readonly T[],
  cpf: string,
  processoId: string,
  idIgnorado?: string,
) {
  const titular = cpfPessoa(cpf);
  if (!titular || !processoId) return false;
  return !cadastros.some((item) =>
    item.id !== idIgnorado &&
    cpfPessoa(item.cpf) === titular &&
    item.processo_id === processoId &&
    item.situacao === "Ativo",
  );
}

export function podeRegistrarVinculo(vinculo: Pick<VinculoPessoa, "situacao" | "processo_id">) {
  return vinculo.situacao === "Ativo" && Boolean(vinculo.processo_id);
}
