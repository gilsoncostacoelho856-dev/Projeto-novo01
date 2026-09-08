"use client";

import Link from "next/link";
import { useFinance } from "@/lib/finance-context";
import { statusColor, statusOf } from "@/lib/derive";
import {
  daysInMonth,
  elapsedDays,
  formatBRL,
  formatMonth,
  formatPercent,
  todayISO,
} from "@/lib/format";
import { BudgetMeter } from "@/components/charts/BudgetMeter";
import { CategoryStack } from "@/components/charts/CategoryStack";
import { DailyColumns } from "@/components/charts/DailyColumns";
import { MonthPicker } from "@/components/MonthPicker";
import { Alert, Button, Card, EmptyState, SectionTitle, Skeleton } from "@/components/ui";
import { IconAlert, IconPlus, IconTarget, IconTrendUp } from "@/components/icons";

export default function DashboardPage() {
  const { month, summary, previousTotal, loading, error, categories } = useFinance();
  const {
    totalSpent,
    totalIncome,
    leftover,
    spentRatio,
    totalLimit,
    totalRemaining,
    budgetRatio,
    rows,
    over,
    warning,
  } = summary;

  const negative = totalIncome > 0 && leftover < 0;

  const delta = previousTotal > 0 ? (totalSpent - previousTotal) / previousTotal : null;
  const withBudget = rows.filter((r) => r.limit !== null);
  const daysLeft = Math.max(daysInMonth(month) - elapsedDays(month), 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-ink">Painel</h1>
        <MonthPicker />
      </div>

      {error ? <Alert tone="critical">{error}</Alert> : null}

      {loading ? (
        <>
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-52 w-full" />
        </>
      ) : (
        <>
          {negative ? (
            <Alert tone="critical" title="Você gastou mais do que ganhou neste mês">
              {formatBRL(Math.abs(leftover))} acima da renda de {formatMonth(month)}.{" "}
              <Link href="/renda" className="underline">
                Rever renda
              </Link>
            </Alert>
          ) : null}

          {over.length > 0 ? (
            <Alert
              tone="critical"
              title={
                over.length === 1
                  ? "1 categoria passou do limite"
                  : `${over.length} categorias passaram do limite`
              }
            >
              {over.map((r) => r.category.name).join(", ")}.{" "}
              <Link href="/orcamento" className="underline">
                Rever orçamento
              </Link>
            </Alert>
          ) : null}

          {warning.length > 0 ? (
            <Alert
              tone="warning"
              title={
                warning.length === 1
                  ? "1 categoria perto do limite"
                  : `${warning.length} categorias perto do limite`
              }
            >
              Acima de {formatPercent(0.8)} do limite: {warning.map((r) => r.category.name).join(", ")}.
            </Alert>
          ) : null}

          {/* ---------------------------------------------------- numero-heroi */}
          <Card>
            <p className="text-sm text-ink-2">Gasto em {formatMonth(month)}</p>
            <p className="mt-1 text-[44px] font-semibold leading-none text-ink sm:text-5xl">
              {formatBRL(totalSpent)}
            </p>

            {delta !== null ? (
              <p className="mt-2 flex items-center gap-1.5 text-sm">
                <span
                  className="font-medium"
                  style={{ color: delta > 0 ? "var(--critical)" : "var(--good-ink)" }}
                >
                  {delta > 0 ? "▲" : "▼"} {formatPercent(Math.abs(delta))}
                </span>
                <span className="text-ink-2">
                  vs. mês anterior ({formatBRL(previousTotal)})
                </span>
              </p>
            ) : null}

            {totalLimit > 0 ? (
              <div className="mt-4">
                <div
                  className="h-2.5 w-full overflow-hidden rounded"
                  style={{
                    background: `color-mix(in oklab, ${statusColor(statusOf(budgetRatio))} 20%, var(--surface))`,
                  }}
                  role="img"
                  aria-label={`${formatBRL(totalSpent)} de ${formatBRL(totalLimit)} do orçamento total`}
                >
                  <div
                    className="h-full transition-[width] duration-300"
                    style={{
                      width: `${Math.min(budgetRatio ?? 0, 1) * 100}%`,
                      background: statusColor(statusOf(budgetRatio)),
                      borderRadius: "4px",
                    }}
                  />
                </div>
                <p className="mt-2 text-sm text-ink-2">
                  {totalRemaining >= 0 ? (
                    <>
                      Restam{" "}
                      <span className="font-semibold text-ink">
                        {formatBRL(totalRemaining)}
                      </span>{" "}
                      de {formatBRL(totalLimit)} orçados
                      {daysLeft > 0 ? ` · faltam ${daysLeft} dia${daysLeft > 1 ? "s" : ""}` : ""}
                    </>
                  ) : (
                    <span className="flex items-center gap-1.5 text-[var(--critical)]">
                      <IconAlert className="h-4 w-4" />
                      {formatBRL(Math.abs(totalRemaining))} acima do orçamento total
                    </span>
                  )}
                </p>
              </div>
            ) : null}
          </Card>

          {/* ------------------------------------------------- sobra do mes */}
          {/* a borda esquerda grossa repete o padrao dos alertas criticos */}
          <Card
            style={negative ? { borderLeft: "4px solid var(--critical)" } : undefined}
          >
            {totalIncome === 0 ? (
              <EmptyState
                title="Cadastre sua renda do mês"
                action={
                  <Link href="/renda">
                    <Button>
                      <IconTrendUp className="h-4 w-4" />
                      Cadastrar renda
                    </Button>
                  </Link>
                }
              >
                Com a renda de {formatMonth(month)} cadastrada, o painel mostra quanto
                sobra depois dos gastos.
              </EmptyState>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <p className="text-sm text-ink-2">Sobra do mês</p>
                  {negative ? (
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
                      style={{
                        color: "var(--critical)",
                        background:
                          "color-mix(in oklab, var(--critical) 14%, var(--surface))",
                      }}
                    >
                      <IconAlert className="h-3.5 w-3.5" />
                      No vermelho
                    </span>
                  ) : null}
                </div>

                <p
                  className="mt-1 text-[40px] font-semibold leading-none sm:text-[44px]"
                  style={{
                    color: negative ? "var(--critical)" : "var(--good-ink)",
                  }}
                >
                  {negative ? `− ${formatBRL(Math.abs(leftover))}` : formatBRL(leftover)}
                </p>

                <p className="mt-2 text-sm text-ink-2">
                  Renda{" "}
                  <span className="font-semibold text-ink">{formatBRL(totalIncome)}</span>{" "}
                  − gastos{" "}
                  <span className="font-semibold text-ink">{formatBRL(totalSpent)}</span>
                </p>

                {/* quanto da renda ja foi consumido pelos gastos */}
                <div
                  className="mt-4 h-2.5 w-full overflow-hidden rounded"
                  style={{
                    background: `color-mix(in oklab, ${negative ? "var(--critical)" : "var(--good)"} 20%, var(--surface))`,
                  }}
                  role="img"
                  aria-label={`${formatBRL(totalSpent)} gastos de ${formatBRL(totalIncome)} de renda`}
                >
                  <div
                    className="h-full rounded transition-[width] duration-300"
                    style={{
                      width: `${Math.min(spentRatio ?? 0, 1) * 100}%`,
                      background: negative ? "var(--critical)" : "var(--accent)",
                    }}
                  />
                </div>
                <p className="mt-2 text-sm text-ink-2">
                  {negative ? (
                    <span className="flex items-center gap-1.5 text-[var(--critical)]">
                      <IconAlert className="h-4 w-4" />
                      {formatBRL(Math.abs(leftover))} acima da renda do mês
                    </span>
                  ) : (
                    <>
                      Os gastos consumiram {formatPercent(spentRatio ?? 0)} da renda
                      {daysLeft > 0
                        ? ` · faltam ${daysLeft} dia${daysLeft > 1 ? "s" : ""}`
                        : ""}
                    </>
                  )}
                </p>
              </>
            )}
          </Card>

          {/* --------------------------------------------------- linha de KPIs */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="Orçamento do mês" value={totalLimit > 0 ? formatBRL(totalLimit) : "—"} />
            <Stat
              label="Média por dia"
              value={formatBRL(summary.dailyAverage)}
              hint={`Projeção: ${formatBRL(summary.projected)}`}
            />
            <Stat
              label="Categorias no limite"
              value={`${over.length + warning.length} de ${withBudget.length || 0}`}
              hint={
                over.length > 0
                  ? `${over.length} já estourou`
                  : warning.length > 0
                    ? `${warning.length} passou de ${formatPercent(0.8)}`
                    : "Tudo sob controle"
              }
              tone={over.length > 0 ? "critical" : "default"}
              className="col-span-2 sm:col-span-1"
            />
          </div>

          {totalSpent === 0 ? (
            <Card>
              <EmptyState
                title="Nenhum gasto neste mês"
                action={
                  <Link href="/gastos">
                    <Button>
                      <IconPlus className="h-4 w-4" />
                      Registrar gasto
                    </Button>
                  </Link>
                }
              >
                Registre o primeiro gasto de {formatMonth(month)} para ver os gráficos.
              </EmptyState>
            </Card>
          ) : (
            <>
              {/* ------------------------------------ gasto vs. limite (medidores) */}
              <Card>
                <SectionTitle
                  title="Gasto vs. limite"
                  hint="Cada categoria comparada ao seu limite do mês."
                  action={
                    <Link href="/orcamento">
                      <Button variant="secondary" size="sm">
                        <IconTarget className="h-4 w-4" />
                        Ajustar
                      </Button>
                    </Link>
                  }
                />
                {withBudget.length === 0 ? (
                  <EmptyState
                    title="Nenhum limite definido"
                    action={
                      <Link href="/orcamento">
                        <Button size="sm">Definir limites</Button>
                      </Link>
                    }
                  >
                    Defina um limite mensal por categoria para acompanhar quanto ainda
                    pode gastar.
                  </EmptyState>
                ) : (
                  <ul className="divide-y divide-[var(--line)]">
                    {rows
                      .filter((r) => r.limit !== null || r.spent > 0)
                      .map((row) => (
                        <BudgetMeter key={row.category.id} row={row} />
                      ))}
                  </ul>
                )}
              </Card>

              {/* -------------------------------------------- tendencia no mes */}
              <Card>
                <SectionTitle
                  title="Gastos por dia"
                  hint={`Maior dia destacado · média de ${formatBRL(summary.dailyAverage)} por dia`}
                />
                <DailyColumns data={summary.daily} today={todayISO()} />
              </Card>

              {/* ------------------------------------------- parte-do-todo */}
              <Card>
                <SectionTitle
                  title="Para onde foi o dinheiro"
                  hint="Participação de cada categoria no total do mês."
                />
                <CategoryStack rows={rows} total={totalSpent} />

                <details className="mt-4 text-sm">
                  <summary className="cursor-pointer text-ink-2 hover:text-ink">
                    Ver como tabela
                  </summary>
                  <table className="mt-3 w-full text-left">
                    <thead>
                      <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                        <th className="py-2 font-medium">Categoria</th>
                        <th className="py-2 text-right font-medium">Gasto</th>
                        <th className="py-2 text-right font-medium">Limite</th>
                        <th className="py-2 text-right font-medium">%</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--line)]">
                      {rows.map((r) => (
                        <tr key={r.category.id}>
                          <td className="py-2 text-ink">{r.category.name}</td>
                          <td className="py-2 text-right tabular-nums text-ink">
                            {formatBRL(r.spent)}
                          </td>
                          <td className="py-2 text-right tabular-nums text-ink-2">
                            {r.limit === null ? "—" : formatBRL(r.limit)}
                          </td>
                          <td className="py-2 text-right tabular-nums text-ink-2">
                            {r.ratio === null ? "—" : formatPercent(r.ratio)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              </Card>
            </>
          )}

          {categories.length === 0 ? (
            <Alert tone="info">
              Você ainda não tem categorias.{" "}
              <Link href="/categorias" className="underline">
                Criar categorias
              </Link>
            </Alert>
          ) : null}
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone = "default",
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "critical";
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-line bg-surface p-4 ${className ?? ""}`}
    >
      <p className="text-sm text-ink-2">{label}</p>
      <p
        className="mt-1 text-xl font-semibold text-ink"
        style={tone === "critical" ? { color: "var(--critical)" } : undefined}
      >
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
