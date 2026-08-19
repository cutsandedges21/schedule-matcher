// src/components/BackButton.tsx
import { useNavigate } from 'react-router-dom';
import Button from './Button';

/**
 * Always goes to the fixed parent route, never `navigate(-1)`. Browser
 * history depends on how the student got here — a few taps in, or straight
 * from a shared link — and back has to land in the same place either way, so
 * it is keyed to the page's logical parent instead of the tab's history.
 */
export default function BackButton({ to, label = '← Back' }: { to: string; label?: string }) {
  const navigate = useNavigate();

  return (
    <Button
      variant="ghost"
      onClick={() => navigate(to)}
      aria-label="Go back"
      className="-ml-3 px-3"
    >
      {label}
    </Button>
  );
}
