// src/components/ErrorBoundary.tsx
import { Component, type ReactNode } from 'react';
import ErrorPage from './ErrorPage';
import { buttonClassName } from './Button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Catches render errors anywhere below it and swaps in ErrorPage instead of
 * the white screen React leaves behind otherwise. A home-screen PWA has no
 * browser chrome to fall back on, so an uncaught error is otherwise a dead
 * app with no visible way out.
 *
 * Must be a class component: `getDerivedStateFromError` /
 * `componentDidCatch` have no hook equivalent.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('Uncaught render error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorPage
          title="Something went wrong"
          body="The app hit an unexpected error. Your schedule and account are safe."
          extraAction={
            <button
              type="button"
              onClick={() => window.location.reload()}
              className={buttonClassName('secondary')}
            >
              Reload
            </button>
          }
        />
      );
    }

    return this.props.children;
  }
}
