/** Calculos derivados do mes: gasto por categoria, situacao do limite e serie diaria. */

import type { Budget, Category, Expense } from "@/lib/types";
import { daysInMonth, elapsedDays, roundCents } from "@/lib/format";

/** Fracao do limite a partir da qual o alerta amarelo aparece. */
export const WARNING_RATIO = 0.8;

export type CategoryStatus = "no-budget" | "ok" | "warning" | "over";

export type CategorySummary = {
  category: Category;
  spent: number;
  /** Limite do mes, ou null quando a categoria nao tem orcamento definido. */
  limit: number | null;
  /** Limite - gasto (negativo quando estourou). null sem orcamento. */
  remaining: number | null;
  /** gasto / limite. null sem orcamento. */
  ratio: number | null;
  status: CategoryStatus;
  /** Participacao no total gasto do mes, de 0 a 1. */
  share: number;
};

export type MonthSummary = {
  rows: CategorySummary[];
  totalSpent: number;
  totalLimit: number;
  totalRemaining: number;
  budgetRatio: number | null;
  over: CategorySummary[];
  warning: CategorySummary[];
  /** Um ponto por dia do mes, na ordem do calendario. */
  daily: { date: string; day: number; total: number }[];
  /** Media diaria considerando os dias ja decorridos do mes. */
  dailyAverage: number;
  /** Projecao de gasto ate o fim do mes no ritmo atual. */
  projected: number;
};

export function statusOf(ratio: number | null): CategoryStatus {
  if (ratio === null) return "no-budget";
  if (ratio >= 1) return "over";
  if (ratio >= WARNING_RATIO) return "warning";
  return "ok";
}

export function summarize(
  month: string,
  categories: Category[],
  expenses: Expense[],
  budgets: Budget[],
): MonthSummary {
  const spentByCategory = new Map<string, number>();
  for (const e of expenses) {
    spentByCategory.set(e.categoryId, (spentByCategory.get(e.categoryId) ?? 0) + e.amount);
  }
  const limitByCategory = new Map(budgets.map((b) => [b.categoryId, b.limitAmount]));

  const totalSpent = roundCents(expenses.reduce((sum, e) => sum + e.amount, 0));

  const rows: CategorySummary[] = categories.map((category) => {
    const spent = roundCents(spentByCategory.get(category.id) ?? 0);
    const limit = limitByCategory.get(category.id) ?? null;
    const ratio = limit && limit > 0 ? spent / limit : null;
    return {
      category,
      spent,
      limit,
      remaining: limit === null ? null : roundCents(limit - spent),
      ratio,
      status: statusOf(ratio),
      share: totalSpent > 0 ? spent / totalSpent : 0,
    };
  });

  // Quem tem orcamento primeiro, do mais critico para o menos; depois por gasto.
  rows.sort((a, b) => {
    if ((a.ratio === null) !== (b.ratio === null)) return a.ratio === null ? 1 : -1;
    if (a.ratio !== null && b.ratio !== null && a.ratio !== b.ratio) return b.ratio - a.ratio;
    return b.spent - a.spent;
  });

  const totalLimit = roundCents(budgets.reduce((sum, b) => sum + b.limitAmount, 0));

  const totals = new Map<string, number>();
  for (const e of expenses) totals.set(e.date, (totals.get(e.date) ?? 0) + e.amount);
  const daily = Array.from({ length: daysInMonth(month) }, (_, i) => {
    const day = i + 1;
    const date = `${month}-${String(day).padStart(2, "0")}`;
    return { date, day, total: roundCents(totals.get(date) ?? 0) };
  });

  const elapsed = elapsedDays(month);
  const dailyAverage = elapsed > 0 ? roundCents(totalSpent / elapsed) : 0;

  return {
    rows,
    totalSpent,
    totalLimit,
    totalRemaining: roundCents(totalLimit - totalSpent),
    budgetRatio: totalLimit > 0 ? totalSpent / totalLimit : null,
    over: rows.filter((r) => r.status === "over"),
    warning: rows.filter((r) => r.status === "warning"),
    daily,
    dailyAverage,
    projected: roundCents(dailyAverage * daysInMonth(month)),
  };
}

/** Cor da paleta categorica para o slot da categoria (ordem fixa, 8 slots). */
export function seriesColor(colorIndex: number): string {
  return `var(--series-${(((colorIndex % 8) + 8) % 8) + 1})`;
}

/** Cor do medidor conforme a severidade: acento -> alerta -> critico. */
export function statusColor(status: CategoryStatus): string {
  switch (status) {
    case "over":
      return "var(--critical)";
    case "warning":
      return "var(--warning)";
    default:
      return "var(--accent)";
  }
}
