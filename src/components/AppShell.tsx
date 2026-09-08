"use client";

/** Moldura do app: cabecalho fixo, navegacao inferior no celular e lateral no
 *  desktop. Pensado mobile-first — os alvos de toque tem 44px e a barra inferior
 *  respeita a area segura do iPhone.
 *
 *  Sao sete secoes, mais do que cabe numa barra inferior de celular: as quatro
 *  do dia a dia ficam visiveis e o resto entra no menu "Mais". No desktop a
 *  lateral mostra todas. */

import { useEffect, useState } from "react";
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
  IconMore,
  IconPlus,
  IconReceipt,
  IconSun,
  IconTag,
  IconTarget,
  IconTrendUp,
  IconUsers,
  IconWallet,
  IconX,
} from "@/components/icons";

type NavItem = {
  href: string;
  label: string;
  Icon: (props: { className?: string }) => React.ReactElement;
};

/** Barra inferior do celular e topo da lateral. */
const NAV_PRIMARY: NavItem[] = [
  { href: "/dashboard", label: "Painel", Icon: IconDashboard },
  { href: "/gastos", label: "Novo", Icon: IconPlus },
  { href: "/orcamento", label: "Orçamento", Icon: IconTarget },
  { href: "/historico", label: "Histórico", Icon: IconList },
];

/** Menu "Mais" no celular; continuam na lateral do desktop. */
const NAV_SECONDARY: NavItem[] = [
  { href: "/renda", label: "Renda", Icon: IconTrendUp },
  { href: "/a-receber", label: "A receber", Icon: IconUsers },
  { href: "/a-pagar", label: "A pagar", Icon: IconReceipt },
  { href: "/categorias", label: "Categorias", Icon: IconTag },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, signOut, mode } = useFinance();
  const { theme, toggle } = useTheme();
  const [moreOpen, setMoreOpen] = useState(false);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const inMore = NAV_SECONDARY.some((item) => isActive(item.href));

  // Fecha o menu ao navegar e com Esc.
  useEffect(() => setMoreOpen(false), [pathname]);
  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMoreOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moreOpen]);

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
            {[...NAV_PRIMARY, ...NAV_SECONDARY].map(({ href, label, Icon }) => (
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

      {/* menu "Mais" (celular): folha acima da barra inferior */}
      {moreOpen ? (
        // z-20 deixa a barra inferior (z-30) por cima: ela continua visivel e clicavel
        <div className="fixed inset-0 z-20 lg:hidden">
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={() => setMoreOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div
            className="absolute inset-x-0 rounded-t-2xl border-t border-line bg-surface p-3"
            style={{ bottom: "calc(env(safe-area-inset-bottom) + 3.5rem)" }}
          >
            <div className="mb-1 flex items-center justify-between px-2">
              <h2 className="text-sm font-semibold text-ink">Mais</h2>
              <IconButton label="Fechar menu" onClick={() => setMoreOpen(false)}>
                <IconX />
              </IconButton>
            </div>
            <ul className="flex flex-col gap-1">
              {NAV_SECONDARY.map(({ href, label, Icon }) => (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={isActive(href) ? "page" : undefined}
                    className={cx(
                      "flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
                      isActive(href)
                        ? "bg-surface-2 text-ink"
                        : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                    )}
                  >
                    <Icon />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {/* navegacao inferior (celular) */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Navegação principal"
      >
        <ul className="mx-auto flex max-w-lg">
          {NAV_PRIMARY.map(({ href, label, Icon }) => (
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
          <li className="flex-1">
            <button
              type="button"
              onClick={() => setMoreOpen((open) => !open)}
              aria-expanded={moreOpen}
              className={cx(
                "flex min-h-14 w-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors",
                inMore || moreOpen ? "text-accent" : "text-ink-2",
              )}
            >
              <IconMore />
              Mais
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
}
