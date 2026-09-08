"use client";

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
import type { Receivable, ReceivableInput } from "@/lib/types";

export default function ReceivablesPage() {
  const {
    receivableSummary,
    addReceivable,
    editReceivable,
    markReceivableReceived,
    removeReceivable,
    loading,
  } = useFinance();

  const { pending, received, pendingTotal, receivedTotal } = receivableSummary;

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

  function validate(input: ReceivableInput): string | null {
    if (!input.person) return "Informe o nome de quem deve.";
    if (!(input.amount > 0)) return "Informe um valor maior que zero.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return "Informe uma data válida.";
    return null;
  }

  if (loading && pending.length === 0 && received.length === 0) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-ink">A receber</h1>

      {error ? <Alert tone="critical">{error}</Alert> : null}
      {notice ? <Alert tone="good">{notice}</Alert> : null}

      {/* ------------------------------------------------------ numero-heroi */}
      <Card>
        <p className="text-sm text-ink-2">Ainda a receber</p>
        <p className="mt-1 text-[44px] font-semibold leading-none text-ink sm:text-5xl">
          {formatBRL(pendingTotal)}
        </p>
        <p className="mt-2 text-sm text-ink-2">
          {pending.length === 0
            ? "Ninguém está te devendo."
            : `${pending.length} cobrança${pending.length > 1 ? "s" : ""} em aberto`}
          {received.length > 0 ? ` · ${formatBRL(receivedTotal)} já recebido` : ""}
        </p>
      </Card>

      {/* ----------------------------------------------------- novo lancamento */}
      <Card as="div">
        <SectionTitle
          title="Novo valor a receber"
          hint="Anote quem te deve para não esquecer de cobrar."
        />
        <ReceivableForm
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
              await addReceivable(input);
              setNotice(`${formatBRL(input.amount)} de ${input.person} registrado.`);
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
            Quando alguém ficar te devendo, cadastre aqui e marque como recebido no
            dia do pagamento.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-[var(--line)]">
            {pending.map((item) =>
              editingId === item.id ? (
                <li key={item.id} className="py-3">
                  <ReceivableForm
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
                        await editReceivable(item.id, input);
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
                      await markReceivableReceived(item.id, todayISO());
                      setNotice(`${item.person} pagou ${formatBRL(item.amount)}.`);
                    })
                  }
                  onRemove={() => {
                    if (
                      !window.confirm(
                        `Excluir o valor a receber de "${item.person}"? Essa ação não pode ser desfeita.`,
                      )
                    ) {
                      return;
                    }
                    void run(() => removeReceivable(item.id));
                  }}
                />
              ),
            )}
          </ul>
        )}
      </Card>

      {/* ------------------------------------------------------------ recebidos */}
      {received.length > 0 ? (
        <Card as="div">
          <SectionTitle
            title={`Recebidos (${received.length})`}
            hint={`${formatBRL(receivedTotal)} já entraram.`}
          />
          <ul className="divide-y divide-[var(--line)]">
            {received.map((item) => (
              <Row
                key={item.id}
                item={item}
                busy={busy}
                onEdit={() => setEditingId(item.id)}
                onToggle={() =>
                  run(async () => {
                    await markReceivableReceived(item.id, null);
                    setNotice(`${item.person} voltou para os pendentes.`);
                  })
                }
                onRemove={() => {
                  if (
                    !window.confirm(
                      `Excluir o valor a receber de "${item.person}"? Essa ação não pode ser desfeita.`,
                    )
                  ) {
                    return;
                  }
                  void run(() => removeReceivable(item.id));
                }}
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
  item: Receivable;
  busy: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const isReceived = item.receivedAt !== null;

  return (
    <li
      className={cx(
        "flex flex-wrap items-center gap-x-3 gap-y-2 py-3",
        isReceived && "opacity-70",
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-ink">{item.person}</p>
        <p className="mt-0.5 text-sm text-ink-2">
          {formatDate(item.date)}
          {item.description ? ` · ${item.description}` : ""}
          {isReceived ? (
            <span style={{ color: "var(--good-ink)" }}>
              {" "}
              · recebido em {formatDate(item.receivedAt!)}
            </span>
          ) : null}
        </p>
      </div>

      <span
        className="shrink-0 font-semibold tabular-nums"
        style={{ color: isReceived ? "var(--good-ink)" : "var(--ink-1)" }}
      >
        {formatBRL(item.amount)}
      </span>

      {/* no celular os botoes descem para a propria linha, com espaco de sobra */}
      <div className="-mr-2 flex w-full shrink-0 items-center justify-end gap-1 sm:w-auto">
        <Button
          variant={isReceived ? "ghost" : "secondary"}
          size="sm"
          onClick={onToggle}
          disabled={busy}
          className="whitespace-nowrap"
        >
          {isReceived ? (
            "Desfazer"
          ) : (
            <>
              <IconCheck className="h-4 w-4" />
              Recebido
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

function ReceivableForm({
  initial,
  busy,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: Receivable;
  busy: boolean;
  submitLabel: string;
  /** Retorna true quando salvou — o formulario novo se limpa nesse caso. */
  onSubmit: (input: ReceivableInput) => Promise<boolean>;
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
          <Field label="Pessoa" htmlFor={`person${suffix}`}>
            <Input
              id={`person${suffix}`}
              value={person}
              onChange={(e) => setPerson(e.target.value)}
              maxLength={60}
              placeholder="Ex.: Marina"
            />
          </Field>
        </div>
        <div className="sm:w-44">
          <Field label="Valor" htmlFor={`receivable-amount${suffix}`}>
            <CurrencyInput
              id={`receivable-amount${suffix}`}
              value={amount}
              onChange={setAmount}
            />
          </Field>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="sm:w-52">
          <Field label="Data" htmlFor={`receivable-date${suffix}`}>
            <Input
              id={`receivable-date${suffix}`}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
        </div>
        <div className="flex-1">
          <Field
            label="Descrição"
            htmlFor={`receivable-description${suffix}`}
            hint="Opcional — do que se trata."
          >
            <Input
              id={`receivable-description${suffix}`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={120}
              placeholder="Ex.: rachar o jantar"
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
