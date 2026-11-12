import type { Metadata } from "next";
import { Geologica, Onest } from "next/font/google";
import { Providers } from "@/components/Providers";
import { getDict, getTheme } from "@/lib/i18n/server";
import "./globals.css";

// cyrillic-ext — для таджикских букв ҳ ҷ ӣ ӯ қ ғ
const onest = Onest({
  variable: "--font-onest",
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
  weight: ["400", "500", "600", "700"],
});

// Заголовки. В PRD был Unbounded, но в нём нет таджикских букв (проверено по cmap),
// поэтому Geologica: тоже широкий и с характером, полная поддержка ҳ ҷ ӣ ӯ қ ғ.
// Ось SHRP («острота») даёт срезанные углы — фирменная деталь заголовков.
const geologica = Geologica({
  variable: "--font-geologica",
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
  axes: ["SHRP"],
});

export const metadata: Metadata = {
  title: "Роҳат — система ресторана",
  description: "Заказы, склад, персонал и отчёты ресторана",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [{ locale, t }, theme] = await Promise.all([getDict(), getTheme()]);
  return (
    <html lang={locale === "tg" ? "tg" : "ru"} data-theme={theme} className={`${onest.variable} ${geologica.variable} h-full`}>
      <body className="min-h-full">
        <Providers locale={locale} t={t}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
