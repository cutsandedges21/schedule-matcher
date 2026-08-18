// src/components/BackButton.tsx
import { useNavigate } from 'react-router-dom';
import Button from './Button';

/**
 * Prefers real browser history over the fixed `to` route: react-router
 * stamps `history.state.idx` on every in-app navigation, so `idx > 0` means
 * this page was actually reached by clicking through the app (e.g. Compare
 * opened from a friend's card, or from the group picker) and going back
 * lands wherever that was. A shared link opened fresh has no such history,
 * so `idx` is 0 and `to` is used instead.
 */
export default function BackButton({ to, label = '← Back' }: { to: string; label?: string }) {
  const navigate = useNavigate();

  function handleClick() {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate(to);
  }

  return (
    <Button variant="ghost" onClick={handleClick} aria-label="Go back" className="-ml-3 px-3">
      {label}
    </Button>
  );
}
