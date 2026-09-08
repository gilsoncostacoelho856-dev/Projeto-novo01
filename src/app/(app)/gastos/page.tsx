"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { errorMessage, useFinance } from "@/lib/finance-context";
import { seriesColor } from "@/lib/derive";
import { formatBRL, monthOf, todayISO } from "@/lib/format";
import { CurrencyInput } from "@/components/CurrencyInput";
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Select,
  Skeleton,
  Swatch,
} from "@/components/ui";
import { IconCheck } from "@/components/icons";

export default function NewExpensePage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <ExpenseForm />
    </Suspense>
  );
}

function ExpenseForm() {
  const router = useRouter();
  const params = useSearchParams();
  const editingId = params.get("id");

  const { categories, expenses, addExpense, editExpense, loading, setMonth } =
    useFinance();

  const editing = useMemo(
    () => (editingId ? expenses.find((e) => e.id === editingId) ?? null : null),
    [editingId, expenses],
  );

  const [amount, setAmount] = useState(0);
  const [categoryId, setCategoryId] = useState("");
  const [date, setDate] = useState(() => todayISO());
  const [description, setDescription] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Preenche o formulario ao editar um gasto existente.
  useEffect(() => {
    if (!editing) return;
    setAmount(editing.amount);
    setCategoryId(editing.categoryId);
    setDate(editing.date);
    setDescription(editing.description);
  }, [editing]);

  // Pre-seleciona a primeira categoria em um lancamento novo.
  useEffect(() => {
    if (!editingId && !categoryId && categories.length > 0) {
      setCategoryId(categories[0].id);
    }
  }, [categories, categoryId, editingId]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!(amount > 0)) nextErrors.amount = "Informe um valor maior que zero.";
    if (!categoryId) nextErrors.categoryId = "Escolha uma categoria.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) nextErrors.date = "Informe uma data válida.";
    setErrors(nextErrors);
    setFormError(null);
    setSaved(null);
    if (Object.keys(nextErrors).length > 0) return;

    const input = {
      amount,
      categoryId,
      date,
      description: description.trim(),
    };

    setBusy(true);
    try {
      if (editingId && editing) {
        await editExpense(editingId, input);
        router.push("/historico");
        return;
      }
      // garante que o mes do gasto seja o mes visivel no painel
      setMonth(monthOf(date));
      await addExpense(input);
      setSaved(`${formatBRL(amount)} registrado.`);
      setAmount(0);
      setDescription("");
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading && categories.length === 0) {
    return <Skeleton className="h-96 w-full" />;
  }

  if (categories.length === 0) {
    return (
      <Card>
        <EmptyState
          title="Crie uma categoria primeiro"
          action={
            <Link href="/categorias">
              <Button>Criar categoria</Button>
            </Link>
          }
        >
          Todo gasto precisa de uma categoria para entrar no orçamento.
        </EmptyState>
      </Card>
    );
  }

  if (editingId && !editing) {
    return (
      <Card>
        <EmptyState
          title="Gasto não encontrado"
          action={
            <Link href="/historico">
              <Button variant="secondary">Voltar ao histórico</Button>
            </Link>
          }
        >
          Ele pode ter sido removido ou pertencer a outro mês.
        </EmptyState>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-ink">
        {editingId ? "Editar gasto" : "Novo gasto"}
      </h1>

      {formError ? <Alert tone="critical">{formError}</Alert> : null}
      {saved ? (
        <div
          role="status"
          className="flex items-center gap-2 rounded-xl border border-line bg-surface p-3 text-sm"
        >
          <span style={{ color: "var(--good)" }}>
            <IconCheck className="h-5 w-5" />
          </span>
          <span className="text-ink">{saved}</span>
          <Link href="/historico" className="ml-auto text-accent-ink underline">
            Ver histórico
          </Link>
        </div>
      ) : null}

      <form
        onSubmit={submit}
        noValidate
        className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:p-5"
      >
        <Field label="Valor" htmlFor="amount" error={errors.amount}>
          <CurrencyInput id="amount" value={amount} onChange={setAmount} autoFocus />
        </Field>

        <Field label="Categoria" htmlFor="category" error={errors.categoryId}>
          <div className="flex items-center gap-2">
            <Swatch
              color={seriesColor(
                categories.find((c) => c.id === categoryId)?.colorIndex ?? 0,
              )}
              className="h-3 w-3"
            />
            <Select
              id="category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
        </Field>

        <Field label="Data" htmlFor="date" error={errors.date}>
          <Input
            id="date"
            type="date"
            value={date}
            max={todayISO()}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>

        <Field
          label="Descrição"
          htmlFor="description"
          hint="Opcional — ajuda a lembrar do que foi."
        >
          <Input
            id="description"
            type="text"
            maxLength={120}
            placeholder="Ex.: supermercado do mês"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>

        <div className="flex gap-3">
          {editingId ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push("/historico")}
            >
              Cancelar
            </Button>
          ) : null}
          <Button type="submit" block disabled={busy}>
            {busy ? "Salvando…" : editingId ? "Salvar alterações" : "Registrar gasto"}
          </Button>
        </div>
      </form>
    </div>
  );
}
