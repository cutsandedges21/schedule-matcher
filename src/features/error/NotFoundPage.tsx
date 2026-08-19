// src/features/error/NotFoundPage.tsx
import ErrorPage from '@/components/ErrorPage';

/**
 * The catch-all route in App.tsx. Rendered outside RequireAuth — a broken or
 * mistyped link shouldn't force a sign-in before saying so.
 */
export default function NotFoundPage() {
  return (
    <ErrorPage
      title="Page not found"
      body="That link doesn't lead anywhere in Schedule Matcher. Double-check it, or head home."
    />
  );
}
