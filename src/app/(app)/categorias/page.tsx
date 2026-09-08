"use client";

import { useState } from "react";
import { errorMessage, useFinance } from "@/lib/finance-context";
import { seriesColor } from "@/lib/derive";
import { formatBRL } from "@/lib/format";
import {
  Alert,
  Button,
  Card,
  IconButton,
  Input,
  SectionTitle,
  Select,
  Skeleton,
  Swatch,
} from "@/components/ui";
import { IconPencil, IconPlus, IconTrash } from "@/components/icons";

const SLOTS = [0, 1, 2, 3, 4, 5, 6, 7];

export default function CategoriesPage() {
  const { categories, summary, addCategory, editCategory, removeCategory, loading } =
    useFinance();

  const [name, setName] = useState("");
  const [colorIndex, setColorIndex] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [moveTo, setMoveTo] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const spentByCategory = new Map(summary.rows.map((r) => [r.category.id, r.spent]));

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
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
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Dê um nome para a categoria.");
      return;
    }
    await run(async () => {
      await addCategory(trimmed, colorIndex);
      setName("");
      // proxima cor livre, mantendo a ordem fixa da paleta
      setColorIndex((current) => (current + 1) % SLOTS.length);
    });
  }

  if (loading && categories.length === 0) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-ink">Categorias</h1>

      {error ? <Alert tone="critical">{error}</Alert> : null}

      <Card as="div">
        <SectionTitle
          title="Nova categoria"
          hint="Use nomes curtos — eles aparecem nos gráficos."
        />
        <form onSubmit={create} className="flex flex-col gap-3">
          <div className="flex gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              placeholder="Ex.: Pets"
              aria-label="Nome da categoria"
            />
            <Button type="submit" disabled={busy}>
              <IconPlus className="h-4 w-4" />
              Criar
            </Button>
          </div>
          <ColorPicker value={colorIndex} onChange={setColorIndex} />
        </form>
      </Card>

      <Card as="div">
        <SectionTitle title={`Suas categorias (${categories.length})`} />
        <ul className="divide-y divide-[var(--line)]">
          {categories.map((category) => {
            const spent = spentByCategory.get(category.id) ?? 0;

            if (editingId === category.id) {
              return (
                <li key={category.id} className="py-3">
                  <EditRow
                    initialName={category.name}
                    initialColor={category.colorIndex}
                    busy={busy}
                    onCancel={() => setEditingId(null)}
                    onSave={(nextName, nextColor) =>
                      run(async () => {
                        await editCategory(category.id, {
                          name: nextName,
                          colorIndex: nextColor,
                        });
                        setEditingId(null);
                      })
                    }
                  />
                </li>
              );
            }

            return (
              <li key={category.id} className="py-2">
                <div className="flex items-center gap-3">
                  <Swatch color={seriesColor(category.colorIndex)} className="h-3 w-3" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink">{category.name}</p>
                    <p className="text-xs text-ink-2">
                      {spent > 0 ? `${formatBRL(spent)} neste mês` : "Sem gastos no mês"}
                    </p>
                  </div>
                  <IconButton
                    label={`Editar ${category.name}`}
                    onClick={() => {
                      setEditingId(category.id);
                      setDeletingId(null);
                    }}
                  >
                    <IconPencil className="h-4 w-4" />
                  </IconButton>
                  <IconButton
                    label={`Excluir ${category.name}`}
                    onClick={() => {
                      setDeletingId(deletingId === category.id ? null : category.id);
                      setMoveTo(categories.find((c) => c.id !== category.id)?.id ?? "");
                      setEditingId(null);
                    }}
                    disabled={categories.length === 1}
                    className="disabled:opacity-30"
                  >
                    <IconTrash className="h-4 w-4" />
                  </IconButton>
                </div>

                {deletingId === category.id ? (
                  <div className="mt-2 rounded-xl border border-line bg-surface-2 p-3">
                    <p className="text-sm text-ink">
                      Excluir <strong>{category.name}</strong>? Os gastos já lançados
                      precisam ir para outra categoria.
                    </p>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <Select
                        value={moveTo}
                        onChange={(e) => setMoveTo(e.target.value)}
                        aria-label="Mover gastos para"
                        className="sm:flex-1"
                      >
                        {categories
                          .filter((c) => c.id !== category.id)
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              Mover gastos para {c.name}
                            </option>
                          ))}
                      </Select>
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          onClick={() => setDeletingId(null)}
                          disabled={busy}
                        >
                          Cancelar
                        </Button>
                        <Button
                          variant="danger"
                          disabled={busy || !moveTo}
                          onClick={() =>
                            run(async () => {
                              await removeCategory(category.id, moveTo);
                              setDeletingId(null);
                            })
                          }
                        >
                          Excluir
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}

function EditRow({
  initialName,
  initialColor,
  busy,
  onSave,
  onCancel,
}: {
  initialName: string;
  initialColor: number;
  busy: boolean;
  onSave: (name: string, colorIndex: number) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [colorIndex, setColorIndex] = useState(initialColor);

  return (
    <div className="flex flex-col gap-3">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={40}
        aria-label="Nome da categoria"
        autoFocus
      />
      <ColorPicker value={colorIndex} onChange={setColorIndex} />
      <div className="flex gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          Cancelar
        </Button>
        <Button
          onClick={() => onSave(name.trim() || initialName, colorIndex)}
          disabled={busy}
        >
          Salvar
        </Button>
      </div>
    </div>
  );
}

function ColorPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (index: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Cor da categoria">
      {SLOTS.map((slot) => (
        <button
          key={slot}
          type="button"
          onClick={() => onChange(slot)}
          aria-label={`Cor ${slot + 1}`}
          aria-pressed={value === slot}
          className="h-9 w-9 rounded-full border-2 transition-transform"
          style={{
            background: seriesColor(slot),
            borderColor: value === slot ? "var(--ink-1)" : "transparent",
            transform: value === slot ? "scale(1.05)" : undefined,
          }}
        />
      ))}
    </div>
  );
}
