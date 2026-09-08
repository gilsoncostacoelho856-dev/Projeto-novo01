"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { errorMessage, useFinance } from "@/lib/finance-context";
import { DEMO_EMAIL, DEMO_PASSWORD } from "@/lib/data/demo";
import { useTheme } from "@/lib/theme";
import { Alert, Button, Field, IconButton, Input } from "@/components/ui";
import { IconMoon, IconSun, IconWallet } from "@/components/icons";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const { user, authReady, signIn, signUp, mode: backend } = useFinance();
  const { theme, toggle } = useTheme();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (authReady && user) router.replace("/dashboard");
  }, [authReady, user, router]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const nextErrors: typeof errors = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      nextErrors.email = "Informe um e-mail válido.";
    }
    if (password.length < 6) {
      nextErrors.password = "A senha precisa ter pelo menos 6 caracteres.";
    }
    setErrors(nextErrors);
    setFormError(null);
    setNotice(null);
    if (Object.keys(nextErrors).length > 0) return;

    setBusy(true);
    try {
      if (mode === "signin") {
        await signIn(email, password);
        router.replace("/dashboard");
      } else {
        const { needsConfirmation } = await signUp(email, password);
        if (needsConfirmation) {
          setMode("signin");
          setNotice(
            "Conta criada! Confirme o e-mail que enviamos e depois entre com sua senha.",
          );
        } else {
          router.replace("/dashboard");
        }
      }
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function enterDemo() {
    setBusy(true);
    setFormError(null);
    try {
      await signIn(DEMO_EMAIL, DEMO_PASSWORD);
      router.replace("/dashboard");
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col px-4 py-6">
      <div className="flex justify-end">
        <IconButton
          label={theme === "dark" ? "Usar tema claro" : "Usar tema escuro"}
          onClick={toggle}
        >
          {theme === "dark" ? <IconSun /> : <IconMoon />}
        </IconButton>
      </div>

      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center">
        <div className="mb-6 text-center">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-white">
            <IconWallet className="h-7 w-7" />
          </span>
          <h1 className="text-2xl font-semibold text-ink">Minhas Finanças</h1>
          <p className="mt-1 text-sm text-ink-2">
            Seus gastos e limites do mês, num lugar só.
          </p>
        </div>

        <form
          onSubmit={submit}
          noValidate
          className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:p-5"
        >
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1">
            {(
              [
                ["signin", "Entrar"],
                ["signup", "Criar conta"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setMode(value);
                  setFormError(null);
                  setErrors({});
                }}
                aria-pressed={mode === value}
                className={
                  "min-h-10 rounded-lg text-sm font-medium transition-colors " +
                  (mode === value
                    ? "bg-surface text-ink shadow-sm"
                    : "text-ink-2 hover:text-ink")
                }
              >
                {label}
              </button>
            ))}
          </div>

          {formError ? <Alert tone="critical">{formError}</Alert> : null}
          {notice ? <Alert tone="good">{notice}</Alert> : null}

          <Field label="E-mail" htmlFor="email" error={errors.email}>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="voce@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>

          <Field
            label="Senha"
            htmlFor="password"
            error={errors.password}
            hint={mode === "signup" ? "Mínimo de 6 caracteres." : undefined}
          >
            <Input
              id="password"
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>

          <Button type="submit" block disabled={busy}>
            {busy ? "Aguarde…" : mode === "signin" ? "Entrar" : "Criar conta"}
          </Button>
        </form>

        {backend === "demo" ? (
          <div className="mt-4">
            <Alert tone="info" title="Modo demonstração">
              O Supabase ainda não foi configurado, então os dados ficam guardados neste
              navegador. Veja <code>SETUP.md</code> para ligar o banco de verdade.
              <Button
                variant="secondary"
                size="sm"
                block
                className="mt-3"
                onClick={() => void enterDemo()}
                disabled={busy}
              >
                Entrar com a conta de exemplo
              </Button>
            </Alert>
          </div>
        ) : null}
      </div>
    </div>
  );
}
