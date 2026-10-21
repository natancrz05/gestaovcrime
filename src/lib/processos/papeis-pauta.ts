const normalizarPapel = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Para fins da plataforma, identifica os papéis processuais que representam
 * a pessoa submetida à persecução ou à medida criminal.
 */
export function papelEhReu(papel: string) {
  const t = normalizarPapel(papel);
  return /(AUTOR\s+DO\s+FATO|\bREU\b|ACUSAD|DENUNCIAD|INDICIAD|QUERELAD|EXECUTAD|INVESTIGAD|REQUERID|APELAD|FLAGRANTEAD|AUTUAD)/.test(t);
}
