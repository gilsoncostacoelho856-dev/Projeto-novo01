"use client";

/** Espelho da tela "A receber", do outro lado do balcao. Como la, estes valores
 *  NAO entram na sobra do mes: sao lembrete de divida, nao gasto que ja saiu da
 *  conta — o gasto e lancado em /gastos no dia do pagamento. */

import { useState } from "react";
import { errorMessage, useFinance } from "@/lib/finance-context";
import { formatBRL, formatDate, todayISO } from "@/lib/format";
import { CurrencyInput } from "@/components/CurrencyInput";
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
import { IconCheck, IconPencil, IconPlus, IconTrash } from "@/components/icons";
import type { Payable, PayableInput } from "@/lib/types";

export default function PayablesPage() {
  const { payableSummary, addPayable, editPayable, markPayablePaid, removePayable, loading } =
    useFinance();

  const { pending, paid, pendingTotal, paidTotal } = payableSummary;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  function validate(input: PayableInput): string | null {
    if (!input.person) return "Informe para quem você deve.";
    if (!(input.amount > 0)) return "Informe um valor maior que zero.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return "Informe uma data válida.";
    return null;
  }

  function confirmRemoval(item: Payable) {
    if (
      !window.confirm(
        `Excluir a conta de "${item.person}"? Essa ação não pode ser desfeita.`,
      )
    ) {
      return;
    }
    void run(() => removePayable(item.id));
  }

  if (loading && pending.length === 0 && paid.length === 0) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-ink">A pagar</h1>

      {error ? <Alert tone="critical">{error}</Alert> : null}
      {notice ? <Alert tone="good">{notice}</Alert> : null}

      {/* ------------------------------------------------------ numero-heroi */}
      <Card>
        <p className="text-sm text-ink-2">Ainda a pagar</p>
        <p className="mt-1 text-[44px] font-semibold leading-none text-ink sm:text-5xl">
          {formatBRL(pendingTotal)}
        </p>
        <p className="mt-2 text-sm text-ink-2">
          {pending.length === 0
            ? "Você não está devendo nada."
            : `${pending.length} conta${pending.length > 1 ? "s" : ""} em aberto`}
          {paid.length > 0 ? ` · ${formatBRL(paidTotal)} já pago` : ""}
        </p>
      </Card>

      {/* ----------------------------------------------------- novo lancamento */}
      <Card as="div">
        <SectionTitle
          title="Nova conta a pagar"
          hint="Anote o que você deve para não perder o vencimento."
        />
        <PayableForm
          busy={busy}
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
              await addPayable(input);
              setNotice(`${formatBRL(input.amount)} para ${input.person} registrado.`);
              ok = true;
            });
            return ok;
          }}
        />
      </Card>

      {/* ------------------------------------------------------------ pendentes */}
      <Card as="div">
        <SectionTitle title={`Pendentes (${pending.length})`} />
        {pending.length === 0 ? (
          <EmptyState title="Nada pendente">
            Quando você ficar devendo alguém, cadastre aqui e marque como pago no dia
            que quitar.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-[var(--line)]">
            {pending.map((item) =>
              editingId === item.id ? (
                <li key={item.id} className="py-3">
                  <PayableForm
                    initial={item}
                    busy={busy}
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
                        await editPayable(item.id, input);
                        setEditingId(null);
                        ok = true;
                      });
                      return ok;
                    }}
                  />
                </li>
              ) : (
                <Row
                  key={item.id}
                  item={item}
                  busy={busy}
                  onEdit={() => setEditingId(item.id)}
                  onToggle={() =>
                    run(async () => {
                      await markPayablePaid(item.id, todayISO());
                      setNotice(`${formatBRL(item.amount)} pago para ${item.person}.`);
                    })
                  }
                  onRemove={() => confirmRemoval(item)}
                />
              ),
            )}
          </ul>
        )}
      </Card>

      {/* ---------------------------------------------------------------- pagos */}
      {paid.length > 0 ? (
        <Card as="div">
          <SectionTitle
            title={`Pagos (${paid.length})`}
            hint={`${formatBRL(paidTotal)} já quitados.`}
          />
          <ul className="divide-y divide-[var(--line)]">
            {paid.map((item) => (
              <Row
                key={item.id}
                item={item}
                busy={busy}
                onEdit={() => setEditingId(item.id)}
                onToggle={() =>
                  run(async () => {
                    await markPayablePaid(item.id, null);
                    setNotice(`${item.person} voltou para as pendentes.`);
                  })
                }
                onRemove={() => confirmRemoval(item)}
              />
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

function Row({
  item,
  busy,
  onEdit,
  onToggle,
  onRemove,
}: {
  item: Payable;
  busy: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const isPaid = item.paidAt !== null;

  return (
    <li
      className={cx(
        "flex flex-wrap items-center gap-x-3 gap-y-2 py-3",
        isPaid && "opacity-70",
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-ink">{item.person}</p>
        <p className="mt-0.5 text-sm text-ink-2">
          {formatDate(item.date)}
          {item.description ? ` · ${item.description}` : ""}
          {isPaid ? (
            <span style={{ color: "var(--good-ink)" }}>
              {" "}
              · pago em {formatDate(item.paidAt!)}
            </span>
          ) : null}
        </p>
      </div>

      <span
        className="shrink-0 font-semibold tabular-nums"
        style={{ color: isPaid ? "var(--good-ink)" : "var(--ink-1)" }}
      >
        {formatBRL(item.amount)}
      </span>

      {/* no celular os botoes descem para a propria linha, com espaco de sobra */}
      <div className="-mr-2 flex w-full shrink-0 items-center justify-end gap-1 sm:w-auto">
        <Button
          variant={isPaid ? "ghost" : "secondary"}
          size="sm"
          onClick={onToggle}
          disabled={busy}
          className="whitespace-nowrap"
        >
          {isPaid ? (
            "Desfazer"
          ) : (
            <>
              <IconCheck className="h-4 w-4" />
              Pago
            </>
          )}
        </Button>
        <IconButton label={`Editar ${item.person}`} className="h-10 w-10" onClick={onEdit}>
          <IconPencil className="h-4 w-4" />
        </IconButton>
        <IconButton
          label={`Excluir ${item.person}`}
          className="h-10 w-10"
          onClick={onRemove}
          disabled={busy}
        >
          <IconTrash className="h-4 w-4" />
        </IconButton>
      </div>
    </li>
  );
}

function PayableForm({
  initial,
  busy,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: Payable;
  busy: boolean;
  submitLabel: string;
  /** Retorna true quando salvou — o formulario novo se limpa nesse caso. */
  onSubmit: (input: PayableInput) => Promise<boolean>;
  onCancel?: () => void;
}) {
  const [person, setPerson] = useState(initial?.person ?? "");
  const [amount, setAmount] = useState(initial?.amount ?? 0);
  const [date, setDate] = useState(initial?.date ?? todayISO());
  const [description, setDescription] = useState(initial?.description ?? "");
  // `busy` e da tela inteira; este marca so o envio deste formulario
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const saved = await onSubmit({
        person: person.trim(),
        amount,
        date,
        description: description.trim(),
      });
      if (saved && !initial) {
        setPerson("");
        setAmount(0);
        setDate(todayISO());
        setDescription("");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const suffix = initial ? `-${initial.id}` : "";

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <Field label="Pessoa ou empresa" htmlFor={`payee${suffix}`}>
            <Input
              id={`payee${suffix}`}
              value={person}
              onChange={(e) => setPerson(e.target.value)}
              maxLength={60}
              placeholder="Ex.: Dentista"
            />
          </Field>
        </div>
        <div className="sm:w-44">
          <Field label="Valor" htmlFor={`payable-amount${suffix}`}>
            <CurrencyInput
              id={`payable-amount${suffix}`}
              value={amount}
              onChange={setAmount}
            />
          </Field>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="sm:w-52">
          <Field label="Data" htmlFor={`payable-date${suffix}`}>
            <Input
              id={`payable-date${suffix}`}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
        </div>
        <div className="flex-1">
          <Field
            label="Descrição"
            htmlFor={`payable-description${suffix}`}
            hint="Opcional — do que se trata."
          >
            <Input
              id={`payable-description${suffix}`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={120}
              placeholder="Ex.: segunda parcela"
            />
          </Field>
        </div>
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
    </form>
  );
}
