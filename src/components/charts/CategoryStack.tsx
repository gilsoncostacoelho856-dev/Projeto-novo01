"use client";

/** Parte-do-todo: como o gasto do mes se divide entre as categorias.
 *  Barra empilhada horizontal — cabe no celular e aguenta nomes longos.
 *
 *  Paleta categorica em ordem fixa (8 slots, validada para daltonismo); a cauda
 *  vira "Outras". Os segmentos sao separados por 2px da cor da superficie, e a
 *  identidade nunca depende so da cor: ha legenda rotulada com valores e uma
 *  visao em tabela. */

import { useState } from "react";
import type { CategorySummary } from "@/lib/derive";
import { seriesColor } from "@/lib/derive";
import { formatBRL, formatPercent } from "@/lib/format";
import { Swatch } from "@/components/ui";

const MAX_SLICES = 8;
const OTHER_COLOR = "var(--ink-3)";

type Slice = { key: string; name: string; value: number; share: number; color: string };

function buildSlices(rows: CategorySummary[], total: number): Slice[] {
  const spending = rows
    .filter((r) => r.spent > 0)
    .sort((a, b) => b.spent - a.spent)
    .map(
      (r): Slice => ({
        key: r.category.id,
        name: r.category.name,
        value: r.spent,
        share: total > 0 ? r.spent / total : 0,
        color: seriesColor(r.category.colorIndex),
      }),
    );

  if (spending.length <= MAX_SLICES) return spending;

  const head = spending.slice(0, MAX_SLICES - 1);
  const tail = spending.slice(MAX_SLICES - 1);
  const value = tail.reduce((sum, s) => sum + s.value, 0);
  return [
    ...head,
    {
      key: "__other__",
      name: `Outras (${tail.length})`,
      value,
      share: total > 0 ? value / total : 0,
      color: OTHER_COLOR,
    },
  ];
}

export function CategoryStack({
  rows,
  total,
}: {
  rows: CategorySummary[];
  total: number;
}) {
  const [active, setActive] = useState<Slice | null>(null);
  const slices = buildSlices(rows, total);

  if (slices.length === 0) {
    return <p className="text-sm text-ink-2">Nenhum gasto registrado neste mês.</p>;
  }

  return (
    <div>
      <div className="relative">
        {/* a dica flutua acima da barra e nunca cobre o proprio dado */}
        {active ? (
          <div className="pointer-events-none absolute -top-1 left-0 right-0 flex justify-center">
            <div className="-translate-y-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm shadow-lg">
              <span className="font-medium text-ink">{active.name}</span>
              <span className="text-ink-2">
                {" · "}
                {formatBRL(active.value)} ({formatPercent(active.share)})
              </span>
            </div>
          </div>
        ) : null}

        <div
          className="flex h-7 w-full gap-0.5"
          onMouseLeave={() => setActive(null)}
          role="img"
          aria-label={`Distribuição do gasto: ${slices
            .map((s) => `${s.name} ${formatBRL(s.value)}`)
            .join(", ")}`}
        >
          {slices.map((slice, i) => (
            <button
              key={slice.key}
              type="button"
              // alvo de toque maior que a marca: o botao ocupa toda a altura
              className="h-full min-w-[3px] cursor-default transition-opacity"
              style={{
                flex: `${Math.max(slice.share, 0.005)} 1 0`,
                background: slice.color,
                opacity: active && active.key !== slice.key ? 0.45 : 1,
                borderRadius:
                  slices.length === 1
                    ? "4px"
                    : i === 0
                      ? "4px 0 0 4px"
                      : i === slices.length - 1
                        ? "0 4px 4px 0"
                        : "0",
              }}
              onMouseEnter={() => setActive(slice)}
              onFocus={() => setActive(slice)}
              onBlur={() => setActive(null)}
              aria-label={`${slice.name}: ${formatBRL(slice.value)}, ${formatPercent(slice.share)} do mês`}
            />
          ))}
        </div>
      </div>

      {/* legenda com rotulo e valor — identidade nunca fica so na cor */}
      <ul className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
        {slices.map((slice) => (
          <li
            key={slice.key}
            className="flex items-baseline justify-between gap-3 text-sm"
            onMouseEnter={() => setActive(slice)}
            onMouseLeave={() => setActive(null)}
          >
            <span className="flex min-w-0 items-center gap-2">
              <Swatch color={slice.color} />
              <span className="truncate text-ink-2">{slice.name}</span>
            </span>
            <span className="shrink-0 tabular-nums text-ink">
              {formatBRL(slice.value)}
              <span className="ml-1.5 text-muted">{formatPercent(slice.share)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
