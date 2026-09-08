"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { errorMessage, useFinance } from "@/lib/finance-context";
import { seriesColor } from "@/lib/derive";
import { formatBRL, formatDateLong, formatMonth } from "@/lib/format";
import { MonthPicker } from "@/components/MonthPicker";
import {
  Alert,
  Button,
  Card,
  EmptyState,
  IconButton,
  Input,
  Select,
  Skeleton,
  Swatch,
  cx,
} from "@/components/ui";
import { IconPencil, IconPlus, IconSearch, IconTrash } from "@/components/icons";

export default function HistoryPage() {
  const router = useRouter();
  const { month, expenses, categories, removeExpense, loading } = useFinance();

  const [categoryId, setCategoryId] = useState("all");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return expenses.filter((e) => {
      if (categoryId !== "all" && e.categoryId !== categoryId) return false;
      if (!term) return true;
      const category = categoryById.get(e.categoryId)?.name ?? "";
      return (
        e.description.toLowerCase().includes(term) ||
        category.toLowerCase().includes(term)
      );
    });
  }, [expenses, categoryId, query, categoryById]);

  // Agrupa por dia, mantendo a ordem do mais recente para o mais antigo.
  const groups = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const expense of filtered) {
      const list = map.get(expense.date) ?? [];
      list.push(expense);
      map.set(expense.date, list);
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [filtered]);

  const total = filtered.reduce((sum, e) => sum + e.amount, 0);

  async function remove(id: string, label: string) {
    if (!window.confirm(`Excluir "${label}"? Essa ação não pode ser desfeita.`)) return;
    setRemoving(id);
    setError(null);
    try {
      await removeExpense(id);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-ink">Histórico</h1>
        <MonthPicker />
      </div>

      {error ? <Alert tone="critical">{error}</Alert> : null}

      {/* filtros em uma linha, acima da lista */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
            <IconSearch className="h-4 w-4" />
          </span>
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por descrição ou categoria"
            aria-label="Buscar gastos"
            className="pl-9"
          />
        </div>
        <Select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          aria-label="Filtrar por categoria"
          className="sm:w-52"
        >
          <option value="all">Todas as categorias</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex items-baseline justify-between px-1">
        <span className="text-sm text-ink-2">
          {filtered.length} gasto{filtered.length === 1 ? "" : "s"} em {formatMonth(month)}
        </span>
        <span className="font-semibold tabular-nums text-ink">{formatBRL(total)}</span>
      </div>

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : groups.length === 0 ? (
        <Card>
          <EmptyState
            title={
              expenses.length === 0
                ? "Nenhum gasto neste mês"
                : "Nada encontrado com esses filtros"
            }
            action={
              expenses.length === 0 ? (
                <Link href="/gastos">
                  <Button>
                    <IconPlus className="h-4 w-4" />
                    Registrar gasto
                  </Button>
                </Link>
              ) : (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setQuery("");
                    setCategoryId("all");
                  }}
                >
                  Limpar filtros
                </Button>
              )
            }
          >
            {expenses.length === 0
              ? `Ainda não há lançamentos em ${formatMonth(month)}.`
              : "Tente outra busca ou outra categoria."}
          </EmptyState>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map(([date, items]) => (
            <Card key={date} className="p-0 sm:p-0">
              <div className="flex items-baseline justify-between border-b border-line px-4 py-2.5">
                <h2 className="text-sm font-medium text-ink">{formatDateLong(date)}</h2>
                <span className="text-sm tabular-nums text-ink-2">
                  {formatBRL(items.reduce((sum, e) => sum + e.amount, 0))}
                </span>
              </div>
              <ul className="divide-y divide-[var(--line)]">
                {items.map((expense) => {
                  const category = categoryById.get(expense.categoryId);
                  const label = expense.description || category?.name || "gasto";
                  return (
                    <li
                      key={expense.id}
                      className={cx(
                        "flex items-center gap-2 px-4 py-3",
                        removing === expense.id && "opacity-50",
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-ink">
                          {expense.description || (category?.name ?? "Sem categoria")}
                        </p>
                        <p className="mt-0.5 flex items-center gap-1.5 text-sm text-ink-2">
                          <Swatch
                            color={seriesColor(category?.colorIndex ?? 0)}
                            className="h-2 w-2"
                          />
                          {category?.name ?? "Sem categoria"}
                        </p>
                      </div>

                      <span className="shrink-0 font-semibold tabular-nums text-ink">
                        {formatBRL(expense.amount)}
                      </span>

                      <div className="-mr-2 flex shrink-0">
                        <IconButton
                          label={`Editar ${label}`}
                          className="h-10 w-10"
                          onClick={() => router.push(`/gastos?id=${expense.id}`)}
                        >
                          <IconPencil className="h-4 w-4" />
                        </IconButton>
                        <IconButton
                          label={`Excluir ${label}`}
                          className="h-10 w-10"
                          onClick={() => void remove(expense.id, label)}
                          disabled={removing === expense.id}
                        >
                          <IconTrash className="h-4 w-4" />
                        </IconButton>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
