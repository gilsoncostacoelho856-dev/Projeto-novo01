/** Back-end do MODO DEMONSTRACAO: tudo vive no localStorage do navegador.
 *
 *  Serve para rodar o app sem nenhuma configuracao. NAO e seguro nem
 *  sincroniza entre dispositivos: a senha e guardada em texto puro no proprio
 *  navegador e qualquer script da pagina consegue le-la. Para uso real,
 *  configure o Supabase (veja SETUP.md).
 */

import {
  AppError,
  DEFAULT_CATEGORIES,
  type AuthUser,
  type Budget,
  type Category,
  type DataAdapter,
  type Expense,
  type ExpenseInput,
  type Income,
  type IncomeInput,
  type Receivable,
  type ReceivableInput,
} from "@/lib/types";
import { addMonths, currentMonth, monthOf, roundCents, toISODate } from "@/lib/format";

const STORE_KEY = "financas:demo:v1";
const SESSION_KEY = "financas:demo:session";

export const DEMO_EMAIL = "demo@financas.app";
export const DEMO_PASSWORD = "demo1234";

type DemoUser = { id: string; email: string; password: string };

type Store = {
  users: DemoUser[];
  categories: Record<string, Category[]>;
  expenses: Record<string, Expense[]>;
  budgets: Record<string, Budget[]>;
  incomes: Record<string, Income[]>;
  receivables: Record<string, Receivable[]>;
};

function uid(): string {
  return globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function emptyStore(): Store {
  return {
    users: [],
    categories: {},
    expenses: {},
    budgets: {},
    incomes: {},
    receivables: {},
  };
}

function readStore(): Store {
  if (typeof window === "undefined") return emptyStore();
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return seedStore();
    const parsed = JSON.parse(raw) as Store;
    if (!parsed || !Array.isArray(parsed.users)) return seedStore();
    // Um store gravado por uma versao anterior nao tem as colecoes novas.
    return { ...emptyStore(), ...parsed };
  } catch {
    return emptyStore();
  }
}

function writeStore(store: Store): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    throw new AppError(
      "Não foi possível salvar no navegador. Verifique se o armazenamento local está habilitado.",
    );
  }
}

/** Cria a conta de demonstracao com dois meses de dados plausiveis. */
function seedStore(): Store {
  const store = emptyStore();
  const user: DemoUser = { id: uid(), email: DEMO_EMAIL, password: DEMO_PASSWORD };
  store.users.push(user);

  const categories: Category[] = DEFAULT_CATEGORIES.map((c) => ({
    id: uid(),
    name: c.name,
    colorIndex: c.colorIndex,
  }));
  store.categories[user.id] = categories;

  const byName = (name: string) => categories.find((c) => c.name === name)!.id;
  const thisMonth = currentMonth();
  const lastMonth = addMonths(thisMonth, -1);

  const limits: Record<string, number> = {
    Alimentação: 900,
    Transporte: 400,
    Moradia: 1800,
    Lazer: 300,
    Saúde: 250,
    Educação: 200,
  };
  store.budgets[user.id] = [thisMonth, lastMonth].flatMap((month) =>
    Object.entries(limits).map(([name, limitAmount]) => ({
      categoryId: byName(name),
      month,
      limitAmount,
    })),
  );

  const templates: [string, string, number][] = [
    ["Alimentação", "Supermercado", 210.4],
    ["Alimentação", "Padaria", 28.9],
    ["Alimentação", "Almoço no trabalho", 39.5],
    ["Alimentação", "Delivery", 62.3],
    ["Transporte", "Combustível", 180],
    ["Transporte", "Aplicativo de corrida", 34.7],
    ["Moradia", "Aluguel", 1500],
    ["Moradia", "Conta de luz", 143.2],
    ["Moradia", "Internet", 99.9],
    ["Lazer", "Streaming", 39.9],
    ["Lazer", "Cinema", 68],
    ["Saúde", "Farmácia", 87.6],
    ["Educação", "Curso online", 120],
  ];

  const expenses: Expense[] = [];
  for (const month of [lastMonth, thisMonth]) {
    const [y, m] = month.split("-").map(Number);
    const isCurrent = month === thisMonth;
    const lastDay = isCurrent ? Number(toISODate(new Date()).slice(8, 10)) : 28;
    templates.forEach(([categoryName, description, base], i) => {
      const day = Math.min(lastDay, 2 + ((i * 5) % 26));
      const jitter = isCurrent ? 1 : 0.9;
      expenses.push({
        id: uid(),
        categoryId: byName(categoryName),
        amount: roundCents(base * jitter),
        date: toISODate(new Date(y, m - 1, day)),
        description,
      });
    });
  }
  store.expenses[user.id] = expenses;

  store.incomes[user.id] = [thisMonth, lastMonth].flatMap((month) => [
    { id: uid(), source: "Salário", amount: 4200, month },
    { id: uid(), source: "Freela", amount: 950, month },
  ]);

  const [cy, cm] = thisMonth.split("-").map(Number);
  store.receivables[user.id] = [
    {
      id: uid(),
      person: "Marina",
      amount: 120,
      date: toISODate(new Date(cy, cm - 1, Math.min(5, Number(toISODate(new Date()).slice(8, 10))))),
      description: "Rachar o jantar",
      receivedAt: null,
    },
    {
      id: uid(),
      person: "Rafael",
      amount: 300,
      date: toISODate(new Date(cy, cm - 2, 18)),
      description: "Empréstimo",
      receivedAt: null,
    },
  ];

  writeStore(store);
  return store;
}

