"use client";

/** Renda do mes, lancamento a lancamento — a mesma forma dos gastos.
 *
 *  Quem recebe todo dia (motorista de app, autonomo) lanca um ganho por dia,
 *  ou varios no mesmo dia, e o mes e a soma deles. Quem tem renda fixa lanca
 *  uma vez e usa "Copiar de <mes>" no mes seguinte. Para acelerar o uso
 *  repetido, ao salvar o formulario mantem fonte e data e limpa so o valor. */

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { errorMessage, useFinance } from "@/lib/finance-context";
import {
  addMonths,
  daysInMonth,
  formatBRL,
  formatDateLong,
  formatMonth,
  formatMonthShort,
  monthOf,
  todayISO,
} from "@/lib/format";
import { CurrencyInput } from "@/components/CurrencyInput";
import { MonthPicker } from "@/components/MonthPicker";
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Field,
  IconButton,
  Input,
  SectionTitle,
  Skeleton,
  cx,
} from "@/components/ui";
import { IconAlert, IconPencil, IconPlus, IconTrash } from "@/components/icons";
import type { Income, IncomeInput } from "@/lib/types";

/** Um dia do mes visivel para lancar: hoje, ou o ultimo dia se o mes ja passou. */
function defaultDate(month: string): string {
  const today = todayISO();
  if (monthOf(today) === month) return today;
  return `${month}-${String(daysInMonth(month)).padStart(2, "0")}`;
}

