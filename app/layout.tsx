import * as Sentry from "@sentry/nextjs";
import type { Metadata } from "next";
import { Bricolage_Grotesque, IBM_Plex_Sans } from "next/font/google";
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

/**
 * Provide page metadata for the application.
 *
 * Includes the site title and description and embeds Sentry trace data in the `other` field.
 *
 * @returns A Metadata object with `title`, `description`, and an `other` field merged with Sentry trace data.
 */
export function generateMetadata(): Metadata {
  return {
    title: "Zemni",
    description: "Summaries, flashcards and quizzes from PDFs/Markdown",
    other: {
      ...Sentry.getTraceData()
    }
  };
}

/**
 * Application root layout that renders the global HTML structure and app-level providers.
 *
 * Initializes the page theme, applies global fonts, wraps content with client providers and an error boundary,
 * renders the notification Toaster, and conditionally includes user synchronization when Clerk is properly configured.
 *
 * @param children - The application content to render within the layout
 * @returns The root HTML element tree for the application
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Only include UserSync if Clerk is configured
  const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const isClerkConfigured = clerkKey && 
    clerkKey.startsWith("pk_") && 
    !clerkKey.includes("YOUR_CLERK_PUBLISHABLE_KEY");

  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body suppressHydrationWarning>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const saved = localStorage.getItem('theme');
                  const theme = saved === 'dark' || saved === 'light' 
                    ? saved 
                    : window.matchMedia('(prefers-color-scheme: dark)').matches 
                      ? 'dark' 
                      : 'light';
                  document.documentElement.setAttribute('data-theme', theme);
                } catch (e) {}
              })();
            `,
          }}
        />
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