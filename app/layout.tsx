import type { Metadata } from "next";
import { Bricolage_Grotesque, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import "katex/dist/katex.min.css";
import ConvexClientProvider from "@/lib/convex-client-provider";
import { UserSync } from "@/components/auth/UserSync";

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
  // Only include UserSync if Clerk is configured
  const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const isClerkConfigured = clerkKey && 
    clerkKey.startsWith("pk_") && 
    !clerkKey.includes("YOUR_CLERK_PUBLISHABLE_KEY");

  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body suppressHydrationWarning>
        <ConvexClientProvider>
          {isClerkConfigured && <UserSync />}
          {children}
        </ConvexClientProvider>
      </body>
    </html>
  );
}
