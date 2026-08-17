// src/components/ProgressBar.tsx

/**
 * A determinate bar when we know how far along we are, and a sliding one when
 * we don't. `value` is 0–1, or null for "still working, no idea how long" —
 * which is the honest state while the model reads the image over the network.
 */
export default function ProgressBar({ value, label }: { value: number | null; label?: string }) {
  const percent = value === null ? null : Math.round(Math.min(1, Math.max(0, value)) * 100);

  return (
    <div
      role="progressbar"
      aria-label={label ?? 'Loading'}
      // Omitting the value attributes entirely is what marks a progressbar as
      // indeterminate to assistive tech; passing 0 would announce "0%" forever.
      {...(percent === null
        ? {}
        : { 'aria-valuenow': percent, 'aria-valuemin': 0, 'aria-valuemax': 100 })}
      className="h-2 w-full overflow-hidden rounded-full bg-slate-200"
    >
      {percent === null ? (
        <div className="h-full w-1/3 rounded-full bg-slate-900 motion-safe:animate-progress-slide" />
      ) : (
        <div
          className="h-full rounded-full bg-slate-900 transition-[width] duration-300 ease-out"
          style={{ width: `${percent}%` }}
        />
      )}
    </div>
  );
}
