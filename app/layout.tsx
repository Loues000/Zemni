import type { Metadata } from "next";
import { Bricolage_Grotesque, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import "katex/dist/katex.min.css";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display"
});

const body = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-body"
});

export const metadata: Metadata = {
  title: "Zemni",
  description: "Summaries, flashcards and quizzes from PDFs/Markdown"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
