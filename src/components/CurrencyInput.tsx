"use client";

/** Campo de dinheiro: o usuario digita so os numeros e o valor vai se formando
 *  da direita para a esquerda (1 2 3 -> R$ 1,23). Teclado numerico no celular. */

import { useEffect, useState } from "react";
import { cx } from "@/components/ui";

const centsFormat = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatCents(cents: number): string {
  return centsFormat.format(cents / 100);
}

export function CurrencyInput({
  id,
  value,
  onChange,
  placeholder = "0,00",
  autoFocus,
  className,
  "aria-describedby": describedBy,
}: {
  id: string;
  /** Valor em reais; 0 mostra o campo vazio. */
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  "aria-describedby"?: string;
}) {
  const [text, setText] = useState(() => (value > 0 ? formatCents(Math.round(value * 100)) : ""));

  // Reflete mudancas vindas de fora (ex.: carregar um gasto para editar).
  useEffect(() => {
    const next = value > 0 ? formatCents(Math.round(value * 100)) : "";
    setText((current) => {
      const currentCents = Math.round((Number(current.replace(/\D/g, "")) || 0));
      return currentCents === Math.round(value * 100) ? current : next;
    });
  }, [value]);

  return (
    <div className={cx("relative", className)}>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base text-ink-2">
        R$
      </span>
      <input
        id={id}
        // "decimal" abre o teclado numerico sem esconder a virgula
        inputMode="decimal"
        autoFocus={autoFocus}
        value={text}
        placeholder={placeholder}
        aria-describedby={describedBy}
        onChange={(event) => {
          const digits = event.target.value.replace(/\D/g, "").slice(0, 11);
          if (digits === "") {
            setText("");
            onChange(0);
            return;
          }
          const cents = Number(digits);
          setText(formatCents(cents));
          onChange(cents / 100);
        }}
        className="min-h-11 w-full rounded-xl border border-line bg-surface py-2.5 pl-10 pr-3 text-right text-lg font-semibold tabular-nums text-ink outline-none transition-colors placeholder:font-normal placeholder:text-muted focus:border-accent"
      />
    </div>
  );
}