export default function IncomePage() {
  const {
    month,
    incomes,
    summary,
    addIncome,
    editIncome,
    removeIncome,
    copyIncomesFromPreviousMonth,
    setMonth,
    loading,
  } = useFinance();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { totalIncome, totalSpent, leftover, incomeSources } = summary;

  // Nomes ja usados viram sugestoes do campo "Fonte", para nao redigitar.
  const knownSources = useMemo(() => {
    const seen = new Map<string, string>();
    for (const income of incomes) {
      const key = income.source.trim().toLowerCase();
      if (!seen.has(key)) seen.set(key, income.source);
    }
    return [...seen.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [incomes]);

  // Agrupa os lancamentos por dia, do mais recente para o mais antigo.
  const days = useMemo(() => {
    const map = new Map<string, Income[]>();
    for (const income of incomes) {
      const list = map.get(income.date) ?? [];
      list.push(income);
      map.set(income.date, list);
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [incomes]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function validate(input: IncomeInput): string | null {
    if (!input.source) return "Dê um nome para a fonte de renda.";
    if (!(input.amount > 0)) return "Informe um valor maior que zero.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return "Informe uma data válida.";
    return null;
  }

  function confirmRemoval(income: Income) {
    if (
      !window.confirm(
        `Excluir ${formatBRL(income.amount)} de "${income.source}"? Essa ação não pode ser desfeita.`,
      )
    ) {
      return;
    }
    void run(() => removeIncome(income.id));
  }

  async function copyPrevious() {
    const previous = formatMonthShort(addMonths(month, -1));
    await run(async () => {
      const count = await copyIncomesFromPreviousMonth();
      setNotice(
        count === 0
          ? `Nenhuma fonte fixa nova para copiar de ${previous}.`
          : `${count} fonte${count > 1 ? "s" : ""} fixa${count > 1 ? "s" : ""} copiada${count > 1 ? "s" : ""} de ${previous}.`,
      );
    });
  }

  if (loading && incomes.length === 0) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-ink">Renda</h1>
        <MonthPicker />
      </div>

      {error ? <Alert tone="critical">{error}</Alert> : null}
      {notice ? <Alert tone="good">{notice}</Alert> : null}

      {/* ------------------------------------------------- renda x gastos do mes */}
      <Card>
        <p className="text-sm text-ink-2">Renda de {formatMonth(month)}</p>
        <p className="mt-1 text-[44px] font-semibold leading-none text-ink sm:text-5xl">
          {formatBRL(totalIncome)}
        </p>
        {incomes.length === 0 ? (
          <p className="mt-2 text-sm text-ink-2">Nenhum ganho lançado neste mês.</p>
        ) : (
          <p className="mt-2 text-sm text-ink-2">
            {incomes.length} lançamento{incomes.length > 1 ? "s" : ""} · menos{" "}
            {formatBRL(totalSpent)} de gastos ={" "}
            <span
              className="font-semibold"
              style={{ color: leftover < 0 ? "var(--critical)" : "var(--good-ink)" }}
            >
              {formatBRL(leftover)}
            </span>{" "}
            de sobra
          </p>
        )}
      </Card>

      {/* --------------------------------------------------------- novo ganho */}
      <Card as="div">
        <SectionTitle
          title="Novo ganho"
          hint="Lance no dia em que o dinheiro entrou — quantos quiser por dia."
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
        <IncomeForm
          key={month}
          month={month}
          busy={busy}
          suggestions={knownSources}
          submitLabel="Adicionar"
          onSubmit={async (input) => {
            const problem = validate(input);
            if (problem) {
              setError(problem);
              setNotice(null);
              return false;
            }
            let ok = false;
            await run(async () => {
              // segue o mes do lancamento, como faz a tela de gastos
              setMonth(monthOf(input.date));
              await addIncome(input);
              setNotice(`${formatBRL(input.amount)} de ${input.source} lançado.`);
              ok = true;
            });
            return ok;
          }}
        />
        <p className="mt-3 text-xs text-muted">
          &ldquo;Copiar de {formatMonthShort(addMonths(month, -1))}&rdquo; repete só as
          fontes fixas — as que tiveram um único lançamento no mês passado e ainda não
          aparecem neste.
        </p>
      </Card>

      {/* ------------------------------------------------------ resumo por fonte */}
      {incomeSources.length > 1 ? (
        <Card as="div">
          <SectionTitle title="Por fonte" />
          <ul className="divide-y divide-[var(--line)]">
            {incomeSources.map((source) => (
              <li key={source.source} className="flex items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink">{source.source}</p>
                  <p className="text-xs text-ink-2">
                    {source.count} lançamento{source.count > 1 ? "s" : ""} ·{" "}
                    {Math.round(source.share * 100)}% da renda
                  </p>
                </div>
                <span className="shrink-0 font-semibold tabular-nums text-ink">
                  {formatBRL(source.total)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {/* --------------------------------------------------- lancamentos do mes */}
      {incomes.length === 0 ? (
        <Card>
          <EmptyState title="Nenhum ganho neste mês">
            Lance o que você recebeu para o painel mostrar quanto sobra depois dos
            gastos.
          </EmptyState>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {days.map(([date, items]) => (
            <Card key={date} className="p-0 sm:p-0">
              <div className="flex items-baseline justify-between border-b border-line px-4 py-2.5">
                <h2 className="text-sm font-medium text-ink">{formatDateLong(date)}</h2>
                <span className="text-sm tabular-nums text-ink-2">
                  {formatBRL(items.reduce((sum, i) => sum + i.amount, 0))}
                </span>
              </div>
              <ul className="divide-y divide-[var(--line)]">
                {items.map((income) =>
                  editingId === income.id ? (
                    <li key={income.id} className="px-4 py-3">
                      <IncomeForm
                        initial={income}
                        month={month}
                        busy={busy}
                        suggestions={knownSources}
                        submitLabel="Salvar"
                        onCancel={() => setEditingId(null)}
                        onSubmit={async (input) => {
                          const problem = validate(input);
                          if (problem) {
                            setError(problem);
                            setNotice(null);
                            return false;
                          }
                          let ok = false;
                          await run(async () => {
                            await editIncome(income.id, input);
                            setEditingId(null);
                            ok = true;
                          });
                          return ok;
                        }}
                      />
                    </li>
                  ) : (
                    <li
                      key={income.id}
                      className={cx(
                        "flex items-center gap-2 px-4 py-3",
                        busy && "opacity-70",
                      )}
                    >
                      <p className="min-w-0 flex-1 truncate font-medium text-ink">
                        {income.source}
                      </p>
                      <span className="shrink-0 font-semibold tabular-nums text-ink">
                        {formatBRL(income.amount)}
                      </span>
                      <div className="-mr-2 flex shrink-0">
                        <IconButton
                          label={`Editar ${income.source}`}
                          className="h-10 w-10"
                          onClick={() => setEditingId(income.id)}
                        >
                          <IconPencil className="h-4 w-4" />
                        </IconButton>
                        <IconButton
                          label={`Excluir ${income.source}`}
                          className="h-10 w-10"
                          disabled={busy}
                          onClick={() => confirmRemoval(income)}
                        >
                          <IconTrash className="h-4 w-4" />
                        </IconButton>
                      </div>
                    </li>
                  ),
                )}
              </ul>
            </Card>
          ))}

          <div className="flex items-baseline justify-between px-1">
            <span className="text-sm text-ink-2">Renda total de {formatMonth(month)}</span>
            <span className="text-lg font-semibold tabular-nums text-ink">
              {formatBRL(totalIncome)}
            </span>
          </div>
        </div>
      )}

      {incomes.length > 0 && leftover < 0 ? (
        <Alert tone="critical" title="Você gastou mais do que ganhou neste mês">
          <span className="flex items-center gap-1.5">
            <IconAlert className="h-4 w-4 shrink-0" />
            {formatBRL(Math.abs(leftover))} acima da renda.{" "}
            <Link href="/historico" className="underline">
              Ver gastos
            </Link>
          </span>
        </Alert>
      ) : null}
    </div>
  );
}

function IncomeForm({
  initial,
  month,
  busy,
  suggestions,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: Income;
  /** Mes visivel — decide a data inicial de um lancamento novo. */
  month: string;
  busy: boolean;
  suggestions: string[];
  submitLabel: string;
  /** Retorna true quando salvou — o formulario novo limpa so o valor. */
  onSubmit: (input: IncomeInput) => Promise<boolean>;
  onCancel?: () => void;
}) {
  const [source, setSource] = useState(initial?.source ?? "");
  const [amount, setAmount] = useState(initial?.amount ?? 0);
  const [date, setDate] = useState(initial?.date ?? defaultDate(month));
  const [submitting, setSubmitting] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const saved = await onSubmit({ source: source.trim(), amount, date });
      if (saved && !initial) {
        // mantem fonte e data: lancar o proximo ganho do dia e so digitar o valor
        setAmount(0);
        amountRef.current?.focus();
      }
    } finally {
      setSubmitting(false);
    }
  }

  const suffix = initial ? `-${initial.id}` : "";
  const listId = `sources${suffix}`;

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <Field label="Fonte" htmlFor={`source${suffix}`}>
            <Input
              id={`source${suffix}`}
              list={suggestions.length > 0 ? listId : undefined}
              value={source}
              onChange={(e) => setSource(e.target.value)}
              maxLength={40}
              placeholder="Ex.: Salário"
            />
            {suggestions.length > 0 ? (
              <datalist id={listId}>
                {suggestions.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            ) : null}
          </Field>
        </div>
        <div className="sm:w-44">
          <Field label="Valor" htmlFor={`income-amount${suffix}`}>
            <CurrencyInput
              id={`income-amount${suffix}`}
              ref={amountRef}
              value={amount}
              onChange={setAmount}
            />
          </Field>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="sm:w-52">
          <Field label="Data" htmlFor={`income-date${suffix}`}>
            <Input
              id={`income-date${suffix}`}
              type="date"
              value={date}
              max={todayISO()}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
        </div>
        <div className="flex gap-2">
          {onCancel ? (
            <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>
              Cancelar
            </Button>
          ) : null}
          <Button type="submit" disabled={busy}>
            {initial ? null : <IconPlus className="h-4 w-4" />}
            {submitting ? "Salvando…" : submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}
