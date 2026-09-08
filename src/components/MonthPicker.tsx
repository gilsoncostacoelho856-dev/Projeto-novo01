"use client";

/** Seletor de mes: setas para navegar e um select com os ultimos 18 meses. */

import { useFinance } from "@/lib/finance-context";
import { addMonths, currentMonth, formatMonth, recentMonths } from "@/lib/format";
import { IconChevronLeft, IconChevronRight } from "@/components/icons";
import { IconButton } from "@/components/ui";

export function MonthPicker() {
  const { month, setMonth } = useFinance();
  const options = recentMonths(18, currentMonth());
  // um mes selecionado fora da janela padrao (ex.: link antigo) entra na lista
  if (!options.includes(month)) options.unshift(month);

  return (
    <div className="flex items-center gap-1">
      <IconButton label="Mês anterior" onClick={() => setMonth(addMonths(month, -1))}>
        <IconChevronLeft />
      </IconButton>

      <div className="relative">
        <select
          value={month}
          onChange={(event) => setMonth(event.target.value)}
          aria-label="Mês de referência"
          className="min-h-11 appearance-none rounded-xl bg-transparent px-2 text-center text-sm font-semibold text-ink outline-none hover:bg-surface-2"
        >
          {options.map((m) => (
            <option key={m} value={m}>
              {formatMonth(m)}
            </option>
          ))}
        </select>
      </div>

      <IconButton
        label="Próximo mês"
        onClick={() => setMonth(addMonths(month, 1))}
        disabled={month >= currentMonth()}
        className="disabled:pointer-events-none disabled:opacity-30"
      >
        <IconChevronRight />
      </IconButton>
    </div>
  );
}
