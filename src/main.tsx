import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { configError } from './lib/supabase';
// Side effect only: catches Chrome's `beforeinstallprompt` before it is lost,
// so onboarding can offer a real install button. Must run at startup — the
// event fires long before the onboarding screen mounts.
import './lib/installPrompt';
// Side effect only: registers window 'error' and 'unhandledrejection'
// listeners. Must run before React mounts, so a crash during the very first
// render is still caught.
import './lib/errorLog';
import './index.css';

/**
 * Shown instead of the app when the build is missing its Supabase config.
 * A visible, actionable message beats a blank page and a console entry nobody
 * thinks to open.
 */
function ConfigError({ message }: { message: string }) {
  return (
    <main className="flex min-h-dvh flex-col justify-center gap-4 p-6">
      <h1 className="text-xl font-bold text-slate-900">Configuration problem</h1>
      <p className="text-sm leading-relaxed text-slate-700">{message}</p>
      <p className="text-xs text-slate-500">
        Nothing is wrong with your account — the app was deployed without its settings.
      </p>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {configError ? (
      <ConfigError message={configError} />
    ) : (
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    )}
  </StrictMode>
);
