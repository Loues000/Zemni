import AppClient from "./components/app-client";

// Prevent static generation - uses Clerk for authentication
export const dynamic = 'force-dynamic';

/**
 * Renders the application's client-side root component.
 *
 * @returns The JSX element that mounts the `AppClient` component.
 */
export default function Page() {
  return <AppClient />;
}