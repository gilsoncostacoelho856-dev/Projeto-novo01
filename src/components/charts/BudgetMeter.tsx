"use client";

/** Medidor de uma razao contra um limite (gasto vs. orcamento da categoria).
 *  Forma escolhida de proposito: para "um valor contra um teto" o medidor le
 *  melhor que qualquer grafico de barras de duas series.
 *
 *  A cor do preenchimento carrega a severidade (acento -> alerta -> critico) e a
 *  trilha e um passo mais claro do mesmo tom. Como cor sozinha nao pode carregar
 *  significado, todo estado vem acompanhado de icone + rotulo em texto. */

import type { CategorySummary } from "@/lib/derive";
import { seriesColor, statusColor } from "@/lib/derive";
import { formatBRL, formatPercent } from "@/lib/format";
import { IconAlert, IconCheck } from "@/components/icons";
import { Swatch } from "@/components/ui";

export function BudgetMeter({ row }: { row: CategorySummary }) {
  const { category, spent, limit, remaining, ratio, status } = row;
  const fill = statusColor(status);
  const width = ratio === null ? 0 : Math.min(ratio, 1) * 100;

  return (
    <li className="py-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2">
          <Swatch color={seriesColor(category.colorIndex)} />
          <span className="truncate font-medium text-ink">{category.name}</span>
        </span>
        <span className="shrink-0 text-sm text-ink-2 tabular-nums">
          <span className="font-semibold text-ink">{formatBRL(spent)}</span>
          {limit !== null ? ` de ${formatBRL(limit)}` : ""}
        </span>
      </div>

      {limit === null ? (
        <p className="mt-1.5 text-sm text-muted">Sem limite definido</p>
      ) : (
        <>
          <div
            className="mt-2 h-2.5 w-full overflow-hidden rounded"
            style={{ background: `color-mix(in oklab, ${fill} 20%, var(--surface))` }}
            role="img"
            aria-label={`${category.name}: ${formatBRL(spent)} de ${formatBRL(limit)} (${formatPercent(ratio ?? 0)})`}
          >
            <div
              className="h-full transition-[width] duration-300"
              style={{ width: `${width}%`, background: fill, borderRadius: "4px" }}
            />
          </div>

          <div className="mt-1.5 flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-1.5">
              {/* o icone usa a cor de status; o texto fica em tom de tinta legivel */}
              <span style={{ color: fill }} className="shrink-0">
                {status === "ok" ? (
                  <IconCheck className="h-4 w-4" />
                ) : (
                  <IconAlert className="h-4 w-4" />
                )}
              </span>
              <span className="font-medium" style={{ color: statusInk(status) }}>
                {statusLabel(status, remaining)}
              </span>
            </span>
            <span className="shrink-0 text-ink-2 tabular-nums">
              {formatPercent(ratio ?? 0)}
            </span>
          </div>
        </>
      )}
    </li>
  );
}

function statusLabel(status: CategorySummary["status"], remaining: number | null): string {
  if (remaining === null) return "";
  if (status === "over") return `${formatBRL(Math.abs(remaining))} acima do limite`;
  if (status === "warning") return `Perto do limite · restam ${formatBRL(remaining)}`;
  return `Restam ${formatBRL(remaining)}`;
}

/** Tom de texto para o estado — passos com contraste suficiente para leitura. */
function statusInk(status: CategorySummary["status"]): string {
  if (status === "over") return "var(--critical)";
  if (status === "warning") return "var(--ink-2)";
  return "var(--good-ink)";
}
