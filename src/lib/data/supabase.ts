/** Back-end Supabase: autenticacao por e-mail/senha e tabelas protegidas por RLS.
 *  O esquema esperado esta em `supabase/schema.sql`. */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  AppError,
  type AuthUser,
  type Budget,
  type Category,
  type DataAdapter,
  type Expense,
  type ExpenseInput,
} from "@/lib/types";
import { monthRange, roundCents } from "@/lib/format";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function isSupabaseConfigured(): boolean {
  return Boolean(url && anonKey && !url.includes("SEU-PROJETO"));
}

let client: SupabaseClient | null = null;

function db(): SupabaseClient {
  if (!client) {
    if (!isSupabaseConfigured()) {
      throw new AppError("Supabase não configurado.");
    }
    client = createClient(url!, anonKey!, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
  return client;
}

/** Traduz as mensagens mais comuns do Supabase para portugues. */
function translate(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (m.includes("email not confirmed")) {
    return "Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.";
  }
  if (m.includes("user already registered") || m.includes("already been registered")) {
    return "Já existe uma conta com este e-mail.";
  }
  if (m.includes("password should be at least")) {
    return "A senha precisa ter pelo menos 6 caracteres.";
  }
  if (m.includes("unable to validate email")) return "E-mail inválido.";
  if (m.includes("rate limit") || m.includes("too many requests")) {
    return "Muitas tentativas. Aguarde um minuto e tente de novo.";
  }
  if (m.includes("duplicate key") && m.includes("categories")) {
    return "Você já tem uma categoria com esse nome.";
  }
  if (m.includes("violates foreign key") || m.includes("still referenced")) {
    return "Existem gastos usando esta categoria. Escolha para onde movê-los.";
  }
  if (m.includes("failed to fetch") || m.includes("networkerror")) {
    return "Sem conexão com o servidor. Verifique sua internet.";
  }
  if (m.includes("relation") && m.includes("does not exist")) {
    return "As tabelas ainda não foram criadas no Supabase. Rode o SQL de supabase/schema.sql.";
  }
  return message;
}

function fail(error: { message: string }): never {
  throw new AppError(translate(error.message));
}

async function currentUserId(): Promise<string> {
  const { data } = await db().auth.getUser();
  if (!data.user) throw new AppError("Sessão expirada. Entre novamente.");
  return data.user.id;
}

type CategoryRow = { id: string; name: string; color_index: number };
type ExpenseRow = {
  id: string;
  category_id: string;
  amount: string | number;
  date: string;
  description: string | null;
};
type BudgetRow = { category_id: string; month: string; limit_amount: string | number };

const toCategory = (r: CategoryRow): Category => ({
  id: r.id,
  name: r.name,
  colorIndex: r.color_index,
});

const toExpense = (r: ExpenseRow): Expense => ({
  id: r.id,
  categoryId: r.category_id,
  amount: Number(r.amount),
  date: r.date,
  description: r.description ?? "",
});

export const supabaseAdapter: DataAdapter = {
  mode: "supabase",

  async getUser(): Promise<AuthUser | null> {
    const { data } = await db().auth.getUser();
    return data.user ? { id: data.user.id, email: data.user.email ?? "" } : null;
  },

  async signIn(email, password) {
    const { data, error } = await db().auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) fail(error);
    return { id: data.user!.id, email: data.user!.email ?? "" };
  },

  async signUp(email, password) {
    const { data, error } = await db().auth.signUp({ email: email.trim(), password });
    if (error) fail(error);
    // Sem sessao = o projeto exige confirmacao por e-mail.
    if (!data.session) return { user: null, needsConfirmation: true };
    return {
      user: { id: data.user!.id, email: data.user!.email ?? "" },
      needsConfirmation: false,
    };
  },

  async signOut() {
    await db().auth.signOut();
  },

  async listCategories() {
    const { data, error } = await db()
      .from("categories")
      .select("id, name, color_index")
      .order("name");
    if (error) fail(error);
    return (data as CategoryRow[]).map(toCategory);
  },

  async createCategory(name, colorIndex) {
    const userId = await currentUserId();
    const { data, error } = await db()
      .from("categories")
      .insert({ user_id: userId, name, color_index: colorIndex })
      .select("id, name, color_index")
      .single();
    if (error) fail(error);
    return toCategory(data as CategoryRow);
  },

  async updateCategory(id, patch) {
    const row: Record<string, unknown> = {};
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.colorIndex !== undefined) row.color_index = patch.colorIndex;
    const { error } = await db().from("categories").update(row).eq("id", id);
    if (error) fail(error);
  },

  async deleteCategory(id, moveTo) {
    if (moveTo) {
      const { error: moveError } = await db()
        .from("expenses")
        .update({ category_id: moveTo })
        .eq("category_id", id);
      if (moveError) fail(moveError);
    }
    const { error } = await db().from("categories").delete().eq("id", id);
    if (error) fail(error);
  },

  async listExpenses(month) {
    const { start, end } = monthRange(month);
    const { data, error } = await db()
      .from("expenses")
      .select("id, category_id, amount, date, description")
      .gte("date", start)
      .lte("date", end)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) fail(error);
    return (data as ExpenseRow[]).map(toExpense);
  },

  async createExpense(input: ExpenseInput) {
    const userId = await currentUserId();
    const { data, error } = await db()
      .from("expenses")
      .insert({
        user_id: userId,
        category_id: input.categoryId,
        amount: roundCents(input.amount),
        date: input.date,
        description: input.description,
      })
      .select("id, category_id, amount, date, description")
      .single();
    if (error) fail(error);
    return toExpense(data as ExpenseRow);
  },

  async updateExpense(id, input) {
    const { error } = await db()
      .from("expenses")
      .update({
        category_id: input.categoryId,
        amount: roundCents(input.amount),
        date: input.date,
        description: input.description,
      })
      .eq("id", id);
    if (error) fail(error);
  },

  async deleteExpense(id) {
    const { error } = await db().from("expenses").delete().eq("id", id);
    if (error) fail(error);
  },

  async listBudgets(month) {
    const { data, error } = await db()
      .from("budgets")
      .select("category_id, month, limit_amount")
      .eq("month", `${month}-01`);
    if (error) fail(error);
    return (data as BudgetRow[]).map(
      (r): Budget => ({
        categoryId: r.category_id,
        month: r.month.slice(0, 7),
        limitAmount: Number(r.limit_amount),
      }),
    );
  },

  async setBudget(categoryId, month, limitAmount) {
    const userId = await currentUserId();
    const monthDate = `${month}-01`;
    if (limitAmount > 0) {
      const { error } = await db().from("budgets").upsert(
        {
          user_id: userId,
          category_id: categoryId,
          month: monthDate,
          limit_amount: roundCents(limitAmount),
        },
        { onConflict: "user_id,category_id,month" },
      );
      if (error) fail(error);
      return;
    }
    const { error } = await db()
      .from("budgets")
      .delete()
      .eq("category_id", categoryId)
      .eq("month", monthDate);
    if (error) fail(error);
  },
};

/** Reemite o callback quando o Supabase troca ou expira a sessao. */
export function onAuthChange(callback: (user: AuthUser | null) => void): () => void {
  const { data } = db().auth.onAuthStateChange((_event, session) => {
    callback(
      session?.user ? { id: session.user.id, email: session.user.email ?? "" } : null,
    );
  });
  return () => data.subscription.unsubscribe();
}
