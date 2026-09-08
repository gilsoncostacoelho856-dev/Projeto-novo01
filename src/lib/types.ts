/** Modelos compartilhados pelos dois back-ends (Supabase e modo demonstracao). */

export type AuthUser = {
  id: string;
  email: string;
};

export type Category = {
  id: string;
  name: string;
  /** Slot da paleta categorica: 0..7, atribuido em ordem fixa (nunca ciclado). */
  colorIndex: number;
};

export type Expense = {
  id: string;
  categoryId: string;
  /** Valor em reais, positivo. */
  amount: number;
  /** Data local no formato YYYY-MM-DD. */
  date: string;
  description: string;
};

export type Budget = {
  categoryId: string;
  /** Mes de referencia no formato YYYY-MM. */
  month: string;
  /** Limite mensal em reais. */
  limitAmount: number;
};

export type ExpenseInput = {
  categoryId: string;
  amount: number;
  date: string;
  description: string;
};

/** Uma fonte de renda de um mes (salario, freela, aluguel recebido...). */
export type Income = {
  id: string;
  /** Nome da fonte, ex.: "Salário". */
  source: string;
  /** Valor em reais, positivo. */
  amount: number;
  /** Mes de referencia no formato YYYY-MM. */
  month: string;
};

export type IncomeInput = {
  source: string;
  amount: number;
  month: string;
};

/** Valor que alguem te deve. Nao entra no calculo da sobra do mes. */
export type Receivable = {
  id: string;
  /** Nome de quem deve. */
  person: string;
  /** Valor em reais, positivo. */
  amount: number;
  /** Data local no formato YYYY-MM-DD (quando emprestou ou combinou receber). */
  date: string;
  description: string;
  /** Data YYYY-MM-DD do pagamento, ou null enquanto estiver pendente. */
  receivedAt: string | null;
};

export type ReceivableInput = {
  person: string;
  amount: number;
  date: string;
  description: string;
};

/** Erro com mensagem ja em portugues, pronta para exibir ao usuario. */
export class AppError extends Error {}

export interface DataAdapter {
  readonly mode: "supabase" | "demo";

  getUser(): Promise<AuthUser | null>;
  signIn(email: string, password: string): Promise<AuthUser>;
  /** Retorna `needsConfirmation` quando o Supabase exige confirmacao por e-mail. */
  signUp(
    email: string,
    password: string,
  ): Promise<{ user: AuthUser | null; needsConfirmation: boolean }>;
  signOut(): Promise<void>;

  listCategories(): Promise<Category[]>;
  createCategory(name: string, colorIndex: number): Promise<Category>;
  updateCategory(
    id: string,
    patch: { name?: string; colorIndex?: number },
  ): Promise<void>;
  /** Move os gastos para `moveTo` (quando houver) e remove a categoria. */
  deleteCategory(id: string, moveTo: string | null): Promise<void>;

  /** Gastos de um mes YYYY-MM, do mais recente para o mais antigo. */
  listExpenses(month: string): Promise<Expense[]>;
  createExpense(input: ExpenseInput): Promise<Expense>;
  updateExpense(id: string, input: ExpenseInput): Promise<void>;
  deleteExpense(id: string): Promise<void>;

  listBudgets(month: string): Promise<Budget[]>;
  /** Grava o limite; `limitAmount <= 0` remove o orcamento da categoria. */
  setBudget(categoryId: string, month: string, limitAmount: number): Promise<void>;

  /** Fontes de renda de um mes YYYY-MM, da maior para a menor. */
  listIncomes(month: string): Promise<Income[]>;
  createIncome(input: IncomeInput): Promise<Income>;
  updateIncome(id: string, input: IncomeInput): Promise<void>;
  deleteIncome(id: string): Promise<void>;

  /** Todos os valores a receber, pendentes primeiro. */
  listReceivables(): Promise<Receivable[]>;
  createReceivable(input: ReceivableInput): Promise<Receivable>;
  updateReceivable(id: string, input: ReceivableInput): Promise<void>;
  /** `receivedAt` null volta o lancamento para pendente. */
  setReceivableReceived(id: string, receivedAt: string | null): Promise<void>;
  deleteReceivable(id: string): Promise<void>;
}

export const DEFAULT_CATEGORIES: { name: string; colorIndex: number }[] = [
  { name: "Alimentação", colorIndex: 0 },
  { name: "Transporte", colorIndex: 1 },
  { name: "Moradia", colorIndex: 2 },
  { name: "Lazer", colorIndex: 3 },
  { name: "Saúde", colorIndex: 4 },
  { name: "Educação", colorIndex: 5 },
  { name: "Outros", colorIndex: 6 },
];
