/** Formatacao e aritmetica de datas em pt-BR, sempre no fuso local.
 *  Datas trafegam como string `YYYY-MM-DD` e meses como `YYYY-MM`; nunca
 *  passamos essas strings por `new Date(...)` direto para evitar o desvio de
 *  fuso que joga o dia 1 para o mes anterior. */

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const brlCompact = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatBRL(value: number): string {
  return brl.format(value);
}

/** Versao curta para numeros grandes (R$ 12,3 mil) — usada em eixos e tiles. */
export function formatBRLCompact(value: number): string {
  return Math.abs(value) >= 10000 ? brlCompact.format(value) : brl.format(value);
}

export function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

/** "2026-09-08" -> "08/09/2026" */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/** "2026-09-08" -> "sáb, 8 de setembro" */
export function formatDateLong(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const weekday = WEEKDAYS[new Date(y, m - 1, d).getDay()];
  return `${weekday}, ${d} de ${MONTHS[m - 1]}`;
}

/** "2026-09" -> "Setembro de 2026" */
export function formatMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const name = MONTHS[m - 1];
  return `${name[0].toUpperCase()}${name.slice(1)} de ${y}`;
}

/** "2026-09" -> "set/26" */
export function formatMonthShort(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${MONTHS[m - 1].slice(0, 3)}/${String(y).slice(2)}`;
}

export function todayISO(): string {
  const now = new Date();
  return toISODate(now);
}

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function currentMonth(): string {
  return todayISO().slice(0, 7);
}

/** Mes (YYYY-MM) a que uma data YYYY-MM-DD pertence. */
export function monthOf(iso: string): string {
  return iso.slice(0, 7);
}

export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const total = y * 12 + (m - 1) + delta;
  const year = Math.floor(total / 12);
  const mm = String((total % 12) + 1).padStart(2, "0");
  return `${year}-${mm}`;
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

/** Primeiro e ultimo dia do mes, inclusivos, em YYYY-MM-DD. */
export function monthRange(month: string): { start: string; end: string } {
  return {
    start: `${month}-01`,
    end: `${month}-${String(daysInMonth(month)).padStart(2, "0")}`,
  };
}

/** Quantos dias do mes ja passaram (o mes inteiro, se ele ja acabou). */
export function elapsedDays(month: string): number {
  const today = todayISO();
  const total = daysInMonth(month);
  if (monthOf(today) > month) return total;
  if (monthOf(today) < month) return 0;
  return Number(today.slice(8, 10));
}

/** Lista de meses do mais recente para o mais antigo, para o seletor. */
export function recentMonths(count = 18, from = currentMonth()): string[] {
  return Array.from({ length: count }, (_, i) => addMonths(from, -i));
}

/** Converte "1.234,56", "1234.56" ou "1234,5" em numero. */
export function parseAmount(raw: string): number {
  const cleaned = raw
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}\b)/g, "")
    .replace(",", ".");
  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) ? value : NaN;
}

/** Arredonda para centavos, evitando o lixo de ponto flutuante nas somas. */
export function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}
