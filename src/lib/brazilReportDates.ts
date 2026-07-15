/** Datas e intervalos de relatório no fuso America/Sao_Paulo (UTC-3, sem horário de verão). */

export const BRAZIL_TIMEZONE = "America/Sao_Paulo";
const BRAZIL_OFFSET = "-03:00";

/** YYYY-MM-DD no calendário de Brasília (para inputs type=date). */
export function brazilIsoDate(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BRAZIL_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function brazilIsoDateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return brazilIsoDate(d);
}

export function brazilMonthStartIsoDate(date: Date = new Date()): string {
  return `${brazilIsoDate(date).slice(0, 7)}-01`;
}

/**
 * Dia civil em Brasília → limites UTC para Supabase (timestamptz).
 * Início: 00:00:00.000 · Fim: 23:59:59.999 (horário de Brasília).
 */
export function brazilDayBoundsUtc(isoDate: string): { startUtc: string; endUtc: string } {
  const startUtc = new Date(`${isoDate}T00:00:00.000${BRAZIL_OFFSET}`).toISOString();
  const endUtc = new Date(`${isoDate}T23:59:59.999${BRAZIL_OFFSET}`).toISOString();
  return { startUtc, endUtc };
}

/** Intervalo [startDate, endDate] inclusivo no calendário de Brasília. */
export function brazilRangeBoundsUtc(
  startDate: string,
  endDate: string,
): { startUtc: string; endUtc: string } {
  const start = brazilDayBoundsUtc(startDate).startUtc;
  const end = brazilDayBoundsUtc(endDate).endUtc;
  return { startUtc: start, endUtc: end };
}

/** Chave dd/mm/aaaa para agrupamento diário (pt-BR, Brasília). */
export function brazilDateKeyFromTimestamp(isoTimestamp: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: BRAZIL_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(isoTimestamp));
}

/** Chave YYYY-MM para agrupamento mensal (Brasília). */
export function brazilMonthKeyFromTimestamp(isoTimestamp: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BRAZIL_TIMEZONE,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date(isoTimestamp));
  const year = parts.find((p) => p.type === "year")?.value ?? "0000";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  return `${year}-${month}`;
}

/** Rótulo "Semana de dd/mm/aaaa" com início no domingo (calendário Brasília). */
export function brazilWeekLabelFromTimestamp(isoTimestamp: string): string {
  const iso = brazilIsoDate(new Date(isoTimestamp));
  const anchor = new Date(`${iso}T12:00:00${BRAZIL_OFFSET}`);
  const dow = anchor.getUTCDay();
  anchor.setUTCDate(anchor.getUTCDate() - dow);
  const weekStart = brazilDateKeyFromTimestamp(anchor.toISOString());
  return `Semana de ${weekStart}`;
}

/** Exibe YYYY-MM-DD como dd/mm/aaaa (rótulo de período). */
export function brazilIsoDateLabel(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

export function formatBrazilDateTime(isoTimestamp: string): {
  date: string;
  time: string;
} {
  const d = new Date(isoTimestamp);
  return {
    date: d.toLocaleDateString("pt-BR", { timeZone: BRAZIL_TIMEZONE }),
    time: d.toLocaleTimeString("pt-BR", {
      timeZone: BRAZIL_TIMEZONE,
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}
