"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { errorMessage, useFinance } from "@/lib/finance-context";
import { seriesColor } from "@/lib/derive";
import { addMonths, formatBRL, formatMonth, formatMonthShort } from "@/lib/format";
import { CurrencyInput } from "@/components/CurrencyInput";
import { MonthPicker } from "@/components/MonthPicker";
import { Alert, Button, Card, EmptyState, SectionTitle, Skeleton, Swatch } from "@/components/ui";
import { IconCheck } from "@/components/icons";

export default function BudgetPage() {
  const {
    month,
    categories,
    budgets,
    summary,
    saveBudget,
    copyBudgetsFromPreviousMonth,
    loading,
  } = useFinance();

  // Rascunho local: o usuario ajusta varios limites e salva de uma vez.
  const [drafts, setDrafts] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const saved = useMemo(() => {
    const map: Record<string, number> = {};
    for (const b of budgets) map[b.categoryId] = b.limitAmount;
    return map;
  }, [budgets]);

  useEffect(() => {
    setDrafts(saved);
    setNotice(null);
  }, [saved, month]);

  const changed = categories.filter((c) => (drafts[c.id] ?? 0) !== (saved[c.id] ?? 0));
  const draftTotal = categories.reduce((sum, c) => sum + (drafts[c.id] ?? 0), 0);
  const spentByCategory = new Map(summary.rows.map((r) => [r.category.id, r.spent]));

  async function save() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      for (const category of changed) {
        await saveBudget(category.id, drafts[category.id] ?? 0);
      }
      setNotice("Limites salvos.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function copyPrevious() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const count = await copyBudgetsFromPreviousMonth();
      setNotice(
        count === 0
          ? `Nenhum limite novo para copiar de ${formatMonthShort(addMonths(month, -1))}.`
          : `${count} limite${count > 1 ? "s" : ""} copiado${count > 1 ? "s" : ""} de ${formatMonthShort(addMonths(month, -1))}.`,
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading && categories.length === 0) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="flex flex-col gap-4 pb-20">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-ink">Orçamento</h1>
        <MonthPicker />
      </div>

      {error ? <Alert tone="critical">{error}</Alert> : null}
      {notice ? <Alert tone="good">{notice}</Alert> : null}

      {categories.length === 0 ? (
        <Card>
          <EmptyState
            title="Nenhuma categoria ainda"
            action={
              <Link href="/categorias">
                <Button>Criar categoria</Button>
              </Link>
            }
          >
            Crie categorias para definir um limite mensal em cada uma.
          </EmptyState>
        </Card>
      ) : (
        <Card>
          <SectionTitle
            title={`Limites de ${formatMonth(month)}`}
            hint="Deixe em branco (ou zero) para não acompanhar a categoria neste mês."
            action={
              <Button
                variant="secondary"
                size="sm"
                className="whitespace-nowrap"
                onClick={() => void copyPrevious()}
                disabled={busy}
              >
                Copiar de {formatMonthShort(addMonths(month, -1))}
              </Button>
            }
          />

          <ul className="divide-y divide-[var(--line)]">
            {categories.map((category) => {
              const spent = spentByCategory.get(category.id) ?? 0;
              const limit = drafts[category.id] ?? 0;
              const over = limit > 0 && spent > limit;
              return (
                <li
                  key={category.id}
                  className="flex flex-wrap items-center gap-3 py-3 sm:flex-nowrap"
                >
                  <label
                    htmlFor={`limit-${category.id}`}
                    className="flex min-w-0 flex-1 items-center gap-2"
                  >
                    <Swatch color={seriesColor(category.colorIndex)} />
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-ink">
                        {category.name}
                      </span>
                      <span className="block text-xs text-ink-2">
                        Já gastou {formatBRL(spent)}
                        {over ? " — acima do limite" : ""}
                      </span>
                    </span>
                  </label>

                  <CurrencyInput
                    id={`limit-${category.id}`}
                    className="w-full sm:w-44"
                    value={limit}
                    onChange={(value) =>
                      setDrafts((current) => ({ ...current, [category.id]: value }))
                    }
                  />
                </li>
              );
            })}
          </ul>

          <div className="mt-4 flex items-baseline justify-between border-t border-line pt-4">
            <span className="text-sm text-ink-2">Total orçado</span>
            <span className="text-lg font-semibold tabular-nums text-ink">
              {formatBRL(draftTotal)}
            </span>
          </div>
        </Card>
      )}

      {/* barra de salvar: so aparece quando ha mudanca, presa acima da nav */}
      {changed.length > 0 ? (
        <div className="fixed inset-x-0 bottom-14 z-20 border-t border-line bg-surface/95 p-3 backdrop-blur lg:bottom-0">
          <div className="mx-auto flex max-w-4xl items-center gap-3">
            <span className="text-sm text-ink-2">
              {changed.length} alteração{changed.length > 1 ? "ões" : ""} pendente
              {changed.length > 1 ? "s" : ""}
            </span>
            <Button className="ml-auto" onClick={() => void save()} disabled={busy}>
              <IconCheck className="h-4 w-4" />
              {busy ? "Salvando…" : "Salvar limites"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
