export interface EtiquetaLocal {
  id: string;
  nome: string;
  cor: string;
  favorita: boolean;
}

interface EstadoEtiquetas {
  etiquetas: EtiquetaLocal[];
  processos: Record<string, string[]>;
}

const CHAVE = "gestaovcrime.etiquetas.v1";

const estadoVazio = (): EstadoEtiquetas => ({ etiquetas: [], processos: {} });

function ler(): EstadoEtiquetas {
  if (typeof window === "undefined") return estadoVazio();
  try {
    const bruto = window.localStorage.getItem(CHAVE);
    if (!bruto) return estadoVazio();
    const valor = JSON.parse(bruto) as Partial<EstadoEtiquetas>;
    return {
      etiquetas: Array.isArray(valor.etiquetas) ? valor.etiquetas : [],
      processos: valor.processos && typeof valor.processos === "object" ? valor.processos : {},
    };
  } catch {
    return estadoVazio();
  }
}

function gravar(estado: EstadoEtiquetas) {
  if (typeof window !== "undefined") window.localStorage.setItem(CHAVE, JSON.stringify(estado));
}

function novoId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `etq-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function listarEtiquetasLocais(): EtiquetaLocal[] {
  return ler().etiquetas.sort((a, b) => Number(b.favorita) - Number(a.favorita) || a.nome.localeCompare(b.nome));
}

export function salvarEtiquetaLocal(entrada: Omit<EtiquetaLocal, "id">, id?: string) {
  const estado = ler();
  const nome = entrada.nome.trim();
  if (!nome) throw new Error("Informe o nome da etiqueta.");

  const duplicada = estado.etiquetas.some((e) => e.nome.trim().toLocaleLowerCase() === nome.toLocaleLowerCase() && e.id !== id);
  if (duplicada) throw new Error("Já existe uma etiqueta com este nome.");

  if (id) {
    estado.etiquetas = estado.etiquetas.map((e) => e.id === id ? { ...e, ...entrada, nome } : e);
  } else {
    estado.etiquetas.push({ ...entrada, nome, id: novoId() });
  }
  gravar(estado);
}

export function removerEtiquetaLocal(id: string) {
  const estado = ler();
  estado.etiquetas = estado.etiquetas.filter((e) => e.id !== id);
  for (const processoId of Object.keys(estado.processos)) {
    estado.processos[processoId] = (estado.processos[processoId] ?? []).filter((x) => x !== id);
  }
  gravar(estado);
}

export function listarEtiquetasDoProcessoLocal(processoId: string): EtiquetaLocal[] {
  const estado = ler();
  const ids = new Set(estado.processos[processoId] ?? []);
  return estado.etiquetas.filter((e) => ids.has(e.id));
}

export function listarEtiquetasPorProcessosLocal(processoIds: string[]): Record<string, EtiquetaLocal[]> {
  const estado = ler();
  const porId = new Map(estado.etiquetas.map((e) => [e.id, e]));
  const resultado: Record<string, EtiquetaLocal[]> = {};
  for (const processoId of processoIds) {
    resultado[processoId] = (estado.processos[processoId] ?? [])
      .map((id) => porId.get(id))
      .filter((e): e is EtiquetaLocal => Boolean(e));
  }
  return resultado;
}

export function adicionarEtiquetaAoProcessoLocal(processoId: string, etiquetaId: string) {
  const estado = ler();
  if (!estado.etiquetas.some((e) => e.id === etiquetaId)) throw new Error("Etiqueta não encontrada.");
  const atuais = estado.processos[processoId] ?? [];
  if (atuais.includes(etiquetaId)) throw new Error("Esta etiqueta já está vinculada ao processo.");
  estado.processos[processoId] = [...atuais, etiquetaId];
  gravar(estado);
}
