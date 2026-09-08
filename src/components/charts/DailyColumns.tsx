"use client";

/** Tendencia no mes: quanto foi gasto em cada dia.
 *  Serie unica — um tom so (o acento), sem legenda: o titulo ja diz o que e.
 *  Rotulo direto apenas no extremo (o maior dia); os demais valores ficam no
 *  eixo, na dica de foco/hover e na lista do historico. */

import { useState } from "react";
import { formatBRL, formatBRLCompact, formatDateLong } from "@/lib/format";

type Point = { date: string; day: number; total: number };

export function DailyColumns({ data, today }: { data: Point[]; today: string }) {
  const [active, setActive] = useState<Point | null>(null);

  const max = Math.max(...data.map((d) => d.total), 0);
  if (max <= 0) {
    return (
      <p className="py-8 text-center text-sm text-ink-2">
        Nenhum gasto neste mês ainda.
      </p>
    );
  }

  // folga de 15% no topo: o rotulo do maior dia cabe dentro da area do grafico
  const top = niceCeiling(max * 1.15);
  const peak = data.reduce((a, b) => (b.total > a.total ? b : a), data[0]);
  const peakLeft = ((data.indexOf(peak) + 0.5) / data.length) * 100;
  const ticks = [top, top / 2, 0];

  return (
    <div>
      <div className="flex gap-2">
        {/* eixo Y: valores arredondados, tipografia tabular para alinhar */}
        <div className="flex h-40 w-14 shrink-0 flex-col justify-between py-0 text-right text-[11px] tabular-nums text-muted">
          {ticks.map((t) => (
            <span key={t} className="leading-none">
              {t === 0 ? "0" : formatBRLCompact(t)}
            </span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1">
          {/* linhas de grade: 1px, solidas, recuadas ao fundo */}
          <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
            {ticks.map((t) => (
              <div key={t} className="h-px w-full" style={{ background: "var(--grid)" }} />
            ))}
          </div>

          {active ? (
            <div
              className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm shadow-lg"
              style={{ left: `clamp(56px, ${((data.indexOf(active) + 0.5) / data.length) * 100}%, calc(100% - 56px))` }}
            >
              <span className="font-medium text-ink">{formatBRL(active.total)}</span>
              <span className="text-ink-2"> · {formatDateLong(active.date)}</span>
            </div>
          ) : null}

          {!active && peak.total > 0 ? (
            <span
              className="pointer-events-none absolute -translate-x-1/2 whitespace-nowrap text-[11px] font-medium tabular-nums text-ink-2"
              style={{
                left: `clamp(28px, ${peakLeft}%, calc(100% - 28px))`,
                bottom: `calc(${(peak.total / top) * 100}% + 22px)`,
              }}
            >
              {formatBRL(peak.total)}
            </span>
          ) : null}

          <div
            className="flex h-40 items-end gap-px"
            onMouseLeave={() => setActive(null)}
          >
            {data.map((point) => {
              const isFuture = point.date > today;
              const height = (point.total / top) * 100;
              return (
                <button
                  key={point.date}
                  type="button"
                  className="group flex h-full min-w-0 flex-1 cursor-default items-end"
                  onMouseEnter={() => setActive(point)}
                  onFocus={() => setActive(point)}
                  onBlur={() => setActive(null)}
                  aria-label={`${formatDateLong(point.date)}: ${formatBRL(point.total)}`}
                >
                  <span
                    className="w-full transition-opacity group-hover:opacity-80"
                    style={{
                      height: point.total > 0 ? `max(${height}%, 3px)` : "1px",
                      background:
                        point.total > 0
                          ? "var(--accent)"
                          : isFuture
                            ? "transparent"
                            : "var(--grid)",
                      borderRadius: "4px 4px 0 0",
                      maxWidth: "24px",
                      marginInline: "auto",
                    }}
                  />
                </button>
              );
            })}
          </div>

          {/* eixo X: um rotulo a cada 5 dias, para nao virar ruido no celular */}
          <div className="mt-1.5 flex gap-px text-[11px] tabular-nums text-muted">
            {data.map((point) => (
              <span key={point.date} className="min-w-0 flex-1 text-center">
                {point.day === 1 || point.day % 5 === 0 ? point.day : " "}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Arredonda o topo do eixo para um numero "limpo" (10, 25, 50, 100, ...). */
function niceCeiling(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10]) {
    if (value <= step * magnitude) return step * magnitude;
  }
  return 10 * magnitude;
}
