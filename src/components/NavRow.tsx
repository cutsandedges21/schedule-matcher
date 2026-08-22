// src/components/NavRow.tsx
import { Link } from 'react-router-dom';

/**
 * One row in a grouped list: a label, a trailing glyph, and a whole-row tap
 * target. `to` navigates within the app; `href` is for an external site and
 * always opens in a new tab — `rel="noopener noreferrer"` is not optional
 * there, since without it the opened tab could reach back into
 * `window.opener`. The glyph tells the difference before a tap: `›` for
 * in-app, `↗` for leaving it. Exactly one of `to`/`href` must be given.
 */
export default function NavRow({
  to,
  href,
  label,
  description,
}: {
  to?: string;
  href?: string;
  label: string;
  description?: string;
}) {
  const className =
    'flex min-h-touch items-center justify-between gap-3 px-4 py-3 text-left active:bg-slate-100';

  const content = (
    <>
      <span className="flex flex-col">
        <span className="text-sm font-medium">{label}</span>
        {description && <span className="text-xs text-slate-500">{description}</span>}
      </span>
      <span aria-hidden className="shrink-0 text-slate-400">
        {href ? '↗' : '›'}
      </span>
    </>
  );

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {content}
      </a>
    );
  }

  if (!to) throw new Error('NavRow requires either `to` or `href`.');

  return (
    <Link to={to} className={className}>
      {content}
    </Link>
  );
}
