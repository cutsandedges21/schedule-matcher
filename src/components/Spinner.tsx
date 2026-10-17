/**
 * Full-screen by default — the original use, a whole page waiting on its data.
 * `inline` is for a section of a page that loads on its own (a tab inside a
 * Space, a dashboard card), where taking over the screen would hide the parts
 * that already arrived.
 */
export default function Spinner({ label, inline = false }: { label?: string; inline?: boolean }) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 ${inline ? 'py-12' : 'min-h-dvh'}`}
    >
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900"
        role="status"
        aria-label={label ?? 'Loading'}
      />
      {label && <p className="text-sm text-slate-500">{label}</p>}
    </div>
  );
}
