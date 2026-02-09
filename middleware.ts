import { NextResponse } from "next/server";
import { clerkMiddleware } from "@clerk/nextjs/server";

const isDev = process.env.NODE_ENV !== "production";

function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

export default clerkMiddleware((_auth, request) => {
  if (isDev) {
    return NextResponse.next();
  }

  const nonce = createNonce();
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    "https://*.clerk.com",
    "https://*.clerk.accounts.dev",
  ];

  const contentSecurityPolicy = [
    "default-src 'self'",
    `script-src ${scriptSrc.join(" ")}`,
    "worker-src 'self' blob:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https://*.clerk.com https://*.clerk.accounts.dev https://clerk-telemetry.com https://*.convex.cloud wss://*.convex.cloud https://api.openrouter.ai https://api.anthropic.com https://api.openai.com https://generativelanguage.googleapis.com https://*.ingest.sentry.io https://*.ingest.de.sentry.io",
    "frame-src 'self' https://*.clerk.com https://*.clerk.accounts.dev",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    "upgrade-insecure-requests",
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  response.headers.set("Content-Security-Policy", contentSecurityPolicy);

  return response;
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