function readSession(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

function requireUserId(): string {
  const id = readSession();
  if (!id) throw new AppError("Sessão expirada. Entre novamente.");
  return id;
}

function sortExpenses(list: Expense[]): Expense[] {
  return [...list].sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1));
}

/** Pendentes primeiro; dentro de cada grupo, do mais recente para o mais antigo. */
function sortReceivables(list: Receivable[]): Receivable[] {
  return [...list].sort((a, b) => {
    const pendingA = a.receivedAt === null;
    const pendingB = b.receivedAt === null;
    if (pendingA !== pendingB) return pendingA ? -1 : 1;
    return a.date === b.date ? 0 : a.date < b.date ? 1 : -1;
  });
}

export const demoAdapter: DataAdapter = {
  mode: "demo",

  async getUser() {
    const id = readSession();
    if (!id) return null;
    const user = readStore().users.find((u) => u.id === id);
    return user ? { id: user.id, email: user.email } : null;
  },

  async signIn(email, password) {
    const store = readStore();
    const user = store.users.find(
      (u) => u.email.toLowerCase() === email.trim().toLowerCase(),
    );
    if (!user || user.password !== password) {
      throw new AppError("E-mail ou senha incorretos.");
    }
    window.localStorage.setItem(SESSION_KEY, user.id);
    return { id: user.id, email: user.email };
  },

  async signUp(email, password) {
    const store = readStore();
    const normalized = email.trim().toLowerCase();
    if (store.users.some((u) => u.email.toLowerCase() === normalized)) {
      throw new AppError("Já existe uma conta com este e-mail.");
    }
    const user: DemoUser = { id: uid(), email: normalized, password };
    store.users.push(user);
    store.categories[user.id] = DEFAULT_CATEGORIES.map((c) => ({
      id: uid(),
      name: c.name,
      colorIndex: c.colorIndex,
    }));
    store.expenses[user.id] = [];
    store.budgets[user.id] = [];
    store.incomes[user.id] = [];
    store.receivables[user.id] = [];
    writeStore(store);
    window.localStorage.setItem(SESSION_KEY, user.id);
    return { user: { id: user.id, email: user.email }, needsConfirmation: false };
  },

  async signOut() {
    window.localStorage.removeItem(SESSION_KEY);
  },

  async listCategories() {
    const userId = requireUserId();
    const list = readStore().categories[userId] ?? [];
    return [...list].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  },

  async createCategory(name, colorIndex) {
    const userId = requireUserId();
    const store = readStore();
    const list = store.categories[userId] ?? [];
    if (list.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      throw new AppError("Você já tem uma categoria com esse nome.");
    }
    const category: Category = { id: uid(), name, colorIndex };
    store.categories[userId] = [...list, category];
    writeStore(store);
    return category;
  },

  async updateCategory(id, patch) {
    const userId = requireUserId();
    const store = readStore();
    const list = store.categories[userId] ?? [];
    if (
      patch.name &&
      list.some((c) => c.id !== id && c.name.toLowerCase() === patch.name!.toLowerCase())
    ) {
      throw new AppError("Você já tem uma categoria com esse nome.");
    }
    store.categories[userId] = list.map((c) => (c.id === id ? { ...c, ...patch } : c));
    writeStore(store);
  },

  async deleteCategory(id, moveTo) {
    const userId = requireUserId();
    const store = readStore();
    const expenses = store.expenses[userId] ?? [];
    if (moveTo) {
      store.expenses[userId] = expenses.map((e) =>
        e.categoryId === id ? { ...e, categoryId: moveTo } : e,
      );
    } else if (expenses.some((e) => e.categoryId === id)) {
      throw new AppError("Escolha para onde mover os gastos desta categoria.");
    }
    store.categories[userId] = (store.categories[userId] ?? []).filter((c) => c.id !== id);
    store.budgets[userId] = (store.budgets[userId] ?? []).filter(
      (b) => b.categoryId !== id,
    );
    writeStore(store);
  },

  async listExpenses(month) {
    const userId = requireUserId();
    const list = (readStore().expenses[userId] ?? []).filter(
      (e) => monthOf(e.date) === month,
    );
    return sortExpenses(list);
  },

  async createExpense(input) {
    const userId = requireUserId();
    const store = readStore();
    const expense: Expense = { id: uid(), ...input, amount: roundCents(input.amount) };
    store.expenses[userId] = [...(store.expenses[userId] ?? []), expense];
    writeStore(store);
    return expense;
  },

  async updateExpense(id, input) {
    const userId = requireUserId();
    const store = readStore();
    store.expenses[userId] = (store.expenses[userId] ?? []).map((e) =>
      e.id === id ? { ...e, ...input, amount: roundCents(input.amount) } : e,
    );
    writeStore(store);
  },

  async deleteExpense(id) {
    const userId = requireUserId();
    const store = readStore();
    store.expenses[userId] = (store.expenses[userId] ?? []).filter((e) => e.id !== id);
    writeStore(store);
  },

  async listBudgets(month) {
    const userId = requireUserId();
    return (readStore().budgets[userId] ?? []).filter((b) => b.month === month);
  },

  async setBudget(categoryId, month, limitAmount) {
    const userId = requireUserId();
    const store = readStore();
    const list = (store.budgets[userId] ?? []).filter(
      (b) => !(b.categoryId === categoryId && b.month === month),
    );
    if (limitAmount > 0) {
      list.push({ categoryId, month, limitAmount: roundCents(limitAmount) });
    }
    store.budgets[userId] = list;
    writeStore(store);
  },

  async listIncomes(month) {
    const userId = requireUserId();
    return (readStore().incomes[userId] ?? [])
      .filter((i) => i.month === month)
      .sort((a, b) => b.amount - a.amount);
  },

  async createIncome(input: IncomeInput) {
    const userId = requireUserId();
    const store = readStore();
    const income: Income = { id: uid(), ...input, amount: roundCents(input.amount) };
    store.incomes[userId] = [...(store.incomes[userId] ?? []), income];
    writeStore(store);
    return income;
  },

  async updateIncome(id, input) {
    const userId = requireUserId();
    const store = readStore();
    store.incomes[userId] = (store.incomes[userId] ?? []).map((i) =>
      i.id === id ? { ...i, ...input, amount: roundCents(input.amount) } : i,
    );
    writeStore(store);
  },

  async deleteIncome(id) {
    const userId = requireUserId();
    const store = readStore();
    store.incomes[userId] = (store.incomes[userId] ?? []).filter((i) => i.id !== id);
    writeStore(store);
  },

  async listReceivables() {
    const userId = requireUserId();
    return sortReceivables(readStore().receivables[userId] ?? []);
  },

  async createReceivable(input: ReceivableInput) {
    const userId = requireUserId();
    const store = readStore();
    const receivable: Receivable = {
      id: uid(),
      ...input,
      amount: roundCents(input.amount),
      receivedAt: null,
    };
    store.receivables[userId] = [...(store.receivables[userId] ?? []), receivable];
    writeStore(store);
    return receivable;
  },

  async updateReceivable(id, input) {
    const userId = requireUserId();
    const store = readStore();
    store.receivables[userId] = (store.receivables[userId] ?? []).map((r) =>
      r.id === id ? { ...r, ...input, amount: roundCents(input.amount) } : r,
    );
    writeStore(store);
  },

  async setReceivableReceived(id, receivedAt) {
    const userId = requireUserId();
    const store = readStore();
    store.receivables[userId] = (store.receivables[userId] ?? []).map((r) =>
      r.id === id ? { ...r, receivedAt } : r,
    );
    writeStore(store);
  },

  async deleteReceivable(id) {
    const userId = requireUserId();
    const store = readStore();
    store.receivables[userId] = (store.receivables[userId] ?? []).filter(
      (r) => r.id !== id,
    );
    writeStore(store);
  },
};
