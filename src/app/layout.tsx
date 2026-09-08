import type { Metadata, Viewport } from "next";
import "./globals.css";
import { themeScript } from "@/lib/theme-script";
import { ThemeProvider } from "@/lib/theme";
import { FinanceProvider } from "@/lib/finance-context";

export const metadata: Metadata = {
  title: "Minhas Finanças",
  description:
    "Controle financeiro pessoal: registre gastos, defina limites por categoria e acompanhe o mês.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f9f9f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0d0d" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        {/* aplica o tema salvo antes da primeira pintura */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased">
        <ThemeProvider>
          <FinanceProvider>{children}</FinanceProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
