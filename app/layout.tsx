import * as Sentry from "@sentry/nextjs";
import type { Metadata } from "next";
import { Bricolage_Grotesque, IBM_Plex_Sans } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import "katex/dist/katex.min.css";
import ConvexClientProvider from "@/lib/convex-client-provider";
import { UserSync } from "@/components/auth/UserSync";
import { SentryErrorBoundary } from "@/components/ui";
import { Toaster } from "sonner";


const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display"
});

const body = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-body"
});

export function generateMetadata(): Metadata {
  return {
    title: "Zemni",
    description: "Summaries, flashcards and quizzes from PDFs/Markdown",
    other: {
      ...Sentry.getTraceData()
    }
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const isClerkConfigured = clerkKey && 
    clerkKey.startsWith("pk_") && 
    !clerkKey.includes("YOUR_CLERK_PUBLISHABLE_KEY");

  return (
    <html lang="en" className={`${display.variable} ${body.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Script id="theme-init" strategy="beforeInteractive">
          {`(function() {
            try {
              const saved = localStorage.getItem('theme');
              const theme = saved === 'dark' || saved === 'light'
                ? saved
                : window.matchMedia('(prefers-color-scheme: dark)').matches
                  ? 'dark'
                  : 'light';
              document.documentElement.setAttribute('data-theme', theme);
            } catch (e) {}
          })();`}
        </Script>
        <ConvexClientProvider>
          {isClerkConfigured && <UserSync />}
          <SentryErrorBoundary>{children}</SentryErrorBoundary>
          <Toaster 
            position="top-right" 
            richColors 
            closeButton
            duration={5000}
          />
        </ConvexClientProvider>
      </body>
    </html>
  );
}
