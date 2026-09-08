"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useFinance } from "@/lib/finance-context";
import { AppShell } from "@/components/AppShell";
import { IconWallet } from "@/components/icons";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, authReady } = useFinance();
  const router = useRouter();

  useEffect(() => {
    if (authReady && !user) router.replace("/login");
  }, [authReady, user, router]);

  if (!authReady || !user) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <span className="flex items-center gap-2 text-ink-2">
          <IconWallet className="h-6 w-6 animate-pulse" />
          Carregando…
        </span>
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}
