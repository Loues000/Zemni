import AppClient from "./components/app-client";

// Prevent static generation - uses Clerk for authentication
export const dynamic = 'force-dynamic';

/**
 * Render the main application shell.
 */
export default function Page() {
  return <AppClient />;
}
