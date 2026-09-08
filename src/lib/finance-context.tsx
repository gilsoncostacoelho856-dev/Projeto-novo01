"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { getAdapter, isSupabaseConfigured } from "@/lib/data";
import { onAuthChange } from "@/lib/data/supabase";
import { addMonths, currentMonth } from "@/lib/format";
import { summarize, type MonthSummary } from "@/lib/derive";
import {
  AppError,
  type AuthUser,
  type Budget,
  type Category,
  type Expense,
  type ExpenseInput,
} from "@/lib/types";

export function errorMessage(err: unknown): string {
  if (err instanceof AppError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return "Algo deu errado. Tente novamente.";
}

type FinanceValue = {
  mode: "supabase" | "demo";
  user: AuthUser | null;
  /** false enquanto ainda nao sabemos se ha sessao (evita piscar o login). */
  authReady: boolean;

  month: string;
  setMonth: (month: string) => void;

  categories: Category[];
  expenses: Expense[];
  budgets: Budget[];
  /** Gastos do mes anterior, usados na variacao do painel. */
  previousTotal: number;
  summary: MonthSummary;

  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;

  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
  ) => Promise<{ needsConfirmation: boolean }>;
  signOut: () => Promise<void>;

  addExpense: (input: ExpenseInput) => Promise<void>;
  editExpense: (id: string, input: ExpenseInput) => Promise<void>;
  removeExpense: (id: string) => Promise<void>;

  saveBudget: (categoryId: string, limitAmount: number) => Promise<void>;
  copyBudgetsFromPreviousMonth: () => Promise<number>;

  addCategory: (name: string, colorIndex: number) => Promise<void>;
  editCategory: (
    id: string,
    patch: { name?: string; colorIndex?: number },
  ) => Promise<void>;
  removeCategory: (id: string, moveTo: string | null) => Promise<void>;
};

const FinanceContext = createContext<FinanceValue | null>(null);

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const adapter = useMemo(() => getAdapter(), []);

  const [user, setUser] = useState<AuthUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [month, setMonth] = useState<string>(() => currentMonth());

  const [categories, setCategories] = useState<Category[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [previousTotal, setPreviousTotal] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Descarta respostas de requisicoes antigas quando o mes muda rapido.
  const requestId = useRef(0);

  useEffect(() => {
    let active = true;
    adapter
      .getUser()
      .then((u) => active && setUser(u))
      .catch(() => active && setUser(null))
      .finally(() => active && setAuthReady(true));

    const unsubscribe = isSupabaseConfigured() ? onAuthChange(setUser) : undefined;
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [adapter]);

  const load = useCallback(async () => {
    if (!user) return;
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const [cats, exps, buds, prev] = await Promise.all([
        adapter.listCategories(),
        adapter.listExpenses(month),
        adapter.listBudgets(month),
        adapter.listExpenses(addMonths(month, -1)),
      ]);
      if (id !== requestId.current) return;
      setCategories(cats);
      setExpenses(exps);
      setBudgets(buds);
      setPreviousTotal(prev.reduce((sum, e) => sum + e.amount, 0));
    } catch (err) {
      if (id !== requestId.current) return;
      setError(errorMessage(err));
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [adapter, month, user]);

  useEffect(() => {
    if (!user) {
      setCategories([]);
      setExpenses([]);
      setBudgets([]);
      setPreviousTotal(0);
      setLoading(false);
      return;
    }
    void load();
  }, [user, load]);

  const summary = useMemo(
    () => summarize(month, categories, expenses, budgets),
    [month, categories, expenses, budgets],
  );

  const value: FinanceValue = {
    mode: adapter.mode,
    user,
    authReady,
    month,
    setMonth,
    categories,
    expenses,
    budgets,
    previousTotal,
    summary,
    loading,
    error,
    reload: load,

    signIn: async (email, password) => {
      setUser(await adapter.signIn(email, password));
    },
    signUp: async (email, password) => {
      const { user: created, needsConfirmation } = await adapter.signUp(email, password);
      if (created) setUser(created);
      return { needsConfirmation };
    },
    signOut: async () => {
      await adapter.signOut();
      setUser(null);
    },

    addExpense: async (input) => {
      await adapter.createExpense(input);
      await load();
    },
    editExpense: async (id, input) => {
      await adapter.updateExpense(id, input);
      await load();
    },
    removeExpense: async (id) => {
      await adapter.deleteExpense(id);
      await load();
    },

    saveBudget: async (categoryId, limitAmount) => {
      await adapter.setBudget(categoryId, month, limitAmount);
      await load();
    },
    copyBudgetsFromPreviousMonth: async () => {
      const previous = await adapter.listBudgets(addMonths(month, -1));
      const existing = new Set(budgets.map((b) => b.categoryId));
      const missing = previous.filter((b) => !existing.has(b.categoryId));
      for (const b of missing) {
        await adapter.setBudget(b.categoryId, month, b.limitAmount);
      }
      await load();
      return missing.length;
    },

    addCategory: async (name, colorIndex) => {
      await adapter.createCategory(name, colorIndex);
      await load();
    },
    editCategory: async (id, patch) => {
      await adapter.updateCategory(id, patch);
      await load();
    },
    removeCategory: async (id, moveTo) => {
      await adapter.deleteCategory(id, moveTo);
      await load();
    },
  };

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance(): FinanceValue {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error("useFinance precisa estar dentro de <FinanceProvider>.");
  return ctx;
}
