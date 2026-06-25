/** Converte valor em reais (ex.: 8.5, "8,50" ou "8.50") para centavos inteiros (850). */
export function reaisToCentavos(reais: number | string | null | undefined): number {
  if (reais == null || reais === '') return 0;

  if (typeof reais === 'number') {
    if (!Number.isFinite(reais) || reais <= 0) return 0;
    return Math.round(reais * 100);
  }

  const trimmed = reais.trim().replace(/[^\d,.-]/g, '');
  if (!trimmed) return 0;

  const normalized = trimmed.includes(',')
    ? trimmed.replace(/\./g, '').replace(',', '.')
    : trimmed;

  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) return 0;

  return Math.round(value * 100);
}

export function centavosToReais(centavos: number): number {
  return centavos / 100;
}
