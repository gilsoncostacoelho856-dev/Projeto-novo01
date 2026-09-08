"use client";

/** Moldura do app: cabecalho fixo, navegacao inferior no celular e lateral no
 *  desktop. Pensado mobile-first — os alvos de toque tem 44px e a barra inferior
 *  respeita a area segura do iPhone. */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useFinance } from "@/lib/finance-context";
import { useTheme } from "@/lib/theme";
import { cx, IconButton } from "@/components/ui";
import {
  IconDashboard,
  IconList,
  IconLogout,
  IconMoon,
  IconPlus,
  IconSun,
  IconTag,
  IconTarget,
  IconWallet,
} from "@/components/icons";

const NAV = [
  { href: "/dashboard", label: "Painel", Icon: IconDashboard },
  { href: "/gastos", label: "Novo", Icon: IconPlus },
  { href: "/orcamento", label: "Orçamento", Icon: IconTarget },
  { href: "/historico", label: "Histórico", Icon: IconList },
  { href: "/categorias", label: "Categorias", Icon: IconTag },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, signOut, mode } = useFinance();
  const { theme, toggle } = useTheme();

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="min-h-dvh lg:flex">
      {/* navegacao lateral (desktop) */}
      <aside className="hidden w-60 shrink-0 border-r border-line bg-surface lg:block">
        <div className="sticky top-0 flex h-dvh flex-col p-4">
          <Link href="/dashboard" className="mb-6 flex items-center gap-2 px-2 py-1">
            <span className="text-accent">
              <IconWallet className="h-6 w-6" />
            </span>
            <span className="whitespace-nowrap font-semibold text-ink">Minhas Finanças</span>
          </Link>

          <nav className="flex flex-col gap-1">
            {NAV.map(({ href, label, Icon }) => (
              <Link
                key={href}
                href={href}
                aria-current={isActive(href) ? "page" : undefined}
                className={cx(
                  "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
                  isActive(href)
                    ? "bg-surface-2 text-ink"
                    : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                )}
              >
                <Icon />
                {label}
              </Link>
            ))}
          </nav>

          <div className="mt-auto border-t border-line pt-3">
            {mode === "demo" ? (
              <p className="mb-2 rounded-lg bg-surface-2 px-3 py-2 text-xs text-ink-2">
                Modo demonstração — os dados ficam só neste navegador.
              </p>
            ) : null}
            <p className="truncate px-3 text-xs text-muted">{user?.email}</p>
            <button
              type="button"
              onClick={() => void signOut()}
              className="mt-1 flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <IconLogout />
              Sair
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-line bg-surface/95 px-3 py-2 backdrop-blur sm:px-5">
          <Link href="/dashboard" className="flex items-center gap-2 lg:hidden">
            <span className="text-accent">
              <IconWallet className="h-6 w-6" />
            </span>
            <span className="font-semibold text-ink">Minhas Finanças</span>
          </Link>

          <div className="ml-auto flex items-center gap-1">
            <IconButton
              label={theme === "dark" ? "Usar tema claro" : "Usar tema escuro"}
              onClick={toggle}
            >
              {theme === "dark" ? <IconSun /> : <IconMoon />}
            </IconButton>
            <IconButton label="Sair" onClick={() => void signOut()} className="lg:hidden">
              <IconLogout />
            </IconButton>
          </div>
        </header>

        <main className="mx-auto w-full max-w-4xl flex-1 px-3 pb-28 pt-4 sm:px-5 lg:pb-10">
          {children}
        </main>
      </div>

      {/* navegacao inferior (celular) */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Navegação principal"
      >
        <ul className="mx-auto flex max-w-lg">
          {NAV.map(({ href, label, Icon }) => (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={isActive(href) ? "page" : undefined}
                className={cx(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors",
                  isActive(href) ? "text-accent" : "text-ink-2",
                )}
              >
                <Icon />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
