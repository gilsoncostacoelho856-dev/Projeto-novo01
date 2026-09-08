"use client";

import { useState } from "react";
import Link from "next/link";
import { errorMessage, useFinance } from "@/lib/finance-context";
import { addMonths, formatBRL, formatMonth, formatMonthShort } from "@/lib/format";
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
} from "@/components/ui";
import { IconAlert, IconPencil, IconPlus, IconTrash } from "@/components/icons";

export default function IncomePage() {
  const {
    month,
    incomes,
    summary,
    addIncome,
    editIncome,
    removeIncome,
    copyIncomesFromPreviousMonth,
    loading,
  } = useFinance();

  const [source, setSource] = useState("");
  const [amount, setAmount] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { totalIncome, totalSpent, leftover } = summary;

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

  async function create(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = source.trim();
    if (!trimmed) {
      setError("Dê um nome para a fonte de renda.");
      return;
    }
    if (!(amount > 0)) {
      setError("Informe um valor maior que zero.");
      return;
    }
    await run(async () => {
      await addIncome(trimmed, amount);
      setSource("");
      setAmount(0);
      setNotice(`${trimmed} adicionada à renda de ${formatMonth(month)}.`);
    });
  }

  async function copyPrevious() {
    const previous = formatMonthShort(addMonths(month, -1));
    await run(async () => {
      const count = await copyIncomesFromPreviousMonth();
      setNotice(
        count === 0
          ? `Nenhuma fonte nova para copiar de ${previous}.`
          : `${count} fonte${count > 1 ? "s" : ""} copiada${count > 1 ? "s" : ""} de ${previous}.`,
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
          <p className="mt-2 text-sm text-ink-2">Nenhuma fonte cadastrada neste mês.</p>
        ) : (
          <p className="mt-2 text-sm text-ink-2">
            {incomes.length} fonte{incomes.length > 1 ? "s" : ""} · menos{" "}
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

      {/* -------------------------------------------------------- nova fonte */}
      <Card as="div">
        <SectionTitle
          title="Nova fonte de renda"
          hint="Cadastre cada entrada do mês: salário, freela, aluguel…"
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
        <form onSubmit={create} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Field label="Fonte" htmlFor="source">
              <Input
                id="source"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                maxLength={40}
                placeholder="Ex.: Salário"
              />
            </Field>
          </div>
          <div className="sm:w-44">
            <Field label="Valor" htmlFor="income-amount">
              <CurrencyInput id="income-amount" value={amount} onChange={setAmount} />
            </Field>
          </div>
          <Button type="submit" disabled={busy} className="sm:mb-0">
            <IconPlus className="h-4 w-4" />
            Adicionar
          </Button>
        </form>
      </Card>

      {/* --------------------------------------------------- fontes cadastradas */}
      <Card as="div">
        <SectionTitle title={`Fontes de ${formatMonth(month)}`} />

        {incomes.length === 0 ? (
          <EmptyState title="Nenhuma renda cadastrada neste mês">
            Cadastre suas fontes de renda para o painel mostrar quanto sobra depois
            dos gastos.
          </EmptyState>
        ) : (
          <>
            <ul className="divide-y divide-[var(--line)]">
              {incomes.map((income) => {
                if (editingId === income.id) {
                  return (
                    <li key={income.id} className="py-3">
                      <EditRow
                        initialSource={income.source}
                        initialAmount={income.amount}
                        busy={busy}
                        onCancel={() => setEditingId(null)}
                        onSave={(nextSource, nextAmount) =>
                          run(async () => {
                            await editIncome(income.id, {
                              source: nextSource,
                              amount: nextAmount,
                              month: income.month,
                            });
                            setEditingId(null);
                          })
                        }
                      />
                    </li>
                  );
                }

                const share = totalIncome > 0 ? income.amount / totalIncome : 0;
                return (
                  <li key={income.id} className="flex items-center gap-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-ink">{income.source}</p>
                      <p className="text-xs text-ink-2">
                        {Math.round(share * 100)}% da renda do mês
                      </p>
                    </div>
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
                        onClick={() => {
                          if (
                            !window.confirm(
                              `Excluir a renda "${income.source}"? Essa ação não pode ser desfeita.`,
                            )
                          ) {
                            return;
                          }
                          void run(() => removeIncome(income.id));
                        }}
                      >
                        <IconTrash className="h-4 w-4" />
                      </IconButton>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="mt-4 flex items-baseline justify-between border-t border-line pt-4">
              <span className="text-sm text-ink-2">Renda total</span>
              <span className="text-lg font-semibold tabular-nums text-ink">
                {formatBRL(totalIncome)}
              </span>
            </div>
          </>
        )}
      </Card>

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

function EditRow({
  initialSource,
  initialAmount,
  busy,
  onSave,
  onCancel,
}: {
  initialSource: string;
  initialAmount: number;
  busy: boolean;
  onSave: (source: string, amount: number) => void;
  onCancel: () => void;
}) {
  const [source, setSource] = useState(initialSource);
  const [amount, setAmount] = useState(initialAmount);

  return (
    <div className="flex flex-col gap-3">
      <Input
        value={source}
        onChange={(e) => setSource(e.target.value)}
        maxLength={40}
        aria-label="Fonte de renda"
        autoFocus
      />
      <CurrencyInput id="edit-income-amount" value={amount} onChange={setAmount} />
      <div className="flex gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          Cancelar
        </Button>
        <Button
          onClick={() => onSave(source.trim() || initialSource, amount)}
          disabled={busy || !(amount > 0)}
        >
          Salvar
        </Button>
      </div>
    </div>
  );
}
