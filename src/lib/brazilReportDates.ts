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

/** Soma (ou subtrai) dias em um YYYY-MM-DD civil, sem depender do fuso do navegador. */
export function brazilAddCalendarDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  const yyyy = utc.getUTCFullYear();
  const mm = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(utc.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function brazilIsoDateDaysAgo(days: number): string {
  return brazilAddCalendarDays(brazilIsoDate(), -days);
}

/** Janela inclusiva dos últimos N dias civis em Brasília (hoje conta como 1). */
export function brazilLastNDaysRange(days: number): { start: string; end: string } {
  const end = brazilIsoDate();
  const start = brazilAddCalendarDays(end, -(Math.max(1, days) - 1));
  return { start, end };
}

/** Garante start <= end em YYYY-MM-DD. */
export function brazilNormalizeIsoRange(startDate: string, endDate: string): { start: string; end: string } {
  if (!startDate || !endDate) {
    const today = brazilIsoDate();
    return { start: startDate || today, end: endDate || today };
  }
  return startDate <= endDate
    ? { start: startDate, end: endDate }
    : { start: endDate, end: startDate };
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
  const { start, end } = brazilNormalizeIsoRange(startDate, endDate);
  return { startUtc: brazilDayBoundsUtc(start).startUtc, endUtc: brazilDayBoundsUtc(end).endUtc };
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

/** Segunda-feira da semana civil em Brasília (YYYY-MM-DD). */
export function brazilWeekStartIsoFromTimestamp(isoTimestamp: string): string {
  const iso = brazilIsoDate(new Date(isoTimestamp));
  const [year, month, day] = iso.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  const fromMonday = (utc.getUTCDay() + 6) % 7;
  utc.setUTCDate(utc.getUTCDate() - fromMonday);
  const yyyy = utc.getUTCFullYear();
  const mm = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(utc.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Rótulo "Semana de dd/mm/aaaa" com início na segunda (calendário Brasília). */
export function brazilWeekLabelFromTimestamp(isoTimestamp: string): string {
  const weekStart = brazilWeekStartIsoFromTimestamp(isoTimestamp);
  return `Semana de ${brazilIsoDateLabel(weekStart)}`;
}

/** Exibe YYYY-MM-DD como dd/mm/aaaa (rótulo de período). */
export function brazilIsoDateLabel(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

/** YYYY-MM → "setembro de 2026". */
export function brazilMonthLabelFromKey(yyyyMm: string): string {
  const [year, month] = yyyyMm.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, 1));
  return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
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
